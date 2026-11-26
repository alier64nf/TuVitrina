import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { shippingZoneSchema, type ShippingZoneInput } from '@tuvitrina/contracts';
import { CurrentUser, type RequestAuthUser } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ShippingService } from './shipping.service';

@ApiTags('Zonas de Envío')
@ApiBearerAuth()
@Controller('api/v1/stores/me/shipping-zones')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las zonas de envío de la tienda' })
  listZones(@CurrentUser() user: RequestAuthUser) {
    return this.shippingService.listZones(user.profile!.id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea una zona de envío por provincia o municipio' })
  createZone(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(shippingZoneSchema)) body: ShippingZoneInput,
  ) {
    return this.shippingService.createZone(user.profile!.id, body);
  }

  @Patch(':zoneId')
  @ApiOperation({ summary: 'Actualiza una zona de envío' })
  updateZone(
    @CurrentUser() user: RequestAuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Body(new ZodValidationPipe(shippingZoneSchema)) body: ShippingZoneInput,
  ) {
    return this.shippingService.updateZone(user.profile!.id, zoneId, body);
  }

  @Delete(':zoneId')
  @ApiOperation({ summary: 'Elimina una zona de envío' })
  deleteZone(
    @CurrentUser() user: RequestAuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
  ) {
    return this.shippingService.deleteZone(user.profile!.id, zoneId);
  }
}
