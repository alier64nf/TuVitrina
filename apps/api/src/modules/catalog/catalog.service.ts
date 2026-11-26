import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Category, type Product, type ProductVariant } from '@prisma/client';
import {
  computeDiscountPercent,
  CURRENCIES,
  isCategoryAvailableNow,
  type CategoryDto,
  type CategorySchedule,
  type CreateCategoryInput,
  type CreateProductInput,
  type CsvImportErrorRow,
  type CsvImportResultDto,
  type CurrencyCode,
  type PaginatedProductsResponse,
  type ProductDto,
  type ProductImageRef,
  type ProductVariantDto,
  type ProductVariantInput,
  type ReorderCategoriesInput,
  type ReorderProductsInput,
  type UpdateCategoryInput,
  type UpdateProductInput,
} from '@tuvitrina/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StoresService } from '../stores/stores.service';

type ProductWithVariants = Product & { variants: ProductVariant[] };

function mapCategoryDto(category: Category): CategoryDto {
  const schedule = (category.schedule as CategorySchedule | null) ?? null;
  return {
    id: category.id,
    storeId: category.storeId,
    name: category.name,
    sortOrder: category.sortOrder,
    active: category.active,
    schedule,
    isAvailableNow: isCategoryAvailableNow(schedule),
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

function mapVariantDto(variant: ProductVariant): ProductVariantDto {
  return {
    id: variant.id,
    productId: variant.productId,
    label: variant.label,
    sku: variant.sku,
    attributes: (variant.attributes as Record<string, string>) ?? {},
    priceOverride: variant.priceOverride !== null ? Number(variant.priceOverride) : null,
    stock: variant.stock,
    active: variant.active,
  };
}

function mapProductDto(product: ProductWithVariants): ProductDto {
  const price = Number(product.price);
  const compareAtPrice =
    product.compareAtPrice !== null ? Number(product.compareAtPrice) : null;

  return {
    id: product.id,
    storeId: product.storeId,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    price,
    compareAtPrice,
    discountPercent: computeDiscountPercent(price, compareAtPrice),
    currency: product.currency as CurrencyCode,
    stock: product.stock,
    active: product.active,
    soldOut: product.soldOut,
    sortOrder: product.sortOrder,
    images: Array.isArray(product.images)
      ? (product.images as unknown as ProductImageRef[])
      : [],
    variants: product.variants.map(mapVariantDto),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
  ) {}

  // ============================================================================
  // CATEGORÍAS
  // ============================================================================

  async listCategories(ownerId: string): Promise<CategoryDto[]> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const categories = await this.prisma.category.findMany({
      where: { storeId: store.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return categories.map(mapCategoryDto);
  }

  async createCategory(ownerId: string, input: CreateCategoryInput): Promise<CategoryDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const limits = await this.storesService.getPlanLimits(store.plan);
    const count = await this.prisma.category.count({ where: { storeId: store.id } });
    if (count >= limits.maxCategories) {
      throw new ForbiddenException(
        `Tu plan ${store.plan.toUpperCase()} permite hasta ${limits.maxCategories} categorías.`,
      );
    }

    const last = await this.prisma.category.findFirst({
      where: { storeId: store.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const created = await this.prisma.category.create({
      data: {
        storeId: store.id,
        name: input.name,
        active: input.active ?? true,
        schedule: input.schedule
          ? (input.schedule as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapCategoryDto(created);
  }

  async updateCategory(
    ownerId: string,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId: store.id },
    });
    if (!existing) {
      throw new NotFoundException('Categoría no encontrada en tu tienda.');
    }

    const updated = await this.prisma.category.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.schedule !== undefined
          ? {
              schedule: input.schedule
                ? (input.schedule as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
      },
    });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapCategoryDto(updated);
  }

  async reorderCategories(
    ownerId: string,
    input: ReorderCategoriesInput,
  ): Promise<CategoryDto[]> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.category.findMany({
      where: { storeId: store.id },
      select: { id: true },
    });
    const ownedIds = new Set(existing.map((c) => c.id));
    for (const id of input.categoryIds) {
      if (!ownedIds.has(id)) {
        throw new BadRequestException('Una o más categorías no pertenecen a tu tienda.');
      }
    }

    await this.prisma.$transaction(
      input.categoryIds.map((id, index) =>
        this.prisma.category.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return this.listCategories(ownerId);
  }

  async deleteCategory(ownerId: string, categoryId: string): Promise<{ deleted: boolean }> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId: store.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Categoría no encontrada en tu tienda.');
    }

    await this.prisma.category.delete({ where: { id: existing.id } });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return { deleted: true };
  }

  // ============================================================================
  // PRODUCTOS Y VARIANTES
  // ============================================================================

  private validateVariantsAndImages(
    storeId: string,
    maxImagesPerProduct: number,
    images: ProductImageRef[],
    variantAttributeNames: string[],
    variants: ProductVariantInput[],
  ): void {
    if (images.length > maxImagesPerProduct) {
      throw new ForbiddenException(
        `Tu plan actual permite hasta ${maxImagesPerProduct} imágenes por producto.`,
      );
    }

    for (const img of images) {
      if (!img.objectPath.startsWith(`${storeId}/`)) {
        throw new BadRequestException('Una de las imágenes no corresponde a tu tienda.');
      }
    }

    const attributeKeySet = new Set<string>(
      variantAttributeNames.map((k) => k.trim()).filter(Boolean),
    );
    for (const variant of variants) {
      for (const key of Object.keys(variant.attributes)) {
        attributeKeySet.add(key.trim());
      }
    }
    if (attributeKeySet.size > 3) {
      throw new BadRequestException('Un producto puede tener como máximo 3 atributos de variante.');
    }
  }

  private async ensureCategoryOwnership(storeId: string, categoryId?: string | null) {
    if (!categoryId) return;
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException('La categoría seleccionada no pertenece a tu tienda.');
    }
  }

  async listProducts(
    ownerId: string,
    query: { q?: string; categoryId?: string; cursor?: string; limit?: number },
  ): Promise<PaginatedProductsResponse> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50);

    const where: Prisma.ProductWhereInput = {
      storeId: store.id,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.q && query.q.trim().length > 0
        ? {
            OR: [
              { name: { contains: query.q.trim(), mode: 'insensitive' } },
              { description: { contains: query.q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [totalCount, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { variants: { orderBy: { createdAt: 'asc' } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
    ]);

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? sliced[sliced.length - 1]?.id ?? null : null;

    return {
      items: sliced.map(mapProductDto),
      nextCursor,
      totalCount,
    };
  }

  async getProduct(ownerId: string, productId: string): Promise<ProductDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado en tu tienda.');
    }
    return mapProductDto(product);
  }

  async createProduct(ownerId: string, input: CreateProductInput): Promise<ProductDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const limits = await this.storesService.getPlanLimits(store.plan);

    const productCount = await this.prisma.product.count({ where: { storeId: store.id } });
    if (productCount >= limits.maxProducts) {
      throw new ForbiddenException(
        `Has alcanzado el límite de ${limits.maxProducts} productos del plan ${store.plan.toUpperCase()}.`,
      );
    }

    await this.ensureCategoryOwnership(store.id, input.categoryId);
    this.validateVariantsAndImages(
      store.id,
      limits.maxImagesPerProduct,
      input.images ?? [],
      input.variantAttributeNames ?? [],
      input.variants ?? [],
    );

    const last = await this.prisma.product.findFirst({
      where: { storeId: store.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      return tx.product.create({
        data: {
          storeId: store.id,
          categoryId: input.categoryId ?? null,
          name: input.name,
          description: input.description ?? null,
          price: new Prisma.Decimal(input.price),
          compareAtPrice:
            input.compareAtPrice !== undefined && input.compareAtPrice !== null
              ? new Prisma.Decimal(input.compareAtPrice)
              : null,
          currency: input.currency ?? 'CUP',
          stock: input.stock ?? null,
          active: input.active ?? true,
          soldOut: input.soldOut ?? false,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          images: (input.images ?? []) as unknown as Prisma.InputJsonValue,
          variants:
            input.variants && input.variants.length > 0
              ? {
                  create: input.variants.map((v) => ({
                    label: v.label,
                    sku: v.sku ?? null,
                    attributes: v.attributes as Prisma.InputJsonValue,
                    priceOverride:
                      v.priceOverride !== undefined && v.priceOverride !== null
                        ? new Prisma.Decimal(v.priceOverride)
                        : null,
                    stock: v.stock ?? null,
                    active: v.active ?? true,
                  })),
                }
              : undefined,
        },
        include: { variants: { orderBy: { createdAt: 'asc' } } },
      });
    });

    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapProductDto(created);
  }

  async updateProduct(
    ownerId: string,
    productId: string,
    input: UpdateProductInput,
  ): Promise<ProductDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Producto no encontrado en tu tienda.');
    }

    const limits = await this.storesService.getPlanLimits(store.plan);
    await this.ensureCategoryOwnership(store.id, input.categoryId);
    this.validateVariantsAndImages(
      store.id,
      limits.maxImagesPerProduct,
      input.images ?? [],
      input.variantAttributeNames ?? [],
      input.variants ?? [],
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.productVariant.deleteMany({ where: { productId: existing.id } });
      return tx.product.update({
        where: { id: existing.id },
        data: {
          categoryId: input.categoryId ?? null,
          name: input.name,
          description: input.description ?? null,
          price: new Prisma.Decimal(input.price),
          compareAtPrice:
            input.compareAtPrice !== undefined && input.compareAtPrice !== null
              ? new Prisma.Decimal(input.compareAtPrice)
              : null,
          currency: input.currency ?? 'CUP',
          stock: input.stock ?? null,
          active: input.active ?? true,
          soldOut: input.soldOut ?? false,
          images: (input.images ?? []) as unknown as Prisma.InputJsonValue,
          variants:
            input.variants && input.variants.length > 0
              ? {
                  create: input.variants.map((v) => ({
                    label: v.label,
                    sku: v.sku ?? null,
                    attributes: v.attributes as Prisma.InputJsonValue,
                    priceOverride:
                      v.priceOverride !== undefined && v.priceOverride !== null
                        ? new Prisma.Decimal(v.priceOverride)
                        : null,
                    stock: v.stock ?? null,
                    active: v.active ?? true,
                  })),
                }
              : undefined,
        },
        include: { variants: { orderBy: { createdAt: 'asc' } } },
      });
    });

    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapProductDto(updated);
  }

  async toggleSoldOut(ownerId: string, productId: string, soldOut: boolean): Promise<ProductDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Producto no encontrado en tu tienda.');
    }

    const updated = await this.prisma.product.update({
      where: { id: existing.id },
      data: { soldOut },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapProductDto(updated);
  }

  async duplicateProduct(ownerId: string, productId: string): Promise<ProductDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const limits = await this.storesService.getPlanLimits(store.plan);

    const productCount = await this.prisma.product.count({ where: { storeId: store.id } });
    if (productCount >= limits.maxProducts) {
      throw new ForbiddenException(
        `Has alcanzado el límite de ${limits.maxProducts} productos del plan ${store.plan.toUpperCase()}.`,
      );
    }

    const source = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      include: { variants: true },
    });
    if (!source) {
      throw new NotFoundException('Producto no encontrado en tu tienda.');
    }

    const last = await this.prisma.product.findFirst({
      where: { storeId: store.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const copyName = `Copia de ${source.name}`.slice(0, 120);
    const duplicated = await this.prisma.product.create({
      data: {
        storeId: store.id,
        categoryId: source.categoryId,
        name: copyName,
        description: source.description,
        price: source.price,
        compareAtPrice: source.compareAtPrice,
        currency: source.currency,
        stock: source.stock,
        active: source.active,
        soldOut: source.soldOut,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        images: source.images as Prisma.InputJsonValue,
        variants:
          source.variants.length > 0
            ? {
                create: source.variants.map((v) => ({
                  label: v.label,
                  sku: v.sku,
                  attributes: v.attributes as Prisma.InputJsonValue,
                  priceOverride: v.priceOverride,
                  stock: v.stock,
                  active: v.active,
                })),
              }
            : undefined,
      },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });

    await this.storesService.bumpStoreCache(store.id, store.slug);
    return mapProductDto(duplicated);
  }

  async deleteProduct(ownerId: string, productId: string): Promise<{ deleted: boolean }> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Producto no encontrado en tu tienda.');
    }

    await this.prisma.product.delete({ where: { id: existing.id } });
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return { deleted: true };
  }

  async reorderProducts(
    ownerId: string,
    input: ReorderProductsInput,
  ): Promise<{ reordered: boolean }> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.product.findMany({
      where: { storeId: store.id },
      select: { id: true },
    });
    const ownedIds = new Set(existing.map((p) => p.id));
    for (const id of input.productIds) {
      if (!ownedIds.has(id)) {
        throw new BadRequestException('Uno o más productos no pertenecen a tu tienda.');
      }
    }

    await this.prisma.$transaction(
      input.productIds.map((id, index) =>
        this.prisma.product.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    await this.storesService.bumpStoreCache(store.id, store.slug);
    return { reordered: true };
  }

  private parseCsvRows(csvText: string): string[][] {
    const clean = csvText.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < clean.length; i += 1) {
      const char = clean[i];
      const next = clean[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          currentCell += '"';
          i += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          currentCell += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && next === '\n') {
          i += 1;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  async importProductsCsv(ownerId: string, csvContent: string): Promise<CsvImportResultDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const limits = await this.storesService.getPlanLimits(store.plan);

    const parsedRows = this.parseCsvRows(csvContent);
    if (parsedRows.length < 2) {
      throw new BadRequestException(
        'El CSV debe incluir una fila de encabezados y al menos una fila de producto.',
      );
    }

    const headerRow = parsedRows[0].map((h) =>
      h
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_'),
    );

    const colIndex = {
      name: headerRow.findIndex((h) => ['nombre', 'name', 'producto', 'titulo'].includes(h)),
      price: headerRow.findIndex((h) => ['precio', 'price'].includes(h)),
      compareAtPrice: headerRow.findIndex((h) =>
        ['precio_anterior', 'compare_at_price', 'compareatprice', 'precio_tachado'].includes(h),
      ),
      currency: headerRow.findIndex((h) => ['moneda', 'currency'].includes(h)),
      category: headerRow.findIndex((h) => ['categoria', 'category'].includes(h)),
      description: headerRow.findIndex((h) => ['descripcion', 'description'].includes(h)),
      stock: headerRow.findIndex((h) => ['stock', 'cantidad', 'inventario'].includes(h)),
      active: headerRow.findIndex((h) => ['activo', 'active'].includes(h)),
    };

    if (colIndex.name === -1 || colIndex.price === -1) {
      throw new BadRequestException(
        'El CSV debe contener al menos las columnas "nombre" (o "name") y "precio" (o "price").',
      );
    }

    const existingCategories = await this.prisma.category.findMany({
      where: { storeId: store.id },
    });
    const categoryByName = new Map(
      existingCategories.map((c) => [c.name.trim().toLowerCase(), c.id]),
    );
    let nextCategorySortOrder = existingCategories.reduce(
      (max, c) => Math.max(max, c.sortOrder),
      -1,
    );
    let currentCategoryCount = existingCategories.length;

    let currentProductCount = await this.prisma.product.count({ where: { storeId: store.id } });
    const lastProd = await this.prisma.product.findFirst({
      where: { storeId: store.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    let nextProdSortOrder = (lastProd?.sortOrder ?? -1) + 1;

    const errors: CsvImportErrorRow[] = [];
    let importedCount = 0;
    let skippedCount = 0;

    for (let i = 1; i < parsedRows.length; i += 1) {
      const rowNum = i + 1;
      const row = parsedRows[i];
      const getVal = (idx: number) => (idx >= 0 ? (row[idx] ?? '').trim() : '');

      if (currentProductCount >= limits.maxProducts) {
        errors.push({
          row: rowNum,
          field: 'plan',
          message: `Límite de ${limits.maxProducts} productos alcanzado para el plan ${store.plan.toUpperCase()}.`,
        });
        skippedCount += 1;
        continue;
      }

      const name = getVal(colIndex.name);
      if (name.length < 2 || name.length > 120) {
        errors.push({
          row: rowNum,
          field: 'nombre',
          message: 'El nombre debe tener entre 2 y 120 caracteres.',
        });
        skippedCount += 1;
        continue;
      }

      const rawPrice = getVal(colIndex.price).replace(',', '.');
      const price = Number(rawPrice);
      if (!Number.isFinite(price) || price <= 0 || price > 100000000) {
        errors.push({
          row: rowNum,
          field: 'precio',
          message: `Precio inválido ("${getVal(colIndex.price)}"). Debe ser un número mayor a 0.`,
        });
        skippedCount += 1;
        continue;
      }

      let compareAtPrice: number | null = null;
      const rawCompare = getVal(colIndex.compareAtPrice).replace(',', '.');
      if (rawCompare.length > 0) {
        const parsedCompare = Number(rawCompare);
        if (!Number.isFinite(parsedCompare) || parsedCompare <= price) {
          errors.push({
            row: rowNum,
            field: 'precio_anterior',
            message: 'El precio anterior debe ser numérico y mayor que el precio de venta.',
          });
          skippedCount += 1;
          continue;
        }
        compareAtPrice = parsedCompare;
      }

      const rawCurrency = (getVal(colIndex.currency) || store.baseCurrency).toUpperCase();
      if (!(CURRENCIES as readonly string[]).includes(rawCurrency)) {
        errors.push({
          row: rowNum,
          field: 'moneda',
          message: `Moneda inválida ("${rawCurrency}"). Usa CUP, USD o MLC.`,
        });
        skippedCount += 1;
        continue;
      }

      let stock: number | null = null;
      const rawStock = getVal(colIndex.stock);
      if (rawStock.length > 0) {
        const parsedStock = Number(rawStock);
        if (!Number.isInteger(parsedStock) || parsedStock < 0) {
          errors.push({
            row: rowNum,
            field: 'stock',
            message: `Stock inválido ("${rawStock}"). Debe ser un entero >= 0.`,
          });
          skippedCount += 1;
          continue;
        }
        stock = parsedStock;
      }

      let categoryId: string | null = null;
      const rawCat = getVal(colIndex.category);
      if (rawCat.length >= 2) {
        const catKey = rawCat.toLowerCase();
        const foundCatId = categoryByName.get(catKey);
        if (foundCatId) {
          categoryId = foundCatId;
        } else if (currentCategoryCount < limits.maxCategories) {
          nextCategorySortOrder += 1;
          const createdCat = await this.prisma.category.create({
            data: {
              storeId: store.id,
              name: rawCat.slice(0, 80),
              sortOrder: nextCategorySortOrder,
              active: true,
            },
          });
          categoryByName.set(catKey, createdCat.id);
          currentCategoryCount += 1;
          categoryId = createdCat.id;
        } else {
          errors.push({
            row: rowNum,
            field: 'categoria',
            message: `No se pudo crear la categoría "${rawCat}" porque alcanzaste el límite (${limits.maxCategories}) de tu plan.`,
          });
          skippedCount += 1;
          continue;
        }
      }

      const rawActive = getVal(colIndex.active).toLowerCase();
      const active =
        rawActive === '' || ['si', 'sí', 'true', '1', 'activo'].includes(rawActive);
      const description = getVal(colIndex.description).slice(0, 1200) || null;

      await this.prisma.product.create({
        data: {
          storeId: store.id,
          categoryId,
          name,
          description,
          price: new Prisma.Decimal(price),
          compareAtPrice: compareAtPrice !== null ? new Prisma.Decimal(compareAtPrice) : null,
          currency: rawCurrency as CurrencyCode,
          stock,
          active,
          soldOut: stock === 0,
          sortOrder: nextProdSortOrder,
          images: [],
        },
      });

      nextProdSortOrder += 1;
      currentProductCount += 1;
      importedCount += 1;
    }

    if (importedCount > 0) {
      await this.storesService.bumpStoreCache(store.id, store.slug);
    }

    return {
      importedCount,
      skippedCount,
      errors,
    };
  }
}
