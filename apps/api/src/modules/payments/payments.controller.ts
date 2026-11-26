import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  enzonaCredentialSchema,
  exchangeRatesSchema,
  paymentMethodSchema,
  type EnzonaCredentialInput,
  type ExchangeRatesInput,
  type PaymentMethodInput,
} from '@tuvitrina/contracts';
import { CurrentUser, type RequestAuthUser } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PaymentsService } from './payments.service';

@ApiTags('Pagos y Configuración')
@ApiBearerAuth()
@Controller('api/v1/stores/me/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('methods')
  @ApiOperation({ summary: 'Lista los medios de pago configurados en la tienda' })
  listMethods(@CurrentUser() user: RequestAuthUser) {
    return this.paymentsService.listPaymentMethods(user.profile!.id);
  }

  @Post('methods')
  @ApiOperation({ summary: 'Crea un nuevo medio de pago en la tienda' })
  createMethod(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(paymentMethodSchema)) body: PaymentMethodInput,
  ) {
    return this.paymentsService.createPaymentMethod(user.profile!.id, body);
  }

  @Patch('methods/:methodId')
  @ApiOperation({ summary: 'Actualiza un medio de pago' })
  updateMethod(
    @CurrentUser() user: RequestAuthUser,
    @Param('methodId', ParseUUIDPipe) methodId: string,
    @Body(new ZodValidationPipe(paymentMethodSchema)) body: PaymentMethodInput,
  ) {
    return this.paymentsService.updatePaymentMethod(user.profile!.id, methodId, body);
  }

  @Delete('methods/:methodId')
  @ApiOperation({ summary: 'Elimina un medio de pago' })
  deleteMethod(
    @CurrentUser() user: RequestAuthUser,
    @Param('methodId', ParseUUIDPipe) methodId: string,
  ) {
    return this.paymentsService.deletePaymentMethod(user.profile!.id, methodId);
  }

  @Post('enzona/credentials')
  @ApiOperation({ summary: 'Guarda credenciales de EnZona cifradas con AES-256-GCM' })
  saveEnzona(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(enzonaCredentialSchema)) body: EnzonaCredentialInput,
  ) {
    return this.paymentsService.saveEnzonaCredentials(user.profile!.id, body);
  }

  @Post('enzona/test')
  @HttpCode(200)
  @ApiOperation({ summary: 'Prueba la conexión con EnZona Sandbox usando las credenciales cifradas' })
  testEnzona(@CurrentUser() user: RequestAuthUser) {
    return this.paymentsService.testEnzonaConnection(user.profile!.id);
  }

  @Patch('exchange-rates')
  @ApiOperation({ summary: 'Actualiza las tasas de cambio de USD y MLC de la tienda' })
  updateRates(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(exchangeRatesSchema)) body: ExchangeRatesInput,
  ) {
    return this.paymentsService.updateExchangeRates(user.profile!.id, body);
  }
}
