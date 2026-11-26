import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  convertCurrency,
  fromCents,
  toCents,
  type CurrencyCode,
  type CustomerSummaryDto,
  type OrderDto,
  type UpdateOrderStatusInput,
} from '@tuvitrina/contracts';
import type { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StoresService } from '../stores/stores.service';

function escapeCsvCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
  ) {}

  async listSellerOrders(ownerId: string, status?: string): Promise<OrderDto[]> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const orders = await this.prisma.order.findMany({
      where: {
        storeId: store.id,
        ...(status && status !== 'all' ? { status: status as OrderStatus } : {}),
      },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return orders.map((order) => ({
      id: order.id,
      storeId: order.storeId,
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
      status: order.status,
      paymentStatus: order.paymentStatus,
      channel: order.channel,
      paymentLabel: order.paymentLabel,
      fulfillmentType: order.fulfillmentType,
      shippingZoneName: order.shippingZoneName,
      customerSnapshot: order.customerSnapshot as any,
      currency: order.currency as CurrencyCode,
      subtotal: Number(order.subtotal),
      discountTotal: Number(order.discountTotal),
      shippingCost: Number(order.shippingCost),
      total: Number(order.total),
      couponCode: order.couponCode,
      cancelReason: order.cancelReason,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        variantLabel: i.variantLabel,
        unitPrice: Number(i.unitPrice),
        currency: i.currency as CurrencyCode,
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
      })),
      statusHistory: order.statusHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      })),
    }));
  }

  async getSellerOrder(ownerId: string, orderId: string): Promise<OrderDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId: store.id },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado en tu tienda.');
    }

    return {
      id: order.id,
      storeId: order.storeId,
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
      status: order.status,
      paymentStatus: order.paymentStatus,
      channel: order.channel,
      paymentLabel: order.paymentLabel,
      fulfillmentType: order.fulfillmentType,
      shippingZoneName: order.shippingZoneName,
      customerSnapshot: order.customerSnapshot as any,
      currency: order.currency as CurrencyCode,
      subtotal: Number(order.subtotal),
      discountTotal: Number(order.discountTotal),
      shippingCost: Number(order.shippingCost),
      total: Number(order.total),
      couponCode: order.couponCode,
      cancelReason: order.cancelReason,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        variantLabel: i.variantLabel,
        unitPrice: Number(i.unitPrice),
        currency: i.currency as CurrencyCode,
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
      })),
      statusHistory: order.statusHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }

  async updateOrderStatus(
    ownerId: string,
    orderId: string,
    input: UpdateOrderStatusInput,
    profileId: string,
  ): Promise<OrderDto> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, storeId: store.id },
      include: { items: true },
    });

    if (!existing) {
      throw new NotFoundException('Pedido no encontrado en tu tienda.');
    }

    const oldStatus = existing.status;
    const newStatus = input.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Si se confirma por primera vez, descontar stock si aplica
      if (oldStatus === 'created' && newStatus === 'confirmed') {
        for (const item of existing.items) {
          if (item.productId) {
            await tx.product.updateMany({
              where: { id: item.productId, storeId: store.id, stock: { not: null } },
              data: { stock: { decrement: item.quantity } },
            });
          }
        }
      }

      const ord = await tx.order.update({
        where: { id: existing.id },
        data: {
          status: newStatus,
          cancelReason: newStatus === 'cancelled' ? input.cancelReason || 'Cancelado por el vendedor' : existing.cancelReason,
          statusHistory: {
            create: {
              fromStatus: oldStatus,
              toStatus: newStatus,
              note: input.note || `Estado actualizado a ${newStatus}`,
              changedById: profileId,
            },
          },
        },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      });

      return ord;
    });

    return {
      id: updated.id,
      storeId: updated.storeId,
      orderNumber: updated.orderNumber,
      trackingToken: updated.trackingToken,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      channel: updated.channel,
      paymentLabel: updated.paymentLabel,
      fulfillmentType: updated.fulfillmentType,
      shippingZoneName: updated.shippingZoneName,
      customerSnapshot: updated.customerSnapshot as any,
      currency: updated.currency as CurrencyCode,
      subtotal: Number(updated.subtotal),
      discountTotal: Number(updated.discountTotal),
      shippingCost: Number(updated.shippingCost),
      total: Number(updated.total),
      couponCode: updated.couponCode,
      cancelReason: updated.cancelReason,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      items: updated.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        variantLabel: i.variantLabel,
        unitPrice: Number(i.unitPrice),
        currency: i.currency as CurrencyCode,
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
      })),
      statusHistory: updated.statusHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }

  async exportOrdersCsv(ownerId: string): Promise<string> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const orders = await this.prisma.order.findMany({
      where: { storeId: store.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    const headers = [
      'Numero',
      'Fecha',
      'Estado',
      'EstadoPago',
      'MedioPago',
      'Canal',
      'TipoEntrega',
      'Cliente',
      'Telefono',
      'Provincia',
      'Municipio',
      'Direccion',
      'Subtotal',
      'Descuento',
      'Envio',
      'Total',
      'Moneda',
      'Cupon',
      'Productos',
    ];

    const lines = [headers.map(escapeCsvCell).join(',')];

    for (const order of orders) {
      const customer = (order.customerSnapshot ?? {}) as Record<string, unknown>;
      const productsSummary = order.items
        .map(
          (i) =>
            `${i.quantity}x ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ''} (${Number(i.lineTotal)} ${i.currency})`,
        )
        .join(' | ');

      const row = [
        `#${order.orderNumber}`,
        order.createdAt.toISOString(),
        order.status,
        order.paymentStatus,
        order.paymentLabel,
        order.channel,
        order.fulfillmentType,
        customer.customerName ?? '',
        customer.phone ?? '',
        customer.province ?? '',
        customer.municipality ?? '',
        customer.streetAddress ?? '',
        Number(order.subtotal),
        Number(order.discountTotal),
        Number(order.shippingCost),
        Number(order.total),
        order.currency,
        order.couponCode ?? '',
        productsSummary,
      ];
      lines.push(row.map(escapeCsvCell).join(','));
    }

    return `\uFEFF${lines.join('\r\n')}`;
  }

  async listCustomers(ownerId: string, q?: string): Promise<CustomerSummaryDto[]> {
    const store = await this.storesService.requireOwnedStore(ownerId);
    const exchangeRates = (store.exchangeRates as Record<string, number> | null) ?? {
      USD: 320,
      MLC: 270,
    };
    const baseCurrency = store.baseCurrency as CurrencyCode;

    const orders = await this.prisma.order.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    const byPhone = new Map<
      string,
      {
        phone: string;
        customerName: string;
        province: string;
        municipality: string;
        ordersCount: number;
        totalSpentCents: number;
        lastOrderAt: string;
        orders: CustomerSummaryDto['orders'];
      }
    >();

    for (const order of orders) {
      const snap = (order.customerSnapshot ?? {}) as Record<string, string>;
      const rawPhone = (snap.phone ?? '').trim();
      const key = rawPhone.replace(/\D/g, '') || rawPhone || order.id;

      let entry = byPhone.get(key);
      if (!entry) {
        entry = {
          phone: rawPhone,
          customerName: (snap.customerName ?? 'Cliente').trim(),
          province: (snap.province ?? '').trim(),
          municipality: (snap.municipality ?? '').trim(),
          ordersCount: 0,
          totalSpentCents: 0,
          lastOrderAt: order.createdAt.toISOString(),
          orders: [],
        };
        byPhone.set(key, entry);
      }

      entry.ordersCount += 1;
      if (order.status !== 'cancelled') {
        const converted = convertCurrency(
          Number(order.total),
          order.currency as CurrencyCode,
          baseCurrency,
          exchangeRates,
        );
        entry.totalSpentCents += toCents(converted);
      }
      entry.orders.push({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: Number(order.total),
        currency: order.currency as CurrencyCode,
        createdAt: order.createdAt.toISOString(),
      });
    }

    let results: CustomerSummaryDto[] = Array.from(byPhone.values()).map((c) => ({
      phone: c.phone,
      customerName: c.customerName,
      province: c.province,
      municipality: c.municipality,
      ordersCount: c.ordersCount,
      totalSpent: fromCents(c.totalSpentCents),
      currency: baseCurrency,
      lastOrderAt: c.lastOrderAt,
      orders: c.orders,
    }));

    if (q && q.trim().length > 0) {
      const term = q.trim().toLowerCase();
      results = results.filter(
        (c) =>
          c.customerName.toLowerCase().includes(term) ||
          c.phone.toLowerCase().includes(term) ||
          c.municipality.toLowerCase().includes(term),
      );
    }

    results.sort((a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime());
    return results;
  }
}
