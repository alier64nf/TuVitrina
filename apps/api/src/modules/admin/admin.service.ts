import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Profile, type Store, type SubscriptionRequest, type Report } from '@prisma/client';
import type {
  AuditLogDto,
  PlatformMetricsDto,
  ProfileDto,
  ReportDto,
  ReviewReportInput,
  ReviewSubscriptionInput,
  StoreSummaryDto,
  SubscriptionRequestDto,
  UpdatePlansConfigInput,
  UpdateStoreStatusInput,
} from '@tuvitrina/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { StoresService } from '../stores/stores.service';
import { SubscriptionsService, mapSubscriptionDto } from '../subscriptions/subscriptions.service';

function mapReportDto(
  report: Report & {
    store?: Pick<Store, 'id' | 'name' | 'slug'> | null;
    product?: { id: string; name: string } | null;
  },
): ReportDto {
  return {
    id: report.id,
    storeId: report.storeId,
    storeName: report.store?.name,
    storeSlug: report.store?.slug,
    productId: report.productId,
    productName: report.product?.name,
    targetType: report.targetType as 'store' | 'product',
    reason: report.reason,
    details: report.details,
    reporterContact: report.reporterContact,
    status: report.status as 'open' | 'reviewing' | 'resolved' | 'dismissed',
    resolutionNote: report.resolutionNote,
    reviewedById: report.reviewedById,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

function mapProfileDto(profile: Profile): ProfileDto {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    phone: profile.phone,
    role: profile.role as 'seller' | 'support' | 'admin',
    termsVersion: profile.termsVersion,
    acceptedTermsAt: profile.acceptedTermsAt.toISOString(),
  };
}

function mapAuditLogDto(log: {
  id: string;
  actorId: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}): AuditLogDto {
  return {
    id: log.id,
    actorId: log.actorId,
    actorRole: log.actorRole,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    metadata: (log.metadata as Record<string, unknown> | null) ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storesService: StoresService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async getMetrics(): Promise<PlatformMetricsDto> {
    if (!this.prisma.isConfigured()) {
      return {
        activeStores: 0,
        suspendedStores: 0,
        totalOrders: 0,
        totalUsers: 0,
        freeStores: 0,
        proStores: 0,
        conversionFreeToProPercent: 0,
        pendingSubscriptionsCount: 0,
        openReportsCount: 0,
      };
    }

    const [
      activeStores,
      suspendedStores,
      totalOrders,
      totalUsers,
      freeStores,
      proStores,
      pendingSubscriptionsCount,
      openReportsCount,
    ] = await Promise.all([
      this.prisma.store.count({ where: { status: 'active' } }),
      this.prisma.store.count({ where: { status: 'suspended' } }),
      this.prisma.order.count(),
      this.prisma.profile.count(),
      this.prisma.store.count({ where: { plan: 'free' } }),
      this.prisma.store.count({ where: { plan: 'pro' } }),
      this.prisma.subscriptionRequest.count({ where: { status: 'pending' } }),
      this.prisma.report.count({ where: { status: { in: ['open', 'reviewing'] } } }),
    ]);

    const totalStores = freeStores + proStores;
    const conversionFreeToProPercent =
      totalStores > 0 ? Math.round((proStores / totalStores) * 1000) / 10 : 0;

    return {
      activeStores,
      suspendedStores,
      totalOrders,
      totalUsers,
      freeStores,
      proStores,
      conversionFreeToProPercent,
      pendingSubscriptionsCount,
      openReportsCount,
    };
  }

  async listStores(params?: {
    q?: string;
    status?: string;
    plan?: string;
  }): Promise<StoreSummaryDto[]> {
    if (!this.prisma.isConfigured()) return [];

    const where: Prisma.StoreWhereInput = {
      ...(params?.status ? { status: params.status as any } : {}),
      ...(params?.plan ? { plan: params.plan as any } : {}),
      ...(params?.q && params.q.trim().length > 0
        ? {
            OR: [
              { name: { contains: params.q.trim(), mode: 'insensitive' } },
              { slug: { contains: params.q.trim(), mode: 'insensitive' } },
              { whatsapp: { contains: params.q.trim() } },
            ],
          }
        : {}),
    };

    const stores = await this.prisma.store.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return Promise.all(stores.map((s) => this.storesService.toSummaryDto(s)));
  }

  async updateStoreStatus(
    storeId: string,
    input: UpdateStoreStatusInput,
    actor: Profile,
  ): Promise<StoreSummaryDto> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) {
      throw new NotFoundException('Tienda no encontrada.');
    }

    if (input.status === 'suspended' && (!input.suspendedReason || input.suspendedReason.trim().length === 0)) {
      throw new BadRequestException('Debes indicar el motivo de la suspensión de la tienda.');
    }

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        status: input.status,
        suspendedReason: input.status === 'suspended' ? input.suspendedReason?.trim() : null,
        cacheVersion: { increment: 1 },
      },
    });

    // Invalida inmediatamente la caché pública para hacerla invisible
    await this.redis.del(`store:public:${store.slug}`);

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: input.status === 'suspended' ? 'store.suspended' : 'store.reactivated',
        entityType: 'store',
        entityId: store.id,
        metadata: {
          storeSlug: store.slug,
          previousStatus: store.status,
          newStatus: input.status,
          suspendedReason: input.suspendedReason,
        },
      },
    });

    return this.storesService.toSummaryDto(updated);
  }

  async listUsers(params?: { q?: string; role?: string }): Promise<ProfileDto[]> {
    if (!this.prisma.isConfigured()) return [];

    const where: Prisma.ProfileWhereInput = {
      ...(params?.role ? { role: params.role as any } : {}),
      ...(params?.q && params.q.trim().length > 0
        ? {
            OR: [
              { email: { contains: params.q.trim(), mode: 'insensitive' } },
              { displayName: { contains: params.q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const profiles = await this.prisma.profile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return profiles.map(mapProfileDto);
  }

  async listSubscriptions(params?: { status?: string }): Promise<SubscriptionRequestDto[]> {
    if (!this.prisma.isConfigured()) return [];

    const where: Prisma.SubscriptionRequestWhereInput = {
      ...(params?.status ? { status: params.status as any } : {}),
    };

    const list = await this.prisma.subscriptionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        store: { select: { id: true, name: true, slug: true } },
      },
    });

    return list.map(mapSubscriptionDto);
  }

  async reviewSubscription(
    id: string,
    input: ReviewSubscriptionInput,
    actor: Profile,
  ): Promise<SubscriptionRequestDto> {
    const sub = await this.prisma.subscriptionRequest.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!sub) {
      throw new NotFoundException('Solicitud de suscripción no encontrada.');
    }

    if (sub.status !== 'pending') {
      throw new BadRequestException('Esta solicitud de suscripción ya fue revisada previamente.');
    }

    if (input.status === 'rejected' && (!input.rejectionReason || input.rejectionReason.trim().length === 0)) {
      throw new BadRequestException('Debes indicar el motivo del rechazo.');
    }

    const reviewed = await this.prisma.$transaction(async (tx) => {
      if (input.status === 'approved') {
        const expirationDate = new Date(Date.now() + sub.durationDays * 24 * 60 * 60 * 1000);
        await tx.store.update({
          where: { id: sub.storeId },
          data: {
            plan: 'pro',
            planExpiresAt: expirationDate,
            cacheVersion: { increment: 1 },
          },
        });
      }

      const updatedSub = await tx.subscriptionRequest.update({
        where: { id },
        data: {
          status: input.status,
          rejectionReason: input.status === 'rejected' ? input.rejectionReason?.trim() : null,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
        include: {
          store: { select: { id: true, name: true, slug: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: `subscription.${input.status}`,
          entityType: 'subscription_request',
          entityId: sub.id,
          metadata: {
            storeId: sub.storeId,
            storeSlug: sub.store?.slug,
            amount: Number(sub.amount),
            currency: sub.currency,
            reference: sub.reference,
            rejectionReason: input.rejectionReason,
          },
        },
      });

      return updatedSub;
    });

    if (input.status === 'approved' && sub.store?.slug) {
      await this.redis.del(`store:public:${sub.store.slug}`);
    }

    return mapSubscriptionDto(reviewed);
  }

  async listReports(params?: { status?: string }): Promise<ReportDto[]> {
    if (!this.prisma.isConfigured()) return [];

    const where: Prisma.ReportWhereInput = {
      ...(params?.status ? { status: params.status as any } : {}),
    };

    const reports = await this.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        store: { select: { id: true, name: true, slug: true } },
        product: { select: { id: true, name: true } },
      },
    });

    return reports.map(mapReportDto);
  }

  async reviewReport(
    id: string,
    input: ReviewReportInput,
    actor: Profile,
  ): Promise<ReportDto> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true, slug: true } },
        product: { select: { id: true, name: true } },
      },
    });
    if (!report) {
      throw new NotFoundException('Reporte no encontrado.');
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: input.status,
        resolutionNote: input.resolutionNote?.trim() ?? null,
        reviewedById: actor.id,
      },
      include: {
        store: { select: { id: true, name: true, slug: true } },
        product: { select: { id: true, name: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'report.reviewed',
        entityType: 'report',
        entityId: id,
        metadata: {
          status: input.status,
          resolutionNote: input.resolutionNote,
        },
      },
    });

    return mapReportDto(updated);
  }

  async listAuditLogs(params?: { entityType?: string; limit?: number }): Promise<AuditLogDto[]> {
    if (!this.prisma.isConfigured()) return [];

    const where: Prisma.AuditLogWhereInput = {
      ...(params?.entityType ? { entityType: params.entityType } : {}),
    };

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(params?.limit ?? 50, 100),
    });

    return logs.map(mapAuditLogDto);
  }

  async updatePlansConfig(input: UpdatePlansConfigInput, actor: Profile) {
    const updated = await this.prisma.plansConfig.upsert({
      where: { key: 'default' },
      update: {
        freeLimits: input.freeLimits as unknown as Prisma.InputJsonValue,
        proLimits: input.proLimits as unknown as Prisma.InputJsonValue,
        proPriceCup: new Prisma.Decimal(input.proPriceCup),
        proPriceUsd: new Prisma.Decimal(input.proPriceUsd),
        proDurationDays: input.proDurationDays,
        paymentInstructions: input.paymentInstructions,
      },
      create: {
        key: 'default',
        freeLimits: input.freeLimits as unknown as Prisma.InputJsonValue,
        proLimits: input.proLimits as unknown as Prisma.InputJsonValue,
        proPriceCup: new Prisma.Decimal(input.proPriceCup),
        proPriceUsd: new Prisma.Decimal(input.proPriceUsd),
        proDurationDays: input.proDurationDays,
        paymentInstructions: input.paymentInstructions,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'plans_config.updated',
        entityType: 'plans_config',
        entityId: 'default',
        metadata: input as unknown as Prisma.InputJsonValue,
      },
    });

    return this.subscriptionsService.getPlansConfig();
  }
}
