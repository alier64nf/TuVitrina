import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { TOKEN_VERIFIER, type TokenVerifier } from '../src/common/guards/supabase-jwt.guard';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

interface MemProfile {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  role: 'seller' | 'support' | 'admin';
  termsVersion: string;
  acceptedTermsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface MemStore {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  whatsapp: string;
  telegram: string | null;
  province: string | null;
  municipality: string | null;
  streetAddress: string | null;
  hours: unknown;
  theme: unknown;
  baseCurrency: 'CUP' | 'USD' | 'MLC';
  acceptedCurrencies: Array<'CUP' | 'USD' | 'MLC'>;
  exchangeRates: unknown;
  freeShippingMin: number | null;
  pickupEnabled: boolean;
  plan: 'free' | 'pro';
  planExpiresAt: Date | null;
  status: 'active' | 'suspended';
  suspendedReason: string | null;
  orderSeq: number;
  cacheVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MemCategory {
  id: string;
  storeId: string;
  name: string;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MemVariant {
  id: string;
  productId: string;
  label: string;
  sku: string | null;
  attributes: Record<string, string>;
  priceOverride: number | null;
  stock: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MemProduct {
  id: string;
  storeId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  currency: 'CUP' | 'USD' | 'MLC';
  stock: number | null;
  active: boolean;
  soldOut: boolean;
  sortOrder: number;
  images: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

function createInMemoryPrismaMock() {
  const profiles = new Map<string, MemProfile>();
  const stores = new Map<string, MemStore>();
  const categories = new Map<string, MemCategory>();
  const products = new Map<string, MemProduct>();
  const variants = new Map<string, MemVariant>();
  const auditLogs: Array<Record<string, unknown>> = [];
  const paymentMethods: Array<Record<string, unknown>> = [];

  const mock: Record<string, any> = {
    isConfigured: () => true,
    ensureConfigured: () => undefined,
    checkHealth: async () => 'up' as const,
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    $transaction: async (arg: any) => {
      if (typeof arg === 'function') {
        return arg(mock);
      }
      return Promise.all(arg);
    },
    plansConfig: {
      findUnique: async () => ({
        key: 'default',
        freeLimits: { maxProducts: 50, maxImagesPerProduct: 3, maxCategories: 15 },
        proLimits: { maxProducts: 100000, maxImagesPerProduct: 10, maxCategories: 200 },
      }),
    },
    profile: {
      findUnique: async ({ where }: any) => profiles.get(where.id) ?? null,
      create: async ({ data }: any) => {
        const now = new Date();
        const row: MemProfile = {
          id: data.id,
          email: data.email,
          displayName: data.displayName,
          phone: data.phone ?? null,
          role: data.role ?? 'seller',
          termsVersion: data.termsVersion,
          acceptedTermsAt: data.acceptedTermsAt,
          createdAt: now,
          updatedAt: now,
        };
        profiles.set(row.id, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const current = profiles.get(where.id);
        if (!current) throw { code: 'P2025' };
        const updated = { ...current, ...data, updatedAt: new Date() };
        profiles.set(where.id, updated);
        return updated;
      },
    },
    store: {
      findFirst: async ({ where }: any) => {
        for (const s of stores.values()) {
          if (where.ownerId && s.ownerId !== where.ownerId) continue;
          return s;
        }
        return null;
      },
      findUnique: async ({ where }: any) => {
        if (where.id) return stores.get(where.id) ?? null;
        if (where.slug) {
          for (const s of stores.values()) {
            if (s.slug === where.slug) return s;
          }
        }
        return null;
      },
      create: async ({ data }: any) => {
        const now = new Date();
        const row: MemStore = {
          id: randomUUID(),
          ownerId: data.ownerId,
          slug: data.slug,
          name: data.name,
          category: data.category,
          description: null,
          whatsapp: data.whatsapp,
          telegram: null,
          province: null,
          municipality: null,
          streetAddress: null,
          hours: data.hours ?? null,
          theme: data.theme ?? null,
          baseCurrency: data.baseCurrency ?? 'CUP',
          acceptedCurrencies: data.acceptedCurrencies ?? ['CUP'],
          exchangeRates: data.exchangeRates ?? {},
          freeShippingMin: null,
          pickupEnabled: false,
          plan: 'free',
          planExpiresAt: null,
          status: 'active',
          suspendedReason: null,
          orderSeq: 0,
          cacheVersion: 1,
          createdAt: now,
          updatedAt: now,
        };
        stores.set(row.id, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const current = stores.get(where.id);
        if (!current) throw { code: 'P2025' };
        const nextCache =
          typeof data.cacheVersion === 'object' && data.cacheVersion?.increment
            ? current.cacheVersion + data.cacheVersion.increment
            : current.cacheVersion;
        const updated = {
          ...current,
          ...data,
          cacheVersion: nextCache,
          updatedAt: new Date(),
        };
        stores.set(where.id, updated);
        return updated;
      },
    },
    paymentMethod: {
      create: async ({ data }: any) => {
        const item = { id: randomUUID(), ...data };
        paymentMethods.push(item);
        return item;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        const entry = { id: randomUUID(), ...data, createdAt: new Date() };
        auditLogs.push(entry);
        return entry;
      },
    },
    category: {
      count: async ({ where }: any) =>
        [...categories.values()].filter((c) => c.storeId === where.storeId).length,
      findMany: async ({ where }: any) =>
        [...categories.values()]
          .filter((c) => c.storeId === where.storeId)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      findFirst: async ({ where, orderBy }: any) => {
        let list = [...categories.values()].filter((c) => {
          if (where.id && c.id !== where.id) return false;
          if (where.storeId && c.storeId !== where.storeId) return false;
          return true;
        });
        if (orderBy?.sortOrder === 'desc') {
          list = list.sort((a, b) => b.sortOrder - a.sortOrder);
        }
        return list[0] ?? null;
      },
      create: async ({ data }: any) => {
        const now = new Date();
        const row: MemCategory = {
          id: randomUUID(),
          storeId: data.storeId,
          name: data.name,
          sortOrder: data.sortOrder ?? 0,
          active: data.active ?? true,
          createdAt: now,
          updatedAt: now,
        };
        categories.set(row.id, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const current = categories.get(where.id);
        if (!current) throw { code: 'P2025' };
        const updated = { ...current, ...data, updatedAt: new Date() };
        categories.set(where.id, updated);
        return updated;
      },
      delete: async ({ where }: any) => {
        const current = categories.get(where.id);
        if (!current) throw { code: 'P2025' };
        categories.delete(where.id);
        return current;
      },
    },
    product: {
      count: async ({ where }: any) =>
        [...products.values()].filter((p) => {
          if (where.storeId && p.storeId !== where.storeId) return false;
          if (where.categoryId && p.categoryId !== where.categoryId) return false;
          return true;
        }).length,
      findMany: async ({ where, take, cursor, skip }: any) => {
        let list = [...products.values()]
          .filter((p) => {
            if (where.storeId && p.storeId !== where.storeId) return false;
            if (where.categoryId && p.categoryId !== where.categoryId) return false;
            if (where.OR) {
              const q = String(where.OR[0]?.name?.contains ?? '').toLowerCase();
              const match =
                p.name.toLowerCase().includes(q) ||
                (p.description ?? '').toLowerCase().includes(q);
              if (!match) return false;
            }
            return true;
          })
          .sort((a, b) => a.sortOrder - b.sortOrder);
        if (cursor?.id) {
          const idx = list.findIndex((p) => p.id === cursor.id);
          if (idx >= 0) list = list.slice(idx + (skip ?? 0));
        }
        if (take) list = list.slice(0, take);
        return list.map((p) => ({
          ...p,
          variants: [...variants.values()].filter((v) => v.productId === p.id),
        }));
      },
      findFirst: async ({ where, orderBy, include }: any) => {
        let list = [...products.values()].filter((p) => {
          if (where.id && p.id !== where.id) return false;
          if (where.storeId && p.storeId !== where.storeId) return false;
          return true;
        });
        if (orderBy?.sortOrder === 'desc') {
          list = list.sort((a, b) => b.sortOrder - a.sortOrder);
        }
        const found = list[0] ?? null;
        if (!found) return null;
        if (include?.variants) {
          return {
            ...found,
            variants: [...variants.values()].filter((v) => v.productId === found.id),
          };
        }
        return found;
      },
      create: async ({ data }: any) => {
        const now = new Date();
        const productId = randomUUID();
        const row: MemProduct = {
          id: productId,
          storeId: data.storeId,
          categoryId: data.categoryId ?? null,
          name: data.name,
          description: data.description ?? null,
          price: Number(data.price),
          compareAtPrice: data.compareAtPrice !== null && data.compareAtPrice !== undefined ? Number(data.compareAtPrice) : null,
          currency: data.currency ?? 'CUP',
          stock: data.stock ?? null,
          active: data.active ?? true,
          soldOut: data.soldOut ?? false,
          sortOrder: data.sortOrder ?? 0,
          images: Array.isArray(data.images) ? data.images : [],
          createdAt: now,
          updatedAt: now,
        };
        products.set(productId, row);
        const createdVariants: MemVariant[] = [];
        if (data.variants?.create) {
          for (const v of data.variants.create) {
            const vr: MemVariant = {
              id: randomUUID(),
              productId,
              label: v.label,
              sku: v.sku ?? null,
              attributes: v.attributes,
              priceOverride:
                v.priceOverride !== null && v.priceOverride !== undefined
                  ? Number(v.priceOverride)
                  : null,
              stock: v.stock ?? null,
              active: v.active ?? true,
              createdAt: now,
              updatedAt: now,
            };
            variants.set(vr.id, vr);
            createdVariants.push(vr);
          }
        }
        return { ...row, variants: createdVariants };
      },
      update: async ({ where, data }: any) => {
        const current = products.get(where.id);
        if (!current) throw { code: 'P2025' };
        const now = new Date();
        const updated: MemProduct = {
          ...current,
          ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.price !== undefined ? { price: Number(data.price) } : {}),
          ...(data.compareAtPrice !== undefined
            ? {
                compareAtPrice:
                  data.compareAtPrice !== null ? Number(data.compareAtPrice) : null,
              }
            : {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(data.stock !== undefined ? { stock: data.stock } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
          ...(data.soldOut !== undefined ? { soldOut: data.soldOut } : {}),
          ...(data.images !== undefined ? { images: data.images } : {}),
          updatedAt: now,
        };
        products.set(where.id, updated);

        if (data.variants?.create) {
          for (const v of data.variants.create) {
            const vr: MemVariant = {
              id: randomUUID(),
              productId: where.id,
              label: v.label,
              sku: v.sku ?? null,
              attributes: v.attributes,
              priceOverride:
                v.priceOverride !== null && v.priceOverride !== undefined
                  ? Number(v.priceOverride)
                  : null,
              stock: v.stock ?? null,
              active: v.active ?? true,
              createdAt: now,
              updatedAt: now,
            };
            variants.set(vr.id, vr);
          }
        }
        return {
          ...updated,
          variants: [...variants.values()].filter((v) => v.productId === where.id),
        };
      },
      delete: async ({ where }: any) => {
        const current = products.get(where.id);
        if (!current) throw { code: 'P2025' };
        products.delete(where.id);
        for (const [vid, v] of variants.entries()) {
          if (v.productId === where.id) variants.delete(vid);
        }
        return current;
      },
    },
    productVariant: {
      deleteMany: async ({ where }: any) => {
        for (const [vid, v] of variants.entries()) {
          if (v.productId === where.productId) variants.delete(vid);
        }
        return { count: 0 };
      },
    },
  };

  return mock;
}

describe('TuVitrina Fase 1 API (Auth, Onboarding, Catálogo, Aislamiento)', () => {
  let app: INestApplication;
  const sellerAUid = '11111111-1111-4111-8111-111111111111';
  const sellerBUid = '22222222-2222-4222-8222-222222222222';

  const fakeVerifier: TokenVerifier = {
    async verify(token: string) {
      if (token === 'token-a') return { sub: sellerAUid, email: 'ana@tuvitrina.cu' };
      if (token === 'token-b') return { sub: sellerBUid, email: 'pedro@tuvitrina.cu' };
      throw new Error('Token inválido');
    },
  };

  beforeAll(async () => {
    const prismaMock = createInMemoryPrismaMock();
    const redisMock: Partial<RedisService> = {
      getStatus: async () => 'up',
      getJson: async () => null,
      setJson: async () => undefined,
      del: async () => undefined,
      incrementRateLimit: async () => ({ count: 1, ttlSeconds: 60 }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloquea solicitudes sin token JWT y permite /api/v1/health público', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const res = await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('sincroniza perfiles con rol seller fijo y términos versionados', async () => {
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/sync-profile')
      .set('Authorization', 'Bearer token-a')
      .send({
        displayName: 'Ana María',
        termsAccepted: true,
        termsVersion: '2026-11-v1',
        role: 'admin', // Debe ignorarse por seguridad
      })
      .expect(201);

    expect(resA.body.profile.role).toBe('seller');
    expect(resA.body.store).toBeNull();

    await request(app.getHttpServer())
      .post('/api/v1/auth/sync-profile')
      .set('Authorization', 'Bearer token-b')
      .send({
        displayName: 'Pedro López',
        termsAccepted: true,
        termsVersion: '2026-11-v1',
      })
      .expect(201);
  });

  it('ejecuta onboarding de tienda en 3 pasos, valida slug único y normaliza WhatsApp cubano', async () => {
    const check = await request(app.getHttpServer())
      .get('/api/v1/stores/check-slug?slug=dulceria-ana')
      .set('Authorization', 'Bearer token-a')
      .expect(200);
    expect(check.body.available).toBe(true);

    const storeRes = await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Authorization', 'Bearer token-a')
      .send({
        name: 'Dulcería Ana',
        category: 'Dulcería y panadería',
        whatsapp: '51234567',
        slug: 'dulceria-ana',
      })
      .expect(201);

    expect(storeRes.body.whatsapp).toBe('+5351234567');
    expect(storeRes.body.slug).toBe('dulceria-ana');

    // Vendedor B no puede tomar el mismo slug
    await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Authorization', 'Bearer token-b')
      .send({
        name: 'Otra Dulcería',
        category: 'Dulcería y panadería',
        whatsapp: '+5359876543',
        slug: 'dulceria-ana',
      })
      .expect(409);

    // Vendedor B crea su propia tienda con otro slug
    await request(app.getHttpServer())
      .post('/api/v1/stores')
      .set('Authorization', 'Bearer token-b')
      .send({
        name: 'Café Pedro',
        category: 'Alimentos y bebidas',
        whatsapp: '+5359876543',
        slug: 'cafe-pedro',
      })
      .expect(201);
  });

  it('crea y reordena categorías, crea producto con variantes (<=3 attrs) y descuento, y aísla por tienda', async () => {
    const cat1 = await request(app.getHttpServer())
      .post('/api/v1/stores/me/categories')
      .set('Authorization', 'Bearer token-a')
      .send({ name: 'Tortas' })
      .expect(201);

    const cat2 = await request(app.getHttpServer())
      .post('/api/v1/stores/me/categories')
      .set('Authorization', 'Bearer token-a')
      .send({ name: 'Cupcakes' })
      .expect(201);

    const reordered = await request(app.getHttpServer())
      .put('/api/v1/stores/me/categories/reorder')
      .set('Authorization', 'Bearer token-a')
      .send({ categoryIds: [cat2.body.id, cat1.body.id] })
      .expect(200);

    expect(reordered.body[0].id).toBe(cat2.body.id);

    // Producto con precio tachado y variantes válidas (2 atributos)
    const prod = await request(app.getHttpServer())
      .post('/api/v1/stores/me/products')
      .set('Authorization', 'Bearer token-a')
      .send({
        name: 'Torta Tres Leches',
        description: 'Porción artesanal refrigerada.',
        categoryId: cat1.body.id,
        price: 1200,
        compareAtPrice: 1500,
        currency: 'CUP',
        stock: 8,
        variantAttributeNames: ['Tamaño', 'Sabor'],
        variants: [
          {
            label: 'Mediana / Vainilla',
            attributes: { Tamaño: 'Mediana', Sabor: 'Vainilla' },
            priceOverride: 1200,
            stock: 5,
          },
          {
            label: 'Grande / Chocolate',
            attributes: { Tamaño: 'Grande', Sabor: 'Chocolate' },
            priceOverride: 1850,
            stock: 3,
          },
        ],
      })
      .expect(201);

    expect(prod.body.discountPercent).toBe(20);
    expect(prod.body.variants).toHaveLength(2);

    // Rechaza más de 3 atributos
    await request(app.getHttpServer())
      .post('/api/v1/stores/me/products')
      .set('Authorization', 'Bearer token-a')
      .send({
        name: 'Producto inválido',
        price: 500,
        variantAttributeNames: ['A', 'B', 'C', 'D'],
      })
      .expect(400);

    // Aislamiento estricto: Vendedor B no puede leer, editar, marcar agotado ni borrar el producto de Ana
    await request(app.getHttpServer())
      .get(`/api/v1/stores/me/products/${prod.body.id}`)
      .set('Authorization', 'Bearer token-b')
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/stores/me/products/${prod.body.id}/sold-out`)
      .set('Authorization', 'Bearer token-b')
      .send({ soldOut: true })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/stores/me/products/${prod.body.id}`)
      .set('Authorization', 'Bearer token-b')
      .expect(404);

    // Ana marca agotado con un toque y duplica el producto
    const soldOutRes = await request(app.getHttpServer())
      .patch(`/api/v1/stores/me/products/${prod.body.id}/sold-out`)
      .set('Authorization', 'Bearer token-a')
      .send({ soldOut: true })
      .expect(200);
    expect(soldOutRes.body.soldOut).toBe(true);

    const dupRes = await request(app.getHttpServer())
      .post(`/api/v1/stores/me/products/${prod.body.id}/duplicate`)
      .set('Authorization', 'Bearer token-a')
      .expect(201);
    expect(dupRes.body.name).toContain('Copia de Torta Tres Leches');
    expect(dupRes.body.variants).toHaveLength(2);
  });
});
