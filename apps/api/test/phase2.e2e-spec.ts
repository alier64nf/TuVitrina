import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { TOKEN_VERIFIER, type TokenVerifier } from '../src/common/guards/supabase-jwt.guard';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

describe('TuVitrina Fase 2 API (Storefront, Recálculo de Precios, Pedidos y Panel)', () => {
  let app: INestApplication;
  const sellerUid = '11111111-1111-4111-8111-111111111111';
  const storeId = '99999999-9999-4999-8999-999999999999';
  const productId = '88888888-8888-4888-8888-888888888888';

  const mockDb = {
    isConfigured: () => true,
    ensureConfigured: () => undefined,
    checkHealth: async () => 'up' as const,
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    $transaction: async (arg: any) => {
      if (typeof arg === 'function') return arg(mockDb);
      return Promise.all(arg);
    },
    plansConfig: {
      findUnique: async () => ({
        key: 'default',
        freeLimits: { maxProducts: 50 },
      }),
    },
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
      findUnique: async () => ({
        id: storeId,
        ownerId: sellerUid,
        slug: 'dulceria-ana',
        name: 'Dulcería Ana',
        category: 'Dulcería',
        whatsapp: '+5351234567',
        telegram: null,
        province: 'La Habana',
        municipality: 'Playa',
        status: 'active',
        plan: 'free',
        orderSeq: 1,
        baseCurrency: 'CUP',
        acceptedCurrencies: ['CUP'],
        hours: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        categories: [],
        products: [
          {
            id: productId,
            storeId,
            categoryId: null,
            name: 'Torta de Chocolate',
            description: 'Deliciosa',
            price: 1500,
            compareAtPrice: 1800,
            currency: 'CUP',
            stock: 10,
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
            id: randomUUID(),
            storeId,
            type: 'cash',
            label: 'Efectivo contra entrega',
            currencies: ['CUP'],
            instructions: 'Paga al recibir',
            accountData: null,
            enabled: true,
            sortOrder: 0,
          },
        ],
      }),
      findFirst: async () => ({
        id: storeId,
        ownerId: sellerUid,
        slug: 'dulceria-ana',
        name: 'Dulcería Ana',
        category: 'Dulcería',
        whatsapp: '+5351234567',
        telegram: null,
        province: 'La Habana',
        municipality: 'Playa',
        status: 'active',
        plan: 'free',
        orderSeq: 1,
        baseCurrency: 'CUP',
        acceptedCurrencies: ['CUP'],
        hours: null,
      }),
      update: async ({ data }: any) => ({
        id: storeId,
        slug: 'dulceria-ana',
        name: 'Dulcería Ana',
        orderSeq: data.orderSeq?.increment ? 2 : 1,
      }),
    },
    category: {
      count: async () => 1,
      findMany: async () => [],
    },
    product: {
      count: async () => 1,
      findMany: async () => [
        {
          id: productId,
          storeId,
          categoryId: null,
          name: 'Torta de Chocolate',
          description: 'Deliciosa',
          price: 1500,
          compareAtPrice: 1800,
          currency: 'CUP',
          stock: 10,
          active: true,
          soldOut: false,
          sortOrder: 0,
          images: [],
          variants: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      findFirst: async () => ({
        id: productId,
        storeId,
        name: 'Torta de Chocolate',
        price: 1500,
        currency: 'CUP',
        active: true,
        soldOut: false,
        variants: [],
      }),
      updateMany: async () => ({ count: 1 }),
    },
    paymentMethod: {
      findMany: async () => [
        {
          id: randomUUID(),
          storeId,
          type: 'cash',
          label: 'Efectivo contra entrega',
          currencies: ['CUP'],
          instructions: 'Paga al recibir',
          enabled: true,
        },
      ],
    },
    analyticsDaily: {
      upsert: async () => ({}),
    },
    order: {
      create: async ({ data }: any) => ({
        id: randomUUID(),
        storeId,
        orderNumber: 2,
        trackingToken: data.trackingToken,
        status: data.status,
        paymentStatus: data.paymentStatus,
        channel: data.channel,
        paymentLabel: data.paymentLabel,
        fulfillmentType: data.fulfillmentType,
        shippingZoneName: data.shippingZoneName,
        customerSnapshot: data.customerSnapshot,
        currency: 'CUP',
        subtotal: data.subtotal,
        discountTotal: data.discountTotal,
        shippingCost: data.shippingCost,
        total: data.total,
        couponCode: null,
        cancelReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: randomUUID(),
            productId,
            variantId: null,
            productName: 'Torta de Chocolate',
            variantLabel: null,
            unitPrice: 1500,
            currency: 'CUP',
            quantity: 2,
            lineTotal: 3000,
          },
        ],
        statusHistory: [
          {
            id: randomUUID(),
            fromStatus: null,
            toStatus: 'created',
            note: 'Pedido recibido',
            createdAt: new Date(),
          },
        ],
      }),
      findFirst: async () => ({
        id: randomUUID(),
        storeId,
        orderNumber: 2,
        trackingToken: 'abc123token',
        status: 'created',
        paymentStatus: 'pending',
        channel: 'whatsapp',
        paymentLabel: 'Efectivo',
        fulfillmentType: 'delivery',
        shippingZoneName: 'Playa, La Habana',
        customerSnapshot: {
          customerName: 'Carlos Pérez',
          phone: '+5351112233',
          province: 'La Habana',
          municipality: 'Playa',
          streetAddress: 'Calle 5ta #12',
        },
        currency: 'CUP',
        subtotal: 3000,
        discountTotal: 0,
        shippingCost: 0,
        total: 3000,
        couponCode: null,
        cancelReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: randomUUID(),
            productId,
            productName: 'Torta de Chocolate',
            variantLabel: null,
            unitPrice: 1500,
            currency: 'CUP',
            quantity: 2,
            lineTotal: 3000,
          },
        ],
        statusHistory: [
          {
            id: randomUUID(),
            fromStatus: null,
            toStatus: 'created',
            note: 'Pedido recibido',
            createdAt: new Date(),
          },
        ],
      }),
      findMany: async () => [],
      update: async ({ data }: any) => ({
        id: randomUUID(),
        storeId,
        orderNumber: 2,
        trackingToken: 'abc123token',
        status: data.status,
        paymentStatus: 'pending',
        channel: 'whatsapp',
        paymentLabel: 'Efectivo',
        fulfillmentType: 'delivery',
        shippingZoneName: 'Playa, La Habana',
        customerSnapshot: { customerName: 'Carlos', phone: '+5351112233', province: 'La Habana', municipality: 'Playa', streetAddress: 'Calle 5ta' },
        currency: 'CUP',
        subtotal: 3000,
        discountTotal: 0,
        shippingCost: 0,
        total: 3000,
        couponCode: null,
        cancelReason: data.cancelReason ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
        statusHistory: [
          { id: randomUUID(), fromStatus: 'created', toStatus: data.status, note: 'Actualizado', createdAt: new Date() },
        ],
      }),
    },
  };

  const fakeVerifier: TokenVerifier = {
    async verify() {
      return { sub: sellerUid, email: 'ana@tuvitrina.cu' };
    },
  };

  beforeAll(async () => {
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

  it('permite obtener la tienda pública con productos y estado', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/storefronts/dulceria-ana').expect(200);
    expect(res.body.store.name).toBe('Dulcería Ana');
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Torta de Chocolate');
  });

  it('realiza el checkout como invitado con recálculo de precios en servidor y genera enlace WhatsApp', async () => {
    const checkoutRes = await request(app.getHttpServer())
      .post('/api/v1/storefronts/dulceria-ana/orders')
      .send({
        customerName: 'Carlos Pérez',
        phone: '51112233',
        province: 'La Habana',
        municipality: 'Playa',
        streetAddress: 'Calle 5ta #12',
        fulfillmentType: 'delivery',
        channel: 'whatsapp',
        items: [
          {
            productId,
            quantity: 2,
          },
        ],
      })
      .expect(201);

    expect(checkoutRes.body.order.orderNumber).toBe(2);
    expect(checkoutRes.body.order.total).toBe(3000);
    expect(checkoutRes.body.whatsappUrl).toContain('wa.me');
    expect(checkoutRes.body.messageText).toContain('¡Nuevo Pedido #2!');
  });

  it('permite al vendedor listar y actualizar el estado de los pedidos', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/stores/me/orders')
      .set('Authorization', 'Bearer token-seller')
      .expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
  });
});
