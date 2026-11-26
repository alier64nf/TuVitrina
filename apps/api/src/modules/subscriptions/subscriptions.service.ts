import { Injectable } from '@nestjs/common';
import { Prisma, type SubscriptionRequest, type Store } from '@prisma/client';
import type {
  CreateSubscriptionRequestInput,
  PlansConfigDto,
  SubscriptionRequestDto,
} from '@tuvitrina/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StoresService } from '../stores/stores.service';

const DEFAULT_CONFIG: PlansConfigDto = {
  key: 'default',
  freeLimits: {
    maxProducts: 50,
    maxImagesPerProduct: 3,
    maxCategories: 15,
  },
  proLimits: {
    maxProducts: 100000,
    maxImagesPerProduct: 10,
    maxCategories: 200,
  },
  proPriceCup: 3000,
  proPriceUsd: 10,
  proDurationDays: 60,
  paymentInstructions:
    'Realiza tu transferencia a EnZona (@tuvitrina) o Transfermóvil (+53 52000000). Sube una captura nítida de tu comprobante y el código de transacción para activar tu tienda PRO inmediatamente tras la confirmación.',
};

export function mapSubscriptionDto(
  sub: SubscriptionRequest & { store?: Pick<Store, 'id' | 'name' | 'slug'> | null },
): SubscriptionRequestDto {
  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '') || '';
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_ASSETS?.trim() || 'store-assets';
  const receiptPublicUrl = sub.receiptObjectKey.startsWith('http')
    ? sub.receiptObjectKey
    : supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/${bucket}/${sub.receiptObjectKey}`
    : `/uploads/${sub.receiptObjectKey}`;

  return {
    id: sub.id,
    storeId: sub.storeId,
    storeName: sub.store?.name,
    storeSlug: sub.store?.slug,
    profileId: sub.profileId,
    targetPlan: sub.targetPlan as 'free' | 'pro',
    durationDays: sub.durationDays,
    amount: Number(sub.amount),
    currency: sub.currency,
    paymentMethodLabel: sub.paymentMethodLabel,
    reference: sub.reference,
    receiptObjectKey: sub.receiptObjectKey,
    receiptPublicUrl,
    status: sub.status as 'pending' | 'approved' | 'rejected',
    rejectionReason: sub.rejectionReason,
    reviewedById: sub.reviewedById,
    reviewedAt: sub.reviewedAt ? sub.reviewedAt.toISOString() : null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
  ) {}

  async getPlansConfig(): Promise<PlansConfigDto> {
    if (!this.prisma.isConfigured()) {
      return DEFAULT_CONFIG;
    }

    let config = await this.prisma.plansConfig.findUnique({
      where: { key: 'default' },
    });

    if (!config) {
      config = await this.prisma.plansConfig.create({
        data: {
          key: 'default',
          freeLimits: DEFAULT_CONFIG.freeLimits as unknown as Prisma.InputJsonValue,
          proLimits: DEFAULT_CONFIG.proLimits as unknown as Prisma.InputJsonValue,
          proPriceCup: new Prisma.Decimal(DEFAULT_CONFIG.proPriceCup),
          proPriceUsd: new Prisma.Decimal(DEFAULT_CONFIG.proPriceUsd),
          proDurationDays: DEFAULT_CONFIG.proDurationDays,
          paymentInstructions: DEFAULT_CONFIG.paymentInstructions,
        },
      });
    }

    const freeLimits = (config.freeLimits as typeof DEFAULT_CONFIG.freeLimits) || DEFAULT_CONFIG.freeLimits;
    const proLimits = (config.proLimits as typeof DEFAULT_CONFIG.proLimits) || DEFAULT_CONFIG.proLimits;

    return {
      key: config.key,
      freeLimits: {
        maxProducts: Number(freeLimits.maxProducts) || 50,
        maxImagesPerProduct: Number(freeLimits.maxImagesPerProduct) || 3,
        maxCategories: Number(freeLimits.maxCategories) || 15,
      },
      proLimits: {
        maxProducts: Number(proLimits.maxProducts) || 100000,
        maxImagesPerProduct: Number(proLimits.maxImagesPerProduct) || 10,
        maxCategories: Number(proLimits.maxCategories) || 200,
      },
      proPriceCup: Number(config.proPriceCup),
      proPriceUsd: Number(config.proPriceUsd),
      proDurationDays: config.proDurationDays,
      paymentInstructions: config.paymentInstructions,
    };
  }

  async createSubscriptionRequest(
    ownerId: string,
    profileId: string,
    input: CreateSubscriptionRequestInput,
  ): Promise<SubscriptionRequestDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const config = await this.getPlansConfig();

    const created = await this.prisma.subscriptionRequest.create({
      data: {
        storeId: store.id,
        profileId,
        targetPlan: 'pro',
        durationDays: config.proDurationDays,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency,
        paymentMethodLabel: input.paymentMethodLabel,
        reference: input.reference,
        receiptObjectKey: input.receiptObjectKey,
        status: 'pending',
      },
      include: {
        store: { select: { id: true, name: true, slug: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: profileId,
        actorRole: 'seller',
        action: 'subscription.requested',
        entityType: 'subscription_request',
        entityId: created.id,
        metadata: {
          storeId: store.id,
          amount: input.amount,
          currency: input.currency,
          reference: input.reference,
        },
      },
    });

    return mapSubscriptionDto(created);
  }

  async listMySubscriptions(ownerId: string): Promise<SubscriptionRequestDto[]> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const list = await this.prisma.subscriptionRequest.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
      include: {
        store: { select: { id: true, name: true, slug: true } },
      },
    });

    return list.map(mapSubscriptionDto);
  }
}
