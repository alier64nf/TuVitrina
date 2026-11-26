import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  reviewReportSchema,
  reviewSubscriptionSchema,
  updatePlansConfigSchema,
  updateStoreStatusSchema,
  type ReviewReportInput,
  type ReviewSubscriptionInput,
  type UpdatePlansConfigInput,
  type UpdateStoreStatusInput,
} from '@tuvitrina/contracts';
import { CurrentUser, Roles, type RequestAuthUser } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminService } from './admin.service';

@ApiTags('Backoffice Administrador y Soporte')
@ApiBearerAuth()
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('metrics')
  @Roles(UserRole.admin, UserRole.support)
  @ApiOperation({ summary: 'Obtiene métricas de plataforma en tiempo real' })
  getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('stores')
  @Roles(UserRole.admin, UserRole.support)
  @ApiOperation({ summary: 'Lista y busca tiendas en la plataforma' })
  listStores(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
  ) {
    return this.adminService.listStores({ q, status, plan });
  }

  @Patch('stores/:id/status')
  @Roles(UserRole.admin, UserRole.support)
  @ApiOperation({ summary: 'Suspende o reactiva una tienda con motivo obligatorio' })
  updateStoreStatus(
    @Param('id') storeId: string,
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(updateStoreStatusSchema)) body: UpdateStoreStatusInput,
  ) {
    return this.adminService.updateStoreStatus(storeId, body, user.profile!);
  }

  @Get('users')
  @Roles(UserRole.admin, UserRole.support)
  @ApiOperation({ summary: 'Lista y busca usuarios registrados en la plataforma' })
  listUsers(@Query('q') q?: string, @Query('role') role?: string) {
    return this.adminService.listUsers({ q, role });
  }

  @Get('subscriptions')
  @Roles(UserRole.admin, UserRole.support)
  @ApiOperation({ summary: 'Lista solicitudes de suscripción PRO' })
  listSubscriptions(@Query('status') status?: string) {
    return this.adminService.listSubscriptions({ status });
  }

  @Patch('subscriptions/:id/review')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Aprueba o rechaza una solicitud de suscripción PRO activando el plan inmediatamente' })
  reviewSubscription(
    @Param('id') id: string,
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(reviewSubscriptionSchema)) body: ReviewSubscriptionInput,
  ) {
    return this.adminService.reviewSubscription(id, body, user.profile!);
  }

  @Get('reports')
  @Roles(UserRole.admin, UserRole.support)
  @ApiOperation({ summary: 'Lista la cola de reportes de moderación de contenido' })
  listReports(@Query('status') status?: string) {
    return this.adminService.listReports({ status });
  }

  @Patch('reports/:id/review')
  @Roles(UserRole.admin, UserRole.support)
  @ApiOperation({ summary: 'Revisa un reporte de moderación cambiando su estado a reviewing, resolved o dismissed' })
  reviewReport(
    @Param('id') id: string,
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(reviewReportSchema)) body: ReviewReportInput,
  ) {
    return this.adminService.reviewReport(id, body, user.profile!);
  }

  @Get('audit-logs')
  @Roles(UserRole.admin, UserRole.support)
  @ApiOperation({ summary: 'Consulta el registro inmutable de auditoría' })
  listAuditLogs(@Query('entityType') entityType?: string, @Query('limit') limit?: string) {
    return this.adminService.listAuditLogs({
      entityType,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch('plans-config')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Actualiza la configuración de límites y precios de planes' })
  updatePlansConfig(
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(updatePlansConfigSchema)) body: UpdatePlansConfigInput,
  ) {
    return this.adminService.updatePlansConfig(body, user.profile!);
  }
}
