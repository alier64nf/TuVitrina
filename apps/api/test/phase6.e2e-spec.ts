import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { TOKEN_VERIFIER, type TokenVerifier } from '../src/common/guards/supabase-jwt.guard';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

describe('TuVitrina Fase 6 API (Cola Offline Idempotente y Centro de Ayuda / Soporte)', () => {
  let app: INestApplication;

  const adminUid = '99999999-9999-4999-8999-999999999999';
  const sellerUid = '11111111-1111-4111-8111-111111111111';
  const storeId = '33333333-3333-4333-8333-333333333333';
  const prodId = '55555555-5555-4555-8555-555555555555';

  const currentStore = {
    id: storeId,
    ownerId: sellerUid,
    slug: 'tienda-offline',
    name: 'Tienda Offline CU',
    category: 'Alimentos y bebidas',
    description: 'Tienda de prueba Fase 6',
    whatsapp: '+5352345678',
    telegram: '@tiendaoffline',
    province: 'La Habana',
    municipality: 'Playa',
    streetAddress: '5ta Ave #100',
    hours: null,
    theme: { seedColor: '#00796B', mode: 'light', fontFamily: 'outfit' },
    baseCurrency: 'CUP',
    acceptedCurrencies: ['CUP'],
    exchangeRates: { USD: 320, MLC: 270 },
    freeShippingMin: null,
    pickupEnabled: true,
    plan: 'free',
    planExpiresAt: null,
    status: 'active',
    suspendedReason: null,
    orderSeq: 0,
    cacheVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ordersList: any[] = [];
  const supportTicketsList: any[] = [];
  const auditLogsList: any[] = [];

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
        if (where.id === adminUid) {
          return {
            id: adminUid,
            email: 'admin@tuvitrina.cu',
            displayName: 'Soporte Admin',
            phone: '+5350000000',
            role: 'admin',
            termsVersion: '2026-11-v1',
            acceptedTermsAt: new Date(),
          };
        }
        return null;
      },
    },
    store: {
      findUnique: async ({ where }: any) => {
        if (where.slug === 'tienda-offline' || where.id === storeId) {
          return {
            ...currentStore,
            categories: [],
            products: [
              {
                id: prodId,
                storeId,
                categoryId: null,
                name: 'Arroz Criollo 1kg',
                description: 'Saco fresco',
                price: 450,
                compareAtPrice: null,
                currency: 'CUP',
                stock: 30,
                active: true,
                soldOut: false,
                sortOrder: 0,
                images: [],
                variants: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
            paymentMethods: [
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
            ],
            promotions: [],
            shippingZones: [],
          };
        }
        return null;
      },
      update: async ({ data }: any) => {
        if (data.orderSeq?.increment) {
          currentStore.orderSeq += data.orderSeq.increment;
        }
        return currentStore;
      },
    },
    category: { count: async () => 0 },
    product: { count: async () => 1 },
    order: {
      findUnique: async ({ where }: any) => {
        if (where.storeId_idempotencyKey) {
          return (
            ordersList.find(
              (o) =>
                o.storeId === where.storeId_idempotencyKey.storeId &&
                o.idempotencyKey === where.storeId_idempotencyKey.idempotencyKey,
            ) ?? null
          );
        }
        return null;
      },
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
    },
    analyticsDaily: {
      upsert: async () => ({ id: randomUUID(), storeId, day: new Date(), visits: 1 }),
    },
    supportTicket: {
      create: async ({ data }: any) => {
        const created = {
          id: randomUUID(),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        supportTicketsList.push(created);
        return created;
      },
      findMany: async ({ where }: any) => {
        const filtered = where?.status
          ? supportTicketsList.filter((t) => t.status === where.status)
          : supportTicketsList;
        return [...filtered].reverse();
      },
      findUnique: async ({ where }: any) => supportTicketsList.find((t) => t.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const idx = supportTicketsList.findIndex((t) => t.id === where.id);
        supportTicketsList[idx] = { ...supportTicketsList[idx], ...data, updatedAt: new Date() };
        return supportTicketsList[idx];
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        const created = { id: randomUUID(), ...data, createdAt: new Date() };
        auditLogsList.push(created);
        return created;
      },
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
      if (token === 'admin-token') {
        return { uid: adminUid, sub: adminUid, email: 'admin@tuvitrina.cu' };
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

  it('1. Cola offline idempotente: reintentar placeOrder con el mismo idempotencyKey no duplica el pedido ni incrementa orderNumber', async () => {
    const idempotencyKey = `offline-order-${randomUUID()}`;
    const payload = {
      customerName: 'Dayana Morales',
      phone: '+5354321098',
      province: 'La Habana',
      municipality: 'Playa',
      streetAddress: 'Calle 19 #402',
      fulfillmentType: 'pickup',
      paymentMethodId: '77777777-7777-4777-8777-777777777777',
      channel: 'whatsapp',
      idempotencyKey,
      items: [{ productId: prodId, quantity: 2 }],
    };

    const firstRes = await request(app.getHttpServer())
      .post('/api/v1/storefronts/tienda-offline/orders')
      .send(payload);

    expect(firstRes.status).toBe(201);
    expect(firstRes.body.order.orderNumber).toBe(1);
    expect(firstRes.body.order.total).toBe(900);

    const retryRes = await request(app.getHttpServer())
      .post('/api/v1/storefronts/tienda-offline/orders')
      .send(payload);

    expect(retryRes.status).toBe(201);
    expect(retryRes.body.order.id).toBe(firstRes.body.order.id);
    expect(retryRes.body.order.orderNumber).toBe(1);
    expect(ordersList).toHaveLength(1);
    expect(currentStore.orderSeq).toBe(1);
  });

  it('2. Centro de Ayuda: crea ticket de soporte público y permite gestión en backoffice admin/soporte', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/support/tickets')
      .send({
        name: 'Ernesto Díaz',
        contact: '+5352223344',
        channel: 'whatsapp',
        storeSlug: 'tienda-offline',
        topic: 'Configuración de pagos',
        message: 'Necesito ayuda para activar Transfermóvil en mi catálogo.',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.referenceCode).toMatch(/^SOP-/);
    expect(createRes.body.ticket.status).toBe('open');

    const unauthList = await request(app.getHttpServer()).get('/api/v1/admin/support-tickets');
    expect(unauthList.status).toBe(401);

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/admin/support-tickets?status=open')
      .set('Authorization', 'Bearer admin-token');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);

    const ticketId = createRes.body.ticket.id;
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/support-tickets/${ticketId}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ status: 'resolved' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.status).toBe('resolved');
    expect(auditLogsList).toHaveLength(1);
    expect(auditLogsList[0].action).toBe('support_ticket.status_updated');
  });
});
