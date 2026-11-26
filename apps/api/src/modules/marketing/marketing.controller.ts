import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  createCouponSchema,
  createPromotionSchema,
  updateCouponSchema,
  updatePromotionSchema,
  type CreateCouponInput,
  type CreatePromotionInput,
  type UpdateCouponInput,
  type UpdatePromotionInput,
} from '@tuvitrina/contracts';
import { CurrentUser, type RequestAuthUser } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MarketingService } from './marketing.service';

@ApiTags('Marketing y Analítica')
@ApiBearerAuth()
@Controller('api/v1/stores/me')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  // --- Cupones ---

  @Get('coupons')
  @ApiOperation({ summary: 'Lista los cupones de descuento de la tienda' })
  listCoupons(@CurrentUser() user: RequestAuthUser) {
    return this.marketingService.listCoupons(user.profile!.id);
  }

  @Post('coupons')
  @ApiOperation({ summary: 'Crea un cupón de descuento (porcentaje o monto fijo)' })
  createCoupon(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(createCouponSchema)) body: CreateCouponInput,
  ) {
    return this.marketingService.createCoupon(user.profile!.id, body);
  }

  @Patch('coupons/:couponId')
  @ApiOperation({ summary: 'Actualiza un cupón existente' })
  updateCoupon(
    @CurrentUser() user: RequestAuthUser,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Body(new ZodValidationPipe(updateCouponSchema)) body: UpdateCouponInput,
  ) {
    return this.marketingService.updateCoupon(user.profile!.id, couponId, body);
  }

  @Delete('coupons/:couponId')
  @ApiOperation({ summary: 'Elimina un cupón de la tienda' })
  deleteCoupon(
    @CurrentUser() user: RequestAuthUser,
    @Param('couponId', ParseUUIDPipe) couponId: string,
  ) {
    return this.marketingService.deleteCoupon(user.profile!.id, couponId);
  }

  // --- Promociones Automáticas ---

  @Get('promotions')
  @ApiOperation({ summary: 'Lista las promociones automáticas configuradas' })
  listPromotions(@CurrentUser() user: RequestAuthUser) {
    return this.marketingService.listPromotions(user.profile!.id);
  }

  @Post('promotions')
  @ApiOperation({ summary: 'Crea una promoción automática (porcentaje, monto mínimo, 2x1, 3x2, 2da unidad o combo)' })
  createPromotion(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(createPromotionSchema)) body: CreatePromotionInput,
  ) {
    return this.marketingService.createPromotion(user.profile!.id, body);
  }

  @Patch('promotions/:promotionId')
  @ApiOperation({ summary: 'Actualiza una promoción automática' })
  updatePromotion(
    @CurrentUser() user: RequestAuthUser,
    @Param('promotionId', ParseUUIDPipe) promotionId: string,
    @Body(new ZodValidationPipe(updatePromotionSchema)) body: UpdatePromotionInput,
  ) {
    return this.marketingService.updatePromotion(user.profile!.id, promotionId, body);
  }

  @Delete('promotions/:promotionId')
  @ApiOperation({ summary: 'Elimina una promoción automática' })
  deletePromotion(
    @CurrentUser() user: RequestAuthUser,
    @Param('promotionId', ParseUUIDPipe) promotionId: string,
  ) {
    return this.marketingService.deletePromotion(user.profile!.id, promotionId);
  }

  // --- Estadísticas ---

  @Get('analytics')
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', 'all'] })
  @ApiOperation({ summary: 'Obtiene estadísticas privadas de ventas, visitas y conversión por período' })
  getAnalytics(
    @CurrentUser() user: RequestAuthUser,
    @Query('period') period = '7d',
  ) {
    return this.marketingService.getAnalytics(user.profile!.id, period);
  }
}
