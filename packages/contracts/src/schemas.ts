import { z } from 'zod';
import { TERMS_VERSION, normalizeCubanWhatsApp } from './cuba';
import { CURRENCIES } from './pricing';
import { validateStoreSlug } from './slug';

export const dayHoursSchema = z.object({
  open: z.boolean(),
  from: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido.'),
  to: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido.'),
});

export const weeklyHoursSchema = z.object({
  mon: dayHoursSchema,
  tue: dayHoursSchema,
  wed: dayHoursSchema,
  thu: dayHoursSchema,
  fri: dayHoursSchema,
  sat: dayHoursSchema,
  sun: dayHoursSchema,
});

export const syncProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Escribe tu nombre (mínimo 2 caracteres).')
    .max(100, 'Máximo 100 caracteres.'),
  phone: z.string().trim().max(24).optional().nullable(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar los términos y la política de privacidad.' }),
  }),
  termsVersion: z.string().trim().min(3).max(32).default(TERMS_VERSION),
});

export const updateUserProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres.')
    .max(100, 'Máximo 100 caracteres.'),
  phone: z.string().trim().max(24).optional().nullable(),
});

export const createStoreOnboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre de la tienda debe tener al menos 2 caracteres.')
    .max(100, 'Máximo 100 caracteres.'),
  category: z
    .string()
    .trim()
    .min(2, 'Selecciona el rubro de tu negocio.')
    .max(60),
  whatsapp: z
    .string()
    .trim()
    .refine((val) => normalizeCubanWhatsApp(val) !== null, {
      message: 'Introduce un número móvil cubano válido (+53 5XXXXXXX).',
    }),
  slug: z
    .string()
    .trim()
    .superRefine((val, ctx) => {
      const check = validateStoreSlug(val);
      if (!check.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.reason ?? 'Enlace no válido.',
        });
      }
    }),
});

export const updateBusinessProfileSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(100),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional().nullable(),
  whatsapp: z
    .string()
    .trim()
    .refine((val) => normalizeCubanWhatsApp(val) !== null, {
      message: 'Número móvil cubano inválido (+53 5XXXXXXX).',
    }),
  telegram: z.string().trim().max(64).optional().nullable(),
  province: z.string().trim().min(2, 'Selecciona una provincia.').max(60),
  municipality: z.string().trim().min(2, 'Selecciona un municipio.').max(60),
  streetAddress: z.string().trim().max(220).optional().nullable(),
  hours: z
    .object({
      weekly: weeklyHoursSchema,
      instagram: z.string().trim().max(120).optional().nullable(),
      facebook: z.string().trim().max(120).optional().nullable(),
      responseTime: z.string().trim().max(80).optional().nullable(),
    })
    .optional(),
});

export const categoryScheduleSchema = z.object({
  enabled: z.boolean().default(false),
  days: z
    .array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
    .default(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  from: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido.').default('08:00'),
  to: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido.').default('18:00'),
});

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(80, 'Máximo 80 caracteres.'),
  active: z.boolean().optional().default(true),
  schedule: categoryScheduleSchema.optional().nullable(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  active: z.boolean().optional(),
  schedule: categoryScheduleSchema.optional().nullable(),
});

export const reorderCategoriesSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1).max(200),
});

export const reorderProductsSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1).max(500),
});

export const productImageRefSchema = z.object({
  objectPath: z.string().trim().min(3).max(260),
  publicUrl: z.string().trim().url().max(600),
  alt: z.string().trim().max(120).optional().default(''),
});

export const productVariantInputSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1, 'Etiqueta obligatoria.').max(100),
  sku: z.string().trim().max(64).optional().nullable(),
  attributes: z.record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(60)).refine(
    (attrs) => Object.keys(attrs).length >= 1 && Object.keys(attrs).length <= 3,
    { message: 'Cada variante debe definir entre 1 y 3 atributos.' },
  ),
  priceOverride: z.number().positive('El precio debe ser mayor a 0.').max(100000000).optional().nullable(),
  stock: z.number().int().min(0).max(1000000).optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const createProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres.')
      .max(120, 'Máximo 120 caracteres.'),
    description: z.string().trim().max(1200).optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    price: z.number({ invalid_type_error: 'Indica un precio válido.' }).positive('El precio debe ser mayor a 0.').max(100000000),
    compareAtPrice: z
      .number()
      .positive('El precio tachado debe ser mayor a 0.')
      .max(100000000)
      .optional()
      .nullable(),
    currency: z.enum(CURRENCIES).optional().default('CUP'),
    stock: z.number().int().min(0).max(1000000).optional().nullable(),
    active: z.boolean().optional().default(true),
    soldOut: z.boolean().optional().default(false),
    images: z.array(productImageRefSchema).max(10).optional().default([]),
    variantAttributeNames: z
      .array(z.string().trim().min(1).max(40))
      .max(3, 'Puedes usar hasta 3 atributos por producto.')
      .optional()
      .default([]),
    variants: z.array(productVariantInputSchema).max(60).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (
      data.compareAtPrice !== undefined &&
      data.compareAtPrice !== null &&
      data.compareAtPrice <= data.price
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['compareAtPrice'],
        message: 'El precio tachado debe ser mayor que el precio de venta.',
      });
    }
  });

export const updateProductSchema = createProductSchema;

export const toggleSoldOutSchema = z.object({
  soldOut: z.boolean(),
});

export const signedUploadRequestSchema = z.object({
  bucket: z.enum(['product-images', 'store-assets']),
  mimeType: z.enum(['image/webp', 'image/jpeg', 'image/png']),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(2 * 1024 * 1024, 'La imagen comprimida no puede superar 2 MB.'),
});

export type SyncProfileInput = z.infer<typeof syncProfileSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type CreateStoreOnboardingInput = z.infer<typeof createStoreOnboardingSchema>;
export type UpdateBusinessProfileInput = z.infer<typeof updateBusinessProfileSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type ProductImageRef = z.infer<typeof productImageRefSchema>;
export type ProductVariantInput = z.infer<typeof productVariantInputSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ToggleSoldOutInput = z.infer<typeof toggleSoldOutSchema>;
export type SignedUploadRequestInput = z.infer<typeof signedUploadRequestSchema>;

export const guestCheckoutSchema = z.object({
  customerName: z.string().trim().min(2, 'Escribe tu nombre y apellidos.').max(100),
  phone: z
    .string()
    .trim()
    .refine((val) => normalizeCubanWhatsApp(val) !== null, {
      message: 'Introduce tu número móvil cubano (+53 5XXXXXXX) para el pedido.',
    }),
  province: z.string().trim().min(2, 'Selecciona tu provincia.').max(60),
  municipality: z.string().trim().min(2, 'Selecciona tu municipio.').max(60),
  streetAddress: z.string().trim().min(3, 'Escribe tu dirección exacta (calle, número, entre calles).').max(220),
  notes: z.string().trim().max(300).optional().nullable(),
  fulfillmentType: z.enum(['delivery', 'pickup']).default('delivery'),
  paymentMethodId: z.string().uuid().optional().nullable(),
  couponCode: z.string().trim().max(40).optional().nullable(),
  idempotencyKey: z.string().trim().max(80).optional().nullable(),
  channel: z.enum(['whatsapp', 'telegram']).default('whatsapp'),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional().nullable(),
        quantity: z.number().int().positive().max(1000),
      }),
    )
    .min(1, 'El carrito está vacío.')
    .max(50),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['created', 'confirmed', 'preparing', 'dispatched', 'delivered', 'cancelled']),
  note: z.string().trim().max(240).optional().nullable(),
  cancelReason: z.string().trim().max(240).optional().nullable(),
});

export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const shippingZoneSchema = z.object({
  province: z.string().trim().min(2, 'Provincia obligatoria.').max(60),
  municipality: z.string().trim().max(60).optional().nullable(),
  cost: z.number({ invalid_type_error: 'Indica un costo de envío válido.' }).min(0).max(1000000),
  currency: z.enum(CURRENCIES).default('CUP'),
  active: z.boolean().optional().default(true),
});

export const paymentMethodSchema = z.object({
  type: z.enum(['cash', 'transfermovil', 'enzona', 'bank_transfer', 'other']),
  label: z.string().trim().min(2, 'Nombre del medio de pago obligatorio.').max(80),
  currencies: z.array(z.enum(CURRENCIES)).min(1, 'Selecciona al menos una moneda.'),
  instructions: z.string().trim().max(400).optional().nullable(),
  accountData: z.string().trim().max(160).optional().nullable(),
  enabled: z.boolean().optional().default(true),
});

export const enzonaCredentialSchema = z.object({
  clientId: z.string().trim().min(5, 'Client ID requerido.').max(120),
  clientSecret: z.string().trim().min(5, 'Client Secret requerido.').max(120),
  sandbox: z.boolean().default(true),
});

export const exchangeRatesSchema = z.object({
  USD: z.number().positive('Tasa USD debe ser mayor a 0.').max(10000),
  MLC: z.number().positive('Tasa MLC debe ser mayor a 0.').max(10000),
});

export type ShippingZoneInput = z.infer<typeof shippingZoneSchema>;
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;
export type EnzonaCredentialInput = z.infer<typeof enzonaCredentialSchema>;
export type ExchangeRatesInput = z.infer<typeof exchangeRatesSchema>;

export const createSubscriptionRequestSchema = z.object({
  currency: z.enum(CURRENCIES),
  amount: z.number().positive('El monto debe ser mayor a 0.'),
  paymentMethodLabel: z.string().trim().min(2, 'Especifica el medio de pago.').max(60),
  reference: z.string().trim().min(2, 'Indica el número de transacción o referencia.').max(80),
  receiptObjectKey: z.string().trim().min(3, 'Comprobante obligatorio.').max(255),
});

export const reviewSubscriptionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().trim().max(240).optional().nullable(),
});

export const createReportSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  targetType: z.enum(['store', 'product']),
  reason: z.string().trim().min(2, 'Indica el motivo del reporte.').max(80),
  details: z.string().trim().min(5, 'Describe con más detalle el problema (mínimo 5 caracteres).').max(500),
  reporterContact: z.string().trim().max(120).optional().nullable(),
});

export const reviewReportSchema = z.object({
  status: z.enum(['reviewing', 'resolved', 'dismissed']),
  resolutionNote: z.string().trim().max(300).optional().nullable(),
});

export const updateStoreStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  suspendedReason: z.string().trim().max(240).optional().nullable(),
});

export const updatePlansConfigSchema = z.object({
  freeLimits: z.object({
    maxProducts: z.number().int().min(1),
    maxImagesPerProduct: z.number().int().min(1),
    maxCategories: z.number().int().min(1),
  }),
  proLimits: z.object({
    maxProducts: z.number().int().min(1),
    maxImagesPerProduct: z.number().int().min(1),
    maxCategories: z.number().int().min(1),
  }),
  proPriceCup: z.number().positive(),
  proPriceUsd: z.number().positive(),
  proDurationDays: z.number().int().positive(),
  paymentInstructions: z.string().trim().max(600),
});

export type CreateSubscriptionRequestInput = z.infer<typeof createSubscriptionRequestSchema>;
export type ReviewSubscriptionInput = z.infer<typeof reviewSubscriptionSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ReviewReportInput = z.infer<typeof reviewReportSchema>;
export type UpdateStoreStatusInput = z.infer<typeof updateStoreStatusSchema>;
export type UpdatePlansConfigInput = z.infer<typeof updatePlansConfigSchema>;

export const STORE_FONT_PRESETS = ['outfit', 'plus-jakarta', 'fraunces', 'archivo'] as const;
export type StoreFontPreset = (typeof STORE_FONT_PRESETS)[number];

export const storeThemeSchema = z.object({
  seedColor: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color hexadecimal inválido (ej. #00796B).')
    .default('#00796B'),
  mode: z.enum(['light', 'dark']).default('light'),
  fontFamily: z.enum(STORE_FONT_PRESETS).default('outfit'),
  logo: productImageRefSchema.optional().nullable(),
  cover: productImageRefSchema.optional().nullable(),
});

export type StoreThemeConfig = z.infer<typeof storeThemeSchema>;
export type ReorderProductsInput = z.infer<typeof reorderProductsSchema>;

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, 'Código mínimo de 2 caracteres.')
      .max(40, 'Máximo 40 caracteres.')
      .regex(/^[A-Z0-9_-]+$/, 'Solo letras, números, guion y guion bajo.'),
    discountType: z.enum(['percent', 'fixed']),
    discountValue: z.number().positive('El descuento debe ser mayor a 0.'),
    currency: z.enum(CURRENCIES).default('CUP'),
    minOrderAmount: z.number().min(0).default(0),
    startsAt: z.string().datetime({ offset: true }).or(z.string().min(4)),
    endsAt: z.string().datetime({ offset: true }).or(z.string().min(4)),
    maxUses: z.number().int().positive().optional().nullable(),
    active: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === 'percent' && data.discountValue > 99) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'El porcentaje de descuento no puede superar el 99%.',
      });
    }
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'La fecha de vencimiento debe ser posterior a la fecha de inicio.',
      });
    }
  });

export const updateCouponSchema = createCouponSchema;

export const createPromotionSchema = z
  .object({
    name: z.string().trim().min(2, 'Nombre obligatorio.').max(100),
    type: z.enum(['percent', 'min_amount', 'bogo_2x1', 'bogo_3x2', 'second_unit', 'combo']),
    discountValue: z.number().min(0).default(0),
    minAmount: z.number().min(0).default(0),
    categoryId: z.string().uuid().optional().nullable(),
    productIds: z.array(z.string().uuid()).max(50).optional().default([]),
    active: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if ((data.type === 'percent' || data.type === 'second_unit' || data.type === 'combo') && (data.discountValue <= 0 || data.discountValue > 99)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Indica un porcentaje entre 1 y 99%.',
      });
    }
    if (data.type === 'min_amount' && (data.discountValue <= 0 || data.minAmount <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minAmount'],
        message: 'Indica el monto mínimo y el descuento fijo a aplicar.',
      });
    }
    if (data.type === 'combo' && (!data.productIds || data.productIds.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productIds'],
        message: 'Un combo requiere seleccionar al menos 2 productos.',
      });
    }
  });

export const updatePromotionSchema = createPromotionSchema;

export const quoteOrderSchema = z.object({
  province: z.string().trim().optional().default('La Habana'),
  municipality: z.string().trim().optional().default('Playa'),
  fulfillmentType: z.enum(['delivery', 'pickup']).default('delivery'),
  couponCode: z.string().trim().max(40).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional().nullable(),
        quantity: z.number().int().positive().max(1000),
      }),
    )
    .min(1, 'El carrito está vacío.')
    .max(50),
});

export const importProductsCsvSchema = z.object({
  csvContent: z.string().min(3, 'El archivo CSV está vacío.').max(2_000_000),
});

export const supportTicketSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre (mínimo 2 caracteres).').max(100),
  contact: z.string().trim().min(4, 'Indica tu WhatsApp, Telegram o correo.').max(120),
  channel: z.enum(['whatsapp', 'telegram', 'email']).default('whatsapp'),
  storeSlug: z.string().trim().max(60).optional().nullable(),
  topic: z.string().trim().min(2, 'Selecciona un tema.').max(120),
  message: z.string().trim().min(10, 'Cuéntanos más detalles (mínimo 10 caracteres).').max(1500),
});

export const updateSupportTicketStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type QuoteOrderInput = z.infer<typeof quoteOrderSchema>;
export type ImportProductsCsvInput = z.infer<typeof importProductsCsvSchema>;
export type SupportTicketInput = z.infer<typeof supportTicketSchema>;
export type UpdateSupportTicketStatusInput = z.infer<typeof updateSupportTicketStatusSchema>;




