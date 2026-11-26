'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid2 as Grid,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Coins,
  MessageCircle,
  Palette,
  QrCode,
  Send,
  Smartphone,
  Tag,
  WifiOff,
} from 'lucide-react';
import { formatMoney, TuVitrinaApiClient, type PlansConfigDto } from '@tuvitrina/contracts';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { ES_CU } from '@/lib/i18n/es-cu';
import { WHATSAPP_BRAND_HEX } from '@/lib/theme/m3Theme';

const FEATURES = [
  {
    icon: WifiOff,
    title: 'Catálogo offline y Modo ligero',
    body: 'Tus clientes navegan productos guardados en caché aun con datos móviles lentos o intermitentes. Si hacen un pedido sin señal, queda en cola y se envía solo al reconectar.',
  },
  {
    icon: MessageCircle,
    title: 'Pedidos armados directo a WhatsApp',
    body: 'El comprador elige productos, variantes, entrega y método de pago; el servidor calcula el total real y abre WhatsApp con el resumen listo para confirmar.',
  },
  {
    icon: Coins,
    title: 'Multimoneda CUP, USD y MLC',
    body: 'Define tu moneda base, tasas de cambio con fecha y acepta pagos en efectivo, transferencia, Transfermóvil o EnZona según tu negocio.',
  },
  {
    icon: Tag,
    title: 'Cupones, combos y envíos por municipio',
    body: 'Configura tarifas por provincia y municipio de Cuba, envío gratis desde monto mínimo, cupones de descuento y promociones 2x1 o 3x2.',
  },
  {
    icon: Palette,
    title: 'Identidad visual y código QR propio',
    body: 'Personaliza color semilla, modo claro u oscuro, tipografía autoalojada, logo y portada con ajuste automático de contraste WCAG.',
  },
  {
    icon: BarChart3,
    title: 'Analítica privada y exportación CSV',
    body: 'Consulta pedidos, ticket promedio, productos más vendidos y visitas diarias sin rastreadores invasivos, más importación masiva desde CSV.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Registra tu negocio en 3 pasos',
    body: 'Elige nombre, rubro, valida tu WhatsApp cubano (+53) y reserva tu enlace corto único en menos de 5 minutos.',
  },
  {
    step: '02',
    title: 'Publica tus productos desde el móvil',
    body: 'Sube fotos con compresión WebP automática para ahorrar megas, agrega variantes, precios tachados y organiza categorías.',
  },
  {
    step: '03',
    title: 'Comparte tu enlace o QR y vende',
    body: 'Recibe pedidos numerados en tu panel y por WhatsApp o Telegram, con enlace de seguimiento en tiempo real y cero comisión por venta.',
  },
];

const FAQS = [
  {
    q: '¿TuVitrina cobra comisión por mis ventas?',
    a: 'No. TuVitrina cobra 0% de comisión por venta. El dinero de cada pedido va directo entre tú y tu cliente por el medio que configures.',
  },
  {
    q: '¿Funciona si mis clientes tienen conexión lenta o intermitente?',
    a: 'Sí. TuVitrina es una PWA instalable con caché inteligente de catálogos, Modo ligero para diferir imágenes pesadas y cola de pedidos sin conexión con reintento automático.',
  },
  {
    q: '¿Puedo vender en CUP, USD y MLC?',
    a: 'Sí. Configuras la moneda base de tu tienda, tasas editables con fecha y los métodos de pago permitidos para cada moneda (efectivo, transferencia, Transfermóvil y EnZona).',
  },
  {
    q: '¿Cómo se paga el Plan PRO si decido crecer?',
    a: 'El Plan PRO se activa mediante pago manual sin tarjetas internacionales: envías tu comprobante desde el panel y el equipo valida tu suscripción.',
  },
  {
    q: '¿Puedo usar un dominio propio en el Plan PRO?',
    a: 'Sí, en la guía del Centro de ayuda y en Panel > Apariencia y QR encontrarás los registros DNS (CNAME y TXT) para conectar tu dominio en despliegues con TLS multi-inquilino.',
  },
];

export default function LandingPage() {
  const apiClient = useMemo(
    () =>
      new TuVitrinaApiClient(
        process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '') || '',
        async () => null,
      ),
    [],
  );

  const plansQuery = useQuery<PlansConfigDto>({
    queryKey: ['public-plans-config'],
    queryFn: () => apiClient.getPlansConfig(),
    retry: 0,
    staleTime: 300_000,
  });

  const plans = plansQuery.data;
  const freeProducts = plans?.freeLimits.maxProducts ?? 50;
  const freeImages = plans?.freeLimits.maxImagesPerProduct ?? 3;
  const proProducts = plans?.proLimits.maxProducts ?? 100000;
  const proImages = plans?.proLimits.maxImagesPerProduct ?? 10;
  const proPriceCup = plans?.proPriceCup ?? 3000;
  const proPriceUsd = plans?.proPriceUsd ?? 10;
  const proDays = plans?.proDurationDays ?? 60;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: 72, gap: 2 }}>
            <Typography
              component={Link}
              href="/"
              variant="h5"
              color="primary.main"
              sx={{ textDecoration: 'none', fontWeight: 700, letterSpacing: '-0.02em' }}
            >
              {ES_CU.brand}
            </Typography>

            <Stack
              component="nav"
              aria-label="Navegación principal"
              direction="row"
              spacing={3}
              sx={{ display: { xs: 'none', md: 'flex' } }}
              alignItems="center"
            >
              <Typography
                component="a"
                href="#funcionalidades"
                variant="body2"
                color="text.secondary"
                sx={{ textDecoration: 'none', fontWeight: 500 }}
              >
                Funcionalidades
              </Typography>
              <Typography
                component="a"
                href="#como-funciona"
                variant="body2"
                color="text.secondary"
                sx={{ textDecoration: 'none', fontWeight: 500 }}
              >
                Cómo funciona
              </Typography>
              <Typography
                component="a"
                href="#precios"
                variant="body2"
                color="text.secondary"
                sx={{ textDecoration: 'none', fontWeight: 500 }}
              >
                Precios
              </Typography>
              <Typography
                component={Link}
                href="/herramientas"
                variant="body2"
                color="text.secondary"
                sx={{ textDecoration: 'none', fontWeight: 500 }}
              >
                Herramientas
              </Typography>
              <Typography
                component={Link}
                href="/ayuda"
                variant="body2"
                color="text.secondary"
                sx={{ textDecoration: 'none', fontWeight: 500 }}
              >
                Ayuda
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                <PWAInstallButton size="small" variant="text" label="Instalar app" />
              </Box>
              <Button component={Link} href="/entrar" variant="text" color="inherit" sx={{ minHeight: 44 }}>
                Entrar
              </Button>
              <Button
                component={Link}
                href="/entrar"
                variant="contained"
                color="secondary"
                endIcon={<ArrowRight size={18} />}
                sx={{ minHeight: 44 }}
              >
                Crear tienda gratis
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main" id="contenido-principal">
        {/* HERO SECTION */}
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={2.5}>
                <Typography variant="overline" color="primary.main" fontWeight={700}>
                  PARA EMPRENDEDORES Y MIPYMES EN CUBA
                </Typography>
                <Typography
                  variant="h1"
                  sx={{
                    fontSize: { xs: '2.25rem', sm: '2.75rem', md: '3.25rem' },
                    lineHeight: 1.1,
                    fontWeight: 700,
                    letterSpacing: '-0.025em',
                  }}
                >
                  Tu vitrina online lista en minutos, directo a tu WhatsApp.
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.08rem', lineHeight: 1.6 }}>
                  {ES_CU.tagline} Catálogo rápido con fotos ligeras WebP, multimoneda CUP/USD/MLC,
                  modo sin conexión y cero comisiones por venta.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} pt={1}>
                  <Button
                    component={Link}
                    href="/entrar"
                    variant="contained"
                    color="secondary"
                    size="large"
                    endIcon={<ArrowRight size={18} />}
                    sx={{ minHeight: 48 }}
                  >
                    Abrir mi tienda gratis
                  </Button>
                  <Button
                    component={Link}
                    href="/herramientas"
                    variant="outlined"
                    size="large"
                    startIcon={<QrCode size={18} />}
                    sx={{ minHeight: 48 }}
                  >
                    Herramientas gratuitas
                  </Button>
                </Stack>
                <Stack direction="row" spacing={3} pt={1} flexWrap="wrap" useFlexGap>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    • 0% comisión por venta
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    • Funciona con datos móviles 2G/3G
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    • Sin cuenta obligatoria para comprar
                  </Typography>
                </Stack>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  aspectRatio: '16 / 9',
                }}
              >
                <Box
                  component="img"
                  src="/images/hero_cuban_storefront.jpg"
                  alt="Emprendimiento cubano gestionando su catálogo digital TuVitrina desde el móvil"
                  fetchPriority="high"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>

        {/* FUNCIONALIDADES */}
        <Box id="funcionalidades" sx={{ bgcolor: 'background.paper', py: { xs: 6, md: 9 }, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Container maxWidth="lg">
            <Stack spacing={1.5} maxWidth={680} mb={5}>
              <Typography variant="overline" color="primary.main" fontWeight={700}>
                FUNCIONALIDADES DISEÑADAS PARA CUBA
              </Typography>
              <Typography variant="h2" sx={{ fontSize: { xs: '1.85rem', md: '2.4rem' }, fontWeight: 700 }}>
                Todo lo necesario para vender sin fricción ni comisiones
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Pensado para responder en teléfonos de gama baja, redes inestables y flujos reales de cobro y envío en la isla.
              </Typography>
            </Stack>

            <Grid container spacing={2.5}>
              {FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <Grid key={feat.title} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent sx={{ p: 3 }}>
                        <Stack spacing={1.5}>
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: 2.5,
                              bgcolor: 'primary.50',
                              color: 'primary.main',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon size={22} aria-hidden="true" />
                          </Box>
                          <Typography variant="h6" component="h3" fontWeight={700}>
                            {feat.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                            {feat.body}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Container>
        </Box>

        {/* COMO FUNCIONA */}
        <Container id="como-funciona" maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
          <Grid container spacing={5} alignItems="center">
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  aspectRatio: '4 / 3',
                }}
              >
                <Box
                  component="img"
                  src="/images/mobile_catalog_craft.jpg"
                  alt="Catálogo TuVitrina en teléfono móvil junto a productos artesanales cubanos"
                  loading="lazy"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </Box>
            </Grid>

            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="overline" color="primary.main" fontWeight={700}>
                    CÓMO FUNCIONA
                  </Typography>
                  <Typography variant="h2" sx={{ fontSize: { xs: '1.85rem', md: '2.35rem' }, fontWeight: 700, mt: 0.5 }}>
                    De cero a recibir pedidos hoy mismo
                  </Typography>
                </Box>

                <Stack spacing={2.5}>
                  {HOW_IT_WORKS.map((item) => (
                    <Card key={item.step} variant="outlined">
                      <CardContent sx={{ p: 2.5 }}>
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          <Typography
                            variant="h5"
                            component="span"
                            color="primary.main"
                            fontWeight={700}
                            className="tabular-nums"
                          >
                            {item.step}
                          </Typography>
                          <Box>
                            <Typography variant="subtitle1" component="h3" fontWeight={700}>
                              {item.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mt={0.5}>
                              {item.body}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Container>

        {/* PRECIOS */}
        <Box id="precios" sx={{ bgcolor: 'background.paper', py: { xs: 6, md: 9 }, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Container maxWidth="lg">
            <Stack spacing={1.5} textAlign="center" maxWidth={640} mx="auto" mb={5}>
              <Typography variant="overline" color="primary.main" fontWeight={700}>
                PLANES TRANSPARENTES
              </Typography>
              <Typography variant="h2" sx={{ fontSize: { xs: '1.85rem', md: '2.35rem' }, fontWeight: 700 }}>
                Empieza gratis y escala cuando lo necesites
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Sin tarjetas internacionales ni comisiones ocultas. Si bajas de PRO a Free conservas todos tus productos.
              </Typography>
            </Stack>

            <Grid container spacing={3} maxWidth="md" mx="auto">
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 3.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Stack spacing={2} flexGrow={1}>
                      <Typography variant="overline" color="text.secondary" fontWeight={700}>
                        PLAN FREE
                      </Typography>
                      <Typography variant="h3" component="p" fontWeight={700} className="tabular-nums">
                        0 CUP
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Ideal para emprendedores que inician su catálogo por WhatsApp.
                      </Typography>
                      <Stack spacing={1.25} pt={1}>
                        {[
                          `Hasta ${freeProducts} productos activos`,
                          `Hasta ${freeImages} fotos WebP por producto`,
                          'Pedidos por WhatsApp y Telegram',
                          'Multimoneda CUP / USD / MLC y zonas de envío',
                          'PWA offline, Modo ligero y código QR',
                        ].map((line) => (
                          <Stack key={line} direction="row" spacing={1.25} alignItems="center">
                            <Check size={16} color="#00796B" aria-hidden="true" />
                            <Typography variant="body2">{line}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Stack>
                    <Button
                      component={Link}
                      href="/entrar"
                      variant="outlined"
                      size="large"
                      fullWidth
                      sx={{ mt: 3, minHeight: 46 }}
                    >
                      Empezar gratis
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card
                  sx={{
                    height: '100%',
                    border: '2px solid',
                    borderColor: 'primary.main',
                  }}
                >
                  <CardContent sx={{ p: 3.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Stack spacing={2} flexGrow={1}>
                      <Typography variant="overline" color="primary.main" fontWeight={700}>
                        PLAN PRO · PAGO MANUAL
                      </Typography>
                      <Box>
                        <Typography variant="h3" component="p" fontWeight={700} className="tabular-nums">
                          {formatMoney(proPriceCup, 'CUP')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" className="tabular-nums">
                          o {formatMoney(proPriceUsd, 'USD')} por {proDays} días
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Para tiendas con catálogos grandes, promociones avanzadas y marca propia.
                      </Typography>
                      <Stack spacing={1.25} pt={1}>
                        {[
                          `Hasta ${proProducts.toLocaleString('es-CU')} productos publicados`,
                          `Galería de hasta ${proImages} fotos por producto`,
                          'Cupones de descuento y promociones 2x1 / 3x2 / combos',
                          'Importación masiva y exportación de pedidos CSV',
                          'Estadísticas completas y guía de dominio propio',
                        ].map((line) => (
                          <Stack key={line} direction="row" spacing={1.25} alignItems="center">
                            <Check size={16} color="#00796B" aria-hidden="true" />
                            <Typography variant="body2">{line}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Stack>
                    <Button
                      component={Link}
                      href="/entrar"
                      variant="contained"
                      color="secondary"
                      size="large"
                      fullWidth
                      sx={{ mt: 3, minHeight: 46 }}
                    >
                      Crear tienda y pasar a PRO
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* PREGUNTAS FRECUENTES */}
        <Container id="faq" maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
          <Stack spacing={1.5} textAlign="center" mb={4}>
            <Typography variant="overline" color="primary.main" fontWeight={700}>
              PREGUNTAS FRECUENTES
            </Typography>
            <Typography variant="h2" sx={{ fontSize: { xs: '1.8rem', md: '2.2rem' }, fontWeight: 700 }}>
              Resolvemos tus dudas antes de empezar
            </Typography>
          </Stack>

          <Stack spacing={1.5}>
            {FAQS.map((item) => (
              <Accordion key={item.q} variant="outlined">
                <AccordionSummary expandIcon={<ChevronDown size={18} />}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {item.q}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.65}>
                    {item.a}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" mt={5}>
            <Button component={Link} href="/ayuda" variant="outlined" size="large">
              Ir al Centro de Ayuda (10 guías)
            </Button>
            <Button
              component="a"
              href="https://wa.me/5355550199?text=Hola%20equipo%20TuVitrina%2C%20necesito%20ayuda."
              target="_blank"
              rel="noreferrer"
              variant="contained"
              size="large"
              startIcon={<MessageCircle size={18} />}
              sx={{
                bgcolor: WHATSAPP_BRAND_HEX,
                color: '#091A10',
                fontWeight: 700,
                '&:hover': { bgcolor: '#1EBE5D' },
              }}
            >
              Soporte por WhatsApp
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* FOOTER */}
      <Box
        component="footer"
        sx={{
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          py: 4,
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                {ES_CU.brand}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Plataforma SaaS cubana para tiendas online con pedidos por WhatsApp · 0% comisión
              </Typography>
            </Box>

            <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap alignItems="center">
              <Link href="/herramientas" style={{ color: 'inherit', fontSize: 14 }}>
                Herramientas gratis
              </Link>
              <Link href="/ayuda" style={{ color: 'inherit', fontSize: 14 }}>
                Centro de ayuda
              </Link>
              <Link href="/terminos" style={{ color: 'inherit', fontSize: 14 }}>
                Términos
              </Link>
              <Link href="/privacidad" style={{ color: 'inherit', fontSize: 14 }}>
                Privacidad
              </Link>
              <Button
                component="a"
                href="https://t.me/tuvitrina_cu"
                target="_blank"
                rel="noreferrer"
                size="small"
                startIcon={<Send size={14} />}
              >
                Telegram
              </Button>
              <Button
                component={Link}
                href="/entrar"
                size="small"
                startIcon={<Smartphone size={14} />}
              >
                Panel vendedor
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
