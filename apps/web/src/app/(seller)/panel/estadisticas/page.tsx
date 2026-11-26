'use client';

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid2 as Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { formatMoney } from '@tuvitrina/contracts';
import { SellerShell } from '@/components/SellerShell';
import { EmptyStateCard, ErrorStateCard, PageSkeleton } from '@/components/StateViews';
import { useAuth } from '@/components/ThemeAndQueryProvider';

type PeriodKey = '7d' | '30d' | '90d' | 'all';

function AnalyticsDashboard() {
  const { apiClient } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>('7d');

  const analyticsQuery = useQuery({
    queryKey: ['seller-analytics', period],
    queryFn: () => apiClient.getStoreAnalytics(period),
  });

  if (analyticsQuery.isLoading) return <PageSkeleton />;
  if (analyticsQuery.isError || !analyticsQuery.data) {
    return (
      <ErrorStateCard
        message={
          analyticsQuery.error instanceof Error
            ? analyticsQuery.error.message
            : 'Error cargando estadísticas.'
        }
        onRetry={() => analyticsQuery.refetch()}
      />
    );
  }

  const stats = analyticsQuery.data;
  const maxDayVisits = Math.max(1, ...stats.dailySeries.map((d) => d.visits));

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            gap={2}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Período de análisis
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Analítica respetuosa con la privacidad (sin cookies ni rastreo personal).
              </Typography>
            </Box>
            <ToggleButtonGroup
              exclusive
              value={period}
              onChange={(_e, val) => {
                if (val) setPeriod(val);
              }}
              size="small"
            >
              <ToggleButton value="7d">7 días</ToggleButton>
              <ToggleButton value="30d">30 días</ToggleButton>
              <ToggleButton value="90d">90 días</ToggleButton>
              <ToggleButton value="all">Todo</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Pedidos válidos
              </Typography>
              <Typography variant="h4" className="tabular-nums" mt={0.5}>
                {stats.ordersCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Valor total
              </Typography>
              <Typography variant="h5" fontWeight={700} className="tabular-nums" mt={0.5}>
                {formatMoney(stats.totalRevenue, stats.currency)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Ticket promedio
              </Typography>
              <Typography variant="h5" fontWeight={700} className="tabular-nums" mt={0.5}>
                {formatMoney(stats.averageTicket, stats.currency)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Visitas a la tienda
              </Typography>
              <Typography variant="h4" className="tabular-nums" mt={0.5}>
                {stats.visitsCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Conversión
              </Typography>
              <Typography variant="h4" color="primary.main" className="tabular-nums" mt={0.5}>
                {stats.conversionRatePercent}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Actividad diaria (visitas y pedidos)
          </Typography>
          {stats.dailySeries.length === 0 ? (
            <EmptyStateCard
              icon={<BarChart3 size={24} />}
              title="Sin actividad en este período"
              description="Comparte el enlace o QR de tu tienda para empezar a registrar visitas y pedidos."
            />
          ) : (
            <Stack spacing={1.25} mt={2}>
              {stats.dailySeries.slice(-14).map((day) => {
                const widthPct = Math.max(4, Math.round((day.visits / maxDayVisits) * 100));
                return (
                  <Stack key={day.date} direction="row" spacing={2} alignItems="center">
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      className="tabular-nums"
                      sx={{ width: 88, flexShrink: 0 }}
                    >
                      {day.date}
                    </Typography>
                    <Box sx={{ flexGrow: 1, bgcolor: 'action.hover', borderRadius: 1, height: 14, overflow: 'hidden' }}>
                      <Box
                        sx={{
                          width: `${widthPct}%`,
                          height: '100%',
                          bgcolor: 'primary.main',
                        }}
                      />
                    </Box>
                    <Typography variant="caption" className="tabular-nums" sx={{ width: 140, textAlign: 'right', flexShrink: 0 }}>
                      {day.visits} vis. · {day.ordersCount} ped.
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Productos más pedidos
              </Typography>
              {stats.topProducts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Aún no hay productos vendidos en este período.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="right">Unidades</TableCell>
                      <TableCell align="right">Ingresos</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.topProducts.map((p, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{p.productName}</TableCell>
                        <TableCell align="right" className="tabular-nums">
                          {p.quantitySold}
                        </TableCell>
                        <TableCell align="right" className="tabular-nums">
                          {formatMoney(p.revenue, stats.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Medios de pago utilizados
              </Typography>
              {stats.paymentMethodsBreakdown.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Aún no hay pedidos en este período.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Medio</TableCell>
                      <TableCell align="right">Pedidos</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.paymentMethodsBreakdown.map((pm) => (
                      <TableRow key={pm.paymentLabel}>
                        <TableCell>{pm.paymentLabel}</TableCell>
                        <TableCell align="right" className="tabular-nums">
                          {pm.ordersCount}
                        </TableCell>
                        <TableCell align="right" className="tabular-nums">
                          {formatMoney(pm.revenue, stats.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default function EstadisticasPage() {
  return (
    <SellerShell title="Estadísticas">
      {() => <AnalyticsDashboard />}
    </SellerShell>
  );
}
