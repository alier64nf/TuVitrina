import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { TOKEN_VERIFIER, type TokenVerifier } from '../src/common/guards/supabase-jwt.guard';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

describe('TuVitrina Fase 5 API (Personalización, Cupones, Promociones, CSV, Clientes y Analítica)', () => {
  let app: INestApplication;

  const sellerUid = '11111111-1111-4111-8111-111111111111';
  const storeId = '33333333-3333-4333-8333-333333333333';
  const catId = '44444444-4444-4444-8444-444444444444';
  const prod1Id = '55555555-5555-4555-8555-555555555555';
  const prod2Id = '66666666-6666-4666-8666-666666666666';

  let currentStore: any = {
    id: storeId,
    ownerId: sellerUid,
    slug: 'bodega-pro',
    name: 'Bodega PRO',
    category: 'Alimentos y bebidas',
    description: 'Tienda PRO de prueba',
    whatsapp: '+5352345678',
    telegram: '@bodegapro',
    province: 'La Habana',
    municipality: 'Playa',
    streetAddress: '5ta Ave #100',
    hours: null,
    theme: { seedColor: '#00796B', mode: 'light', fontFamily: 'outfit' },
    baseCurrency: 'CUP',
    acceptedCurrencies: ['CUP', 'USD'],
    exchangeRates: { USD: 320, MLC: 270 },
    freeShippingMin: 5000,
    pickupEnabled: true,
    plan: 'pro',
    planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'active',
    suspendedReason: null,
    orderSeq: 0,
    cacheVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const categoriesList: any[] = [
    {
      id: catId,
      storeId,
      name: 'Ofertas',
      sortOrder: 0,
      active: true,
      schedule: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const productsList: any[] = [
    {
      id: prod1Id,
      storeId,
      categoryId: catId,
      name: 'Café Cubano 500g',
      description: 'Tostado artesanal',
      price: 1000,
      compareAtPrice: null,
      currency: 'CUP',
      stock: 20,
      active: true,
      soldOut: false,
      sortOrder: 0,
      images: [
        { objectPath: `${storeId}/cafe-1.webp`, publicUrl: 'https://cdn.test/cafe-1.webp', alt: '' },
        { objectPath: `${storeId}/cafe-2.webp`, publicUrl: 'https://cdn.test/cafe-2.webp', alt: '' },
        { objectPath: `${storeId}/cafe-3.webp`, publicUrl: 'https://cdn.test/cafe-3.webp', alt: '' },
        { objectPath: `${storeId}/cafe-4.webp`, publicUrl: 'https://cdn.test/cafe-4.webp', alt: '' },
      ],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: prod2Id,
      storeId,
      categoryId: catId,
      name: 'Miel Pura 1L',
      description: 'Miel natural',
      price: 500,
      compareAtPrice: null,
      currency: 'CUP',
      stock: 15,
      active: true,
      soldOut: false,
      sortOrder: 1,
      images: [],
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const couponsList: any[] = [];
  const promotionsList: any[] = [];
  const ordersList: any[] = [];
  const shippingZonesList: any[] = [
    {
      id: randomUUID(),
      storeId,
      province: 'La Habana',
      municipality: 'Playa',
      cost: 300,
      currency: 'CUP',
      active: true,
    },
  ];
  const paymentMethodsList: any[] = [
    {
      id: '77777777-7777-4777-8777-777777777777',
      storeId,
      type: 'cash',
      label: 'Efectivo (CUP)',
      currencies: ['CUP'],
      instructions: 'Pago al recibir',
      accountData: null,
      enabled: true,
      sortOrder: 0,
    },
  ];
  const analyticsDailyList: any[] = [
    { id: randomUUID(), storeId, day: new Date(new Date().setHours(0, 0, 0, 0)), visits: 10 },
  ];

  const mockDb: any = {
    isConfigured: () => true,
    ensureConfigured: () => undefined,
    checkHealth: async () => 'up' as const,
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    $transaction: async (arg: any) => (typeof arg === 'function' ? arg(mockDb) : Promise.all(arg)),
    plansConfig: {
      findUnique: async () => ({
        id: randomUUID(),
        key: 'default',
        freeLimits: { maxProducts: 50, maxImagesPerProduct: 3, maxCategories: 15 },
        proLimits: { maxProducts: 100000, maxImagesPerProduct: 10, maxCategories: 200 },
        proPriceCup: 3000,
        proPriceUsd: 10,
        proDurationDays: 60,
        paymentInstructions: 'Transferir',
        updatedAt: new Date(),
      }),
    },
    profile: {
      findUnique: async ({ where }: any) => {
        if (where.id === sellerUid) {
          return {
            id: sellerUid,
            email: 'pro@tuvitrina.cu',
            displayName: 'Elena PRO',
            phone: '+5352345678',
            role: 'seller',
            termsVersion: '2026-11-v1',
            acceptedTermsAt: new Date(),
          };
        }
        return null;
      },
    },
    store: {
      findFirst: async () => currentStore,
      findUnique: async ({ where }: any) => {
        if (where.id === storeId || where.slug === 'bodega-pro') {
          return {
            ...currentStore,
            categories: categoriesList,
            products: productsList,
            paymentMethods: paymentMethodsList,
            promotions: promotionsList.filter((p) => p.active),
            shippingZones: shippingZonesList,
          };
        }
        return null;
      },
      update: async ({ data }: any) => {
        if (data.orderSeq?.increment) {
          currentStore.orderSeq += data.orderSeq.increment;
        }
        if (data.cacheVersion?.increment) {
          currentStore.cacheVersion += data.cacheVersion.increment;
        }
        const rest = { ...data };
        delete rest.orderSeq;
        delete rest.cacheVersion;
        currentStore = { ...currentStore, ...rest, updatedAt: new Date() };
        return currentStore;
      },
    },
    category: {
      count: async () => categoriesList.length,
      findFirst: async ({ where }: any) =>
        categoriesList.find((c) => c.id === where.id) ?? categoriesList[categoriesList.length - 1] ?? null,
      findMany: async () => categoriesList,
      create: async ({ data }: any) => {
        const created = {
          id: randomUUID(),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        categoriesList.push(created);
        return created;
      },
      update: async ({ where, data }: any) => {
        const idx = categoriesList.findIndex((c) => c.id === where.id);
        categoriesList[idx] = { ...categoriesList[idx], ...data, updatedAt: new Date() };
        return categoriesList[idx];
      },
    },
    product: {
      count: async (args?: any) => {
        const idsIn = args?.where?.id?.in as string[] | undefined;
        if (Array.isArray(idsIn)) {
          return productsList.filter((p) => idsIn.includes(p.id)).length;
        }
        return productsList.length;
      },
      findFirst: async ({ where }: any) =>
        where?.id ? productsList.find((p) => p.id === where.id) ?? null : productsList[productsList.length - 1] ?? null,
      findMany: async () => productsList,
      create: async ({ data }: any) => {
        const created = {
          id: randomUUID(),
          ...data,
          variants: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        productsList.push(created);
        return created;
      },
      update: async ({ where, data }: any) => {
        const idx = productsList.findIndex((p) => p.id === where.id);
        if (idx !== -1) {
          productsList[idx] = { ...productsList[idx], ...data, updatedAt: new Date() };
          return productsList[idx];
        }
        return null;
      },
    },
    coupon: {
      findMany: async () => couponsList,
      findFirst: async ({ where }: any) =>
        couponsList.find((c) => c.id === where.id && c.storeId === where.storeId) ?? null,
      findUnique: async ({ where }: any) => {
        if (where.storeId_code) {
          return (
            couponsList.find(
              (c) => c.storeId === where.storeId_code.storeId && c.code === where.storeId_code.code,
            ) ?? null
          );
        }
        return null;
      },
      create: async ({ data }: any) => {
        const created = {
          id: randomUUID(),
          usedCount: 0,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        couponsList.push(created);
        return created;
      },
      update: async ({ where, data }: any) => {
        const idx = couponsList.findIndex((c) => c.id === where.id);
        const next = { ...couponsList[idx], ...data, updatedAt: new Date() };
        if (data.usedCount?.increment) {
          next.usedCount = couponsList[idx].usedCount + data.usedCount.increment;
        }
        couponsList[idx] = next;
        return next;
      },
      updateMany: async ({ where, data }: any) => {
        const idx = couponsList.findIndex(
          (c) =>
            c.id === where.id &&
            (where.usedCount?.lt === undefined || c.usedCount < where.usedCount.lt),
        );
        if (idx === -1) return { count: 0 };
        couponsList[idx].usedCount += data.usedCount?.increment ?? 0;
        return { count: 1 };
      },
      delete: async ({ where }: any) => {
        const idx = couponsList.findIndex((c) => c.id === where.id);
        if (idx !== -1) couponsList.splice(idx, 1);
        return { id: where.id };
      },
    },
    promotion: {
      findMany: async () => promotionsList,
      findFirst: async ({ where }: any) =>
        promotionsList.find((p) => p.id === where.id && p.storeId === where.storeId) ?? null,
      create: async ({ data }: any) => {
        const created = {
          id: randomUUID(),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        promotionsList.push(created);
        return created;
      },
      update: async ({ where, data }: any) => {
        const idx = promotionsList.findIndex((p) => p.id === where.id);
        promotionsList[idx] = { ...promotionsList[idx], ...data, updatedAt: new Date() };
        return promotionsList[idx];
      },
      delete: async ({ where }: any) => {
        const idx = promotionsList.findIndex((p) => p.id === where.id);
        if (idx !== -1) promotionsList.splice(idx, 1);
        return { id: where.id };
      },
    },
    order: {
      create: async ({ data }: any) => {
        const id = randomUUID();
        const created = {
          id,
          ...data,
          items: (data.items?.create ?? []).map((it: any) => ({ id: randomUUID(), orderId: id, ...it })),
          statusHistory: (data.statusHistory?.create ? [data.statusHistory.create] : []).map((h: any) => ({
            id: randomUUID(),
            orderId: id,
            fromStatus: null,
            ...h,
            createdAt: new Date(),
          })),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        ordersList.push(created);
        return created;
      },
      findMany: async () => [...ordersList].reverse(),
    },
    analyticsDaily: {
      upsert: async () => analyticsDailyList[0],
      findMany: async () => analyticsDailyList,
    },
  };

  const redisStore = new Map<string, string>();
  const mockRedis = {
    isConfigured: () => true,
    checkHealth: async () => 'up' as const,
    get: async (key: string) => redisStore.get(key) ?? null,
    set: async (key: string, val: string) => {
      redisStore.set(key, val);
      return 'OK';
    },
    del: async (key: string) => {
      redisStore.delete(key);
      return 1;
    },
    getJson: async (key: string) => {
      const v = redisStore.get(key);
      return v ? JSON.parse(v) : null;
    },
    setJson: async (key: string, val: any) => {
      redisStore.set(key, JSON.stringify(val));
      return 'OK';
    },
    incrementRateLimit: async () => ({ count: 1, ttlSeconds: 60 }),
    incrementWithExpiry: async () => 1,
    close: async () => undefined,
  };

  const mockTokenVerifier: TokenVerifier = {
    verify: async (token: string) => {
      if (token === 'seller-token') {
        return { uid: sellerUid, sub: sellerUid, email: 'pro@tuvitrina.cu' };
      }
      throw new Error('Invalid token');
    },
  };

  beforeAll(async () => {
    process.env.ENZONA_ENCRYPTION_KEY = '01234567890123456789012345678901';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockDb)
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(mockTokenVerifier)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Personalización: actualiza color semilla, modo oscuro, fuente y logo de la tienda', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/stores/me/theme')
      .set('Authorization', 'Bearer seller-token')
      .send({
        seedColor: '#1565C0',
        mode: 'dark',
        fontFamily: 'fraunces',
        logo: {
          objectPath: `${storeId}/logo.webp`,
          publicUrl: 'https://cdn.test/logo.webp',
          alt: 'Logo',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.theme.seedColor).toBe('#1565C0');
    expect(res.body.theme.mode).toBe('dark');
    expect(res.body.theme.fontFamily).toBe('fraunces');
  });

  it('2. Reordenamiento manual de productos y horario por categoría', async () => {
    const catRes = await request(app.getHttpServer())
      .patch(`/api/v1/stores/me/categories/${catId}`)
      .set('Authorization', 'Bearer seller-token')
      .send({
        schedule: {
          enabled: true,
          days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          from: '00:00',
          to: '23:59',
        },
      });
    expect(catRes.status).toBe(200);
    expect(catRes.body.schedule.enabled).toBe(true);
    expect(catRes.body.isAvailableNow).toBe(true);

    const reorderRes = await request(app.getHttpServer())
      .put('/api/v1/stores/me/products/reorder')
      .set('Authorization', 'Bearer seller-token')
      .send({ productIds: [prod2Id, prod1Id] });
    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.reordered).toBe(true);
    expect(productsList.find((p) => p.id === prod2Id)?.sortOrder).toBe(0);
    expect(productsList.find((p) => p.id === prod1Id)?.sortOrder).toBe(1);
  });

  it('3. Importación de productos desde CSV con reporte de errores por fila', async () => {
    const csvContent = [
      'nombre,precio,moneda,categoria,stock',
      'Pan Artesanal,250,CUP,Panadería,10',
      'X,-50,CUP,Panadería,5',
      'Jugo Natural,300,XYZ,Bebidas,8',
    ].join('\n');

    const res = await request(app.getHttpServer())
      .post('/api/v1/stores/me/products/import-csv')
      .set('Authorization', 'Bearer seller-token')
      .send({ csvContent });

    expect(res.status).toBe(201);
    expect(res.body.importedCount).toBe(1);
    expect(res.body.skippedCount).toBe(2);
    expect(res.body.errors).toHaveLength(2);
    expect(res.body.errors[0].row).toBe(3);
    expect(res.body.errors[1].row).toBe(4);
  });

  it('4. Aplica promoción automática + cupón en el mismo pedido sin errores de cálculo', async () => {
    // Promoción automática 2x1 en Café Cubano (1000 CUP)
    const promoRes = await request(app.getHttpServer())
      .post('/api/v1/stores/me/promotions')
      .set('Authorization', 'Bearer seller-token')
      .send({
        name: '2x1 en Café',
        type: 'bogo_2x1',
        discountValue: 0,
        minAmount: 0,
        productIds: [prod1Id],
        active: true,
      });
    expect(promoRes.status).toBe(201);

    // Cupón adicional de 10% sobre el monto restante
    const couponRes = await request(app.getHttpServer())
      .post('/api/v1/stores/me/coupons')
      .set('Authorization', 'Bearer seller-token')
      .send({
        code: 'PRO10',
        discountType: 'percent',
        discountValue: 10,
        currency: 'CUP',
        minOrderAmount: 1000,
        startsAt: new Date(Date.now() - 3600_000).toISOString(),
        endsAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
        maxUses: 1,
        active: true,
      });
    expect(couponRes.status).toBe(201);

    // 2x Café (2000 CUP) + 2x Miel (1000 CUP) = 3000 CUP subtotal
    // Promo 2x1 en Café = -1000 CUP => queda 2000 CUP
    // Cupón PRO10 (10% de 2000 CUP) = -200 CUP => neto 1800 CUP
    // Envío Playa = 300 CUP (neto 1800 < freeShippingMin 5000) => Total = 2100 CUP
    const quoteRes = await request(app.getHttpServer())
      .post('/api/v1/storefronts/bodega-pro/quote')
      .send({
        province: 'La Habana',
        municipality: 'Playa',
        fulfillmentType: 'delivery',
        couponCode: 'pro10',
        items: [
          { productId: prod1Id, quantity: 2 },
          { productId: prod2Id, quantity: 2 },
        ],
      });

    expect(quoteRes.status).toBe(201);
    expect(quoteRes.body.couponApplied).toBe('PRO10');
    expect(quoteRes.body.pricing.subtotal).toBe(3000);
    expect(quoteRes.body.pricing.promotionDiscount).toBe(1000);
    expect(quoteRes.body.pricing.couponDiscount).toBe(200);
    expect(quoteRes.body.pricing.discountTotal).toBe(1200);
    expect(quoteRes.body.pricing.shippingCost).toBe(300);
    expect(quoteRes.body.pricing.total).toBe(2100);

    // Crear pedido real con nombre potencialmente peligroso para probar neutralización CSV después
    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/storefronts/bodega-pro/orders')
      .send({
        customerName: '=CMD|Carlos',
        phone: '+5358881122',
        province: 'La Habana',
        municipality: 'Playa',
        streetAddress: 'Calle 42 #110',
        fulfillmentType: 'delivery',
        paymentMethodId: paymentMethodsList[0].id,
        couponCode: 'PRO10',
        channel: 'whatsapp',
        items: [
          { productId: prod1Id, quantity: 2 },
          { productId: prod2Id, quantity: 2 },
        ],
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.order.subtotal).toBe(3000);
    expect(orderRes.body.order.discountTotal).toBe(1200);
    expect(orderRes.body.order.shippingCost).toBe(300);
    expect(orderRes.body.order.total).toBe(2100);
    expect(orderRes.body.order.couponCode).toBe('PRO10');

    // El cupón tenía maxUses = 1, un segundo intento debe rechazarse
    const secondRes = await request(app.getHttpServer())
      .post('/api/v1/storefronts/bodega-pro/orders')
      .send({
        customerName: 'Ana Pérez',
        phone: '+5357770000',
        province: 'La Habana',
        municipality: 'Playa',
        streetAddress: 'Calle 10 #20',
        fulfillmentType: 'pickup',
        couponCode: 'PRO10',
        channel: 'whatsapp',
        items: [{ productId: prod1Id, quantity: 2 }],
      });
    expect(secondRes.status).toBe(400);
  });

  it('5. Exporta pedidos a CSV con BOM UTF-8 y protección contra inyección de fórmulas', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/stores/me/orders/export-csv')
      .set('Authorization', 'Bearer seller-token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.startsWith('\uFEFF')).toBe(true);
    expect(res.text).toContain("'=CMD|Carlos");
    expect(res.text).toContain('PRO10');
  });

  it('6. Lista clientes agrupados por teléfono con historial de compras', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/stores/me/customers?q=58881122')
      .set('Authorization', 'Bearer seller-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].ordersCount).toBe(1);
    expect(res.body[0].totalSpent).toBe(2100);
    expect(res.body[0].orders).toHaveLength(1);
  });

  it('7. Estadísticas semanales (7d): pedidos, valor total, ticket promedio, visitas y conversión', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/stores/me/analytics?period=7d')
      .set('Authorization', 'Bearer seller-token');

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('7d');
    expect(res.body.ordersCount).toBe(1);
    expect(res.body.totalRevenue).toBe(2100);
    expect(res.body.averageTicket).toBe(2100);
    expect(res.body.visitsCount).toBe(10);
    expect(res.body.conversionRatePercent).toBe(10);
    expect(res.body.topProducts.length).toBeGreaterThanOrEqual(2);
    expect(res.body.paymentMethodsBreakdown[0].paymentLabel).toBe('Efectivo (CUP)');
    expect(res.body.dailySeries.length).toBeGreaterThanOrEqual(1);
  });
});
