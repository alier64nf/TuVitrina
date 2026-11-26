export const CURRENCIES = ['CUP', 'USD', 'MLC'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

export function computeDiscountPercent(
  price: number,
  compareAtPrice?: number | null,
): number | null {
  if (!compareAtPrice || !Number.isFinite(compareAtPrice) || !Number.isFinite(price)) {
    return null;
  }
  const priceCents = toCents(price);
  const compareCents = toCents(compareAtPrice);
  if (compareCents <= priceCents || priceCents <= 0) {
    return null;
  }
  const pct = Math.round(((compareCents - priceCents) / compareCents) * 100);
  return pct >= 1 && pct <= 99 ? pct : null;
}

export function formatMoney(amount: number, currency: CurrencyCode = 'CUP'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('es-CU', {
    minimumFractionDigits: currency === 'CUP' && Number.isInteger(safe) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return `${formatted} ${currency}`;
}

export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  exchangeRates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount;
  const rates: Record<string, number> = { CUP: 1, ...exchangeRates };
  // Convert fromCurrency to CUP first
  let amountInCUP = amount;
  if (fromCurrency === 'USD') {
    amountInCUP = amount * (rates['USD'] ?? 320);
  } else if (fromCurrency === 'MLC') {
    amountInCUP = amount * (rates['MLC'] ?? 270);
  }

  // Convert CUP to toCurrency
  if (toCurrency === 'CUP') return amountInCUP;
  if (toCurrency === 'USD') {
    const rate = rates['USD'] ?? 320;
    return rate > 0 ? amountInCUP / rate : amountInCUP;
  }
  if (toCurrency === 'MLC') {
    const rate = rates['MLC'] ?? 270;
    return rate > 0 ? amountInCUP / rate : amountInCUP;
  }
  return amountInCUP;
}

export type PromotionRuleType =
  | 'percent'
  | 'min_amount'
  | 'bogo_2x1'
  | 'bogo_3x2'
  | 'second_unit'
  | 'combo';

export type CouponDiscountType = 'percent' | 'fixed';

export interface PricingCartItem {
  productId: string;
  categoryId: string | null;
  productName: string;
  unitPrice: number;
  currency: CurrencyCode;
  quantity: number;
}

export interface PricingPromotionRule {
  id: string;
  name: string;
  type: PromotionRuleType;
  discountValue: number;
  minAmount: number;
  categoryId: string | null;
  productIds: string[];
  active: boolean;
}

export interface PricingCouponRule {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  currency: CurrencyCode;
  minOrderAmount: number;
}

export interface AppliedDiscountDetail {
  kind: 'promotion' | 'coupon';
  id?: string;
  name: string;
  discountAmount: number;
}

export interface OrderPricingResult {
  subtotal: number;
  promotionDiscount: number;
  couponDiscount: number;
  discountTotal: number;
  shippingCost: number;
  freeShippingApplied: boolean;
  total: number;
  currency: CurrencyCode;
  appliedDiscounts: AppliedDiscountDetail[];
}

function getEligibleItems(
  items: Array<PricingCartItem & { unitBaseCents: number }>,
  promo: PricingPromotionRule,
) {
  if (promo.productIds && promo.productIds.length > 0) {
    const set = new Set(promo.productIds);
    return items.filter((i) => set.has(i.productId));
  }
  if (promo.categoryId) {
    return items.filter((i) => i.categoryId === promo.categoryId);
  }
  return items;
}

export function calculateOrderPricing(params: {
  items: PricingCartItem[];
  baseCurrency: CurrencyCode;
  exchangeRates: Record<string, number>;
  promotions?: PricingPromotionRule[];
  coupon?: PricingCouponRule | null;
  rawShippingCost?: number;
  shippingCurrency?: CurrencyCode;
  freeShippingMin?: number | null;
}): OrderPricingResult {
  const {
    items,
    baseCurrency,
    exchangeRates,
    promotions = [],
    coupon = null,
    rawShippingCost = 0,
    shippingCurrency = baseCurrency,
    freeShippingMin = null,
  } = params;

  const normalizedItems = items.map((item) => {
    const convertedUnit = convertCurrency(
      item.unitPrice,
      item.currency,
      baseCurrency,
      exchangeRates,
    );
    const unitBaseCents = toCents(convertedUnit);
    return {
      ...item,
      unitBaseCents,
    };
  });

  const subtotalCents = normalizedItems.reduce(
    (sum, item) => sum + item.unitBaseCents * item.quantity,
    0,
  );

  const appliedDiscounts: AppliedDiscountDetail[] = [];
  let totalPromoCents = 0;

  for (const promo of promotions) {
    if (!promo.active) continue;
    const eligible = getEligibleItems(normalizedItems, promo);
    if (eligible.length === 0) continue;

    let promoDiscountCents = 0;

    if (promo.type === 'percent') {
      const pct = Math.min(100, Math.max(0, promo.discountValue));
      const eligibleCents = eligible.reduce(
        (sum, item) => sum + item.unitBaseCents * item.quantity,
        0,
      );
      promoDiscountCents = Math.round((eligibleCents * pct) / 100);
    } else if (promo.type === 'min_amount') {
      const eligibleCents = eligible.reduce(
        (sum, item) => sum + item.unitBaseCents * item.quantity,
        0,
      );
      const minCents = toCents(promo.minAmount);
      if (eligibleCents >= minCents) {
        promoDiscountCents = Math.min(eligibleCents, toCents(promo.discountValue));
      }
    } else if (promo.type === 'bogo_2x1') {
      const unitPrices: number[] = [];
      for (const item of eligible) {
        for (let k = 0; k < item.quantity; k += 1) {
          unitPrices.push(item.unitBaseCents);
        }
      }
      unitPrices.sort((a, b) => a - b);
      const freeUnits = Math.floor(unitPrices.length / 2);
      for (let i = 0; i < freeUnits; i += 1) {
        promoDiscountCents += unitPrices[i] ?? 0;
      }
    } else if (promo.type === 'bogo_3x2') {
      const unitPrices: number[] = [];
      for (const item of eligible) {
        for (let k = 0; k < item.quantity; k += 1) {
          unitPrices.push(item.unitBaseCents);
        }
      }
      unitPrices.sort((a, b) => a - b);
      const freeUnits = Math.floor(unitPrices.length / 3);
      for (let i = 0; i < freeUnits; i += 1) {
        promoDiscountCents += unitPrices[i] ?? 0;
      }
    } else if (promo.type === 'second_unit') {
      const pct = Math.min(100, Math.max(0, promo.discountValue > 0 ? promo.discountValue : 50));
      const unitPrices: number[] = [];
      for (const item of eligible) {
        for (let k = 0; k < item.quantity; k += 1) {
          unitPrices.push(item.unitBaseCents);
        }
      }
      unitPrices.sort((a, b) => a - b);
      const discountedUnits = Math.floor(unitPrices.length / 2);
      for (let i = 0; i < discountedUnits; i += 1) {
        promoDiscountCents += Math.round(((unitPrices[i] ?? 0) * pct) / 100);
      }
    } else if (promo.type === 'combo') {
      const requiredIds = promo.productIds ?? [];
      if (requiredIds.length >= 2) {
        const qtyByProduct = new Map<string, number>();
        const priceByProduct = new Map<string, number>();
        for (const item of normalizedItems) {
          qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
          if (!priceByProduct.has(item.productId)) {
            priceByProduct.set(item.productId, item.unitBaseCents);
          }
        }
        const comboSets = Math.min(...requiredIds.map((pid) => qtyByProduct.get(pid) ?? 0));
        if (comboSets >= 1) {
          const singleComboBaseCents = requiredIds.reduce(
            (sum, pid) => sum + (priceByProduct.get(pid) ?? 0),
            0,
          );
          const pct = Math.min(100, Math.max(0, promo.discountValue));
          promoDiscountCents = Math.round((singleComboBaseCents * comboSets * pct) / 100);
        }
      }
    }

    const availableHeadroom = Math.max(0, subtotalCents - totalPromoCents);
    const clampedPromoCents = Math.min(availableHeadroom, Math.max(0, promoDiscountCents));

    if (clampedPromoCents > 0) {
      totalPromoCents += clampedPromoCents;
      appliedDiscounts.push({
        kind: 'promotion',
        id: promo.id,
        name: promo.name,
        discountAmount: fromCents(clampedPromoCents),
      });
    }
  }

  const afterPromosCents = Math.max(0, subtotalCents - totalPromoCents);
  let couponDiscountCents = 0;

  if (coupon && afterPromosCents > 0) {
    const minOrderBaseCents = toCents(
      convertCurrency(coupon.minOrderAmount, coupon.currency, baseCurrency, exchangeRates),
    );
    if (subtotalCents >= minOrderBaseCents) {
      if (coupon.discountType === 'percent') {
        const pct = Math.min(100, Math.max(0, coupon.discountValue));
        couponDiscountCents = Math.round((afterPromosCents * pct) / 100);
      } else {
        const fixedBase = convertCurrency(
          coupon.discountValue,
          coupon.currency,
          baseCurrency,
          exchangeRates,
        );
        couponDiscountCents = toCents(fixedBase);
      }
      couponDiscountCents = Math.min(afterPromosCents, Math.max(0, couponDiscountCents));
      if (couponDiscountCents > 0) {
        appliedDiscounts.push({
          kind: 'coupon',
          name: `Cupón ${coupon.code}`,
          discountAmount: fromCents(couponDiscountCents),
        });
      }
    }
  }

  const discountTotalCents = totalPromoCents + couponDiscountCents;
  const netSubtotalCents = Math.max(0, subtotalCents - discountTotalCents);

  const rawShippingCents = toCents(
    convertCurrency(rawShippingCost, shippingCurrency, baseCurrency, exchangeRates),
  );
  const freeShippingMinCents =
    freeShippingMin !== null && freeShippingMin !== undefined && freeShippingMin > 0
      ? toCents(freeShippingMin)
      : null;

  const freeShippingApplied =
    freeShippingMinCents !== null && netSubtotalCents >= freeShippingMinCents;
  const finalShippingCents = freeShippingApplied ? 0 : rawShippingCents;
  const totalCents = Math.max(0, netSubtotalCents + finalShippingCents);

  return {
    subtotal: fromCents(subtotalCents),
    promotionDiscount: fromCents(totalPromoCents),
    couponDiscount: fromCents(couponDiscountCents),
    discountTotal: fromCents(discountTotalCents),
    shippingCost: fromCents(finalShippingCents),
    freeShippingApplied,
    total: fromCents(totalCents),
    currency: baseCurrency,
    appliedDiscounts,
  };
}


