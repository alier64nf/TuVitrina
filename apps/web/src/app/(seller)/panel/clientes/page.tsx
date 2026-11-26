'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Eye, MessageCircle, Search, Users } from 'lucide-react';
import { formatMoney, type CustomerSummaryDto } from '@tuvitrina/contracts';
import { SellerShell } from '@/components/SellerShell';
import { EmptyStateCard, ErrorStateCard, PageSkeleton } from '@/components/StateViews';
import { useAuth } from '@/components/ThemeAndQueryProvider';
import { ORDER_STATUS_COLORS } from '@/lib/theme/m3Theme';

function CustomersManager() {
  const { apiClient } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummaryDto | null>(null);

  const customersQuery = useQuery({
    queryKey: ['seller-customers', search.trim()],
    queryFn: () => apiClient.listCustomers(search.trim() || undefined),
  });

  if (customersQuery.isLoading) return <PageSkeleton />;
  if (customersQuery.isError) {
    return (
      <ErrorStateCard
        message={
          customersQuery.error instanceof Error
            ? customersQuery.error.message
            : 'Error cargando la lista de clientes.'
        }
        onRetry={() => customersQuery.refetch()}
      />
    );
  }

  const customers = customersQuery.data ?? [];

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <TextField
            label="Buscar cliente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, teléfono o municipio..."
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </CardContent>
      </Card>

      {customers.length === 0 ? (
        <EmptyStateCard
          icon={<Users size={26} />}
          title="Aún no hay clientes registrados"
          description="Cuando recibas pedidos en tu tienda, aquí verás tus compradores frecuentes y su historial."
        />
      ) : (
        <Stack spacing={1.5}>
          {customers.map((customer) => {
            const cleanPhone = customer.phone.replace(/\D/g, '');
            const whatsappUrl = `https://wa.me/${cleanPhone}`;
            return (
              <Card key={customer.phone}>
                <CardContent>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ sm: 'center' }}
                    gap={2}
                  >
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {customer.customerName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {customer.phone}
                        {customer.municipality ? ` · ${customer.municipality}, ${customer.province}` : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" className="tabular-nums">
                        {customer.ordersCount}{' '}
                        {customer.ordersCount === 1 ? 'pedido' : 'pedidos'} · Total comprado:{' '}
                        <strong>{formatMoney(customer.totalSpent, customer.currency)}</strong> · Último:{' '}
                        {new Date(customer.lastOrderAt).toLocaleDateString('es-CU')}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <Button
                        component="a"
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        size="small"
                        variant="outlined"
                        color="success"
                        startIcon={<MessageCircle size={16} />}
                      >
                        WhatsApp
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Eye size={16} />}
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        Historial
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
        open={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedCustomer ? (
          <>
            <DialogTitle>
              Historial de {selectedCustomer.customerName}
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Teléfono: {selectedCustomer.phone} · Total acumulado:{' '}
                <strong>{formatMoney(selectedCustomer.totalSpent, selectedCustomer.currency)}</strong>
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Pedido</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedCustomer.orders.map((ord) => {
                    const st = ORDER_STATUS_COLORS[ord.status] ?? { label: ord.status, color: '#757575' };
                    return (
                      <TableRow key={ord.id}>
                        <TableCell className="tabular-nums">#{ord.orderNumber}</TableCell>
                        <TableCell className="tabular-nums">
                          {new Date(ord.createdAt).toLocaleDateString('es-CU')}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" fontWeight={700} sx={{ color: st.color }}>
                            {st.label}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" className="tabular-nums">
                          {formatMoney(ord.total, ord.currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedCustomer(null)}>Cerrar</Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>
    </Stack>
  );
}

export default function ClientesPage() {
  return (
    <SellerShell title="Clientes">
      {() => <CustomersManager />}
    </SellerShell>
  );
}
