import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateSupportTicketResponseDto,
  SupportTicketDto,
  SupportTicketInput,
  UpdateSupportTicketStatusInput,
} from '@tuvitrina/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  private mapTicket(ticket: {
    id: string;
    name: string;
    contact: string;
    channel: string;
    storeSlug: string | null;
    topic: string;
    message: string;
    status: 'open' | 'in_progress' | 'resolved';
    createdAt: Date;
    updatedAt: Date;
  }): SupportTicketDto {
    return {
      id: ticket.id,
      name: ticket.name,
      contact: ticket.contact,
      channel: ticket.channel as 'whatsapp' | 'telegram' | 'email',
      storeSlug: ticket.storeSlug,
      topic: ticket.topic,
      message: ticket.message,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  async createTicket(input: SupportTicketInput): Promise<CreateSupportTicketResponseDto> {
    this.prisma.ensureConfigured();
    const created = await this.prisma.supportTicket.create({
      data: {
        name: input.name.trim(),
        contact: input.contact.trim(),
        channel: input.channel,
        storeSlug: input.storeSlug?.trim() || null,
        topic: input.topic.trim(),
        message: input.message.trim(),
        status: 'open',
      },
    });

    return {
      ticket: this.mapTicket(created),
      referenceCode: `SOP-${created.id.slice(0, 8).toUpperCase()}`,
    };
  }

  async listTickets(params?: { status?: string }): Promise<SupportTicketDto[]> {
    this.prisma.ensureConfigured();
    const where: { status?: 'open' | 'in_progress' | 'resolved' } = {};
    if (params?.status === 'open' || params?.status === 'in_progress' || params?.status === 'resolved') {
      where.status = params.status;
    }

    const tickets = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return tickets.map((t) => this.mapTicket(t));
  }

  async updateTicketStatus(
    id: string,
    input: UpdateSupportTicketStatusInput,
    actorId: string,
    actorRole: string,
  ): Promise<SupportTicketDto> {
    this.prisma.ensureConfigured();
    const existing = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Ticket de soporte no encontrado.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.supportTicket.update({
        where: { id },
        data: { status: input.status },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          actorRole,
          action: 'support_ticket.status_updated',
          entityType: 'support_ticket',
          entityId: id,
          metadata: { from: existing.status, to: input.status },
        },
      });
      return next;
    });

    return this.mapTicket(updated);
  }
}
