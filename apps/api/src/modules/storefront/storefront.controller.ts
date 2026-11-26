import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  guestCheckoutSchema,
  quoteOrderSchema,
  type GuestCheckoutInput,
  type QuoteOrderInput,
} from '@tuvitrina/contracts';
import { Public } from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/guards/redis-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { StorefrontService } from './storefront.service';

@ApiTags('Tienda Pública')
@Controller('api/v1/storefronts')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Public()
  @Get(':slug')
  @RateLimit({ limit: 90, windowSeconds: 60, keyPrefix: 'storefront-view' })
  @ApiOperation({ summary: 'Obtiene el catálogo público, información y estado de apertura de una tienda' })
  getStorefront(@Param('slug') slug: string) {
    return this.storefrontService.getStorefront(slug);
  }

  @Public()
  @Post(':slug/quote')
  @RateLimit({ limit: 60, windowSeconds: 60, keyPrefix: 'quote-order' })
  @ApiOperation({ summary: 'Calcula cotización del carrito con promociones automáticas, cupón y envío' })
  quoteOrder(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(quoteOrderSchema)) body: QuoteOrderInput,
  ) {
    return this.storefrontService.quoteOrder(slug, body);
  }

  @Public()
  @Post(':slug/orders')
  @RateLimit({ limit: 15, windowSeconds: 60, keyPrefix: 'checkout' })
  @ApiOperation({ summary: 'Crea un pedido como invitado con recálculo de precios en el servidor' })
  placeOrder(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(guestCheckoutSchema)) body: GuestCheckoutInput,
  ) {
    return this.storefrontService.placeOrder(slug, body);
  }

  @Public()
  @Get(':slug/orders/track/:trackingToken')
  @RateLimit({ limit: 60, windowSeconds: 60, keyPrefix: 'track-order' })
  @ApiQuery({ name: 'trackingToken', required: true, type: String })
  @ApiOperation({ summary: 'Obtiene el estado en tiempo real de un pedido mediante su token de seguimiento' })
  trackOrder(
    @Param('slug') slug: string,
    @Param('trackingToken') trackingToken: string,
  ) {
    return this.storefrontService.trackOrder(slug, trackingToken);
  }
}
