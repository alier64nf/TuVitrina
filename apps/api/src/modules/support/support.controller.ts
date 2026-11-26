import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  supportTicketSchema,
  updateSupportTicketStatusSchema,
  type SupportTicketInput,
  type UpdateSupportTicketStatusInput,
} from '@tuvitrina/contracts';
import { CurrentUser, Public, Roles, type RequestAuthUser } from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/guards/redis-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SupportService } from './support.service';

@ApiTags('Centro de Ayuda y Soporte')
@Controller('api/v1')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('support/tickets')
  @Public()
  @RateLimit({ limit: 6, windowSeconds: 60, keyPrefix: 'support-ticket' })
  @ApiOperation({ summary: 'Crea un ticket de soporte desde el Centro de Ayuda público' })
  createTicket(@Body(new ZodValidationPipe(supportTicketSchema)) body: SupportTicketInput) {
    return this.supportService.createTicket(body);
  }

  @Get('admin/support-tickets')
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.support)
  @ApiOperation({ summary: 'Lista tickets de soporte para el backoffice' })
  listTickets(@Query('status') status?: string) {
    return this.supportService.listTickets({ status });
  }

  @Patch('admin/support-tickets/:id')
  @ApiBearerAuth()
  @Roles(UserRole.admin, UserRole.support)
  @ApiOperation({ summary: 'Actualiza el estado de un ticket de soporte' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: RequestAuthUser,
    @Body(new ZodValidationPipe(updateSupportTicketStatusSchema)) body: UpdateSupportTicketStatusInput,
  ) {
    return this.supportService.updateTicketStatus(id, body, user.profile!.id, user.profile!.role);
  }
}
