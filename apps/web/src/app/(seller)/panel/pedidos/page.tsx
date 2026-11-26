'use client';

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Download, Eye, MessageCircle, Package, Truck } from 'lucide-react';
import { formatMoney, type OrderDto, type StoreSummaryDto } from '@tuvitrina/contracts';
import { SellerShell } from '@/components/SellerShell';
import { EmptyStateCard, ErrorStateCard, PageSkeleton } from '@/components/StateViews';
import { useAuth } from '@/components/ThemeAndQueryProvider';

const STATUS_CHIPS: Record<string, { label: string; color: string }> = {
  created: { label: 'Nuevo', color: '#FF6B3D' },
  confirmed: { label: 'Confirmado', color: '#00796B' },
  preparing: { label: 'Preparando', color: '#0288D1' },
  dispatched: { label: 'Despachado', color: '#7B1FA2' },
  delivered: { label: 'Entregado', color: '#2E7D32' },
  cancelled: { label: 'Cancelado', color: '#C62828' },
};

function OrdersManager({ store }: { store: StoreSummaryDto }) {
  const { apiClient } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>('confirmed');
  const [actionNote, setActionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ['seller-orders', statusFilter],
    queryFn: () => apiClient.listSellerOrders({ status: statusFilter }),
    refetchInterval: 15_000,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await apiClient.updateOrderStatus(selectedOrder.id, {
        status: targetStatus as any,
        note: actionNote.trim() || undefined,
      });
      setSelectedOrder(null);
      setActionNote('');
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar el estado.');
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = async () => {
    setExportBusy(true);
    setErrorMsg(null);
    try {
      const csv = await apiClient.exportOrdersCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedidos-${store.slug}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo exportar los pedidos.');
    } finally {
      setExportBusy(false);
    }
  };

  if (ordersQuery.isLoading) return <PageSkeleton />;
  if (ordersQuery.isError) {
    return (
      <ErrorStateCard
        message={ordersQuery.error instanceof Error ? ordersQuery.error.message : 'Error cargando pedidos.'}
        onRetry={() => ordersQuery.refetch()}
      />
    );
  }

  const orders = ordersQuery.data ?? [];

  return (
    <Stack spacing={3}>
      {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              select
              label="Filtrar por estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">Todos los estados</MenuItem>
              <MenuItem value="created">Nuevos</MenuItem>
              <MenuItem value="confirmed">Confirmados</MenuItem>
              <MenuItem value="preparing">Preparando</MenuItem>
              <MenuItem value="dispatched">Despachados</MenuItem>
              <MenuItem value="delivered">Entregados</MenuItem>
              <MenuItem value="cancelled">Cancelados</MenuItem>
            </TextField>
            <Button
              variant="outlined"
              startIcon={<Download size={18} />}
              disabled={exportBusy}
              onClick={() => void handleExportCsv()}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {exportBusy ? 'Exportando...' : 'Exportar CSV'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {orders.length === 0 ? (
        <EmptyStateCard
          icon={<Package size={26} />}
          title="No hay pedidos con este filtro"
          description="Los pedidos de tus clientes aparecerán aquí en tiempo real cuando compren en tu tienda online."
        />
      ) : (
        <Stack spacing={1.5}>
          {orders.map((order) => {
            const chip = STATUS_CHIPS[order.status] ?? { label: order.status, color: '#757575' };
            const cleanPhone = order.customerSnapshot.phone.replace(/\D/g, '');
            const whatsappChatUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${order.customerSnapshot.customerName}, le escribo de su pedido #${order.orderNumber} en TuVitrina.`)}`;

            return (
              <Card key={order.id}>
                <CardContent>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    gap={2}
                  >
                    <Box>
                      <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
                        <Typography variant="subtitle1" fontWeight={700} className="tabular-nums">
                          Pedido #{order.orderNumber}
                        </Typography>
                        <Box
                          sx={{
                            px: 1,
                            py: 0.2,
                            borderRadius: 1,
                            fontSize: 11,
                            fontWeight: 700,
                            bgcolor: `${chip.color}15`,
                            color: chip.color,
                          }}
                        >
                          {chip.label}
                        </Box>
                      </Stack>
                      <Typography variant="body2" fontWeight={600}>
                        {order.customerSnapshot.customerName} · {order.customerSnapshot.phone}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.items.length} productos · {formatMoney(order.total, order.currency)}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <Button
                        component="a"
                        href={whatsappChatUrl}
                        target="_blank"
                        rel="noreferrer"
                        variant="outlined"
                        color="success"
                        size="small"
                        startIcon={<MessageCircle size={16} />}
                      >
                        Chat
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Eye size={16} />}
                        onClick={() => {
                          setSelectedOrder(order);
                          setTargetStatus(order.status);
                        }}
                      >
                        Gestionar
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <Dialog
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedOrder ? (
          <>
            <DialogTitle>Pedido #{selectedOrder.orderNumber}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Cliente</Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {selectedOrder.customerSnapshot.customerName} ({selectedOrder.customerSnapshot.phone})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedOrder.customerSnapshot.streetAddress}, {selectedOrder.customerSnapshot.municipality}, {selectedOrder.customerSnapshot.province}
                  </Typography>
                  {selectedOrder.customerSnapshot.notes ? (
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                      <strong>Notas:</strong> {selectedOrder.customerSnapshot.notes}
                    </Typography>
                  ) : null}
                </Box>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Productos</Typography>
                  {selectedOrder.items.map((i) => (
                    <Stack key={i.id} direction="row" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2">
                        {i.quantity}x {i.productName}{i.variantLabel ? ` (${i.variantLabel})` : ''}
                      </Typography>
                      <Typography variant="body2" fontWeight={700} className="tabular-nums">
                        {formatMoney(i.lineTotal, i.currency)}
                      </Typography>
                    </Stack>
                  ))}
                  <Stack direction="row" justifyContent="space-between" mt={1} pt={1} borderTop="1px solid" borderColor="divider">
                    <Typography variant="subtitle1" fontWeight={700}>Total</Typography>
                    <Typography variant="subtitle1" fontWeight={700} className="tabular-nums" color="primary.main">
                      {formatMoney(selectedOrder.total, selectedOrder.currency)}
                    </Typography>
                  </Stack>
                </Box>

                <TextField
                  select
                  label="Cambiar estado del pedido"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                >
                  <MenuItem value="created">Nuevo</MenuItem>
                  <MenuItem value="confirmed">Confirmado (Descuenta stock)</MenuItem>
                  <MenuItem value="preparing">Preparando</MenuItem>
                  <MenuItem value="dispatched">Despachado</MenuItem>
                  <MenuItem value="delivered">Entregado</MenuItem>
                  <MenuItem value="cancelled">Cancelado</MenuItem>
                </TextField>

                <TextField
                  label="Nota interna o motivo (opcional)"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedOrder(null)}>Cerrar</Button>
              <Button
                variant="contained"
                color="secondary"
                disabled={busy}
                onClick={() => void handleUpdateStatus()}
              >
                {busy ? 'Guardando...' : 'Actualizar estado'}
              </Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>
    </Stack>
  );
}

export default function PedidosPanelPage() {
  return (
    <SellerShell title="Pedidos">
      {(store) => <OrdersManager store={store} />}
    </SellerShell>
  );
}
