'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid2 as Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Crown,
  FileText,
  Flag,
  MessageSquare,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
  Users,
  XCircle,
} from 'lucide-react';
import {
  formatMoney,
  type AuditLogDto,
  type PlatformMetricsDto,
  type ProfileDto,
  type ReportDto,
  type StoreSummaryDto,
  type SubscriptionRequestDto,
  type SupportTicketDto,
  type PlansConfigDto,
} from '@tuvitrina/contracts';
import { useAuth } from '@/components/ThemeAndQueryProvider';
import { PageSkeleton } from '@/components/StateViews';

export default function AdminBackofficePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading: authLoading, apiClient } = useAuth();

  const [currentTab, setCurrentTab] = useState(0);

  // Filtros
  const [storeSearch, setStoreSearch] = useState('');
  const [storeStatusFilter, setStoreStatusFilter] = useState('all');
  const [storePlanFilter, setStorePlanFilter] = useState('all');

  const [subStatusFilter, setSubStatusFilter] = useState('pending');
  const [reportStatusFilter, setReportStatusFilter] = useState('open');
  const [userSearch, setUserSearch] = useState('');

  // Modales
  const [suspendModal, setSuspendModal] = useState<{ open: boolean; store: StoreSummaryDto | null; reason: string }>({
    open: false,
    store: null,
    reason: '',
  });

  const [rejectSubModal, setRejectSubModal] = useState<{ open: boolean; sub: SubscriptionRequestDto | null; reason: string }>({
    open: false,
    sub: null,
    reason: '',
  });

  const [resolveReportModal, setResolveReportModal] = useState<{ open: boolean; report: ReportDto | null; note: string; status: 'resolved' | 'dismissed' }>({
    open: false,
    report: null,
    note: '',
    status: 'resolved',
  });

  // Queries
  const meQuery = useQuery({
    queryKey: ['admin-me', user?.id],
    enabled: Boolean(user),
    queryFn: () => apiClient.getMe(),
  });

  const profile = meQuery.data?.profile;
  const isAuthorized = profile?.role === 'admin' || profile?.role === 'support';

  const metricsQuery = useQuery<PlatformMetricsDto>({
    queryKey: ['admin-metrics'],
    enabled: Boolean(user && isAuthorized),
    queryFn: () => apiClient.adminGetMetrics(),
  });

  const storesQuery = useQuery<StoreSummaryDto[]>({
    queryKey: ['admin-stores', storeSearch, storeStatusFilter, storePlanFilter],
    enabled: currentTab === 1 && Boolean(user),
    queryFn: () =>
      apiClient.adminListStores({
        q: storeSearch || undefined,
        status: storeStatusFilter !== 'all' ? storeStatusFilter : undefined,
        plan: storePlanFilter !== 'all' ? storePlanFilter : undefined,
      }),
  });

  const subsQuery = useQuery<SubscriptionRequestDto[]>({
    queryKey: ['admin-subs', subStatusFilter],
    enabled: currentTab === 0 && Boolean(user),
    queryFn: () =>
      apiClient.adminListSubscriptions({
        status: subStatusFilter !== 'all' ? subStatusFilter : undefined,
      }),
  });

  const reportsQuery = useQuery<ReportDto[]>({
    queryKey: ['admin-reports', reportStatusFilter],
    enabled: currentTab === 2 && Boolean(user),
    queryFn: () =>
      apiClient.adminListReports({
        status: reportStatusFilter !== 'all' ? reportStatusFilter : undefined,
      }),
  });

  const usersQuery = useQuery<ProfileDto[]>({
    queryKey: ['admin-users', userSearch],
    enabled: currentTab === 3 && Boolean(user),
    queryFn: () =>
      apiClient.adminListUsers({
        q: userSearch || undefined,
      }),
  });

  const configQuery = useQuery<PlansConfigDto>({
    queryKey: ['admin-plans-config'],
    enabled: currentTab === 4 && Boolean(user),
    queryFn: () => apiClient.getPlansConfig(),
  });

  const auditLogsQuery = useQuery<AuditLogDto[]>({
    queryKey: ['admin-audit-logs'],
    enabled: currentTab === 5 && Boolean(user),
    queryFn: () => apiClient.adminListAuditLogs({ limit: 100 }),
  });

  const supportTicketsQuery = useQuery<SupportTicketDto[]>({
    queryKey: ['admin-support-tickets'],
    enabled: currentTab === 6 && Boolean(user),
    queryFn: () => apiClient.adminListSupportTickets(),
  });

  // Mutations
  const approveSubMutation = useMutation({
    mutationFn: (subId: string) => apiClient.adminReviewSubscription(subId, { status: 'approved' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
  });

  const rejectSubMutation = useMutation({
    mutationFn: ({ subId, reason }: { subId: string; reason: string }) =>
      apiClient.adminReviewSubscription(subId, { status: 'rejected', rejectionReason: reason }),
    onSuccess: () => {
      setRejectSubModal({ open: false, sub: null, reason: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-subs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
  });

  const updateStoreStatusMutation = useMutation({
    mutationFn: ({ storeId, status, reason }: { storeId: string; status: 'active' | 'suspended'; reason?: string }) =>
      apiClient.adminUpdateStoreStatus(storeId, { status, suspendedReason: reason ?? null }),
    onSuccess: () => {
      setSuspendModal({ open: false, store: null, reason: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-stores'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
  });

  const resolveReportMutation = useMutation({
    mutationFn: ({ reportId, status, note }: { reportId: string; status: 'resolved' | 'dismissed'; note: string }) =>
      apiClient.adminReviewReport(reportId, { status, resolutionNote: note }),
    onSuccess: () => {
      setResolveReportModal({ open: false, report: null, note: '', status: 'resolved' });
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
  });

  const updateSupportTicketMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'in_progress' | 'resolved' }) =>
      apiClient.adminUpdateSupportTicketStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] });
    },
  });

  if (authLoading || (user && meQuery.isLoading)) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <PageSkeleton />
      </Container>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Card sx={{ textAlign: 'center', p: 4 }}>
          <ShieldAlert size={56} color="#DC2626" style={{ margin: '0 auto 16px' }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Acceso Restringido
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Esta sección es exclusiva para el personal de administración y soporte de TuVitrina.
          </Typography>
          <Button component={Link} href="/panel" variant="contained">
            Volver a mi panel de vendedor
          </Button>
        </Card>
      </Container>
    );
  }

  const metrics = metricsQuery.data;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 8 }}>
      {/* Top Header */}
      <Paper square elevation={1} sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <ShieldCheck size={28} color="#00796B" />
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  TuVitrina · Panel de Administración
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Sesión: {user.email} · Rol: <strong>{profile?.role.toUpperCase()}</strong>
                </Typography>
              </Box>
            </Stack>
            <Button component={Link} href="/panel" startIcon={<ArrowLeft size={16} />} variant="outlined" size="small">
              Ir a Mi Panel de Tienda
            </Button>
          </Stack>
        </Container>
      </Paper>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        {/* KPI Strip */}
        <Grid container spacing={2} mb={3}>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">Tiendas Activas</Typography>
                <Typography variant="h5" fontWeight={700} className="tabular-nums" color="success.main">
                  {metrics?.activeStores ?? '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">Tiendas Suspendidas</Typography>
                <Typography variant="h5" fontWeight={700} className="tabular-nums" color="error.main">
                  {metrics?.suspendedStores ?? '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">Pedidos Totales</Typography>
                <Typography variant="h5" fontWeight={700} className="tabular-nums">
                  {metrics?.totalOrders ?? '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">Conversión Free → PRO</Typography>
                <Typography variant="h5" fontWeight={700} className="tabular-nums" color="primary.main">
                  {metrics ? `${metrics.conversionFreeToProPercent}%` : '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 8, md: 2.4 }}>
            <Card variant="outlined" sx={{ bgcolor: (metrics?.pendingSubscriptionsCount ?? 0) > 0 ? '#FFF8E1' : undefined }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary">Suscripciones Pendientes</Typography>
                <Typography variant="h5" fontWeight={700} className="tabular-nums" color="#E65100">
                  {metrics?.pendingSubscriptionsCount ?? '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper square elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)} variant="scrollable" scrollButtons="auto">
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Crown size={16} />
                  <span>Suscripciones PRO</span>
                  {(metrics?.pendingSubscriptionsCount ?? 0) > 0 ? (
                    <Box component="span" sx={{ px: 0.8, py: 0.1, bgcolor: '#ED6C02', color: 'white', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                      {metrics?.pendingSubscriptionsCount}
                    </Box>
                  ) : null}
                </Stack>
              }
            />
            <Tab label={<Stack direction="row" spacing={1} alignItems="center"><StoreIcon size={16} /><span>Tiendas</span></Stack>} />
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Flag size={16} />
                  <span>Moderación Reportes</span>
                  {(metrics?.openReportsCount ?? 0) > 0 ? (
                    <Box component="span" sx={{ px: 0.8, py: 0.1, bgcolor: '#D32F2F', color: 'white', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                      {metrics?.openReportsCount}
                    </Box>
                  ) : null}
                </Stack>
              }
            />
            <Tab label={<Stack direction="row" spacing={1} alignItems="center"><Users size={16} /><span>Usuarios</span></Stack>} />
            <Tab label={<Stack direction="row" spacing={1} alignItems="center"><Settings size={16} /><span>Configuración Planes</span></Stack>} />
            <Tab label={<Stack direction="row" spacing={1} alignItems="center"><FileText size={16} /><span>Auditoría</span></Stack>} />
            <Tab label={<Stack direction="row" spacing={1} alignItems="center"><MessageSquare size={16} /><span>Soporte</span></Stack>} />
          </Tabs>
        </Paper>

        {/* TAB 0: Suscripciones PRO */}
        {currentTab === 0 ? (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700}>
                  Solicitudes de Suscripción PRO
                </Typography>
                <FormControl size="small" sx={{ width: 180 }}>
                  <InputLabel id="sub-status-label">Filtrar estado</InputLabel>
                  <Select
                    labelId="sub-status-label"
                    value={subStatusFilter}
                    label="Filtrar estado"
                    onChange={(e) => setSubStatusFilter(e.target.value)}
                  >
                    <MenuItem value="pending">Solo pendientes</MenuItem>
                    <MenuItem value="approved">Aprobadas</MenuItem>
                    <MenuItem value="rejected">Rechazadas</MenuItem>
                    <MenuItem value="all">Todas</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              {subsQuery.isLoading ? (
                <CircularProgress size={24} />
              ) : (subsQuery.data?.length ?? 0) === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No hay solicitudes registradas con el filtro actual.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Tienda</TableCell>
                        <TableCell>Monto</TableCell>
                        <TableCell>Medio</TableCell>
                        <TableCell>Referencia</TableCell>
                        <TableCell>Comprobante</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {subsQuery.data?.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell className="tabular-nums">
                            {new Date(sub.createdAt).toLocaleDateString('es-CU')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {sub.storeName ?? sub.storeId}
                          </TableCell>
                          <TableCell className="tabular-nums" sx={{ fontWeight: 700 }}>
                            {formatMoney(sub.amount, sub.currency)}
                          </TableCell>
                          <TableCell>{sub.paymentMethodLabel}</TableCell>
                          <TableCell className="tabular-nums">{sub.reference}</TableCell>
                          <TableCell>
                            {sub.receiptPublicUrl ? (
                              <Button
                                variant="text"
                                size="small"
                                href={sub.receiptPublicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                              >
                                Ver comprobante
                              </Button>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {sub.status === 'approved' ? (
                              <Box component="span" sx={{ color: '#2E7D32', fontWeight: 700, fontSize: '0.8125rem' }}>
                                Aprobado
                              </Box>
                            ) : sub.status === 'rejected' ? (
                              <Box component="span" sx={{ color: '#D32F2F', fontWeight: 700, fontSize: '0.8125rem' }}>
                                Rechazado
                              </Box>
                            ) : (
                              <Box component="span" sx={{ color: '#ED6C02', fontWeight: 700, fontSize: '0.8125rem' }}>
                                Pendiente
                              </Box>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {sub.status === 'pending' ? (
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button
                                  variant="contained"
                                  size="small"
                                  color="success"
                                  startIcon={<CheckCircle2 size={14} />}
                                  disabled={approveSubMutation.isPending}
                                  onClick={() => approveSubMutation.mutate(sub.id)}
                                >
                                  Aprobar (PRO)
                                </Button>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  color="error"
                                  startIcon={<XCircle size={14} />}
                                  onClick={() => setRejectSubModal({ open: true, sub, reason: '' })}
                                >
                                  Rechazar
                                </Button>
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                Revisado
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* TAB 1: Tiendas */}
        {currentTab === 1 ? (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3}>
                <TextField
                  placeholder="Buscar por nombre o enlace de tienda..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  size="small"
                  sx={{ flexGrow: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={16} />
                      </InputAdornment>
                    ),
                  }}
                />
                <FormControl size="small" sx={{ width: 150 }}>
                  <InputLabel id="store-status-select-label">Estado</InputLabel>
                  <Select
                    labelId="store-status-select-label"
                    value={storeStatusFilter}
                    label="Estado"
                    onChange={(e) => setStoreStatusFilter(e.target.value)}
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="active">Activas</MenuItem>
                    <MenuItem value="suspended">Suspendidas</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ width: 150 }}>
                  <InputLabel id="store-plan-select-label">Plan</InputLabel>
                  <Select
                    labelId="store-plan-select-label"
                    value={storePlanFilter}
                    label="Plan"
                    onChange={(e) => setStorePlanFilter(e.target.value)}
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    <MenuItem value="free">Free</MenuItem>
                    <MenuItem value="pro">PRO</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              {storesQuery.isLoading ? (
                <CircularProgress size={24} />
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Tienda</TableCell>
                        <TableCell>Enlace</TableCell>
                        <TableCell>WhatsApp</TableCell>
                        <TableCell>Plan</TableCell>
                        <TableCell>Productos</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {storesQuery.data?.map((store) => (
                        <TableRow key={store.id}>
                          <TableCell sx={{ fontWeight: 600 }}>{store.name}</TableCell>
                          <TableCell>
                            <Link href={`/${store.slug}`} target="_blank" style={{ textDecoration: 'none', color: '#00796B' }}>
                              /{store.slug}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums">{store.whatsapp}</TableCell>
                          <TableCell>
                            <Box
                              component="span"
                              sx={{
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                bgcolor: store.plan === 'pro' ? 'primary.50' : 'grey.100',
                                color: store.plan === 'pro' ? 'primary.main' : 'text.secondary',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                              }}
                            >
                              {store.plan.toUpperCase()}
                            </Box>
                          </TableCell>
                          <TableCell className="tabular-nums">{store.productCount}</TableCell>
                          <TableCell>
                            {store.status === 'active' ? (
                              <Box component="span" sx={{ color: '#2E7D32', fontWeight: 600, fontSize: '0.8125rem' }}>
                                Activa
                              </Box>
                            ) : (
                              <Stack spacing={0.2}>
                                <Box component="span" sx={{ color: '#D32F2F', fontWeight: 700, fontSize: '0.8125rem' }}>
                                  Suspendida
                                </Box>
                                {store.suspendedReason ? (
                                  <Typography variant="caption" color="text.secondary">
                                    {store.suspendedReason}
                                  </Typography>
                                ) : null}
                              </Stack>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {store.status === 'active' ? (
                              <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                startIcon={<Ban size={14} />}
                                onClick={() => setSuspendModal({ open: true, store, reason: '' })}
                              >
                                Suspender
                              </Button>
                            ) : (
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                startIcon={<RotateCcw size={14} />}
                                onClick={() => updateStoreStatusMutation.mutate({ storeId: store.id, status: 'active' })}
                              >
                                Reactivar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* TAB 2: Moderación de Reportes */}
        {currentTab === 2 ? (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700}>
                  Cola de Moderación de Contenido
                </Typography>
                <FormControl size="small" sx={{ width: 180 }}>
                  <InputLabel id="report-filter-label">Estado</InputLabel>
                  <Select
                    labelId="report-filter-label"
                    value={reportStatusFilter}
                    label="Estado"
                    onChange={(e) => setReportStatusFilter(e.target.value)}
                  >
                    <MenuItem value="open">Solo abiertos</MenuItem>
                    <MenuItem value="reviewing">En revisión</MenuItem>
                    <MenuItem value="resolved">Resueltos</MenuItem>
                    <MenuItem value="dismissed">Desestimados</MenuItem>
                    <MenuItem value="all">Todos</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              {reportsQuery.isLoading ? (
                <CircularProgress size={24} />
              ) : (reportsQuery.data?.length ?? 0) === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No hay reportes en la cola con el filtro actual.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Objetivo</TableCell>
                        <TableCell>Motivo</TableCell>
                        <TableCell>Detalles</TableCell>
                        <TableCell>Contacto</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportsQuery.data?.map((rep) => (
                        <TableRow key={rep.id}>
                          <TableCell className="tabular-nums">
                            {new Date(rep.createdAt).toLocaleDateString('es-CU')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {rep.targetType === 'store' ? `Tienda: ${rep.storeName}` : `Producto: ${rep.productName ?? 'ID ' + rep.productId}`}
                          </TableCell>
                          <TableCell>{rep.reason}</TableCell>
                          <TableCell sx={{ maxWidth: 280 }}>
                            <Typography variant="body2" noWrap title={rep.details}>
                              {rep.details}
                            </Typography>
                          </TableCell>
                          <TableCell>{rep.reporterContact ?? 'Anónimo'}</TableCell>
                          <TableCell>
                            <Box
                              component="span"
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.8125rem',
                                color:
                                  rep.status === 'open'
                                    ? '#D32F2F'
                                    : rep.status === 'reviewing'
                                    ? '#ED6C02'
                                    : rep.status === 'resolved'
                                    ? '#2E7D32'
                                    : 'text.secondary',
                              }}
                            >
                              {rep.status.toUpperCase()}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            {rep.status === 'open' || rep.status === 'reviewing' ? (
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button
                                  variant="outlined"
                                  size="small"
                                  color="success"
                                  onClick={() => setResolveReportModal({ open: true, report: rep, note: '', status: 'resolved' })}
                                >
                                  Resolver
                                </Button>
                                <Button
                                  variant="text"
                                  size="small"
                                  color="inherit"
                                  onClick={() => setResolveReportModal({ open: true, report: rep, note: '', status: 'dismissed' })}
                                >
                                  Desestimar
                                </Button>
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                {rep.resolutionNote ?? 'Cerrado'}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* TAB 3: Usuarios */}
        {currentTab === 3 ? (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={2} mb={3}>
                <TextField
                  placeholder="Buscar usuarios por correo o nombre..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  size="small"
                  sx={{ flexGrow: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={16} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>

              {usersQuery.isLoading ? (
                <CircularProgress size={24} />
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Nombre</TableCell>
                        <TableCell>Correo</TableCell>
                        <TableCell>Rol</TableCell>
                        <TableCell>Versión Términos</TableCell>
                        <TableCell>Aceptación</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usersQuery.data?.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell sx={{ fontWeight: 600 }}>{u.displayName}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            <Box
                              component="span"
                              sx={{
                                px: 1,
                                py: 0.25,
                                borderRadius: 1,
                                bgcolor: u.role === 'admin' ? '#E8F5E9' : u.role === 'support' ? '#E1F5FE' : 'grey.100',
                                color: u.role === 'admin' ? '#2E7D32' : u.role === 'support' ? '#0288D1' : 'text.secondary',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                              }}
                            >
                              {u.role.toUpperCase()}
                            </Box>
                          </TableCell>
                          <TableCell>{u.termsVersion}</TableCell>
                          <TableCell className="tabular-nums">
                            {new Date(u.acceptedTermsAt).toLocaleDateString('es-CU')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* TAB 4: Configuración de Planes */}
        {currentTab === 4 ? (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} mb={2}>
                Configuración Dinámica de Límites y Precios
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Estos valores se almacenan en la colección/tabla <code>plans_config</code> en la base de datos, garantizando que los límites y tarifas no estén fijos en el código.
              </Typography>

              {configQuery.isLoading ? (
                <CircularProgress size={24} />
              ) : configQuery.data ? (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                        Límites Plan Free
                      </Typography>
                      <Stack spacing={1.5}>
                        <Typography variant="body2">
                          • Máx. Productos: <strong>{configQuery.data.freeLimits.maxProducts}</strong>
                        </Typography>
                        <Typography variant="body2">
                          • Máx. Fotos por Producto: <strong>{configQuery.data.freeLimits.maxImagesPerProduct}</strong>
                        </Typography>
                        <Typography variant="body2">
                          • Máx. Categorías: <strong>{configQuery.data.freeLimits.maxCategories}</strong>
                        </Typography>
                      </Stack>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                        Límites y Precios Plan PRO
                      </Typography>
                      <Stack spacing={1.5}>
                        <Typography variant="body2">
                          • Máx. Productos: <strong>{configQuery.data.proLimits.maxProducts.toLocaleString('es-CU')}</strong>
                        </Typography>
                        <Typography variant="body2">
                          • Máx. Fotos por Producto: <strong>{configQuery.data.proLimits.maxImagesPerProduct}</strong>
                        </Typography>
                        <Typography variant="body2">
                          • Precio CUP: <strong>{formatMoney(configQuery.data.proPriceCup, 'CUP')}</strong>
                        </Typography>
                        <Typography variant="body2">
                          • Precio USD: <strong>{formatMoney(configQuery.data.proPriceUsd, 'USD')}</strong>
                        </Typography>
                        <Typography variant="body2">
                          • Duración de suscripción: <strong>{configQuery.data.proDurationDays} días</strong>
                        </Typography>
                      </Stack>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                        Instrucciones de Pago Mostradas a los Vendedores
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {configQuery.data.paymentInstructions}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* TAB 5: Registro de Auditoría */}
        {currentTab === 5 ? (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} mb={2}>
                Registro Inmutable de Auditoría
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Traza completa de acciones administrativas, cambios de estado de tiendas, revisiones de suscripciones y degradaciones automáticas.
              </Typography>

              {auditLogsQuery.isLoading ? (
                <CircularProgress size={24} />
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha y Hora</TableCell>
                        <TableCell>Rol Actor</TableCell>
                        <TableCell>Acción</TableCell>
                        <TableCell>Entidad</TableCell>
                        <TableCell>Detalles / Metadatos</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditLogsQuery.data?.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="tabular-nums" sx={{ whiteSpace: 'nowrap' }}>
                            {new Date(log.createdAt).toLocaleString('es-CU')}
                          </TableCell>
                          <TableCell>
                            <Box
                              component="span"
                              sx={{
                                px: 0.8,
                                py: 0.2,
                                borderRadius: 1,
                                bgcolor: 'grey.100',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {log.actorRole}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                            {log.action}
                          </TableCell>
                          <TableCell>{log.entityType}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                            {log.metadata ? JSON.stringify(log.metadata) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* TAB 6: Tickets de Soporte */}
        {currentTab === 6 ? (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} mb={2}>
                Tickets del Centro de Ayuda
              </Typography>
              {supportTicketsQuery.isLoading ? (
                <CircularProgress size={24} />
              ) : (supportTicketsQuery.data?.length ?? 0) === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No hay solicitudes de soporte registradas todavía.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Solicitante</TableCell>
                        <TableCell>Canal / Contacto</TableCell>
                        <TableCell>Tema</TableCell>
                        <TableCell>Mensaje</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="right">Acción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {supportTicketsQuery.data?.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell className="tabular-nums">
                            {new Date(ticket.createdAt).toLocaleDateString('es-CU')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {ticket.name}
                            {ticket.storeSlug ? ` (/${ticket.storeSlug})` : ''}
                          </TableCell>
                          <TableCell>
                            {ticket.channel.toUpperCase()} · {ticket.contact}
                          </TableCell>
                          <TableCell>{ticket.topic}</TableCell>
                          <TableCell sx={{ maxWidth: 280 }}>{ticket.message}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{ticket.status.toUpperCase()}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              {ticket.status !== 'in_progress' ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() =>
                                    updateSupportTicketMutation.mutate({
                                      id: ticket.id,
                                      status: 'in_progress',
                                    })
                                  }
                                >
                                  En curso
                                </Button>
                              ) : null}
                              {ticket.status !== 'resolved' ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  onClick={() =>
                                    updateSupportTicketMutation.mutate({
                                      id: ticket.id,
                                      status: 'resolved',
                                    })
                                  }
                                >
                                  Resolver
                                </Button>
                              ) : null}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        ) : null}
      </Container>

      {/* Modal Suspender Tienda */}
      <Dialog open={suspendModal.open} onClose={() => setSuspendModal({ open: false, store: null, reason: '' })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Ban size={20} /> Suspender Tienda «{suspendModal.store?.name}»
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} pt={1}>
            <Alert severity="warning">
              Al suspender la tienda, su catálogo público quedará inmediatamente bloqueado (404) y los clientes no podrán hacer pedidos.
            </Alert>
            <TextField
              label="Motivo obligatorio de suspensión"
              multiline
              rows={3}
              value={suspendModal.reason}
              onChange={(e) => setSuspendModal((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Ej. Incumplimiento reiterado de la política de contenido..."
              required
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSuspendModal({ open: false, store: null, reason: '' })} color="inherit">
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={!suspendModal.reason.trim() || updateStoreStatusMutation.isPending}
            onClick={() => {
              if (suspendModal.store) {
                updateStoreStatusMutation.mutate({
                  storeId: suspendModal.store.id,
                  status: 'suspended',
                  reason: suspendModal.reason.trim(),
                });
              }
            }}
          >
            Confirmar Suspensión Inmediata
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Rechazar Suscripción */}
      <Dialog open={rejectSubModal.open} onClose={() => setRejectSubModal({ open: false, sub: null, reason: '' })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>Rechazar Solicitud de Suscripción PRO</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} pt={1}>
            <Typography variant="body2" color="text.secondary">
              Indica la razón por la que se rechaza el pago (por ejemplo: comprobante borroso, monto incompleto o código de transacción no encontrado).
            </Typography>
            <TextField
              label="Motivo de rechazo"
              multiline
              rows={3}
              value={rejectSubModal.reason}
              onChange={(e) => setRejectSubModal((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Ej. El número de transacción no coincide con el registro del banco..."
              required
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setRejectSubModal({ open: false, sub: null, reason: '' })} color="inherit">
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={!rejectSubModal.reason.trim() || rejectSubMutation.isPending}
            onClick={() => {
              if (rejectSubModal.sub) {
                rejectSubMutation.mutate({
                  subId: rejectSubModal.sub.id,
                  reason: rejectSubModal.reason.trim(),
                });
              }
            }}
          >
            Rechazar Solicitud
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Resolver / Desestimar Reporte */}
      <Dialog
        open={resolveReportModal.open}
        onClose={() => setResolveReportModal({ open: false, report: null, note: '', status: 'resolved' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {resolveReportModal.status === 'resolved' ? 'Resolver Reporte de Moderación' : 'Desestimar Reporte'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} pt={1}>
            <Typography variant="body2" color="text.secondary">
              Escribe una nota interna sobre la resolución aplicada para el registro de auditoría.
            </Typography>
            <TextField
              label="Nota de resolución"
              multiline
              rows={3}
              value={resolveReportModal.note}
              onChange={(e) => setResolveReportModal((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Ej. Se verificó con el vendedor y corrigió la descripción del artículo..."
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setResolveReportModal({ open: false, report: null, note: '', status: 'resolved' })} color="inherit">
            Cancelar
          </Button>
          <Button
            variant="contained"
            color={resolveReportModal.status === 'resolved' ? 'success' : 'inherit'}
            disabled={resolveReportMutation.isPending}
            onClick={() => {
              if (resolveReportModal.report) {
                resolveReportMutation.mutate({
                  reportId: resolveReportModal.report.id,
                  status: resolveReportModal.status,
                  note: resolveReportModal.note.trim(),
                });
              }
            }}
          >
            Guardar y Cerrar Reporte
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
