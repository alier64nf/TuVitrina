import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  calculateOrderPricing,
  computeDiscountPercent,
  convertCurrency,
  isCategoryAvailableNow,
  toCents,
  type CategorySchedule,
  type CheckoutResponseDto,
  type CouponDiscountType,
  type CurrencyCode,
  type GuestCheckoutInput,
  type OrderDto,
  type OrderQuoteResponseDto,
  type PricingCartItem,
  type PricingCouponRule,
  type PricingPromotionRule,
  type PromotionRuleType,
  type QuoteOrderInput,
  type StorefrontPromotionDto,
  type StorefrontShippingZoneDto,
  type StorefrontViewDto,
  type StoreThemeConfig,
} from '@tuvitrina/contracts';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private checkIsOpen(hoursJson: unknown): boolean {
    if (!hoursJson || typeof hoursJson !== 'object') return true;
    const weekly = (
      hoursJson as { weekly?: Record<string, { open: boolean; from: string; to: string }> }
    ).weekly;
    if (!weekly) return true;

    const now = new Date();
    let dayKey: string;
    let currentMinutes: number;
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Havana',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const weekdayRaw = (parts.find((p) => p.type === 'weekday')?.value ?? 'mon').toLowerCase();
      dayKey = weekdayRaw.slice(0, 3);
      const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? now.getHours()) % 24;
      const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? now.getMinutes());
      currentMinutes = hour * 60 + minute;
    } catch {
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
      dayKey = dayNames[now.getDay()];
      currentMinutes = now.getHours() * 60 + now.getMinutes();
    }

    const dayConfig = weekly[dayKey];
    if (!dayConfig || !dayConfig.open) return false;

    const [fromH, fromM] = dayConfig.from.split(':').map(Number);
    const [toH, toM] = dayConfig.to.split(':').map(Number);
    const openMinutes = (fromH ?? 9) * 60 + (fromM ?? 0);
    const closeMinutes = (toH ?? 18) * 60 + (toM ?? 0);

    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  private recordVisit(storeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    void this.prisma.analyticsDaily
      .upsert({
        where: { storeId_day: { storeId, day: today } },
        update: { visits: { increment: 1 } },
        create: { storeId, day: today, visits: 1 },
      })
      .catch(() => undefined);
  }

  async getStorefront(slug: string, options?: { skipVisit?: boolean }): Promise<StorefrontViewDto> {
    this.prisma.ensureConfigured();
    const cacheKey = `store:public:${slug}`;
    const cached = await this.redis.getJson<StorefrontViewDto>(cacheKey);
    if (cached) {
      if (!options?.skipVisit) {
        this.recordVisit(cached.store.id);
      }
      return {
        ...cached,
        isOpen: this.checkIsOpen(cached.store.hours),
        categories: cached.categories.map((c) => ({
          ...c,
          isAvailableNow: isCategoryAvailableNow(c.schedule ?? null),
        })),
      };
    }

    const store = await this.prisma.store.findUnique({
      where: { slug },
      include: {
        categories: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
        },
        products: {
          where: { active: true },
          include: { variants: { where: { active: true } } },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        },
        paymentMethods: {
          where: { enabled: true },
          orderBy: { sortOrder: 'asc' },
        },
        promotions: {
          where: { active: true },
          orderBy: { createdAt: 'desc' },
        },
        shippingZones: {
          where: { active: true },
          orderBy: [{ province: 'asc' }, { municipality: 'asc' }],
        },
      },
    });

    if (!store || store.status !== 'active') {
      throw new NotFoundException('La tienda no existe o se encuentra inactiva.');
    }

    if (!options?.skipVisit) {
      this.recordVisit(store.id);
    }

    const [categoryCount, productCount, limits] = await Promise.all([
      this.prisma.category.count({ where: { storeId: store.id } }),
      this.prisma.product.count({ where: { storeId: store.id } }),
      this.prisma.plansConfig.findUnique({ where: { key: 'default' } }),
    ]);

    const maxProductsAllowed =
      store.plan === 'pro'
        ? ((limits?.proLimits as { maxProducts?: number })?.maxProducts ?? 100000)
        : ((limits?.freeLimits as { maxProducts?: number })?.maxProducts ?? 50);

    const summary = {
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
      exchangeRates: (store.exchangeRates as Record<string, number> | null) ?? {
        USD: 320,
        MLC: 270,
      },
      freeShippingMin: store.freeShippingMin !== null ? Number(store.freeShippingMin) : null,
      pickupEnabled: store.pickupEnabled,
      plan: store.plan,
      planExpiresAt: store.planExpiresAt ? store.planExpiresAt.toISOString() : null,
      daysUntilPlanExpiration: null,
      status: store.status,
      suspendedReason: store.suspendedReason,
      categoryCount,
      productCount,
      maxProductsAllowed,
      createdAt: store.createdAt.toISOString(),
      updatedAt: store.updatedAt.toISOString(),
    };

    const categories = (store.categories ?? []).map((c) => {
      const schedule = (c.schedule as CategorySchedule | null) ?? null;
      return {
        id: c.id,
        storeId: c.storeId,
        name: c.name,
        sortOrder: c.sortOrder,
        active: c.active,
        schedule,
        isAvailableNow: isCategoryAvailableNow(schedule),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    });

    const products = (store.products ?? []).map((p) => {
      const price = Number(p.price);
      const compareAtPrice = p.compareAtPrice !== null ? Number(p.compareAtPrice) : null;
      return {
        id: p.id,
        storeId: p.storeId,
        categoryId: p.categoryId,
        name: p.name,
        description: p.description,
        price,
        compareAtPrice,
        discountPercent: computeDiscountPercent(price, compareAtPrice),
        currency: p.currency as CurrencyCode,
        stock: p.stock,
        active: p.active,
        soldOut: p.soldOut,
        sortOrder: p.sortOrder,
        images: Array.isArray(p.images) ? (p.images as any) : [],
        variants: (p.variants ?? []).map((v) => ({
          id: v.id,
          productId: v.productId,
          label: v.label,
          sku: v.sku,
          attributes: (v.attributes as Record<string, string>) ?? {},
          priceOverride: v.priceOverride !== null ? Number(v.priceOverride) : null,
          stock: v.stock,
          active: v.active,
        })),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    const paymentMethods = (store.paymentMethods ?? []).map((pm) => ({
      id: pm.id,
      type: pm.type,
      label: pm.label,
      currencies: pm.currencies as CurrencyCode[],
      instructions: pm.instructions,
      accountData: pm.accountData,
    }));

    const promotions: StorefrontPromotionDto[] = (store.promotions ?? []).map((pr) => ({
      id: pr.id,
      name: pr.name,
      type: pr.type as PromotionRuleType,
      discountValue: Number(pr.discountValue),
      minAmount: Number(pr.minAmount),
      categoryId: pr.categoryId,
      productIds: pr.productIds ?? [],
    }));

    const shippingZones: StorefrontShippingZoneDto[] = (store.shippingZones ?? []).map((sz) => ({
      id: sz.id,
      province: sz.province,
      municipality: sz.municipality,
      cost: Number(sz.cost),
      currency: sz.currency as CurrencyCode,
    }));

    const result: StorefrontViewDto = {
      store: summary,
      isOpen: this.checkIsOpen(store.hours),
      categories,
      products,
      paymentMethods,
      promotions,
      shippingZones,
    };

    await this.redis.setJson(cacheKey, result, 120);
    return result;
  }

  private resolveShipping(
    shippingZones: StorefrontShippingZoneDto[],
    fulfillmentType: 'delivery' | 'pickup',
    province: string,
    municipality: string,
    baseCurrency: CurrencyCode,
  ): { cost: number; currency: CurrencyCode; zoneName: string | null } {
    if (fulfillmentType === 'pickup') {
      return { cost: 0, currency: baseCurrency, zoneName: 'Recogida en tienda' };
    }

    const byProvince = shippingZones.filter(
      (z) => z.province.toLowerCase() === province.trim().toLowerCase(),
    );
    const municipalMatch = byProvince.find(
      (z) => z.municipality && z.municipality.toLowerCase() === municipality.trim().toLowerCase(),
    );
    if (municipalMatch) {
      return {
        cost: municipalMatch.cost,
        currency: municipalMatch.currency,
        zoneName: `${municipalMatch.municipality}, ${municipalMatch.province}`,
      };
    }

    const provinceMatch = byProvince.find((z) => !z.municipality);
    if (provinceMatch) {
      return {
        cost: provinceMatch.cost,
        currency: provinceMatch.currency,
        zoneName: provinceMatch.province,
      };
    }

    return {
      cost: 0,
      currency: baseCurrency,
      zoneName: province && municipality ? `${municipality}, ${province}` : 'Envío estándar',
    };
  }

  private buildValidatedCartItems(
    storefront: StorefrontViewDto,
    items: Array<{ productId: string; variantId?: string | null; quantity: number }>,
    enforceCategorySchedule: boolean,
  ) {
    const productMap = new Map(storefront.products.map((p) => [p.id, p]));
    const categoryMap = new Map(storefront.categories.map((c) => [c.id, c]));

    const pricingItems: PricingCartItem[] = [];
    const orderItemsData: Array<{
      productId: string;
      variantId: string | null;
      productName: string;
      variantLabel: string | null;
      unitPrice: number;
      currency: CurrencyCode;
      quantity: number;
      lineTotal: number;
    }> = [];

    for (const itemInput of items) {
      const product = productMap.get(itemInput.productId);
      if (!product || !product.active || product.soldOut) {
        throw new BadRequestException('El producto seleccionado ya no está disponible.');
      }

      if (enforceCategorySchedule && product.categoryId) {
        const cat = categoryMap.get(product.categoryId);
        if (cat && cat.schedule?.enabled && !isCategoryAvailableNow(cat.schedule)) {
          throw new BadRequestException(
            `La categoría "${cat.name}" solo está disponible en su horario (${cat.schedule.from} - ${cat.schedule.to}).`,
          );
        }
      }

      let unitPrice = product.price;
      let variantLabel: string | null = null;
      let targetVariantId: string | null = null;

      if (itemInput.variantId) {
        const variant = product.variants.find((v) => v.id === itemInput.variantId);
        if (!variant || !variant.active) {
          throw new BadRequestException('La variante seleccionada no está disponible.');
        }
        targetVariantId = variant.id;
        variantLabel = variant.label;
        if (variant.priceOverride !== null && variant.priceOverride !== undefined) {
          unitPrice = variant.priceOverride;
        }
      }

      const lineTotal = unitPrice * itemInput.quantity;
      pricingItems.push({
        productId: product.id,
        categoryId: product.categoryId,
        productName: product.name,
        unitPrice,
        currency: product.currency,
        quantity: itemInput.quantity,
      });
      orderItemsData.push({
        productId: product.id,
        variantId: targetVariantId,
        productName: product.name,
        variantLabel,
        unitPrice,
        currency: product.currency,
        quantity: itemInput.quantity,
        lineTotal,
      });
    }

    return { pricingItems, orderItemsData };
  }

  async quoteOrder(slug: string, input: QuoteOrderInput): Promise<OrderQuoteResponseDto> {
    this.prisma.ensureConfigured();
    const storefront = await this.getStorefront(slug, { skipVisit: true });
    const store = storefront.store;
    const baseCurrency = store.baseCurrency;
    const exchangeRates = store.exchangeRates ?? { USD: 320, MLC: 270 };

    const { pricingItems } = this.buildValidatedCartItems(storefront, input.items, false);
    const promotions: PricingPromotionRule[] = (storefront.promotions ?? []).map((pr) => ({
      ...pr,
      active: true,
    }));

    const shipping = this.resolveShipping(
      storefront.shippingZones ?? [],
      input.fulfillmentType,
      input.province,
      input.municipality,
      baseCurrency,
    );

    let couponRule: PricingCouponRule | null = null;
    let couponApplied: string | null = null;
    let couponError: string | null = null;

    const cleanCode = input.couponCode?.trim().toUpperCase();
    if (cleanCode) {
      const coupon = await this.prisma.coupon.findUnique({
        where: { storeId_code: { storeId: store.id, code: cleanCode } },
      });
      const now = new Date();
      if (!coupon || !coupon.active) {
        couponError = 'El cupón no existe o no está activo.';
      } else if (now < coupon.startsAt || now > coupon.endsAt) {
        couponError = 'Este cupón está fuera de su período de vigencia.';
      } else if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        couponError = 'Este cupón ya alcanzó su límite de usos.';
      } else {
        const preCheck = calculateOrderPricing({
          items: pricingItems,
          baseCurrency,
          exchangeRates,
          promotions,
        });
        const minInBase = convertCurrency(
          Number(coupon.minOrderAmount),
          coupon.currency as CurrencyCode,
          baseCurrency,
          exchangeRates,
        );
        if (toCents(preCheck.subtotal) < toCents(minInBase)) {
          couponError = `Este cupón requiere un pedido mínimo de ${Number(coupon.minOrderAmount)} ${coupon.currency}.`;
        } else {
          couponRule = {
            code: coupon.code,
            discountType: coupon.discountType as CouponDiscountType,
            discountValue: Number(coupon.discountValue),
            currency: coupon.currency as CurrencyCode,
            minOrderAmount: Number(coupon.minOrderAmount),
          };
          couponApplied = coupon.code;
        }
      }
    }

    const pricing = calculateOrderPricing({
      items: pricingItems,
      baseCurrency,
      exchangeRates,
      promotions,
      coupon: couponRule,
      rawShippingCost: shipping.cost,
      shippingCurrency: shipping.currency,
      freeShippingMin: store.freeShippingMin ?? null,
    });

    return {
      pricing,
      shippingZoneName: shipping.zoneName,
      couponApplied,
      couponError,
    };
  }

  private formatCheckoutResponse(
    order: {
      id: string;
      storeId: string;
      orderNumber: number;
      trackingToken: string;
      status: string;
      paymentStatus: string;
      channel: string;
      paymentLabel: string;
      fulfillmentType: string;
      shippingZoneName: string | null;
      customerSnapshot: unknown;
      currency: string;
      subtotal: unknown;
      discountTotal: unknown;
      shippingCost: unknown;
      total: unknown;
      couponCode: string | null;
      cancelReason: string | null;
      createdAt: Date;
      updatedAt: Date;
      items: Array<{
        id: string;
        productId: string | null;
        variantId: string | null;
        productName: string;
        variantLabel: string | null;
        unitPrice: unknown;
        currency: string;
        quantity: number;
        lineTotal: unknown;
      }>;
      statusHistory: Array<{
        id: string;
        fromStatus: string | null;
        toStatus: string;
        note: string | null;
        createdAt: Date;
      }>;
    },
    store: { slug: string; whatsapp: string; telegram: string | null },
  ): CheckoutResponseDto {
    const baseCurrency = order.currency as CurrencyCode;
    const snapshot = (order.customerSnapshot ?? {}) as {
      customerName?: string;
      phone?: string;
      province?: string;
      municipality?: string;
      streetAddress?: string;
      notes?: string | null;
    };

    const itemsText = order.items
      .map(
        (i) =>
          `• ${i.quantity}x ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ''} - ${Number(i.unitPrice)} ${i.currency}`,
      )
      .join('\n');

    const subtotal = Number(order.subtotal);
    const discountTotal = Number(order.discountTotal);
    const shippingCost = Number(order.shippingCost);
    const total = Number(order.total);

    const summaryLines = [
      `Subtotal: ${subtotal} ${baseCurrency}`,
      ...(discountTotal > 0
        ? [`Descuento${order.couponCode ? ` (${order.couponCode})` : ''}: -${discountTotal} ${baseCurrency}`]
        : []),
      ...(order.fulfillmentType === 'delivery'
        ? [
            `Envío${order.shippingZoneName ? ` (${order.shippingZoneName})` : ''}: ${shippingCost === 0 ? 'Gratis' : `${shippingCost} ${baseCurrency}`}`,
          ]
        : []),
      `💰 *Total:* *${total} ${baseCurrency}*`,
    ].join('\n');

    const messageText =
      `*¡Nuevo Pedido #${order.orderNumber}!*\n\n` +
      `👤 *Cliente:* ${snapshot.customerName ?? ''}\n` +
      `📞 *Teléfono:* ${snapshot.phone ?? ''}\n` +
      `📍 *Dirección:* ${snapshot.streetAddress ?? ''}, ${snapshot.municipality ?? ''}, ${snapshot.province ?? ''}\n` +
      `🚚 *Tipo:* ${order.fulfillmentType === 'pickup' ? 'Recogida en tienda' : 'Envío a domicilio'}\n` +
      `💳 *Pago:* ${order.paymentLabel}\n` +
      (snapshot.notes ? `📝 *Notas:* ${snapshot.notes}\n\n` : '\n') +
      `*Productos:*\n${itemsText}\n\n` +
      `${summaryLines}\n\n` +
      `🔗 *Seguimiento:* https://tuvitrina.cu/${store.slug}/pedido/${order.trackingToken}`;

    const cleanWhatsapp = store.whatsapp.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(messageText)}`;
    const telegramUrl = store.telegram ? `https://t.me/${store.telegram.replace('@', '')}` : null;

    const mappedOrder: OrderDto = {
      id: order.id,
      storeId: order.storeId,
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
      status: order.status,
      paymentStatus: order.paymentStatus,
      channel: order.channel,
      paymentLabel: order.paymentLabel,
      fulfillmentType: order.fulfillmentType,
      shippingZoneName: order.shippingZoneName,
      customerSnapshot: order.customerSnapshot as any,
      currency: baseCurrency,
      subtotal,
      discountTotal,
      shippingCost,
      total,
      couponCode: order.couponCode,
      cancelReason: order.cancelReason,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        variantLabel: i.variantLabel,
        unitPrice: Number(i.unitPrice),
        currency: i.currency as CurrencyCode,
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
      })),
      statusHistory: order.statusHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      })),
    };

    return {
      order: mappedOrder,
      whatsappUrl,
      telegramUrl,
      messageText,
    };
  }

  async placeOrder(slug: string, input: GuestCheckoutInput): Promise<CheckoutResponseDto> {
    this.prisma.ensureConfigured();

    const storefront = await this.getStorefront(slug, { skipVisit: true });
    const store = storefront.store;

    if (store.status !== 'active') {
      throw new BadRequestException('Esta tienda no está activa en este momento.');
    }

    const idempotencyKey = input.idempotencyKey?.trim() || null;
    if (idempotencyKey) {
      const existingOrder = await this.prisma.order.findUnique({
        where: { storeId_idempotencyKey: { storeId: store.id, idempotencyKey } },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (existingOrder) {
        return this.formatCheckoutResponse(existingOrder, store);
      }
    }

    const { pricingItems, orderItemsData } = this.buildValidatedCartItems(
      storefront,
      input.items,
      true,
    );

    const baseCurrency = store.baseCurrency;
    const exchangeRates = store.exchangeRates ?? { USD: 320, MLC: 270 };
    const promotions: PricingPromotionRule[] = (storefront.promotions ?? []).map((pr) => ({
      ...pr,
      active: true,
    }));

    const shipping = this.resolveShipping(
      storefront.shippingZones ?? [],
      input.fulfillmentType,
      input.province,
      input.municipality,
      baseCurrency,
    );

    const trackingToken = randomBytes(24).toString('hex');
    const paymentMethodObj = storefront.paymentMethods.find((pm) => pm.id === input.paymentMethodId);
    const paymentLabel = paymentMethodObj ? paymentMethodObj.label : 'Efectivo / Pago al recibir';
    const requestedCouponCode = input.couponCode?.trim().toUpperCase() || null;

    let createdOrder;
    try {
      const txResult = await this.prisma.$transaction(async (tx) => {
        let couponRule: PricingCouponRule | null = null;
        let validatedCouponCode: string | null = null;

        if (requestedCouponCode) {
          const coupon = await tx.coupon.findUnique({
            where: { storeId_code: { storeId: store.id, code: requestedCouponCode } },
          });
          const now = new Date();
          if (!coupon || !coupon.active) {
            throw new BadRequestException(`El cupón ${requestedCouponCode} no es válido o está inactivo.`);
          }
          if (now < coupon.startsAt || now > coupon.endsAt) {
            throw new BadRequestException(`El cupón ${requestedCouponCode} está vencido o aún no inicia.`);
          }

          const preCheck = calculateOrderPricing({
            items: pricingItems,
            baseCurrency,
            exchangeRates,
            promotions,
          });
          const minInBase = convertCurrency(
            Number(coupon.minOrderAmount),
            coupon.currency as CurrencyCode,
            baseCurrency,
            exchangeRates,
          );
          if (toCents(preCheck.subtotal) < toCents(minInBase)) {
            throw new BadRequestException(
              `El cupón ${coupon.code} requiere un mínimo de ${Number(coupon.minOrderAmount)} ${coupon.currency}.`,
            );
          }

          if (coupon.maxUses !== null) {
            const updatedUsage = await tx.coupon.updateMany({
              where: { id: coupon.id, usedCount: { lt: coupon.maxUses } },
              data: { usedCount: { increment: 1 } },
            });
            if (updatedUsage.count === 0) {
              throw new BadRequestException(`El cupón ${coupon.code} ya alcanzó su límite de usos.`);
            }
          } else {
            await tx.coupon.update({
              where: { id: coupon.id },
              data: { usedCount: { increment: 1 } },
            });
          }

          couponRule = {
            code: coupon.code,
            discountType: coupon.discountType as CouponDiscountType,
            discountValue: Number(coupon.discountValue),
            currency: coupon.currency as CurrencyCode,
            minOrderAmount: Number(coupon.minOrderAmount),
          };
          validatedCouponCode = coupon.code;
        }

        const calculatedPricing = calculateOrderPricing({
          items: pricingItems,
          baseCurrency,
          exchangeRates,
          promotions,
          coupon: couponRule,
          rawShippingCost: shipping.cost,
          shippingCurrency: shipping.currency,
          freeShippingMin: store.freeShippingMin ?? null,
        });

        const updatedStore = await tx.store.update({
          where: { id: store.id },
          data: { orderSeq: { increment: 1 } },
          select: { orderSeq: true },
        });

        const orderNumber = updatedStore.orderSeq;

        const order = await tx.order.create({
          data: {
            storeId: store.id,
            orderNumber,
            trackingToken,
            idempotencyKey,
            status: 'created',
            paymentStatus: 'pending',
            channel: input.channel,
            paymentMethodId: input.paymentMethodId || null,
            paymentLabel,
            fulfillmentType: input.fulfillmentType,
            shippingZoneName: shipping.zoneName,
            couponCode: validatedCouponCode,
            customerSnapshot: {
              customerName: input.customerName.trim(),
              phone: input.phone.trim(),
              province: input.province.trim(),
              municipality: input.municipality.trim(),
              streetAddress: input.streetAddress.trim(),
              notes: input.notes?.trim() || null,
            },
            currency: baseCurrency,
            subtotal: new Prisma.Decimal(calculatedPricing.subtotal),
            discountTotal: new Prisma.Decimal(calculatedPricing.discountTotal),
            shippingCost: new Prisma.Decimal(calculatedPricing.shippingCost),
            total: new Prisma.Decimal(calculatedPricing.total),
            items: {
              create: orderItemsData.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                productName: item.productName,
                variantLabel: item.variantLabel,
                unitPrice: new Prisma.Decimal(item.unitPrice),
                currency: item.currency,
                quantity: item.quantity,
                lineTotal: new Prisma.Decimal(item.lineTotal),
              })),
            },
            statusHistory: {
              create: {
                toStatus: 'created',
                note: idempotencyKey
                  ? 'Pedido recibido (con clave de sincronización).'
                  : 'Pedido recibido desde la tienda online.',
              },
            },
          },
          include: {
            items: true,
            statusHistory: { orderBy: { createdAt: 'asc' } },
          },
        });

        return order;
      });
      createdOrder = txResult;
    } catch (error) {
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const racedOrder = await this.prisma.order.findUnique({
          where: { storeId_idempotencyKey: { storeId: store.id, idempotencyKey } },
          include: {
            items: true,
            statusHistory: { orderBy: { createdAt: 'asc' } },
          },
        });
        if (racedOrder) {
          return this.formatCheckoutResponse(racedOrder, store);
        }
      }
      throw error;
    }

    return this.formatCheckoutResponse(createdOrder, store);
  }

  async trackOrder(slug: string, trackingToken: string): Promise<OrderDto> {
    this.prisma.ensureConfigured();
    const store = await this.prisma.store.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!store) {
      throw new NotFoundException('Tienda no encontrada.');
    }

    const order = await this.prisma.order.findFirst({
      where: { storeId: store.id, trackingToken },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado o enlace de seguimiento inválido.');
    }

    return {
      id: order.id,
      storeId: order.storeId,
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
      status: order.status,
      paymentStatus: order.paymentStatus,
      channel: order.channel,
      paymentLabel: order.paymentLabel,
      fulfillmentType: order.fulfillmentType,
      shippingZoneName: order.shippingZoneName,
      customerSnapshot: order.customerSnapshot as any,
      currency: order.currency as CurrencyCode,
      subtotal: Number(order.subtotal),
      discountTotal: Number(order.discountTotal),
      shippingCost: Number(order.shippingCost),
      total: Number(order.total),
      couponCode: order.couponCode,
      cancelReason: order.cancelReason,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        variantLabel: i.variantLabel,
        unitPrice: Number(i.unitPrice),
        currency: i.currency as CurrencyCode,
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
      })),
      statusHistory: order.statusHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }
}
