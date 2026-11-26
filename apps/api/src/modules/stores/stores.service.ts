import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Store } from '@prisma/client';
import {
  createDefaultWeeklyHours,
  normalizeCubanWhatsApp,
  validateStoreSlug,
  type CheckSlugResponse,
  type CreateStoreOnboardingInput,
  type CurrencyCode,
  type StoreSummaryDto,
  type StoreThemeConfig,
  type UpdateBusinessProfileInput,
} from '@tuvitrina/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

export interface PlanLimits {
  maxProducts: number;
  maxImagesPerProduct: number;
  maxCategories: number;
}

const DEFAULT_FREE_LIMITS: PlanLimits = {
  maxProducts: 50,
  maxImagesPerProduct: 3,
  maxCategories: 15,
};

const DEFAULT_PRO_LIMITS: PlanLimits = {
  maxProducts: 100000,
  maxImagesPerProduct: 10,
  maxCategories: 200,
};

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getPlanLimits(plan: 'free' | 'pro'): Promise<PlanLimits> {
    if (!this.prisma.isConfigured()) {
      return plan === 'pro' ? DEFAULT_PRO_LIMITS : DEFAULT_FREE_LIMITS;
    }
    const config = await this.prisma.plansConfig.findUnique({ where: { key: 'default' } });
    if (!config) {
      return plan === 'pro' ? DEFAULT_PRO_LIMITS : DEFAULT_FREE_LIMITS;
    }
    const raw = (plan === 'pro' ? config.proLimits : config.freeLimits) as Partial<PlanLimits>;
    const fallback = plan === 'pro' ? DEFAULT_PRO_LIMITS : DEFAULT_FREE_LIMITS;
    return {
      maxProducts: typeof raw.maxProducts === 'number' ? raw.maxProducts : fallback.maxProducts,
      maxImagesPerProduct:
        typeof raw.maxImagesPerProduct === 'number'
          ? raw.maxImagesPerProduct
          : fallback.maxImagesPerProduct,
      maxCategories:
        typeof raw.maxCategories === 'number' ? raw.maxCategories : fallback.maxCategories,
    };
  }

  async checkAndApplyPlanExpiration(store: Store): Promise<Store> {
    if (store.plan === 'pro' && store.planExpiresAt && store.planExpiresAt < new Date()) {
      const degraded = await this.prisma.store.update({
        where: { id: store.id },
        data: {
          plan: 'free',
          planExpiresAt: null,
          cacheVersion: { increment: 1 },
        },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId: store.ownerId,
          actorRole: 'system',
          action: 'store.plan_expired_degraded_to_free',
          entityType: 'store',
          entityId: store.id,
          metadata: { previousPlan: 'pro', expiredAt: store.planExpiresAt },
        },
      });
      await this.redis.del(`store:public:${store.slug}`);
      return degraded;
    }
    return store;
  }

  async toSummaryDto(rawStore: Store): Promise<StoreSummaryDto> {
    const store = await this.checkAndApplyPlanExpiration(rawStore);
    const [categoryCount, productCount, limits] = await Promise.all([
      this.prisma.category.count({ where: { storeId: store.id } }),
      this.prisma.product.count({ where: { storeId: store.id } }),
      this.getPlanLimits(store.plan),
    ]);

    let daysUntilPlanExpiration: number | null = null;
    if (store.plan === 'pro' && store.planExpiresAt) {
      const diffMs = store.planExpiresAt.getTime() - Date.now();
      daysUntilPlanExpiration = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      id: store.id,
      ownerId: store.ownerId,
      slug: store.slug,
      name: store.name,
      category: store.category,
      description: store.description,
      whatsapp: store.whatsapp,
      telegram: store.telegram,
      province: store.province,
      municipality: store.municipality,
      streetAddress: store.streetAddress,
      hours: (store.hours as Record<string, unknown> | null) ?? null,
      theme: (store.theme as StoreThemeConfig | null) ?? {
        seedColor: '#00796B',
        mode: 'light',
        fontFamily: 'outfit',
      },
      baseCurrency: store.baseCurrency as CurrencyCode,
      acceptedCurrencies: store.acceptedCurrencies as CurrencyCode[],
      exchangeRates: (store.exchangeRates as Record<string, number> | null) ?? { USD: 320, MLC: 270 },
      freeShippingMin: store.freeShippingMin !== null ? Number(store.freeShippingMin) : null,
      pickupEnabled: store.pickupEnabled,
      plan: store.plan,
      planExpiresAt: store.planExpiresAt ? store.planExpiresAt.toISOString() : null,
      daysUntilPlanExpiration,
      status: store.status,
      suspendedReason: store.suspendedReason,
      categoryCount,
      productCount,
      maxProductsAllowed: limits.maxProducts,
      createdAt: store.createdAt.toISOString(),
      updatedAt: store.updatedAt.toISOString(),
    };
  }

  async requireOwnedStore(ownerId: string): Promise<Store> {
    this.prisma.ensureConfigured();
    const store = await this.prisma.store.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
    });
    if (!store) {
      throw new NotFoundException('Aún no has creado tu tienda. Completa el asistente inicial.');
    }
    return this.checkAndApplyPlanExpiration(store);
  }

  async findSummaryByOwner(ownerId: string): Promise<StoreSummaryDto | null> {
    if (!this.prisma.isConfigured()) return null;
    const store = await this.prisma.store.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
    });
    if (!store) return null;
    return this.toSummaryDto(store);
  }

  async getMyStore(ownerId: string): Promise<StoreSummaryDto> {
    const store = await this.requireOwnedStore(ownerId);
    return this.toSummaryDto(store);
  }

  async checkSlug(rawSlug: string): Promise<CheckSlugResponse> {
    const check = validateStoreSlug(rawSlug);
    if (!check.valid) {
      return {
        slug: check.normalized,
        available: false,
        reason: check.reason,
      };
    }

    if (!this.prisma.isConfigured()) {
      return { slug: check.normalized, available: true };
    }

    const existing = await this.prisma.store.findUnique({
      where: { slug: check.normalized },
      select: { id: true },
    });

    if (existing) {
      return {
        slug: check.normalized,
        available: false,
        reason: 'Este enlace ya está en uso por otra tienda.',
      };
    }

    return { slug: check.normalized, available: true };
  }

  async createStoreOnboarding(
    ownerId: string,
    ownerRole: string,
    input: CreateStoreOnboardingInput,
  ): Promise<StoreSummaryDto> {
    this.prisma.ensureConfigured();

    const normalizedWhatsApp = normalizeCubanWhatsApp(input.whatsapp);
    if (!normalizedWhatsApp) {
      throw new BadRequestException('Introduce un número móvil cubano válido (+53 5XXXXXXX).');
    }

    const slugCheck = validateStoreSlug(input.slug);
    if (!slugCheck.valid) {
      throw new BadRequestException(slugCheck.reason ?? 'Enlace de tienda inválido.');
    }

    const created = await this.prisma.$transaction(
      async (tx) => {
        const existingOwned = await tx.store.findFirst({
          where: { ownerId },
          select: { id: true },
        });
        if (existingOwned) {
          throw new ConflictException('Ya tienes una tienda registrada en esta cuenta.');
        }

        const slugTaken = await tx.store.findUnique({
          where: { slug: slugCheck.normalized },
          select: { id: true },
        });
        if (slugTaken) {
          throw new ConflictException('Ese enlace ya fue tomado por otra tienda.');
        }

        const store = await tx.store.create({
          data: {
            ownerId,
            slug: slugCheck.normalized,
            name: input.name,
            category: input.category,
            whatsapp: normalizedWhatsApp,
            baseCurrency: 'CUP',
            acceptedCurrencies: ['CUP'],
            exchangeRates: { USD: 320, MLC: 270 },
            hours: {
              weekly: createDefaultWeeklyHours(),
              responseTime: 'Menos de 15 minutos',
            } as unknown as Prisma.InputJsonValue,
            theme: {
              seedColor: '#00796B',
              mode: 'light',
              fontFamily: 'outfit',
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.paymentMethod.create({
          data: {
            storeId: store.id,
            type: 'cash',
            label: 'Efectivo (CUP)',
            currencies: ['CUP'],
            instructions: 'Pago contra entrega en efectivo.',
            enabled: true,
            sortOrder: 0,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: ownerId,
            actorRole: ownerRole,
            action: 'store.created',
            entityType: 'store',
            entityId: store.id,
            metadata: { slug: store.slug },
          },
        });

        return store;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.toSummaryDto(created);
  }

  async updateBusinessProfile(
    ownerId: string,
    input: UpdateBusinessProfileInput,
  ): Promise<StoreSummaryDto> {
    const store = await this.requireOwnedStore(ownerId);

    const normalizedWhatsApp = normalizeCubanWhatsApp(input.whatsapp);
    if (!normalizedWhatsApp) {
      throw new BadRequestException('Número móvil cubano inválido (+53 5XXXXXXX).');
    }

    const updated = await this.prisma.store.update({
      where: { id: store.id },
      data: {
        name: input.name,
        category: input.category,
        description: input.description ?? null,
        whatsapp: normalizedWhatsApp,
        telegram: input.telegram ?? null,
        province: input.province,
        municipality: input.municipality,
        streetAddress: input.streetAddress ?? null,
        hours: (input.hours ?? store.hours ?? { weekly: createDefaultWeeklyHours() }) as Prisma.InputJsonValue,
        cacheVersion: { increment: 1 },
      },
    });

    await this.redis.del(`store:public:${updated.slug}`);
    return this.toSummaryDto(updated);
  }

  async updateStoreTheme(
    ownerId: string,
    input: StoreThemeConfig,
  ): Promise<StoreSummaryDto> {
    const store = await this.requireOwnedStore(ownerId);

    if (input.logo?.objectPath && !input.logo.objectPath.startsWith(`${store.id}/`)) {
      throw new BadRequestException('El logo seleccionado no corresponde a tu tienda.');
    }
    if (input.cover?.objectPath && !input.cover.objectPath.startsWith(`${store.id}/`)) {
      throw new BadRequestException('La imagen de portada seleccionada no corresponde a tu tienda.');
    }

    const themeData: StoreThemeConfig = {
      seedColor: input.seedColor,
      mode: input.mode,
      fontFamily: input.fontFamily,
      logo: input.logo ?? null,
      cover: input.cover ?? null,
    };

    const updated = await this.prisma.store.update({
      where: { id: store.id },
      data: {
        theme: themeData as unknown as Prisma.InputJsonValue,
        cacheVersion: { increment: 1 },
      },
    });

    await this.redis.del(`store:public:${updated.slug}`);
    return this.toSummaryDto(updated);
  }

  async bumpStoreCache(storeId: string, slug: string): Promise<void> {
    await this.prisma.store.update({
      where: { id: storeId },
      data: { cacheVersion: { increment: 1 } },
    });
    await this.redis.del(`store:public:${slug}`);
  }
}
