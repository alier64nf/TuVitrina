import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { TOKEN_VERIFIER, type TokenVerifier } from '../src/common/guards/supabase-jwt.guard';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { CryptoService } from '../src/infrastructure/crypto/crypto.service';
import { convertCurrency } from '@tuvitrina/contracts';

describe('TuVitrina Fase 3 API (Multimoneda, EnZona cifrada, Zonas de Envío)', () => {
  let app: INestApplication;
  const sellerUid = '11111111-1111-4111-8111-111111111111';
  const storeId = '99999999-9999-4999-8999-999999999999';

  const paymentMethodsList: any[] = [];
  const shippingZonesList: any[] = [];
  const credentialsMap = new Map<string, any>();

  const mockDb = {
    isConfigured: () => true,
    ensureConfigured: () => undefined,
    checkHealth: async () => 'up' as const,
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    $transaction: async (arg: any) => (typeof arg === 'function' ? arg(mockDb) : Promise.all(arg)),
    plansConfig: { findUnique: async () => ({ key: 'default', freeLimits: { maxProducts: 50 } }) },
    profile: {
      findUnique: async () => ({
        id: sellerUid,
        email: 'ana@tuvitrina.cu',
        displayName: 'Ana',
        role: 'seller',
        termsVersion: '2026-11-v1',
        acceptedTermsAt: new Date(),
      }),
    },
    store: {
      findFirst: async () => ({
        id: storeId,
        ownerId: sellerUid,
        slug: 'dulceria-ana',
        name: 'Dulcería Ana',
        category: 'Dulcería',
        whatsapp: '+5351234567',
        baseCurrency: 'CUP',
        acceptedCurrencies: ['CUP', 'USD', 'MLC'],
        exchangeRates: { USD: 320, MLC: 270 },
        status: 'active',
      }),
      update: async ({ data }: any) => ({
        id: storeId,
        exchangeRates: data.exchangeRates ?? { USD: 320, MLC: 270 },
      }),
    },
    paymentMethod: {
      findMany: async () => paymentMethodsList,
      findFirst: async ({ where }: any) => paymentMethodsList.find((pm) => pm.id === where.id),
      create: async ({ data }: any) => {
        const item = { id: randomUUID(), ...data };
        paymentMethodsList.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = paymentMethodsList.findIndex((pm) => pm.id === where.id);
        paymentMethodsList[idx] = { ...paymentMethodsList[idx], ...data };
        return paymentMethodsList[idx];
      },
      delete: async ({ where }: any) => {
        const idx = paymentMethodsList.findIndex((pm) => pm.id === where.id);
        const removed = paymentMethodsList[idx];
        paymentMethodsList.splice(idx, 1);
        return removed;
      },
    },
    shippingZone: {
      findMany: async () => shippingZonesList,
      findFirst: async ({ where }: any) => shippingZonesList.find((z) => z.id === where.id),
      create: async ({ data }: any) => {
        const item = { id: randomUUID(), ...data };
        shippingZonesList.push(item);
        return item;
      },
      update: async ({ where, data }: any) => {
        const idx = shippingZonesList.findIndex((z) => z.id === where.id);
        shippingZonesList[idx] = { ...shippingZonesList[idx], ...data };
        return shippingZonesList[idx];
      },
      delete: async ({ where }: any) => {
        const idx = shippingZonesList.findIndex((z) => z.id === where.id);
        const removed = shippingZonesList[idx];
        shippingZonesList.splice(idx, 1);
        return removed;
      },
    },
    storePaymentCredential: {
      findUnique: async ({ where }: any) => credentialsMap.get(where.storeId_provider?.provider) ?? null,
      upsert: async ({ where, update, create }: any) => {
        const key = where.storeId_provider.provider;
        const existing = credentialsMap.get(key);
        const saved = existing ? { ...existing, ...update } : { id: randomUUID(), ...create };
        credentialsMap.set(key, saved);
        return saved;
      },
    },
  };

  const fakeVerifier: TokenVerifier = {
    async verify() {
      return { sub: sellerUid, email: 'ana@tuvitrina.cu' };
    },
  };

  beforeAll(async () => {
    process.env.MASTER_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockDb)
      .overrideProvider(RedisService)
      .useValue({
        getStatus: async () => 'up',
        getJson: async () => null,
        setJson: async () => undefined,
        del: async () => undefined,
        incrementRateLimit: async () => ({ count: 1, ttlSeconds: 60 }),
      })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('convierte correctamente monedas con convertCurrency', () => {
    const rates = { USD: 320, MLC: 270 };
    const converted = convertCurrency(3200, 'CUP', 'USD', rates);
    expect(converted).toBe(10);
  });

  it('permite configurar medios de pago y zonas de envío', async () => {
    const pmRes = await request(app.getHttpServer())
      .post('/api/v1/stores/me/payments/methods')
      .set('Authorization', 'Bearer token-seller')
      .send({
        type: 'enzona',
        label: 'EnZona',
        currencies: ['CUP'],
        instructions: 'Paga con EnZona',
        enabled: true,
      })
      .expect(201);

    expect(pmRes.body.label).toBe('EnZona');

    const zoneRes = await request(app.getHttpServer())
      .post('/api/v1/stores/me/shipping-zones')
      .set('Authorization', 'Bearer token-seller')
      .send({
        province: 'La Habana',
        municipality: 'Playa',
        cost: 250,
        currency: 'CUP',
        active: true,
      })
      .expect(201);

    expect(zoneRes.body.cost).toBe(250);
  });

  it('cifra credenciales de EnZona y permite probar la conexión sandbox', async () => {
    const credRes = await request(app.getHttpServer())
      .post('/api/v1/stores/me/payments/enzona/credentials')
      .set('Authorization', 'Bearer token-seller')
      .send({
        clientId: 'enzona-client-id-sandbox-1234',
        clientSecret: 'enzona-secret-sandbox-5678',
        sandbox: true,
      })
      .expect(201);

    expect(credRes.body.saved).toBe(true);

    const testRes = await request(app.getHttpServer())
      .post('/api/v1/stores/me/payments/enzona/test')
      .set('Authorization', 'Bearer token-seller')
      .expect(200);

    expect(testRes.body.ok).toBe(true);
  });
});
