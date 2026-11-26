import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createSubscriptionRequestSchema,
  type CreateSubscriptionRequestInput,
} from '@tuvitrina/contracts';
import { CurrentUser, Public, type RequestAuthUser } from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/guards/redis-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Planes y Suscripciones')
@Controller('api/v1')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans/config')
  @Public()
  @RateLimit({ limit: 60, windowSeconds: 60, keyPrefix: 'plans-config' })
  @ApiOperation({ summary: 'Obtiene la configuración dinámica de límites y precios de planes' })
  getPlansConfig() {
    return this.subscriptionsService.getPlansConfig();
  }

  @Post('stores/me/subscription')
  @ApiBearerAuth()
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'request-subscription' })
  @ApiOperation({ summary: 'Envía una solicitud de suscripción o renovación al plan PRO con comprobante' })
  requestProSubscription(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(createSubscriptionRequestSchema)) body: CreateSubscriptionRequestInput,
  ) {
    return this.subscriptionsService.createSubscriptionRequest(
      user.profile!.id,
      user.profile!.id,
      body,
    );
  }

  @Get('stores/me/subscriptions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista el historial de solicitudes de suscripción de la tienda' })
  listMySubscriptions(@CurrentUser() user: RequestAuthUser) {
    return this.subscriptionsService.listMySubscriptions(user.profile!.id);
  }
}
