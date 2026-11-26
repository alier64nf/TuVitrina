import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateReportInput } from '@tuvitrina/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReport(
    slug: string,
    input: CreateReportInput,
  ): Promise<{ reported: boolean; id: string }> {
    this.prisma.ensureConfigured();

    const store = await this.prisma.store.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    if (!store) {
      throw new NotFoundException('La tienda indicada no existe.');
    }

    if (input.productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: input.productId, storeId: store.id },
        select: { id: true },
      });
      if (!product) {
        throw new NotFoundException('El producto a reportar no pertenece a la tienda especificada.');
      }
    }

    const report = await this.prisma.report.create({
      data: {
        storeId: store.id,
        productId: input.productId ?? null,
        targetType: input.targetType,
        reason: input.reason,
        details: input.details,
        reporterContact: input.reporterContact ?? null,
        status: 'open',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorRole: 'guest',
        action: 'report.created',
        entityType: 'report',
        entityId: report.id,
        metadata: {
          storeSlug: store.slug,
          storeName: store.name,
          targetType: input.targetType,
          reason: input.reason,
        },
      },
    });

    return { reported: true, id: report.id };
  }
}
