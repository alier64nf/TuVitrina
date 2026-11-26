import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  createStoreOnboardingSchema,
  storeThemeSchema,
  updateBusinessProfileSchema,
  type CreateStoreOnboardingInput,
  type StoreThemeConfig,
  type UpdateBusinessProfileInput,
} from '@tuvitrina/contracts';
import { CurrentUser, type RequestAuthUser } from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/guards/redis-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { StoresService } from './stores.service';

@ApiTags('Tiendas')
@ApiBearerAuth()
@Controller('api/v1/stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get('check-slug')
  @RateLimit({ limit: 45, windowSeconds: 60, keyPrefix: 'check-slug' })
  @ApiQuery({ name: 'slug', required: true, type: String })
  @ApiOperation({ summary: 'Verifica si un enlace corto (slug) es válido y está disponible' })
  checkSlug(@Query('slug') slug = '') {
    return this.storesService.checkSlug(slug);
  }

  @Post()
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'create-store' })
  @ApiOperation({ summary: 'Crea la tienda del vendedor autenticado mediante transacción atómica sobre slugs' })
  createStore(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(createStoreOnboardingSchema)) body: CreateStoreOnboardingInput,
  ) {
    return this.storesService.createStoreOnboarding(user.profile!.id, user.profile!.role, body);
  }

  @Get('me')
  @ApiOperation({ summary: 'Obtiene el resumen de la tienda del vendedor autenticado' })
  getMyStore(@CurrentUser() user: RequestAuthUser) {
    return this.storesService.getMyStore(user.profile!.id);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Actualiza datos del negocio (ubicación, horarios, contacto y redes)' })
  updateBusinessProfile(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(updateBusinessProfileSchema)) body: UpdateBusinessProfileInput,
  ) {
    return this.storesService.updateBusinessProfile(user.profile!.id, body);
  }

  @Patch('me/theme')
  @ApiOperation({ summary: 'Personaliza color semilla, modo, fuente tipográfica, logo y portada de la tienda' })
  updateTheme(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(storeThemeSchema)) body: StoreThemeConfig,
  ) {
    return this.storesService.updateStoreTheme(user.profile!.id, body);
  }
}
