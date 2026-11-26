'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock, Package, Truck } from 'lucide-react';
import { formatMoney, TuVitrinaApiClient } from '@tuvitrina/contracts';
import { ErrorStateCard, PageSkeleton } from '@/components/StateViews';
import { StoreThemeWrapper } from '@/components/StoreThemeWrapper';
import { useCachedStorefront } from '@/lib/offline/useCachedStorefront';
import { ensureMinContrast, ORDER_STATUS_COLORS } from '@/lib/theme/m3Theme';

const STATUS_LABELS: Record<string, { label: string; icon: React.ComponentType<{ size?: number }> }> = {
  created: { label: 'Pedido recibido', icon: Clock },
  confirmed: { label: 'Confirmado por tienda', icon: CheckCircle2 },
  preparing: { label: 'Preparando', icon: Package },
  dispatched: { label: 'En camino / Despachado', icon: Truck },
  delivered: { label: 'Entregado', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', icon: Clock },
};

export default function OrderTrackingPage() {
  const params = useParams<{ slug: string; trackingToken: string }>();
  const slug = params?.slug ?? '';
  const trackingToken = params?.trackingToken ?? '';

  const apiClient = useMemo(
    () =>
      new TuVitrinaApiClient(
        process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '') || '',
        async () => null,
      ),
    [],
  );

  const storefrontQuery = useCachedStorefront(apiClient, slug);

  const trackQuery = useQuery({
    queryKey: ['track-order', slug, trackingToken],
    enabled: Boolean(slug && trackingToken),
    queryFn: () => apiClient.trackOrder(slug, trackingToken),
    refetchInterval: 10_000,
  });

  if (trackQuery.isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <PageSkeleton />
      </Container>
    );
  }

  if (trackQuery.isError || !trackQuery.data) {
    return (
      <StoreThemeWrapper themeConfig={storefrontQuery.data?.store.theme}>
        <Container component="main" id="contenido-principal" maxWidth="md" sx={{ py: 8 }}>
          <ErrorStateCard message="No se encontró el pedido o el enlace de seguimiento no es válido." />
        </Container>
      </StoreThemeWrapper>
    );
  }

  const order = trackQuery.data;
  const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, icon: Clock };
  const StatusIcon = statusInfo.icon;
  const statusBg = ORDER_STATUS_COLORS[order.status]?.color ?? '#00796B';
  const statusFg = ensureMinContrast('#FFFFFF', statusBg, 4.5).color;

  return (
    <StoreThemeWrapper themeConfig={storefrontQuery.data?.store.theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 8 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <Container maxWidth="md">
            <Toolbar disableGutters sx={{ minHeight: 68 }}>
              <Button
                component={Link}
                href={`/${slug}`}
                startIcon={<ArrowLeft size={18} />}
                color="inherit"
                sx={{ minHeight: 44 }}
              >
                Volver a la tienda
              </Button>
            </Toolbar>
          </Container>
        </AppBar>

        <Container component="main" id="contenido-principal" maxWidth="md" sx={{ py: 4 }}>
          <Stack spacing={3}>
            <Box textAlign="center">
              <Typography variant="overline" color="primary.main" fontWeight={700}>
                SEGUIMIENTO DE PEDIDO
              </Typography>
              <Typography variant="h4" component="h1" className="tabular-nums">
                Pedido #{order.orderNumber}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Actualizado en tiempo real.
              </Typography>
            </Box>

            <Card sx={{ bgcolor: statusBg, color: statusFg, borderColor: statusBg }} aria-live="polite">
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <Stack spacing={1.5} alignItems="center">
                  <StatusIcon size={36} />
                  <Typography variant="h5" component="h2" fontWeight={700}>
                    {statusInfo.label}
                  </Typography>
                  {order.cancelReason ? (
                    <Typography variant="body2">Motivo: {order.cancelReason}</Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Stack spacing={2.5}>
                  <Typography variant="h6" component="h2">
                    Detalle de productos
                  </Typography>
                  {order.items.map((item) => (
                    <Stack
                      key={item.id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {item.quantity}x {item.productName}
                          {item.variantLabel ? ` (${item.variantLabel})` : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" className="tabular-nums">
                          {formatMoney(item.unitPrice, item.currency)} c/u
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={700} className="tabular-nums">
                        {formatMoney(item.lineTotal, item.currency)}
                      </Typography>
                    </Stack>
                  ))}

                  <Box pt={2} borderTop="1px solid" borderColor="divider">
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Subtotal
                        </Typography>
                        <Typography variant="body2" className="tabular-nums">
                          {formatMoney(order.subtotal, order.currency)}
                        </Typography>
                      </Stack>
                      {order.discountTotal > 0 ? (
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="primary.main" fontWeight={600}>
                            Descuento{order.couponCode ? ` (Cupón ${order.couponCode})` : ''}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="primary.main"
                            fontWeight={600}
                            className="tabular-nums"
                          >
                            -{formatMoney(order.discountTotal, order.currency)}
                          </Typography>
                        </Stack>
                      ) : null}
                      {order.shippingCost > 0 ? (
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Envío{order.shippingZoneName ? ` (${order.shippingZoneName})` : ''}
                          </Typography>
                          <Typography variant="body2" className="tabular-nums">
                            {formatMoney(order.shippingCost, order.currency)}
                          </Typography>
                        </Stack>
                      ) : null}
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        pt={1}
                        borderTop="1px solid"
                        borderColor="divider"
                      >
                        <Typography variant="subtitle1" fontWeight={700}>
                          Total
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          fontWeight={700}
                          className="tabular-nums"
                          color="primary.main"
                        >
                          {formatMoney(order.total, order.currency)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Stack spacing={1.5}>
                  <Typography variant="h6" component="h2">
                    Información de entrega
                  </Typography>
                  <Typography variant="body2">
                    <strong>Cliente:</strong> {order.customerSnapshot.customerName}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Teléfono:</strong> {order.customerSnapshot.phone}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Dirección:</strong> {order.customerSnapshot.streetAddress},{' '}
                    {order.customerSnapshot.municipality}, {order.customerSnapshot.province}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Método de pago:</strong> {order.paymentLabel}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Container>
      </Box>
    </StoreThemeWrapper>
  );
}
