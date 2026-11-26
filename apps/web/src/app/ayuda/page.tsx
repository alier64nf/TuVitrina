'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid2 as Grid,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  Search,
  Send,
} from 'lucide-react';
import { TuVitrinaApiClient } from '@tuvitrina/contracts';
import { WHATSAPP_BRAND_HEX } from '@/lib/theme/m3Theme';

const HELP_TOPICS = [
  {
    id: 'tema-1',
    title: '1. Crear tu cuenta y tienda en 3 pasos',
    summary: 'Registro con Google o correo, aceptación de términos y reserva de slug único.',
    body: 'Ingresa desde "Crear tienda gratis", inicia sesión y completa el asistente de 3 pasos: (1) nombre y rubro, (2) número móvil cubano válido (+53 5XXXXXXX) y (3) enlace corto único (ejemplo: tuvitrina.cu/mi-bodega). El sistema verifica en tiempo real que el enlace no esté ocupado.',
  },
  {
    id: 'tema-2',
    title: '2. Publicar productos, fotos WebP y variantes',
    summary: 'Compresión automática en tu navegador para subir catálogos sin gastar megas.',
    body: 'Desde Panel > Productos > Nuevo producto puedes subir fotos que se comprimen automáticamente a formato WebP antes de enviarse. También puedes definir precios tachados (para mostrar descuentos), variantes por talla/color/sabor, duplicar productos y marcar "Agotado" con un toque.',
  },
  {
    id: 'tema-3',
    title: '3. Configurar monedas (CUP, USD, MLC) y tasas',
    summary: 'Define la moneda base de tu tienda y tasas de cambio editables con fecha.',
    body: 'En Panel > Negocio puedes escoger tu moneda base (CUP, USD o MLC), marcar qué monedas aceptas y actualizar tus tasas de conversión. El carrito convierte automáticamente los totales para mostrarle al cliente el monto exacto en la moneda base.',
  },
  {
    id: 'tema-4',
    title: '4. Medios de pago cubanos (Efectivo, Transfermóvil, EnZona)',
    summary: 'Configura pago contra entrega, transferencias y credenciales cifradas de EnZona.',
    body: 'Activa uno o varios métodos de pago filtrados por moneda y agrega tus instrucciones o tarjeta/teléfono de confirmación. Si usas EnZona en comercio electrónico, tus credenciales se guardan cifradas con AES-256-GCM y nunca vuelven a exponerse en pantalla.',
  },
  {
    id: 'tema-5',
    title: '5. Zonas de envío por municipio y recogida en el local',
    summary: 'Tarifas diferenciadas por provincia/municipio y umbral de envío gratis.',
    body: 'Configura el costo de mensajería por municipio de Cuba y habilita si deseas recogida gratuita en tu local. También puedes definir un monto mínimo de compra para activar automáticamente un cartel y cálculo de envío gratis.',
  },
  {
    id: 'tema-6',
    title: '6. Cómo funcionan los pedidos por WhatsApp y Telegram',
    summary: 'Recálculo en servidor, número correlativo y enlace de seguimiento.',
    body: 'Cuando el cliente confirma el checkout como invitado, el servidor verifica precios, promociones y cupones, asigna un número de pedido correlativo (#1, #2, ...) y genera un token de seguimiento público. Luego abre WhatsApp o Telegram con el mensaje armado.',
  },
  {
    id: 'tema-7',
    title: '7. Modo sin conexión, cola automática y Modo ligero',
    summary: 'Navega tiendas guardadas en caché y envía pedidos aunque se caiga la red.',
    body: 'TuVitrina se puede instalar como aplicación PWA. Los catálogos visitados se guardan en caché y se refrescan en segundo plano. Si un comprador confirma un pedido sin señal, el pedido queda en cola segura y se envía automáticamente con clave de idempotencia al recuperar internet. El Modo ligero difiere las fotos para ahorrar datos.',
  },
  {
    id: 'tema-8',
    title: '8. Cupones de descuento y promociones automáticas (2x1, 3x2)',
    summary: 'Campañas de descuento validadas en servidor sin errores de cálculo.',
    body: 'En Panel > Promos y Cupones puedes crear cupones con código, vigencia, monto mínimo y límite de usos, o activar promociones automáticas (porcentaje, 2x1, 3x2, segunda unidad o combos). Toda regla se valida en el servidor antes de registrar el pedido.',
  },
  {
    id: 'tema-9',
    title: '9. Plan Free vs Plan PRO y renovación manual',
    summary: 'Límites claros, cero pérdida de datos al bajar de plan y pago manual.',
    body: 'El Plan Free permite hasta 50 productos sin comisiones. Cuando necesites más capacidad, galería ampliada o funciones PRO, sube tu comprobante desde Panel > Suscripción. Si vence el período PRO y pasas a Free, tus productos existentes se conservan intactos.',
  },
  {
    id: 'tema-10',
    title: '10. Dominio propio para tiendas PRO (guía DNS)',
    summary: 'Cómo apuntar tu dominio .cu o .com hacia tu tienda TuVitrina en producción.',
    body: 'Las tiendas PRO pueden asociar un dominio propio en entornos con proxy TLS multi-inquilino (Cloudflare for SaaS / Caddy On-Demand TLS). Configura un registro CNAME apuntando a cname.tuvitrina.cu y un registro TXT _tuvitrina-verify con el slug de tu tienda. En el entorno de vista previa actual, las tiendas operan bajo ruta corta /{slug}.',
  },
];

export default function HelpCenterPage() {
  const apiClient = useMemo(
    () =>
      new TuVitrinaApiClient(
        process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '') || '',
        async () => null,
      ),
    [],
  );

  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'telegram' | 'email'>('whatsapp');
  const [storeSlug, setStoreSlug] = useState('');
  const [topic, setTopic] = useState(HELP_TOPICS[0].title);
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  const filteredTopics = HELP_TOPICS.filter((item) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.body.toLowerCase().includes(q)
    );
  });

  const handleSubmitTicket = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setErrorMsg(null);
    setTicketRef(null);
    setSubmitting(true);
    try {
      const res = await apiClient.createSupportTicket({
        name,
        contact,
        channel,
        storeSlug: storeSlug.trim() || null,
        topic,
        message,
      });
      setTicketRef(res.referenceCode);
      setMessage('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo enviar tu solicitud de soporte.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 8 }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: 68 }}>
            <Button component={Link} href="/" startIcon={<ArrowLeft size={18} />} color="inherit" sx={{ minHeight: 44 }}>
              Volver a TuVitrina
            </Button>
            <Stack direction="row" spacing={1}>
              <Button component={Link} href="/herramientas" variant="outlined" size="small" sx={{ minHeight: 40 }}>
                Herramientas gratis
              </Button>
              <Button component={Link} href="/entrar" variant="contained" color="secondary" size="small" sx={{ minHeight: 40 }}>
                Mi panel
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Container component="main" id="contenido-principal" maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={4}>
          <Box maxWidth={720}>
            <Stack direction="row" spacing={1} alignItems="center" color="primary.main" mb={1}>
              <HelpCircle size={20} aria-hidden="true" />
              <Typography variant="overline" fontWeight={700}>
                CENTRO DE AYUDA Y SOPORTE
              </Typography>
            </Stack>
            <Typography variant="h3" component="h1" fontWeight={700} gutterBottom>
              Guías rápidas para vender con TuVitrina
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Explora los 10 temas principales o envíanos un mensaje directo por nuestro formulario, WhatsApp o Telegram.
            </Typography>
          </Box>

          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            label="Buscar en el centro de ayuda"
            placeholder="Ej. WhatsApp, offline, EnZona, dominio, CSV..."
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Grid container spacing={4}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <Stack spacing={1.5}>
                {filteredTopics.length === 0 ? (
                  <Card variant="outlined">
                    <CardContent sx={{ py: 4, textAlign: 'center' }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        No encontramos guías para «{search}»
                      </Typography>
                      <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Prueba con otra palabra o escríbenos mediante el formulario de soporte.
                      </Typography>
                    </CardContent>
                  </Card>
                ) : (
                  filteredTopics.map((item) => (
                    <Accordion key={item.id} id={item.id} variant="outlined" defaultExpanded={item.id === 'tema-1'}>
                      <AccordionSummary expandIcon={<ChevronDown size={18} />}>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={700}>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.summary}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="body2" color="text.secondary" lineHeight={1.65}>
                          {item.body}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))
                )}
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, lg: 5 }}>
              <Stack spacing={3}>
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2} component="form" onSubmit={handleSubmitTicket} noValidate>
                      <Typography variant="h5" component="h2" fontWeight={700}>
                        Formulario de soporte
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Nuestro equipo de soporte responde en horario comercial de Cuba.
                      </Typography>

                      <Box aria-live="polite">
                        {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}
                        {ticketRef ? (
                          <Alert severity="success" icon={<CheckCircle2 size={18} />}>
                            Solicitud recibida con código <strong>{ticketRef}</strong>. Te contactaremos por{' '}
                            {channel.toUpperCase()}.
                          </Alert>
                        ) : null}
                      </Box>

                      <TextField
                        label="Tu nombre"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />

                      <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 5 }}>
                          <TextField
                            select
                            label="Canal preferido"
                            value={channel}
                            onChange={(e) => setChannel(e.target.value as 'whatsapp' | 'telegram' | 'email')}
                          >
                            <MenuItem value="whatsapp">WhatsApp</MenuItem>
                            <MenuItem value="telegram">Telegram</MenuItem>
                            <MenuItem value="email">Correo</MenuItem>
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 7 }}>
                          <TextField
                            label="Tu número, @usuario o correo"
                            required
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                            placeholder="+53 5XXXXXXX"
                          />
                        </Grid>
                      </Grid>

                      <TextField
                        label="Enlace de tu tienda (opcional)"
                        value={storeSlug}
                        onChange={(e) => setStoreSlug(e.target.value)}
                        placeholder="ej. mi-bodega"
                      />

                      <TextField
                        select
                        label="Tema de consulta"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                      >
                        {HELP_TOPICS.map((t) => (
                          <MenuItem key={t.id} value={t.title}>
                            {t.title}
                          </MenuItem>
                        ))}
                        <MenuItem value="Otro tema">Otro tema o incidencia</MenuItem>
                      </TextField>

                      <TextField
                        label="Describe tu consulta"
                        required
                        multiline
                        minRows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Cuéntanos qué necesitas resolver (mínimo 10 caracteres)..."
                      />

                      <Button
                        type="submit"
                        variant="contained"
                        color="secondary"
                        size="large"
                        disabled={submitting}
                        sx={{ minHeight: 46 }}
                      >
                        {submitting ? 'Enviando...' : 'Enviar solicitud de soporte'}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={1.5}>
                      <Typography variant="h6" component="h2" fontWeight={700}>
                        Canales directos
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        También puedes escribirnos directamente si necesitas atención rápida:
                      </Typography>
                      <Button
                        component="a"
                        href="https://wa.me/5355550199?text=Hola%20soporte%20de%20TuVitrina%2C%20necesito%20ayuda%20con%20mi%20tienda."
                        target="_blank"
                        rel="noreferrer"
                        variant="contained"
                        fullWidth
                        startIcon={<MessageCircle size={18} />}
                        sx={{
                          minHeight: 46,
                          bgcolor: WHATSAPP_BRAND_HEX,
                          color: '#091A10',
                          fontWeight: 700,
                          '&:hover': { bgcolor: '#1EBE5D' },
                        }}
                      >
                        Escribir al WhatsApp de Soporte
                      </Button>
                      <Button
                        component="a"
                        href="https://t.me/tuvitrina_cu"
                        target="_blank"
                        rel="noreferrer"
                        variant="outlined"
                        fullWidth
                        startIcon={<Send size={18} />}
                        sx={{ minHeight: 46 }}
                      >
                        Canal y soporte en Telegram (@tuvitrina_cu)
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
