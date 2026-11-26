'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  AppBar,
  Badge,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Container,
  Grid2 as Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { ArrowLeft, Clock, Flag, Minus, Plus, ShoppingBag, Store as StoreIcon, WifiOff } from 'lucide-react';
import { formatMoney, TuVitrinaApiClient, type ProductVariantDto } from '@tuvitrina/contracts';
import { useCart } from '@/lib/cart/useCart';
import { AdaptiveImage } from '@/components/AdaptiveImage';
import { ErrorStateCard, PageSkeleton } from '@/components/StateViews';
import { StoreThemeWrapper } from '@/components/StoreThemeWrapper';
import { useLiteMode } from '@/lib/offline/liteMode';
import { useCachedStorefront } from '@/lib/offline/useCachedStorefront';
import { FIXED_ERROR_HEX } from '@/lib/theme/m3Theme';

const ReportModal = dynamic(
  () => import('@/components/ReportModal').then((mod) => mod.ReportModal),
  { ssr: false },
);

export default function ProductDetailRoute() {
  const params = useParams<{ slug: string; productId: string }>();
  const slug = params?.slug ?? '';
  const productId = params?.productId ?? '';
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
  const { liteMode } = useLiteMode();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const storefrontQuery = useCachedStorefront(apiClient, slug);

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
        <ErrorStateCard message="No se pudo cargar la tienda." onRetry={() => storefrontQuery.refetch()} />
      </Container>
    );
  }

  const { store, categories, products } = storefrontQuery.data;
  const product = products.find((p) => p.id === productId);

  if (!product) {
    return (
      <StoreThemeWrapper themeConfig={store.theme}>
        <Container component="main" id="contenido-principal" maxWidth="md" sx={{ py: 8 }}>
          <ErrorStateCard message="El producto solicitado no existe o ya no está disponible." />
        </Container>
      </StoreThemeWrapper>
    );
  }

  const parentCategory = product.categoryId
    ? categories.find((c) => c.id === product.categoryId)
    : undefined;
  const outOfSchedule = Boolean(
    parentCategory?.schedule?.enabled && parentCategory.isAvailableNow === false,
  );

  const activeImage = selectedImage || product.images[0]?.publicUrl;
  const selectedVariant: ProductVariantDto | undefined = product.variants.find(
    (v) => v.id === selectedVariantId,
  );

  const unitPrice =
    selectedVariant?.priceOverride !== null && selectedVariant?.priceOverride !== undefined
      ? selectedVariant.priceOverride
      : product.price;

  const handleAddToCart = () => {
    cart.addItem(product, selectedVariant, quantity);
    router.push(`/${slug}`);
  };

  return (
    <StoreThemeWrapper themeConfig={store.theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 8 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
        >
          <Container maxWidth="lg">
            <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: 68 }}>
              <Button
                component={Link}
                href={`/${slug}`}
                startIcon={<ArrowLeft size={18} />}
                color="inherit"
                sx={{ minHeight: 44 }}
              >
                Volver a {store.name}
              </Button>
              <IconButton
                color="primary"
                aria-label={`Ver carrito (${cart.totalCount} productos)`}
                onClick={() => router.push(`/${slug}`)}
                sx={{ width: 46, height: 46 }}
              >
                <Badge badgeContent={cart.totalCount} color="secondary">
                  <ShoppingBag size={22} />
                </Badge>
              </IconButton>
            </Toolbar>
          </Container>
        </AppBar>

        <Container component="main" id="contenido-principal" maxWidth="lg" sx={{ py: 4 }}>
          {storefrontQuery.fromCache ? (
            <Alert severity="warning" icon={<WifiOff size={18} />} sx={{ mb: 3 }}>
              Navegando sin conexión sobre la última versión guardada del catálogo.
            </Alert>
          ) : null}

          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={2}>
                <Box
                  sx={{
                    aspectRatio: '1 / 1',
                    borderRadius: 4,
                    bgcolor: 'action.hover',
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <AdaptiveImage
                    src={activeImage}
                    alt={product.name}
                    liteMode={liteMode}
                    deferInLiteMode={false}
                    priority={true}
                    fallbackIcon={<StoreIcon size={40} aria-hidden="true" />}
                  />
                </Box>

                {product.images.length > 1 ? (
                  <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto' }}>
                    {product.images.map((img, idx) => (
                      <ButtonBase
                        key={img.objectPath}
                        onClick={() => setSelectedImage(img.publicUrl)}
                        aria-label={`Ver imagen ${idx + 1} de ${product.name}`}
                        sx={{
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: '2px solid',
                          borderColor:
                            activeImage === img.publicUrl ? 'primary.main' : 'transparent',
                          flexShrink: 0,
                        }}
                      >
                        <Box
                          component="img"
                          src={img.publicUrl}
                          alt={img.alt || `${product.name} - imagen ${idx + 1}`}
                          loading="lazy"
                          sx={{ width: 72, height: 72, objectFit: 'cover', display: 'block' }}
                        />
                      </ButtonBase>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="h4" component="h1" gutterBottom>
                        {product.name}
                      </Typography>
                      <Stack direction="row" spacing={1.5} alignItems="baseline">
                        <Typography variant="h5" fontWeight={700} className="tabular-nums">
                          {formatMoney(unitPrice, product.currency)}
                        </Typography>
                        {product.compareAtPrice ? (
                          <Typography
                            variant="body1"
                            color="text.secondary"
                            className="tabular-nums"
                            sx={{ textDecoration: 'line-through' }}
                          >
                            {formatMoney(product.compareAtPrice, product.currency)}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Box>

                    {outOfSchedule && parentCategory?.schedule ? (
                      <Alert severity="info" icon={<Clock size={18} />}>
                        Disponible en la categoría {parentCategory.name} de{' '}
                        <strong>{parentCategory.schedule.from}</strong> a{' '}
                        <strong>{parentCategory.schedule.to}</strong>.
                      </Alert>
                    ) : null}

                    {product.description ? (
                      <Typography variant="body1" color="text.secondary">
                        {product.description}
                      </Typography>
                    ) : null}

                    {product.variants.length > 0 ? (
                      <TextField
                        select
                        label="Selecciona variante"
                        value={selectedVariantId}
                        onChange={(e) => setSelectedVariantId(e.target.value)}
                      >
                        <MenuItem value="">Elige una opción</MenuItem>
                        {product.variants.map((v) => (
                          <MenuItem key={v.id} value={v.id}>
                            {v.label}{' '}
                            {v.priceOverride ? `(${formatMoney(v.priceOverride, product.currency)})` : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : null}

                    <Stack direction="row" spacing={2} alignItems="center">
                      <Stack
                        direction="row"
                        alignItems="center"
                        border="1px solid"
                        borderColor="divider"
                        borderRadius={2}
                      >
                        <IconButton
                          aria-label="Disminuir cantidad"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          sx={{ width: 44, height: 44 }}
                        >
                          <Minus size={18} />
                        </IconButton>
                        <Typography px={2} fontWeight={700} className="tabular-nums">
                          {quantity}
                        </Typography>
                        <IconButton
                          aria-label="Aumentar cantidad"
                          onClick={() => setQuantity((q) => q + 1)}
                          sx={{ width: 44, height: 44 }}
                        >
                          <Plus size={18} />
                        </IconButton>
                      </Stack>
                      <Button
                        variant="contained"
                        color="secondary"
                        size="large"
                        fullWidth
                        disabled={
                          product.soldOut ||
                          outOfSchedule ||
                          (product.variants.length > 0 && !selectedVariantId)
                        }
                        onClick={handleAddToCart}
                        sx={{ minHeight: 46 }}
                      >
                        {product.soldOut
                          ? 'Agotado'
                          : outOfSchedule
                            ? 'Fuera de horario'
                            : 'Agregar al carrito'}
                      </Button>
                    </Stack>

                    <Box pt={1} textAlign="center">
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
                          minHeight: 44,
                        }}
                      >
                        Reportar este producto
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>

        <ReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          slug={slug}
          storeName={store.name}
          targetType="product"
          productId={product.id}
          productName={product.name}
        />
      </Box>
    </StoreThemeWrapper>
  );
}
