'use client';

import {
  formatMoney,
  TuVitrinaApiClient,
  type CheckoutResponseDto,
  type CurrencyCode,
  type GuestCheckoutInput,
} from '@tuvitrina/contracts';

const QUEUE_KEY = 'tuvitrina:offline-order-queue:v1';
export const ORDER_QUEUE_EVENT = 'tuvitrina:order-queue-updated';

export interface QueuedOrderSummaryItem {
  productName: string;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
  currency: CurrencyCode;
}

export interface QueuedOrderItem {
  id: string;
  slug: string;
  storeName: string;
  storeWhatsapp: string;
  payload: GuestCheckoutInput & { idempotencyKey: string };
  summaryItems: QueuedOrderSummaryItem[];
  estimatedTotal: number;
  currency: CurrencyCode;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  attempts: number;
  lastError: string | null;
  createdAt: string;
  syncedAt: string | null;
  syncedOrderNumber: number | null;
  syncedTrackingToken: string | null;
  syncedWhatsappUrl: string | null;
  offlineDraftWhatsappUrl: string;
}

function emitQueueUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ORDER_QUEUE_EVENT));
  }
}

export function readOrderQueue(): QueuedOrderItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedOrderItem[]) : [];
  } catch {
    return [];
  }
}

function writeOrderQueue(items: QueuedOrderItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep up to 25 recent items (remove oldest synced entries if needed)
    const trimmed = items.slice(-25);
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
    emitQueueUpdated();
  } catch {
    // Ignore storage failures
  }
}

export function buildOfflineDraftWhatsappUrl(params: {
  storeWhatsapp: string;
  storeName: string;
  customerName: string;
  phone: string;
  province: string;
  municipality: string;
  streetAddress: string;
  fulfillmentType: 'delivery' | 'pickup';
  notes?: string | null;
  summaryItems: QueuedOrderSummaryItem[];
  estimatedTotal: number;
  currency: CurrencyCode;
}): string {
  const cleanWhatsapp = params.storeWhatsapp.replace(/\D/g, '');
  const itemsLines = params.summaryItems
    .map(
      (i) =>
        `• ${i.quantity}x ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ''} - ${formatMoney(i.unitPrice, i.currency)}`,
    )
    .join('\n');
  const msg =
    `*Pedido preparado en ${params.storeName} (enviado sin conexión)*\n\n` +
    `👤 *Cliente:* ${params.customerName}\n` +
    `📞 *Teléfono:* ${params.phone}\n` +
    `📍 *Dirección:* ${params.streetAddress}, ${params.municipality}, ${params.province}\n` +
    `🚚 *Tipo:* ${params.fulfillmentType === 'pickup' ? 'Recogida en tienda' : 'Envío a domicilio'}\n` +
    (params.notes ? `📝 *Notas:* ${params.notes}\n\n` : '\n') +
    `*Productos:*\n${itemsLines}\n\n` +
    `💰 *Total estimado:* *${formatMoney(params.estimatedTotal, params.currency)}*`;
  return `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(msg)}`;
}

export function enqueueOfflineOrder(params: {
  slug: string;
  storeName: string;
  storeWhatsapp: string;
  payload: GuestCheckoutInput & { idempotencyKey: string };
  summaryItems: QueuedOrderSummaryItem[];
  estimatedTotal: number;
  currency: CurrencyCode;
}): QueuedOrderItem {
  const existing = readOrderQueue();
  const already = existing.find((item) => item.payload.idempotencyKey === params.payload.idempotencyKey);
  if (already) return already;

  const entry: QueuedOrderItem = {
    id: params.payload.idempotencyKey,
    slug: params.slug,
    storeName: params.storeName,
    storeWhatsapp: params.storeWhatsapp,
    payload: params.payload,
    summaryItems: params.summaryItems,
    estimatedTotal: params.estimatedTotal,
    currency: params.currency,
    status: 'pending',
    attempts: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
    syncedAt: null,
    syncedOrderNumber: null,
    syncedTrackingToken: null,
    syncedWhatsappUrl: null,
    offlineDraftWhatsappUrl: buildOfflineDraftWhatsappUrl({
      storeWhatsapp: params.storeWhatsapp,
      storeName: params.storeName,
      customerName: params.payload.customerName,
      phone: params.payload.phone,
      province: params.payload.province,
      municipality: params.payload.municipality,
      streetAddress: params.payload.streetAddress,
      fulfillmentType: params.payload.fulfillmentType,
      notes: params.payload.notes,
      summaryItems: params.summaryItems,
      estimatedTotal: params.estimatedTotal,
      currency: params.currency,
    }),
  };

  writeOrderQueue([...existing, entry]);
  return entry;
}

export function removeQueuedOrder(id: string): void {
  const next = readOrderQueue().filter((item) => item.id !== id);
  writeOrderQueue(next);
}

let flushInFlight = false;

export async function flushOrderQueue(
  apiClient: TuVitrinaApiClient,
): Promise<{ syncedCount: number; failedCount: number; syncedItems: QueuedOrderItem[] }> {
  if (typeof window === 'undefined' || flushInFlight) {
    return { syncedCount: 0, failedCount: 0, syncedItems: [] };
  }
  if (!window.navigator.onLine) {
    return { syncedCount: 0, failedCount: 0, syncedItems: [] };
  }

  const queue = readOrderQueue();
  const candidates = queue.filter((q) => q.status === 'pending' || q.status === 'error');
  if (candidates.length === 0) {
    return { syncedCount: 0, failedCount: 0, syncedItems: [] };
  }

  flushInFlight = true;
  let syncedCount = 0;
  let failedCount = 0;
  const syncedItems: QueuedOrderItem[] = [];

  try {
    let working = [...queue];
    for (const candidate of candidates) {
      working = working.map((q) => (q.id === candidate.id ? { ...q, status: 'syncing' } : q));
      writeOrderQueue(working);

      try {
        const res: CheckoutResponseDto = await apiClient.placeOrder(candidate.slug, candidate.payload);
        const updatedItem: QueuedOrderItem = {
          ...candidate,
          status: 'synced',
          attempts: candidate.attempts + 1,
          lastError: null,
          syncedAt: new Date().toISOString(),
          syncedOrderNumber: res.order.orderNumber,
          syncedTrackingToken: res.order.trackingToken,
          syncedWhatsappUrl: res.whatsappUrl,
        };
        working = working.map((q) => (q.id === candidate.id ? updatedItem : q));
        writeOrderQueue(working);
        syncedCount += 1;
        syncedItems.push(updatedItem);
      } catch (err) {
        const isNetworkFailure =
          !window.navigator.onLine ||
          (err instanceof TypeError && /fetch|network/i.test(err.message));
        const message = err instanceof Error ? err.message : 'Error de sincronización';
        working = working.map((q) =>
          q.id === candidate.id
            ? {
                ...q,
                status: isNetworkFailure ? 'pending' : 'error',
                attempts: q.attempts + 1,
                lastError: isNetworkFailure ? 'Esperando conexión estable...' : message,
              }
            : q,
        );
        writeOrderQueue(working);
        failedCount += 1;
      }
    }
  } finally {
    flushInFlight = false;
  }

  return { syncedCount, failedCount, syncedItems };
}
