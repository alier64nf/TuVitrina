'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  AppBar,
  Badge,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Drawer,
  Grid2 as Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  Clock,
  Flag,
  MessageCircle,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Store as StoreIcon,
  Tag,
  Trash2,
  Truck,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  formatMoney,
  TuVitrinaApiClient,
  type StorefrontPromotionDto,
} from '@tuvitrina/contracts';
import { useCart } from '@/lib/cart/useCart';
import { AdaptiveImage } from '@/components/AdaptiveImage';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { ErrorStateCard, PageSkeleton } from '@/components/StateViews';
import { StoreThemeWrapper } from '@/components/StoreThemeWrapper';
import { useLiteMode } from '@/lib/offline/liteMode';
import {
  flushOrderQueue,
  ORDER_QUEUE_EVENT,
  readOrderQueue,
  type QueuedOrderItem,
} from '@/lib/offline/orderQueue';
import { useCachedStorefront } from '@/lib/offline/useCachedStorefront';
import { FIXED_ERROR_HEX, WHATSAPP_BRAND_HEX } from '@/lib/theme/m3Theme';

const ReportModal = dynamic(
  () => import('@/components/ReportModal').then((mod) => mod.ReportModal),
  { ssr: false },
);

function formatPromoLabel(promo: StorefrontPromotionDto, baseCurrency: 'CUP' | 'USD' | 'MLC'): string {
  switch (promo.type) {
    case 'percent':
      return `${promo.name} (-${promo.discountValue}%)`;
    case 'min_amount':
      return `${promo.name} (-${formatMoney(promo.discountValue, baseCurrency)} desde ${formatMoney(promo.minAmount, baseCurrency)})`;
    case 'bogo_2x1':
      return `${promo.name} (2x1)`;
    case 'bogo_3x2':
      return `${promo.name} (3x2)`;
    case 'second_unit':
      return `${promo.name} (${promo.discountValue || 50}% en 2da unidad)`;
    case 'combo':
      return `${promo.name} (-${promo.discountValue}% combo)`;
    default:
      return promo.name;
  }
}

export default function StorefrontPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const router = useRouter();

  const apiClient = useMemo(
    () =>
      new TuVitrinaApiClient(
        process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '') || '',
        async () => null,
      ),
    [],
  );

  const cart = useCart(slug);
  const { liteMode, autoDetected, toggleLiteMode } = useLiteMode();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const [queuedOrders, setQueuedOrders] = useState<QueuedOrderItem[]>([]);

  const storefrontQuery = useCachedStorefront(apiClient, slug);

  useEffect(() => {
    const syncList = () => {
      setQueuedOrders(readOrderQueue().filter((q) => q.slug === slug));
    };
    syncList();
    window.addEventListener(ORDER_QUEUE_EVENT, syncList);
    return () => window.removeEventListener(ORDER_QUEUE_EVENT, syncList);
  }, [slug]);

  if (storefrontQuery.isLoading || !cart.loaded) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <PageSkeleton />
      </Container>
    );
  }

  if (storefrontQuery.isError || !storefrontQuery.data) {
    return (
      <Container component="main" id="contenido-principal" maxWidth="md" sx={{ py: 8 }}>
        <ErrorStateCard
          message="La tienda no existe, fue suspendida temporalmente o no está disponible sin conexión."
          onRetry={() => storefrontQuery.refetch()}
        />
      </Container>
    );
  }

  const { store, isOpen, categories, products, promotions = [] } = storefrontQuery.data;

  const categoryById = new Map(categories.map((cat) => [cat.id, cat]));
  const selectedCategoryObj =
    selectedCategory !== 'all' ? categoryById.get(selectedCategory) : undefined;

  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const match =
        p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const cleanWhatsapp = store.whatsapp.replace(/\D/g, '');
  const whatsappContactUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
    `Hola *${store.name}*, les escribo desde su catálogo online en TuVitrina.`,
  )}`;

  const logoUrl = store.theme?.logo?.publicUrl;
  const coverUrl = store.theme?.cover?.publicUrl;
  const freeShippingMin = store.freeShippingMin ?? null;

  return (
    <StoreThemeWrapper themeConfig={store.theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 12 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <Container maxWidth="lg">
            <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: 72, gap: 1.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                {logoUrl ? (
                  <Box
                    component="img"
                    src={logoUrl}
                    alt={`Logo de ${store.name}`}
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      objectFit: 'cover',
                      border: '1px solid',
                      borderColor: 'divider',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    {store.name.slice(0, 2).toUpperCase()}
                  </Box>
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="h6" component="h1" fontWeight={700} noWrap>
                      {store.name}
                    </Typography>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        fontSize: 12,
                        fontWeight: 700,
                        bgcolor: isOpen ? '#DCFCE7' : '#FEE2E2',
                        color: isOpen ? '#14532D' : FIXED_ERROR_HEX,
                      }}
                    >
                      {isOpen ? 'Abierto' : 'Cerrado'}
                    </Box>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {store.category} ·{' '}
                    {store.province && store.municipality
                      ? `${store.municipality}, ${store.province}`
                      : 'Cuba'}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  size="small"
                  variant={liteMode ? 'contained' : 'outlined'}
                  color={liteMode ? 'primary' : 'inherit'}
                  onClick={toggleLiteMode}
                  aria-pressed={liteMode}
                  aria-label="Activar o desactivar modo ligero de ahorro de datos"
                  startIcon={<Zap size={15} />}
                  sx={{ minHeight: 44, display: { xs: 'none', md: 'inline-flex' } }}
                >
                  {liteMode ? 'Modo ligero: ON' : 'Modo ligero'}
                </Button>

                <Box sx={{ display: { xs: 'none', lg: 'inline-flex' } }}>
                  <PWAInstallButton size="small" variant="outlined" label="Instalar" />
                </Box>

                <Button
                  component="a"
                  href={whatsappContactUrl}
                  target="_blank"
                  rel="noreferrer"
                  variant="contained"
                  startIcon={<MessageCircle size={18} />}
                  sx={{
                    display: { xs: 'none', sm: 'inline-flex' },
                    minHeight: 44,
                    bgcolor: WHATSAPP_BRAND_HEX,
                    color: '#091A10',
                    fontWeight: 700,
                    '&:hover': { bgcolor: '#1EBE5D' },
                  }}
                >
                  WhatsApp
                </Button>
                <IconButton
                  color="primary"
                  aria-label={`Abrir carrito (${cart.totalCount} productos)`}
                  onClick={() => setCartDrawerOpen(true)}
                  sx={{ bgcolor: 'action.hover', width: 46, height: 46 }}
                >
                  <Badge badgeContent={cart.totalCount} color="secondary">
                    <ShoppingBag size={22} />
                  </Badge>
                </IconButton>
              </Stack>
            </Toolbar>
          </Container>
        </AppBar>

        <Container component="main" id="contenido-principal" maxWidth="lg" sx={{ py: 3 }}>
          <Stack spacing={2.5}>
            <Box aria-live="polite" sx={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
              {liveMessage}
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ display: { xs: 'flex', md: 'none' } }}>
              <Button
                size="small"
                variant={liteMode ? 'contained' : 'outlined'}
                onClick={toggleLiteMode}
                aria-pressed={liteMode}
                startIcon={<Zap size={15} />}
                sx={{ minHeight: 44 }}
              >
                {liteMode ? 'Modo ligero activo' : 'Modo ligero'}
              </Button>
              <PWAInstallButton size="small" variant="outlined" label="Instalar app" />
            </Stack>

            {storefrontQuery.fromCache ? (
              <Alert severity="warning" icon={<WifiOff size={18} />}>
                <Typography variant="body2">
                  <strong>Modo sin conexión:</strong> estás viendo el catálogo guardado en caché.
                  Puedes seguir armando tu pedido y se enviará automáticamente cuando vuelva la red.
                </Typography>
              </Alert>
            ) : null}

            {storefrontQuery.backgroundUpdated ? (
              <Alert
                severity="info"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<RefreshCw size={14} />}
                    onClick={() => storefrontQuery.refreshStorefront()}
                  >
                    Actualizar
                  </Button>
                }
              >
                Hay precios o productos actualizados en esta tienda.
              </Alert>
            ) : null}

            {liteMode ? (
              <Alert severity="info" icon={<Zap size={18} />}>
                <Typography variant="body2">
                  <strong>Modo ligero activo</strong>
                  {autoDetected ? ' (detectado por conexión lenta o ahorro de datos)' : ''}:
                  las fotos se cargan solo bajo demanda para ahorrar megas.
                </Typography>
              </Alert>
            ) : null}

            {queuedOrders.length > 0 ? (
              <Alert
                severity={queuedOrders.some((q) => q.status === 'pending' || q.status === 'error') ? 'warning' : 'success'}
                action={
                  queuedOrders.some((q) => q.status === 'pending' || q.status === 'error') ? (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => flushOrderQueue(apiClient)}
                      startIcon={<RefreshCw size={14} />}
                    >
                      Reintentar ahora
                    </Button>
                  ) : undefined
                }
              >
                <Stack spacing={0.5}>
                  {queuedOrders.slice(-2).map((q) => (
                    <Typography key={q.id} variant="body2">
                      {q.status === 'synced' && q.syncedTrackingToken ? (
                        <>
                          Pedido guardado sin conexión enviado (#{q.syncedOrderNumber}) ·{' '}
                          <Link href={`/${slug}/pedido/${q.syncedTrackingToken}`}>Ver seguimiento</Link>
                        </>
                      ) : q.status === 'syncing' ? (
                        `Enviando pedido guardado (${formatMoney(q.estimatedTotal, q.currency)})...`
                      ) : (
                        `Pedido pendiente en cola (${formatMoney(q.estimatedTotal, q.currency)}): se enviará automáticamente al reconectar.`
                      )}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            ) : null}

            {coverUrl ? (
              <Box
                sx={{
                  borderRadius: 3,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ width: '100%', height: { xs: 140, sm: 200 } }}>
                  <AdaptiveImage
                    src={coverUrl}
                    alt={`Portada de ${store.name}`}
                    liteMode={liteMode}
                    deferInLiteMode={true}
                    priority={true}
                  />
                </Box>
                {store.description ? (
                  <Box px={2.5} py={1.5}>
                    <Typography variant="body2" color="text.secondary">
                      {store.description}
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            ) : store.description ? (
              <Typography variant="body2" color="text.secondary">
                {store.description}
              </Typography>
            ) : null}

            {promotions.length > 0 ? (
              <Alert severity="info" icon={<Tag size={18} />}>
                <Typography variant="body2" fontWeight={600}>
                  Promociones activas:{' '}
                  {promotions.map((p) => formatPromoLabel(p, store.baseCurrency)).join(' · ')}
                </Typography>
              </Alert>
            ) : null}

            {freeShippingMin && freeShippingMin > 0 ? (
              <Alert severity="success" icon={<Truck size={18} />}>
                <Typography variant="body2">
                  Envío gratis en pedidos desde{' '}
                  <strong>{formatMoney(freeShippingMin, store.baseCurrency)}</strong>.
                </Typography>
              </Alert>
            ) : null}

            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              label={`Buscar productos en ${store.name}`}
              placeholder={`Ej. café, pan, oferta...`}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={20} aria-hidden="true" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Stack
              direction="row"
              spacing={1}
              role="region"
              aria-label="Categorías de la tienda"
              sx={{ overflowX: 'auto', pb: 1 }}
            >
              <Button
                variant={selectedCategory === 'all' ? 'contained' : 'outlined'}
                onClick={() => setSelectedCategory('all')}
                sx={{ borderRadius: 8, whiteSpace: 'nowrap', minHeight: 44 }}
              >
                Todos ({products.length})
              </Button>
              {categories.map((cat) => {
                const catClosed =
                  Boolean(cat.schedule?.enabled) && cat.isAvailableNow === false;
                return (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? 'contained' : 'outlined'}
                    onClick={() => setSelectedCategory(cat.id)}
                    startIcon={catClosed ? <Clock size={14} /> : undefined}
                    sx={{ borderRadius: 8, whiteSpace: 'nowrap', minHeight: 44 }}
                  >
                    {cat.name}
                    {catClosed && cat.schedule ? ` (${cat.schedule.from}–${cat.schedule.to})` : ''}
                  </Button>
                );
              })}
            </Stack>

            {selectedCategoryObj?.schedule?.enabled &&
            selectedCategoryObj.isAvailableNow === false ? (
              <Alert severity="warning" icon={<Clock size={18} />}>
                La categoría <strong>{selectedCategoryObj.name}</strong> solo recibe pedidos de{' '}
                {selectedCategoryObj.schedule.from} a {selectedCategoryObj.schedule.to}.
              </Alert>
            ) : null}

            {filteredProducts.length === 0 ? (
              <Card>
                <CardContent sx={{ py: 6, textAlign: 'center' }}>
                  <Typography variant="h6" component="h2">
                    No hay productos disponibles
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Prueba con otra categoría o término de búsqueda.
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Grid container spacing={2.5}>
                {filteredProducts.map((product) => {
                  const thumb = product.images[0]?.publicUrl;
                  const parentCategory = product.categoryId
                    ? categoryById.get(product.categoryId)
                    : undefined;
                  const outOfSchedule = Boolean(
                    parentCategory?.schedule?.enabled && parentCategory.isAvailableNow === false,
                  );
                  const unavailable = product.soldOut || outOfSchedule;

                  return (
                    <Grid key={product.id} size={{ xs: 6, sm: 4, md: 3 }}>
                      <Card
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          opacity: unavailable ? 0.8 : 1,
                        }}
                      >
                        <CardActionArea
                          onClick={() => router.push(`/${slug}/productos/${product.id}`)}
                          aria-label={`Ver detalle de ${product.name}`}
                          sx={{
                            flexGrow: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                          }}
                        >
                          <Box
                            sx={{
                              aspectRatio: '1 / 1',
                              bgcolor: 'action.hover',
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                          >
                            <AdaptiveImage
                              src={thumb}
                              alt={product.name}
                              liteMode={liteMode}
                              deferInLiteMode={true}
                              fallbackIcon={<StoreIcon size={32} aria-hidden="true" />}
                            />

                            {product.soldOut ? (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  left: 8,
                                  bgcolor: FIXED_ERROR_HEX,
                                  color: '#FFFFFF',
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: 1,
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                AGOTADO
                              </Box>
                            ) : outOfSchedule && parentCategory?.schedule ? (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  left: 8,
                                  bgcolor: 'rgba(17, 24, 39, 0.88)',
                                  color: '#FFFFFF',
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: 1,
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                {parentCategory.schedule.from}–{parentCategory.schedule.to}
                              </Box>
                            ) : product.discountPercent ? (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  left: 8,
                                  bgcolor: 'secondary.main',
                                  color: 'secondary.contrastText',
                                  px: 1,
                                  py: 0.5,
                                  borderRadius: 1,
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                -{product.discountPercent}%
                              </Box>
                            ) : null}
                          </Box>

                          <CardContent sx={{ flexGrow: 1, p: 2 }}>
                            <Typography variant="subtitle2" component="h2" fontWeight={700} noWrap>
                              {product.name}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="baseline" mt={0.5}>
                              <Typography variant="body2" fontWeight={700} className="tabular-nums">
                                {formatMoney(product.price, product.currency)}
                              </Typography>
                              {product.compareAtPrice ? (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  className="tabular-nums"
                                  sx={{ textDecoration: 'line-through' }}
                                >
                                  {formatMoney(product.compareAtPrice, product.currency)}
                                </Typography>
                              ) : null}
                            </Stack>
                          </CardContent>
                        </CardActionArea>

                        <Box p={2} pt={0}>
                          <Button
                            variant="contained"
                            color="secondary"
                            fullWidth
                            disabled={unavailable}
                            onClick={() => {
                              cart.addItem(product);
                              setLiveMessage(`${product.name} agregado al carrito.`);
                            }}
                            sx={{ minHeight: 44 }}
                          >
                            {product.soldOut
                              ? 'Agotado'
                              : outOfSchedule
                                ? 'Fuera de horario'
                                : 'Agregar'}
                          </Button>
                        </Box>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}

            <Box component="footer" textAlign="center" pt={4} pb={cart.totalCount > 0 ? 10 : 4}>
              <Button
                component="a"
                href={whatsappContactUrl}
                target="_blank"
                rel="noreferrer"
                variant="contained"
                startIcon={<MessageCircle size={16} />}
                sx={{
                  display: { xs: 'inline-flex', sm: 'none' },
                  mb: 2,
                  minHeight: 44,
                  bgcolor: WHATSAPP_BRAND_HEX,
                  color: '#091A10',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#1EBE5D' },
                }}
              >
                Escribir por WhatsApp
              </Button>
              <Typography variant="caption" color="text.secondary" display="block">
                Tienda alojada en TuVitrina · Sin comisión por venta ·{' '}
                <Link href="/ayuda">Centro de ayuda</Link>
              </Typography>
              <Button
                variant="text"
                size="small"
                color="inherit"
                startIcon={<Flag size={14} color={FIXED_ERROR_HEX} />}
                onClick={() => setReportModalOpen(true)}
                sx={{
                  textTransform: 'none',
                  color: 'text.secondary',
                  fontSize: '0.8rem',
                  mt: 0.5,
                  minHeight: 44,
                }}
              >
                Reportar esta tienda
              </Button>
            </Box>
          </Stack>
        </Container>

        <ReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          slug={slug}
          storeName={store.name}
          targetType="store"
        />

        {cart.totalCount > 0 ? (
          <Paper
            elevation={4}
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1100,
              p: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Container maxWidth="lg">
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle2" className="tabular-nums">
                    {cart.totalCount} {cart.totalCount === 1 ? 'producto' : 'productos'} · Subtotal
                  </Typography>
                  <Typography variant="h6" fontWeight={700} className="tabular-nums">
                    {formatMoney(cart.subtotal, storefrontQuery.data.store.baseCurrency)}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  startIcon={<ShoppingBag size={18} />}
                  onClick={() => setCartDrawerOpen(true)}
                  sx={{ minHeight: 46 }}
                >
                  Ver pedido / Pagar
                </Button>
              </Stack>
            </Container>
          </Paper>
        ) : null}

        <Drawer
          anchor="right"
          open={cartDrawerOpen}
          onClose={() => setCartDrawerOpen(false)}
          aria-label="Carrito de compras"
          sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: 420 }, p: 3 } }}
        >
          <Stack spacing={3} sx={{ height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" component="h2">
                Tu carrito en {store.name}
              </Typography>
              <Button onClick={() => setCartDrawerOpen(false)} sx={{ minHeight: 44 }}>
                Cerrar
              </Button>
            </Stack>

            {freeShippingMin && freeShippingMin > 0 && cart.items.length > 0 ? (
              <Alert
                severity={cart.subtotal >= freeShippingMin ? 'success' : 'info'}
                icon={<Truck size={16} />}
              >
                {cart.subtotal >= freeShippingMin
                  ? '¡Tu pedido califica para envío gratis!'
                  : `Envío gratis desde ${formatMoney(freeShippingMin, store.baseCurrency)}.`}
              </Alert>
            ) : null}

            {cart.items.length === 0 ? (
              <Box textAlign="center" py={8}>
                <ShoppingBag size={48} color="#757575" aria-hidden="true" />
                <Typography variant="subtitle1" mt={2}>
                  El carrito está vacío
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Agrega productos para armar tu pedido por WhatsApp.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2} sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {cart.items.map((item) => (
                  <Card key={item.cartLineId}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        {item.imageUrl ? (
                          <Box
                            component="img"
                            src={item.imageUrl}
                            alt={item.productName}
                            sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 2 }}
                          />
                        ) : null}
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" fontWeight={700} noWrap>
                            {item.productName}
                          </Typography>
                          {item.variantLabel ? (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {item.variantLabel}
                            </Typography>
                          ) : null}
                          <Typography variant="body2" fontWeight={700} className="tabular-nums">
                            {formatMoney(item.unitPrice * item.quantity, item.currency)}
                          </Typography>
                        </Box>

                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <IconButton
                            aria-label={`Reducir cantidad de ${item.productName}`}
                            onClick={() => cart.updateQuantity(item.cartLineId, item.quantity - 1)}
                            sx={{ width: 40, height: 40 }}
                          >
                            <Minus size={16} />
                          </IconButton>
                          <Typography variant="body2" fontWeight={700} className="tabular-nums" px={0.5}>
                            {item.quantity}
                          </Typography>
                          <IconButton
                            aria-label={`Aumentar cantidad de ${item.productName}`}
                            onClick={() => cart.updateQuantity(item.cartLineId, item.quantity + 1)}
                            sx={{ width: 40, height: 40 }}
                          >
                            <Plus size={16} />
                          </IconButton>
                          <IconButton
                            color="error"
                            aria-label={`Eliminar ${item.productName}`}
                            onClick={() => cart.removeItem(item.cartLineId)}
                            sx={{ width: 40, height: 40 }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}

            {cart.items.length > 0 ? (
              <Stack spacing={2} pt={2} borderTop="1px solid" borderColor="divider">
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle1">Subtotal estimado</Typography>
                  <Typography variant="subtitle1" fontWeight={700} className="tabular-nums">
                    {formatMoney(cart.subtotal, store.baseCurrency)}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Los cupones, promociones automáticas y costo de envío se calculan en el siguiente paso.
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  fullWidth
                  onClick={() => {
                    setCartDrawerOpen(false);
                    router.push(`/${slug}/checkout`);
                  }}
                  sx={{ minHeight: 46 }}
                >
                  Completar datos y enviar pedido
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </Drawer>
      </Box>
    </StoreThemeWrapper>
  );
}
