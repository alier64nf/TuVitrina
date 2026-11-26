'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid2 as Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  FolderTree,
  HelpCircle,
  PackagePlus,
  Store as StoreIcon,
  Wrench,
} from 'lucide-react';
import { SellerShell } from '@/components/SellerShell';
import { EmptyStateCard } from '@/components/StateViews';
import { useAuth } from '@/components/ThemeAndQueryProvider';
import { PWAInstallButton } from '@/components/PWAInstallButton';

export default function PanelHomePage() {
  const { apiClient } = useAuth();

  return (
    <SellerShell title="Inicio de tu tienda">
      {(store) => {
        const paymentMethodsQuery = useQuery({
          queryKey: ['seller-payment-methods-check', store.id],
          queryFn: () =>
            fetch(`${process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '') || ''}/api/v1/storefronts/${store.slug}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
          staleTime: 60_000,
        });

        const hasStore = true;
        const hasLocation = Boolean(store.province && store.municipality);
        const hasPaymentsOrShipping = Boolean(
          (paymentMethodsQuery.data?.paymentMethods?.length ?? 0) > 0 ||
            (paymentMethodsQuery.data?.shippingZones?.length ?? 0) > 0 ||
            store.pickupEnabled,
        );
        const hasCategories = store.categoryCount > 0;
        const hasFirstProduct = store.productCount > 0;
        const hasCustomAppearance = Boolean(
          store.theme?.logo?.publicUrl ||
            store.theme?.cover?.publicUrl ||
            (store.theme?.seedColor && store.theme.seedColor !== '#00796B'),
        );

        const milestones = [
          {
            id: 'store',
            done: hasStore,
            title: '1. Tienda creada con enlace corto y WhatsApp (+53)',
            ctaLabel: 'Ver tienda',
            href: `/${store.slug}`,
            external: true,
          },
          {
            id: 'location',
            done: hasLocation,
            title: '2. Completa provincia, municipio y horarios de atención',
            ctaLabel: 'Configurar',
            href: '/panel/negocio',
          },
          {
            id: 'payments',
            done: hasPaymentsOrShipping,
            title: '3. Activa medios de pago, monedas y zonas de envío',
            ctaLabel: 'Pagos y envío',
            href: '/panel/negocio',
          },
          {
            id: 'categories',
            done: hasCategories,
            title: '4. Organiza tu primera categoría',
            ctaLabel: 'Categorías',
            href: '/panel/categorias',
          },
          {
            id: 'products',
            done: hasFirstProduct,
            title: '5. Publica tu primer producto con foto WebP',
            ctaLabel: 'Nuevo producto',
            href: '/panel/productos/nuevo',
            primary: true,
          },
          {
            id: 'appearance',
            done: hasCustomAppearance,
            title: '6. Personaliza colores, logo y descarga tu código QR',
            ctaLabel: 'Apariencia y QR',
            href: '/panel/personalizacion',
          },
        ];

        const completedSteps = milestones.filter((m) => m.done).length;
        const progressPercent = Math.round((completedSteps / milestones.length) * 100);

        return (
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      Productos publicados
                    </Typography>
                    <Typography variant="h4" className="tabular-nums" mt={0.5}>
                      {store.productCount} / {store.maxProductsAllowed}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      Categorías activas
                    </Typography>
                    <Typography variant="h4" className="tabular-nums" mt={0.5}>
                      {store.categoryCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      WhatsApp de pedidos
                    </Typography>
                    <Typography variant="h6" className="tabular-nums" mt={0.5}>
                      {store.whatsapp}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ sm: 'center' }}
                    gap={1.5}
                  >
                    <Box>
                      <Typography variant="h6" component="h2">
                        Checklist de activación
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Sigue esta guía paso a paso para lanzar tu catálogo profesional y empezar a vender.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="subtitle1" fontWeight={700} className="tabular-nums">
                        {completedSteps}/{milestones.length} ({progressPercent}%)
                      </Typography>
                      <PWAInstallButton size="small" label="Instalar panel" />
                    </Stack>
                  </Stack>

                  <LinearProgress
                    variant="determinate"
                    value={progressPercent}
                    aria-label={`Progreso de activación: ${progressPercent}%`}
                  />

                  <Stack spacing={1.5}>
                    {milestones.map((m) => (
                      <Stack
                        key={m.id}
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        gap={1.5}
                        py={0.5}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          {m.done ? (
                            <CheckCircle2 size={20} color="#00796B" aria-hidden="true" />
                          ) : (
                            <Circle size={20} color="#757575" aria-hidden="true" />
                          )}
                          <Typography
                            variant="body1"
                            sx={{
                              color: m.done ? 'text.primary' : 'text.secondary',
                              fontWeight: m.done ? 500 : 400,
                            }}
                          >
                            {m.title}
                          </Typography>
                        </Stack>
                        <Button
                          component={Link}
                          href={m.href}
                          target={m.external ? '_blank' : undefined}
                          size="small"
                          variant={m.primary ? 'contained' : 'outlined'}
                          color={m.primary ? 'secondary' : 'primary'}
                          endIcon={m.external ? <ExternalLink size={14} /> : undefined}
                          sx={{ minHeight: 38, whiteSpace: 'nowrap' }}
                        >
                          {m.ctaLabel}
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {store.productCount === 0 ? (
              <EmptyStateCard
                icon={<PackagePlus size={26} />}
                title="Tu catálogo está listo para estrenarse"
                description="Agrega tu primer producto con foto comprimida, precio en CUP/USD/MLC y variantes si las necesitas."
                actionLabel="Agregar primer producto"
                onAction={() => {
                  window.location.href = '/panel/productos/nuevo';
                }}
              />
            ) : (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                <Button
                  component={Link}
                  href="/panel/productos/nuevo"
                  variant="contained"
                  color="secondary"
                  startIcon={<PackagePlus size={18} />}
                >
                  Agregar producto
                </Button>
                <Button
                  component={Link}
                  href="/panel/categorias"
                  variant="outlined"
                  startIcon={<FolderTree size={18} />}
                >
                  Organizar categorías
                </Button>
                <Button
                  component={Link}
                  href="/panel/negocio"
                  variant="outlined"
                  startIcon={<StoreIcon size={18} />}
                >
                  Editar perfil del negocio
                </Button>
                <Button
                  component={Link}
                  href="/herramientas"
                  variant="outlined"
                  startIcon={<Wrench size={18} />}
                >
                  Herramientas gratuitas
                </Button>
                <Button
                  component={Link}
                  href="/ayuda"
                  variant="text"
                  startIcon={<HelpCircle size={18} />}
                >
                  Centro de ayuda
                </Button>
              </Stack>
            )}
          </Stack>
        );
      }}
    </SellerShell>
  );
}
