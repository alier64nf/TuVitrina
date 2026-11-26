import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  createCategorySchema,
  createProductSchema,
  importProductsCsvSchema,
  reorderCategoriesSchema,
  reorderProductsSchema,
  toggleSoldOutSchema,
  updateCategorySchema,
  updateProductSchema,
  type CreateCategoryInput,
  type CreateProductInput,
  type ImportProductsCsvInput,
  type ReorderCategoriesInput,
  type ReorderProductsInput,
  type ToggleSoldOutInput,
  type UpdateCategoryInput,
  type UpdateProductInput,
} from '@tuvitrina/contracts';
import { CurrentUser, type RequestAuthUser } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CatalogService } from './catalog.service';

@ApiTags('Catálogo')
@ApiBearerAuth()
@Controller('api/v1/stores/me')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // --- Categorías ---

  @Get('categories')
  @ApiOperation({ summary: 'Lista las categorías de la tienda ordenadas' })
  listCategories(@CurrentUser() user: RequestAuthUser) {
    return this.catalogService.listCategories(user.profile!.id);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Crea una nueva categoría en la tienda' })
  createCategory(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryInput,
  ) {
    return this.catalogService.createCategory(user.profile!.id, body);
  }

  @Put('categories/reorder')
  @ApiOperation({ summary: 'Reordena categorías de la tienda de forma atómica' })
  reorderCategories(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(reorderCategoriesSchema)) body: ReorderCategoriesInput,
  ) {
    return this.catalogService.reorderCategories(user.profile!.id, body);
  }

  @Patch('categories/:categoryId')
  @ApiOperation({ summary: 'Edita una categoría existente' })
  updateCategory(
    @CurrentUser() user: RequestAuthUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryInput,
  ) {
    return this.catalogService.updateCategory(user.profile!.id, categoryId, body);
  }

  @Delete('categories/:categoryId')
  @ApiOperation({ summary: 'Elimina una categoría de la tienda' })
  deleteCategory(
    @CurrentUser() user: RequestAuthUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.catalogService.deleteCategory(user.profile!.id, categoryId);
  }

  // --- Productos ---

  @Get('products')
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Lista productos con búsqueda, filtro por categoría y paginación por cursor' })
  listProducts(
    @CurrentUser() user: RequestAuthUser,
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.catalogService.listProducts(user.profile!.id, {
      q,
      categoryId,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Put('products/reorder')
  @ApiOperation({ summary: 'Reordena manualmente los productos de la tienda' })
  reorderProducts(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(reorderProductsSchema)) body: ReorderProductsInput,
  ) {
    return this.catalogService.reorderProducts(user.profile!.id, body);
  }

  @Post('products/import-csv')
  @ApiOperation({ summary: 'Importa productos desde un archivo CSV con reporte detallado de errores por fila' })
  importProductsCsv(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(importProductsCsvSchema)) body: ImportProductsCsvInput,
  ) {
    return this.catalogService.importProductsCsv(user.profile!.id, body.csvContent);
  }

  @Get('products/:productId')
  @ApiOperation({ summary: 'Obtiene el detalle de un producto de la tienda' })
  getProduct(
    @CurrentUser() user: RequestAuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.catalogService.getProduct(user.profile!.id, productId);
  }

  @Post('products')
  @ApiOperation({ summary: 'Crea un nuevo producto con variantes y precio de oferta opcional' })
  createProduct(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput,
  ) {
    return this.catalogService.createProduct(user.profile!.id, body);
  }

  @Patch('products/:productId')
  @ApiOperation({ summary: 'Actualiza un producto existente y sus variantes' })
  updateProduct(
    @CurrentUser() user: RequestAuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductInput,
  ) {
    return this.catalogService.updateProduct(user.profile!.id, productId, body);
  }

  @Patch('products/:productId/sold-out')
  @ApiOperation({ summary: 'Marca o desmarca un producto como agotado con un toque' })
  toggleSoldOut(
    @CurrentUser() user: RequestAuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body(new ZodValidationPipe(toggleSoldOutSchema)) body: ToggleSoldOutInput,
  ) {
    return this.catalogService.toggleSoldOut(user.profile!.id, productId, body.soldOut);
  }

  @Post('products/:productId/duplicate')
  @ApiOperation({ summary: 'Duplica un producto existente junto a sus variantes e imágenes' })
  duplicateProduct(
    @CurrentUser() user: RequestAuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.catalogService.duplicateProduct(user.profile!.id, productId);
  }

  @Delete('products/:productId')
  @ApiOperation({ summary: 'Elimina un producto de la tienda' })
  deleteProduct(
    @CurrentUser() user: RequestAuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.catalogService.deleteProduct(user.profile!.id, productId);
  }
}
