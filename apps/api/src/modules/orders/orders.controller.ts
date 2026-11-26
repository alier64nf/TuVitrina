import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { updateOrderStatusSchema, type UpdateOrderStatusInput } from '@tuvitrina/contracts';
import { CurrentUser, type RequestAuthUser } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OrdersService } from './orders.service';

@ApiTags('Pedidos (Vendedor)')
@ApiBearerAuth()
@Controller('api/v1/stores/me')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('orders')
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiOperation({ summary: 'Lista los pedidos de la tienda con filtro opcional por estado' })
  listOrders(
    @CurrentUser() user: RequestAuthUser,
    @Query('status') status?: string,
  ) {
    return this.ordersService.listSellerOrders(user.profile!.id, status);
  }

  @Get('orders/export-csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="pedidos-tuvitrina.csv"')
  @ApiOperation({ summary: 'Exporta los pedidos de la tienda en formato CSV compatible con Excel' })
  exportOrdersCsv(@CurrentUser() user: RequestAuthUser) {
    return this.ordersService.exportOrdersCsv(user.profile!.id);
  }

  @Get('customers')
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiOperation({ summary: 'Lista clientes agrupados por teléfono con su historial de pedidos' })
  listCustomers(
    @CurrentUser() user: RequestAuthUser,
    @Query('q') q?: string,
  ) {
    return this.ordersService.listCustomers(user.profile!.id, q);
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Obtiene el detalle completo de un pedido de la tienda' })
  getOrder(
    @CurrentUser() user: RequestAuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.ordersService.getSellerOrder(user.profile!.id, orderId);
  }

  @Patch('orders/:orderId/status')
  @ApiOperation({ summary: 'Actualiza el estado de un pedido y gestiona deducción de stock' })
  updateStatus(
    @CurrentUser() user: RequestAuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body(new ZodValidationPipe(updateOrderStatusSchema)) body: UpdateOrderStatusInput,
  ) {
    return this.ordersService.updateOrderStatus(user.profile!.id, orderId, body, user.profile!.id);
  }
}
