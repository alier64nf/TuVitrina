import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { TOKEN_VERIFIER, type TokenVerifier } from '../src/common/guards/supabase-jwt.guard';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

describe('TuVitrina Fase 4 API (Planes, Suscripción PRO, Moderación y Backoffice Admin)', () => {
  let app: INestApplication;

  const sellerUid = '11111111-1111-4111-8111-111111111111';
  const adminUid = '22222222-2222-4222-8222-222222222222';
  const storeId = '33333333-3333-4333-8333-333333333333';

  let currentStore = {
    id: storeId,
    ownerId: sellerUid,
    slug: 'tienda-piloto',
    name: 'Tienda Piloto',
    category: 'Artesanías',
    description: 'Catálogo de artesanías cubanas',
    whatsapp: '+5352345678',
    telegram: null,
    province: 'La Habana',
    municipality: 'Plaza de la Revolución',
    streetAddress: 'Calle 23 #456',
    hours: null,
    baseCurrency: 'CUP',
    acceptedCurrencies: ['CUP'],
    exchangeRates: { USD: 320, MLC: 270 },
    plan: 'free',
    planExpiresAt: null as Date | null,
    status: 'active',
    suspendedReason: null as string | null,
    cacheVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    categories: [] as any[],
    products: [] as any[],
    paymentMethods: [] as any[],
  };

  const subscriptionsList: any[] = [];
  const reportsList: any[] = [];
  const auditLogsList: any[] = [];

  const mockDb = {
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
        paymentInstructions: 'Transfiere a EnZona o Transfermóvil y sube tu comprobante.',
        updatedAt: new Date(),
      }),
      create: async ({ data }: any) => ({
        id: randomUUID(),
        ...data,
        updatedAt: new Date(),
      }),
      upsert: async ({ update }: any) => ({
        id: randomUUID(),
        ...update,
        updatedAt: new Date(),
      }),
    },
    profile: {
      findUnique: async ({ where }: any) => {
        if (where.id === sellerUid) {
          return {
            id: sellerUid,
            email: 'vendedor@tuvitrina.cu',
            displayName: 'Carlos Vendedor',
            phone: '+5352345678',
            role: 'seller',
            termsVersion: '2026-11-v1',
            acceptedTermsAt: new Date(),
          };
        }
        if (where.id === adminUid) {
          return {
            id: adminUid,
            email: 'admin@tuvitrina.cu',
            displayName: 'Admin Principal',
            phone: '+5351000000',
            role: 'admin',
            termsVersion: '2026-11-v1',
            acceptedTermsAt: new Date(),
          };
        }
        return null;
      },
      count: async () => 2,
      findMany: async () => [
        {
          id: sellerUid,
          email: 'vendedor@tuvitrina.cu',
          displayName: 'Carlos Vendedor',
          phone: '+5352345678',
          role: 'seller',
          termsVersion: '2026-11-v1',
          acceptedTermsAt: new Date(),
        },
        {
          id: adminUid,
          email: 'admin@tuvitrina.cu',
          displayName: 'Admin Principal',
          phone: '+5351000000',
          role: 'admin',
          termsVersion: '2026-11-v1',
          acceptedTermsAt: new Date(),
        },
      ],
    },
    store: {
      findFirst: async () => currentStore,
      findUnique: async ({ where }: any) => {
        if (where.id === storeId || where.slug === 'tienda-piloto') {
          return currentStore;
        }
        return null;
      },
      findMany: async () => [currentStore],
      count: async ({ where }: any) => {
        if (where?.status === 'active') return currentStore.status === 'active' ? 1 : 0;
        if (where?.status === 'suspended') return currentStore.status === 'suspended' ? 1 : 0;
        if (where?.plan === 'pro') return currentStore.plan === 'pro' ? 1 : 0;
        if (where?.plan === 'free') return currentStore.plan === 'free' ? 1 : 0;
        return 1;
      },
      update: async ({ where, data }: any) => {
        currentStore = {
          ...currentStore,
          ...data,
          updatedAt: new Date(),
        };
        return currentStore;
      },
    },
    category: {
      count: async () => 0,
      findMany: async () => [],
    },
    product: {
      count: async () => 0,
      findFirst: async () => null,
      findMany: async () => [],
    },
    order: {
      count: async () => 5,
    },
    analyticsDaily: {
      upsert: async () => ({ id: randomUUID(), visits: 1 }),
    },
    subscriptionRequest: {
      create: async ({ data }: any) => {
        const item = {
          id: randomUUID(),
          ...data,
          store: { id: currentStore.id, name: currentStore.name, slug: currentStore.slug },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        subscriptionsList.push(item);
        return item;
      },
      findMany: async () => subscriptionsList,
      findUnique: async ({ where }: any) => subscriptionsList.find((s) => s.id === where.id),
      update: async ({ where, data }: any) => {
        const idx = subscriptionsList.findIndex((s) => s.id === where.id);
        if (idx !== -1) {
          subscriptionsList[idx] = { ...subscriptionsList[idx], ...data, updatedAt: new Date() };
          return subscriptionsList[idx];
        }
        return null;
      },
      count: async () => subscriptionsList.filter((s) => s.status === 'pending').length,
    },
    report: {
      create: async ({ data }: any) => {
        const item = {
          id: randomUUID(),
          ...data,
          store: { id: currentStore.id, name: currentStore.name, slug: currentStore.slug },
          product: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        reportsList.push(item);
        return item;
      },
      findMany: async () => reportsList,
      findUnique: async ({ where }: any) => reportsList.find((r) => r.id === where.id),
      update: async ({ where, data }: any) => {
        const idx = reportsList.findIndex((r) => r.id === where.id);
        if (idx !== -1) {
          reportsList[idx] = { ...reportsList[idx], ...data, updatedAt: new Date() };
          return reportsList[idx];
        }
        return null;
      },
      count: async () => reportsList.filter((r) => r.status === 'open').length,
    },
    auditLog: {
      create: async ({ data }: any) => {
        const log = { id: randomUUID(), ...data, createdAt: new Date() };
        auditLogsList.push(log);
        return log;
      },
      findMany: async () => auditLogsList,
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
        return { uid: sellerUid, sub: sellerUid, email: 'vendedor@tuvitrina.cu' };
      }
      if (token === 'admin-token') {
        return { uid: adminUid, sub: adminUid, email: 'admin@tuvitrina.cu' };
      }
      throw new Error('Token no válido');
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

  it('1. GET /api/v1/plans/config - Retorna límites y precios configurables de planes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/plans/config');
    expect(res.status).toBe(200);
    expect(res.body.key).toBe('default');
    expect(res.body.freeLimits.maxProducts).toBe(50);
    expect(res.body.proLimits.maxProducts).toBe(100000);
    expect(res.body.proPriceCup).toBe(3000);
    expect(res.body.proDurationDays).toBe(60);
  });

  let createdSubscriptionId = '';

  it('2. POST /api/v1/stores/me/subscription - Vendedor envía comprobante y solicita PRO', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/stores/me/subscription')
      .set('Authorization', 'Bearer seller-token')
      .send({
        currency: 'CUP',
        amount: 3000,
        paymentMethodLabel: 'Transfermóvil',
        reference: 'TM-987654321',
        receiptObjectKey: 'store-assets/receipt-123.webp',
      });

    expect(res.status).toBe(201);
    expect(res.body.targetPlan).toBe('pro');
    expect(res.body.status).toBe('pending');
    expect(res.body.amount).toBe(3000);
    expect(res.body.reference).toBe('TM-987654321');
    createdSubscriptionId = res.body.id;

    // Verificar en lista del vendedor
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/stores/me/subscriptions')
      .set('Authorization', 'Bearer seller-token');
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].id).toBe(createdSubscriptionId);
  });

  it('3. GET /api/v1/admin/metrics - Vendedor recibe 403 Forbidden por no ser admin/support', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/metrics')
      .set('Authorization', 'Bearer seller-token');
    expect(res.status).toBe(403);
  });

  it('4. PATCH /api/v1/admin/subscriptions/:id/review - Admin aprueba PRO y activa tienda inmediatamente', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/subscriptions/${createdSubscriptionId}/review`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        status: 'approved',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(currentStore.plan).toBe('pro');
    expect(currentStore.planExpiresAt).toBeDefined();
    expect(currentStore.planExpiresAt).not.toBeNull();
  });

  let createdReportId = '';

  it('5. POST /api/v1/storefronts/:slug/reports - Cliente público reporta tienda con rate limit', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/storefronts/tienda-piloto/reports')
      .send({
        targetType: 'store',
        reason: 'Contenido inapropiado',
        details: 'La tienda publicó artículos que violan la política de contenido de TuVitrina.',
        reporterContact: '+5359998877',
      });

    expect(res.status).toBe(201);
    expect(res.body.reported).toBe(true);
    createdReportId = res.body.id;
  });

  it('6. Moderación: Admin consulta cola de reportes y resuelve reporte', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/admin/reports')
      .set('Authorization', 'Bearer admin-token');

    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].id).toBe(createdReportId);

    const resolveRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/reports/${createdReportId}/review`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        status: 'resolved',
        resolutionNote: 'Se notificó al vendedor y corrigió la infracción.',
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.status).toBe('resolved');
  });

  it('7. Admin suspende tienda con motivo y la tienda queda inmediatamente inaccesible públicamente', async () => {
    // 1. Tienda está activa
    const beforeRes = await request(app.getHttpServer()).get('/api/v1/storefronts/tienda-piloto');
    expect(beforeRes.status).toBe(200);

    // 2. Admin suspende tienda
    const suspendRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/stores/${storeId}/status`)
      .set('Authorization', 'Bearer admin-token')
      .send({
        status: 'suspended',
        suspendedReason: 'Incumplimiento reiterado de términos de servicio.',
      });

    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.status).toBe('suspended');
    expect(suspendRes.body.suspendedReason).toBe('Incumplimiento reiterado de términos de servicio.');

    // 3. Tienda pública queda inmediatamente inaccesible (404)
    const afterRes = await request(app.getHttpServer()).get('/api/v1/storefronts/tienda-piloto');
    expect(afterRes.status).toBe(404);
  });
});
