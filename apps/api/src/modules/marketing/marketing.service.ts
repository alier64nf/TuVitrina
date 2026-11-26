import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Coupon, type Promotion } from '@prisma/client';
import {
  convertCurrency,
  fromCents,
  toCents,
  type CouponDiscountType,
  type CouponDto,
  type CreateCouponInput,
  type CreatePromotionInput,
  type CurrencyCode,
  type PromotionDto,
  type PromotionRuleType,
  type StoreAnalyticsDto,
  type UpdateCouponInput,
  type UpdatePromotionInput,
} from '@tuvitrina/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StoresService } from '../stores/stores.service';

function mapCouponDto(c: Coupon): CouponDto {
  return {
    id: c.id,
    storeId: c.storeId,
    code: c.code,
    discountType: c.discountType as CouponDiscountType,
    discountValue: Number(c.discountValue),
    currency: c.currency as CurrencyCode,
    minOrderAmount: Number(c.minOrderAmount),
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    active: c.active,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function mapPromotionDto(p: Promotion): PromotionDto {
  return {
    id: p.id,
    storeId: p.storeId,
    categoryId: p.categoryId,
    name: p.name,
    type: p.type as PromotionRuleType,
    discountValue: Number(p.discountValue),
    minAmount: Number(p.minAmount),
    productIds: p.productIds ?? [],
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class MarketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
  ) {}

  // ============================================================================
  // CUPONES
  // ============================================================================

  async listCoupons(ownerId: string): Promise<CouponDto[]> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const coupons = await this.prisma.coupon.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
    });
    return coupons.map(mapCouponDto);
  }

  async createCoupon(ownerId: string, input: CreateCouponInput): Promise<CouponDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const code = input.code.trim().toUpperCase();

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException('Rango de fechas inválido para el cupón.');
    }

    const existing = await this.prisma.coupon.findUnique({
      where: { storeId_code: { storeId: store.id, code } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Ya existe un cupón con el código ${code}.`);
    }

    const created = await this.prisma.coupon.create({
      data: {
        storeId: store.id,
        code,
        discountType: input.discountType,
        discountValue: new Prisma.Decimal(input.discountValue),
        currency: input.currency ?? store.baseCurrency,
        minOrderAmount: new Prisma.Decimal(input.minOrderAmount ?? 0),
        startsAt,
        endsAt,
        maxUses: input.maxUses ?? null,
        active: input.active ?? true,
      },
    });
    return mapCouponDto(created);
  }

  async updateCoupon(
    ownerId: string,
    couponId: string,
    input: UpdateCouponInput,
  ): Promise<CouponDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.coupon.findFirst({
      where: { id: couponId, storeId: store.id },
    });
    if (!existing) {
      throw new NotFoundException('Cupón no encontrado en tu tienda.');
    }

    const code = input.code.trim().toUpperCase();
    if (code !== existing.code) {
      const duplicate = await this.prisma.coupon.findUnique({
        where: { storeId_code: { storeId: store.id, code } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(`Ya existe otro cupón con el código ${code}.`);
      }
    }

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException('Rango de fechas inválido para el cupón.');
    }

    const updated = await this.prisma.coupon.update({
      where: { id: existing.id },
      data: {
        code,
        discountType: input.discountType,
        discountValue: new Prisma.Decimal(input.discountValue),
        currency: input.currency ?? store.baseCurrency,
        minOrderAmount: new Prisma.Decimal(input.minOrderAmount ?? 0),
        startsAt,
        endsAt,
        maxUses: input.maxUses ?? null,
        active: input.active ?? true,
      },
    });
    return mapCouponDto(updated);
  }

  async deleteCoupon(ownerId: string, couponId: string): Promise<{ deleted: boolean }> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.coupon.findFirst({
      where: { id: couponId, storeId: store.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Cupón no encontrado en tu tienda.');
    }
    await this.prisma.coupon.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  // ============================================================================
  // PROMOCIONES AUTOMÁTICAS
  // ============================================================================

  private async validatePromotionRefs(
    storeId: string,
    categoryId?: string | null,
    productIds?: string[],
  ) {
    if (categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: categoryId, storeId },
        select: { id: true },
      });
      if (!cat) {
        throw new BadRequestException('La categoría seleccionada no pertenece a tu tienda.');
      }
    }
    if (productIds && productIds.length > 0) {
      const count = await this.prisma.product.count({
        where: { storeId, id: { in: productIds } },
      });
      if (count !== new Set(productIds).size) {
        throw new BadRequestException('Uno o más productos seleccionados no pertenecen a tu tienda.');
      }
    }
  }

  async listPromotions(ownerId: string): Promise<PromotionDto[]> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const promos = await this.prisma.promotion.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
    });
    return promos.map(mapPromotionDto);
  }

  async createPromotion(ownerId: string, input: CreatePromotionInput): Promise<PromotionDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    await this.validatePromotionRefs(store.id, input.categoryId, input.productIds);

    const created = await this.prisma.promotion.create({
      data: {
        storeId: store.id,
        name: input.name,
        type: input.type,
        discountValue: new Prisma.Decimal(input.discountValue ?? 0),
        minAmount: new Prisma.Decimal(input.minAmount ?? 0),
        categoryId: input.categoryId ?? null,
        productIds: input.productIds ?? [],
        active: input.active ?? true,
      },
    });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapPromotionDto(created);
  }

  async updatePromotion(
    ownerId: string,
    promotionId: string,
    input: UpdatePromotionInput,
  ): Promise<PromotionDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.promotion.findFirst({
      where: { id: promotionId, storeId: store.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Promoción no encontrada en tu tienda.');
    }

    await this.validatePromotionRefs(store.id, input.categoryId, input.productIds);

    const updated = await this.prisma.promotion.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        type: input.type,
        discountValue: new Prisma.Decimal(input.discountValue ?? 0),
        minAmount: new Prisma.Decimal(input.minAmount ?? 0),
        categoryId: input.categoryId ?? null,
        productIds: input.productIds ?? [],
        active: input.active ?? true,
      },
    });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapPromotionDto(updated);
  }

  async deletePromotion(ownerId: string, promotionId: string): Promise<{ deleted: boolean }> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.promotion.findFirst({
      where: { id: promotionId, storeId: store.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Promoción no encontrada en tu tienda.');
    }
    await this.prisma.promotion.delete({ where: { id: existing.id } });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return { deleted: true };
  }

  // ============================================================================
  // ANALÍTICA PRIVADA POR PERÍODO
  // ============================================================================

  async getAnalytics(
    ownerId: string,
    periodParam: string = '7d',
  ): Promise<StoreAnalyticsDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const period: StoreAnalyticsDto['period'] = ['7d', '30d', '90d', 'all'].includes(periodParam)
      ? (periodParam as StoreAnalyticsDto['period'])
      : '7d';

    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : null;
    const sinceDate = daysBack ? new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000) : null;
    if (sinceDate) {
      sinceDate.setHours(0, 0, 0, 0);
    }

    const baseCurrency = store.baseCurrency as CurrencyCode;
    const exchangeRates = (store.exchangeRates as Record<string, number> | null) ?? {
      USD: 320,
      MLC: 270,
    };

    const [orders, analyticsDays] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          storeId: store.id,
          ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
        },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.analyticsDaily.findMany({
        where: {
          storeId: store.id,
          ...(sinceDate ? { day: { gte: sinceDate } } : {}),
        },
        orderBy: { day: 'asc' },
      }),
    ]);

    let ordersCount = 0;
    let cancelledOrdersCount = 0;
    let totalRevenueCents = 0;

    const topProductMap = new Map<
      string,
      { productId: string | null; productName: string; quantitySold: number; revenueCents: number }
    >();
    const paymentMap = new Map<string, { ordersCount: number; revenueCents: number }>();
    const dailyMap = new Map<string, { visits: number; ordersCount: number; revenueCents: number }>();

    for (const dayRow of analyticsDays) {
      const dateStr = dayRow.day.toISOString().slice(0, 10);
      const curr = dailyMap.get(dateStr) ?? { visits: 0, ordersCount: 0, revenueCents: 0 };
      curr.visits += dayRow.visits;
      dailyMap.set(dateStr, curr);
    }

    for (const order of orders) {
      if (order.status === 'cancelled') {
        cancelledOrdersCount += 1;
        continue;
      }

      ordersCount += 1;
      const convertedTotal = convertCurrency(
        Number(order.total),
        order.currency as CurrencyCode,
        baseCurrency,
        exchangeRates,
      );
      const orderCents = toCents(convertedTotal);
      totalRevenueCents += orderCents;

      const dateStr = order.createdAt.toISOString().slice(0, 10);
      const dayEntry = dailyMap.get(dateStr) ?? { visits: 0, ordersCount: 0, revenueCents: 0 };
      dayEntry.ordersCount += 1;
      dayEntry.revenueCents += orderCents;
      dailyMap.set(dateStr, dayEntry);

      const payEntry = paymentMap.get(order.paymentLabel) ?? { ordersCount: 0, revenueCents: 0 };
      payEntry.ordersCount += 1;
      payEntry.revenueCents += orderCents;
      paymentMap.set(order.paymentLabel, payEntry);

      for (const item of order.items) {
        const key = item.productId || item.productName;
        const itemRevenue = convertCurrency(
          Number(item.lineTotal),
          item.currency as CurrencyCode,
          baseCurrency,
          exchangeRates,
        );
        const existingProd = topProductMap.get(key) ?? {
          productId: item.productId,
          productName: item.productName,
          quantitySold: 0,
          revenueCents: 0,
        };
        existingProd.quantitySold += item.quantity;
        existingProd.revenueCents += toCents(itemRevenue);
        topProductMap.set(key, existingProd);
      }
    }

    const visitsCount = analyticsDays.reduce((sum, row) => sum + row.visits, 0);
    const totalRevenue = fromCents(totalRevenueCents);
    const averageTicket = ordersCount > 0 ? fromCents(Math.round(totalRevenueCents / ordersCount)) : 0;
    const conversionRatePercent =
      visitsCount > 0 ? Math.round((ordersCount / visitsCount) * 1000) / 10 : 0;

    const topProducts = Array.from(topProductMap.values())
      .sort((a, b) => b.quantitySold - a.quantitySold || b.revenueCents - a.revenueCents)
      .slice(0, 8)
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        quantitySold: p.quantitySold,
        revenue: fromCents(p.revenueCents),
      }));

    const paymentMethodsBreakdown = Array.from(paymentMap.entries())
      .sort((a, b) => b[1].ordersCount - a[1].ordersCount)
      .map(([paymentLabel, stats]) => ({
        paymentLabel,
        ordersCount: stats.ordersCount,
        revenue: fromCents(stats.revenueCents),
      }));

    const dailySeries = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, stats]) => ({
        date,
        visits: stats.visits,
        ordersCount: stats.ordersCount,
        revenue: fromCents(stats.revenueCents),
      }));

    return {
      period,
      currency: baseCurrency,
      ordersCount,
      cancelledOrdersCount,
      totalRevenue,
      averageTicket,
      visitsCount,
      conversionRatePercent,
      topProducts,
      paymentMethodsBreakdown,
      dailySeries,
    };
  }
}
