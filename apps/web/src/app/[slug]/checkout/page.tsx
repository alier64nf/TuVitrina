'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  FormControlLabel,
  Grid2 as Grid,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, CloudOff, MessageCircle, RefreshCw, Tag, WifiOff } from 'lucide-react';
import {
  CUBA_MUNICIPALITIES,
  CUBA_PROVINCES,
  formatMoney,
  normalizeCubanWhatsApp,
  TuVitrinaApiClient,
} from '@tuvitrina/contracts';
import { useCart } from '@/lib/cart/useCart';
import { ErrorStateCard, PageSkeleton } from '@/components/StateViews';
import { StoreThemeWrapper } from '@/components/StoreThemeWrapper';
import {
  enqueueOfflineOrder,
  flushOrderQueue,
  ORDER_QUEUE_EVENT,
  readOrderQueue,
  type QueuedOrderItem,
} from '@/lib/offline/orderQueue';
import { useCachedStorefront } from '@/lib/offline/useCachedStorefront';
import { WHATSAPP_BRAND_HEX } from '@/lib/theme/m3Theme';

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ord-${crypto.randomUUID()}`;
  }
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function CheckoutPage() {
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

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('La Habana');
  const [municipality, setMunicipality] = useState('Playa');
  const [streetAddress, setStreetAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [retryingQueue, setRetryingQueue] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [queuedOrderId, setQueuedOrderId] = useState<string | null>(null);
  const [queuedOrderState, setQueuedOrderState] = useState<QueuedOrderItem | null>(null);

  const storefrontQuery = useCachedStorefront(apiClient, slug);

  const quoteQuery = useQuery({
    queryKey: [
      'order-quote',
      slug,
      province,
      municipality,
      fulfillmentType,
      appliedCoupon,
      cart.items.map((i) => `${i.productId}:${i.variantId ?? ''}:${i.quantity}`).join(','),
    ],
    enabled: Boolean(
      slug &&
        cart.loaded &&
        cart.items.length > 0 &&
        (typeof navigator === 'undefined' || navigator.onLine),
    ),
    retry: 0,
    queryFn: () =>
      apiClient.quoteOrder(slug, {
        province,
        municipality,
        fulfillmentType,
        couponCode: appliedCoupon || null,
        items: cart.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      }),
  });

  useEffect(() => {
    if (!queuedOrderId) return;
    const syncState = () => {
      const found = readOrderQueue().find((q) => q.id === queuedOrderId) ?? null;
      setQueuedOrderState(found);
    };
    syncState();
    window.addEventListener(ORDER_QUEUE_EVENT, syncState);
    return () => window.removeEventListener(ORDER_QUEUE_EVENT, syncState);
  }, [queuedOrderId]);

  const municipalities = CUBA_MUNICIPALITIES[province] ?? [];

  const handleProvinceChange = (nextProv: string) => {
    setProvince(nextProv);
    const list = CUBA_MUNICIPALITIES[nextProv] ?? [];
    setMunicipality(list[0] ?? '');
  };

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
        <ErrorStateCard message="No se pudo cargar la información de la tienda." />
      </Container>
    );
  }

  const { store, paymentMethods } = storefrontQuery.data;
  const quote = quoteQuery.data;
  const pricing = quote?.pricing;
  const pickupAllowed = store.pickupEnabled !== false;

  const handleApplyCoupon = () => {
    const normalized = couponInput.trim().toUpperCase();
    if (!normalized) return;
    setAppliedCoupon(normalized);
  };

  const handleClearCoupon = () => {
    setCouponInput('');
    setAppliedCoupon('');
  };

  const queueCurrentOrder = (payloadInput: {
    idempotencyKey: string;
    cleanPhone: string;
  }) => {
    const queued = enqueueOfflineOrder({
      slug,
      storeName: store.name,
      storeWhatsapp: store.whatsapp,
      payload: {
        customerName: customerName.trim(),
        phone: payloadInput.cleanPhone,
        province,
        municipality,
        streetAddress: streetAddress.trim(),
        notes: notes.trim() || null,
        fulfillmentType,
        paymentMethodId: paymentMethodId || null,
        couponCode: quote?.couponApplied ?? (appliedCoupon || null),
        idempotencyKey: payloadInput.idempotencyKey,
        channel: 'whatsapp',
        items: cart.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      },
      summaryItems: cart.items.map((i) => ({
        productName: i.productName,
        variantLabel: i.variantLabel,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        currency: i.currency,
      })),
      estimatedTotal: pricing ? pricing.total : cart.subtotal,
      currency: pricing ? pricing.currency : store.baseCurrency,
    });
    cart.clearCart();
    setQueuedOrderId(queued.id);
    setQueuedOrderState(queued);
    setSubmitting(false);
  };

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setErrorMsg(null);

    if (!customerName.trim() || customerName.trim().length < 2) {
      setErrorMsg('Escribe tu nombre y apellidos.');
      return;
    }
    const cleanPhone = normalizeCubanWhatsApp(phone);
    if (!cleanPhone) {
      setErrorMsg('Introduce un número móvil cubano válido (+53 5XXXXXXX).');
      return;
    }
    if (!streetAddress.trim() || streetAddress.trim().length < 3) {
      setErrorMsg('Escribe tu dirección exacta (calle, número, entre calles).');
      return;
    }
    if (cart.items.length === 0) {
      setErrorMsg('Tu carrito está vacío.');
      return;
    }

    const idempotencyKey = generateIdempotencyKey();
    setSubmitting(true);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      queueCurrentOrder({ idempotencyKey, cleanPhone });
      return;
    }

    try {
      const res = await apiClient.placeOrder(slug, {
        customerName: customerName.trim(),
        phone: cleanPhone,
        province,
        municipality,
        streetAddress: streetAddress.trim(),
        notes: notes.trim() || null,
        fulfillmentType,
        paymentMethodId: paymentMethodId || null,
        couponCode: quote?.couponApplied ?? (appliedCoupon || null),
        idempotencyKey,
        channel: 'whatsapp',
        items: cart.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      });

      cart.clearCart();
      window.open(res.whatsappUrl, '_blank', 'noopener,noreferrer');
      router.replace(`/${slug}/pedido/${res.order.trackingToken}`);
    } catch (err) {
      const isNetworkFailure =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        (err instanceof TypeError && /fetch|network|load/i.test(err.message));

      if (isNetworkFailure) {
        queueCurrentOrder({ idempotencyKey, cleanPhone });
        return;
      }

      setErrorMsg(err instanceof Error ? err.message : 'No se pudo enviar el pedido.');
      setSubmitting(false);
    }
  };

  const handleManualSync = async () => {
    setRetryingQueue(true);
    try {
      const res = await flushOrderQueue(apiClient);
      const matched = res.syncedItems.find((item) => item.id === queuedOrderId);
      if (matched?.syncedTrackingToken) {
        setQueuedOrderState(matched);
      }
    } finally {
      setRetryingQueue(false);
    }
  };

  if (queuedOrderState) {
    const isSynced = queuedOrderState.status === 'synced' && queuedOrderState.syncedTrackingToken;
    return (
      <StoreThemeWrapper themeConfig={store.theme}>
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
                  Volver a {store.name}
                </Button>
              </Toolbar>
            </Container>
          </AppBar>

          <Container component="main" id="contenido-principal" maxWidth="sm" sx={{ py: 6 }}>
            <Card>
              <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Stack spacing={2.5} alignItems="center" textAlign="center">
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: 4,
                      bgcolor: isSynced ? 'success.light' : 'warning.light',
                      color: isSynced ? 'success.contrastText' : 'warning.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSynced ? <CheckCircle2 size={32} /> : <CloudOff size={32} />}
                  </Box>

                  <Typography variant="h4" component="h1">
                    {isSynced
                      ? `¡Pedido #${queuedOrderState.syncedOrderNumber} enviado!`
                      : 'Pedido guardado sin conexión'}
                  </Typography>

                  <Typography variant="body1" color="text.secondary">
                    {isSynced
                      ? 'La conexión volvió y tu pedido se registró automáticamente en el servidor de la tienda sin duplicados.'
                      : 'Guardamos tu pedido de forma segura en este dispositivo. Apenas recuperes la conexión, se enviará automáticamente al servidor.'}
                  </Typography>

                  {queuedOrderState.lastError && !isSynced ? (
                    <Alert severity="info" sx={{ width: '100%', textAlign: 'left' }}>
                      Estado actual: {queuedOrderState.lastError}
                    </Alert>
                  ) : null}

                  <Stack spacing={1.5} width="100%">
                    {isSynced && queuedOrderState.syncedTrackingToken ? (
                      <>
                        <Button
                          component={Link}
                          href={`/${slug}/pedido/${queuedOrderState.syncedTrackingToken}`}
                          variant="contained"
                          size="large"
                          fullWidth
                        >
                          Ver seguimiento del pedido #{queuedOrderState.syncedOrderNumber}
                        </Button>
                        {queuedOrderState.syncedWhatsappUrl ? (
                          <Button
                            component="a"
                            href={queuedOrderState.syncedWhatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            variant="contained"
                            size="large"
                            fullWidth
                            startIcon={<MessageCircle size={18} />}
                            sx={{
                              bgcolor: WHATSAPP_BRAND_HEX,
                              color: '#091A10',
                              fontWeight: 700,
                              '&:hover': { bgcolor: '#1EBE5D' },
                            }}
                          >
                            Abrir en WhatsApp
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Button
                          variant="contained"
                          size="large"
                          fullWidth
                          onClick={handleManualSync}
                          disabled={retryingQueue}
                          startIcon={<RefreshCw size={18} />}
                        >
                          {retryingQueue ? 'Sincronizando...' : 'Reintentar envío ahora'}
                        </Button>
                        <Button
                          component="a"
                          href={queuedOrderState.offlineDraftWhatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          variant="outlined"
                          size="large"
                          fullWidth
                          startIcon={<MessageCircle size={18} />}
                        >
                          Preparar mensaje en WhatsApp
                        </Button>
                      </>
                    )}
                    <Button component={Link} href={`/${slug}`} variant="text" fullWidth>
                      Volver al catálogo
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Container>
        </Box>
      </StoreThemeWrapper>
    );
  }

  return (
    <StoreThemeWrapper themeConfig={store.theme}>
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
                Volver a {store.name}
              </Button>
            </Toolbar>
          </Container>
        </AppBar>

        <Container component="main" id="contenido-principal" maxWidth="md" sx={{ py: 4 }}>
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" component="h1">
                  Finalizar pedido en {store.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completa tus datos de contacto y entrega. El pedido se enviará directamente a WhatsApp.
                </Typography>
              </Box>

              {storefrontQuery.fromCache || (typeof navigator !== 'undefined' && !navigator.onLine) ? (
                <Alert severity="warning" icon={<WifiOff size={18} />}>
                  Estás sin conexión. Puedes confirmar tu pedido igualmente: lo guardaremos en cola
                  y se enviará automáticamente en cuanto vuelva el internet.
                </Alert>
              ) : null}

              <Box aria-live="polite">
                {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}
              </Box>

              <Card>
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                  <Stack spacing={2.5}>
                    <Typography variant="h6" component="h2">
                      Tus datos de contacto
                    </Typography>
                    <TextField
                      label="Nombre y apellidos"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                    <TextField
                      label="Tu WhatsApp (+53 5XXXXXXX)"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="51234567"
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                  <Stack spacing={2.5}>
                    <Typography variant="h6" component="h2">
                      Entrega o recogida
                    </Typography>
                    <RadioGroup
                      value={fulfillmentType}
                      onChange={(e) =>
                        setFulfillmentType(e.target.value as 'delivery' | 'pickup')
                      }
                    >
                      <FormControlLabel
                        value="delivery"
                        control={<Radio />}
                        label="Envío a domicilio"
                      />
                      {pickupAllowed ? (
                        <FormControlLabel
                          value="pickup"
                          control={<Radio />}
                          label="Recogida en tienda (gratis)"
                        />
                      ) : null}
                    </RadioGroup>

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          select
                          label="Provincia"
                          value={province}
                          onChange={(e) => handleProvinceChange(e.target.value)}
                        >
                          {CUBA_PROVINCES.map((p) => (
                            <MenuItem key={p} value={p}>
                              {p}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          select
                          label="Municipio"
                          value={municipality}
                          onChange={(e) => setMunicipality(e.target.value)}
                        >
                          {municipalities.map((m) => (
                            <MenuItem key={m} value={m}>
                              {m}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                    </Grid>

                    <TextField
                      label="Dirección exacta (calle, número, entre calles y apto)"
                      required
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                    />
                    <TextField
                      label="Notas adicionales para el vendedor (opcional)"
                      multiline
                      minRows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej. Tocar timbre, dejar con el vecino..."
                    />
                  </Stack>
                </CardContent>
              </Card>

              {paymentMethods.length > 0 ? (
                <Card>
                  <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                    <Stack spacing={2}>
                      <Typography variant="h6" component="h2">
                        Método de pago
                      </Typography>
                      <RadioGroup
                        value={paymentMethodId}
                        onChange={(e) => setPaymentMethodId(e.target.value)}
                      >
                        {paymentMethods.map((pm) => (
                          <FormControlLabel
                            key={pm.id}
                            value={pm.id}
                            control={<Radio />}
                            label={`${pm.label}${pm.instructions ? ` — ${pm.instructions}` : ''}`}
                          />
                        ))}
                      </RadioGroup>
                    </Stack>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Tag size={18} aria-hidden="true" />
                      <Typography variant="h6" component="h2">
                        Cupón de descuento
                      </Typography>
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <TextField
                        label="Código de cupón"
                        placeholder="Ej. VERANO10"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        size="small"
                      />
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={handleApplyCoupon}
                        disabled={!couponInput.trim() || quoteQuery.isFetching}
                        sx={{ whiteSpace: 'nowrap', minHeight: 40 }}
                      >
                        Aplicar
                      </Button>
                      {appliedCoupon ? (
                        <Button
                          type="button"
                          variant="text"
                          color="error"
                          onClick={handleClearCoupon}
                          sx={{ whiteSpace: 'nowrap', minHeight: 40 }}
                        >
                          Quitar
                        </Button>
                      ) : null}
                    </Stack>
                    {quote?.couponApplied ? (
                      <Alert severity="success">
                        Cupón <strong>{quote.couponApplied}</strong> aplicado correctamente.
                      </Alert>
                    ) : null}
                    {quote?.couponError ? <Alert severity="error">{quote.couponError}</Alert> : null}
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                  <Stack spacing={2}>
                    <Typography variant="h6" component="h2">
                      Resumen del pedido
                    </Typography>
                    {cart.items.map((i) => (
                      <Stack key={i.cartLineId} direction="row" justifyContent="space-between">
                        <Typography variant="body2">
                          {i.quantity}x {i.productName}
                          {i.variantLabel ? ` (${i.variantLabel})` : ''}
                        </Typography>
                        <Typography variant="body2" fontWeight={700} className="tabular-nums">
                          {formatMoney(i.unitPrice * i.quantity, i.currency)}
                        </Typography>
                      </Stack>
                    ))}

                    <Box pt={1.5} borderTop="1px solid" borderColor="divider">
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            Subtotal
                          </Typography>
                          <Typography variant="body2" className="tabular-nums">
                            {formatMoney(
                              pricing ? pricing.subtotal : cart.subtotal,
                              pricing ? pricing.currency : store.baseCurrency,
                            )}
                          </Typography>
                        </Stack>

                        {pricing?.appliedDiscounts.map((d, idx) => (
                          <Stack
                            key={`${d.kind}-${idx}`}
                            direction="row"
                            justifyContent="space-between"
                          >
                            <Typography variant="body2" color="primary.main" fontWeight={600}>
                              {d.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="primary.main"
                              fontWeight={600}
                              className="tabular-nums"
                            >
                              -{formatMoney(d.discountAmount, pricing.currency)}
                            </Typography>
                          </Stack>
                        ))}

                        {pricing ? (
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">
                              {fulfillmentType === 'pickup'
                                ? 'Recogida en tienda'
                                : quote?.shippingZoneName
                                  ? `Envío (${quote.shippingZoneName})`
                                  : 'Envío'}
                            </Typography>
                            <Typography variant="body2" className="tabular-nums">
                              {fulfillmentType === 'pickup' || pricing.freeShippingApplied
                                ? 'Gratis'
                                : formatMoney(pricing.shippingCost, pricing.currency)}
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
                            Total a pagar
                          </Typography>
                          <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            className="tabular-nums"
                            color="primary.main"
                          >
                            {formatMoney(
                              pricing ? pricing.total : cart.subtotal,
                              pricing ? pricing.currency : store.baseCurrency,
                            )}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting || cart.items.length === 0}
                startIcon={<MessageCircle size={20} />}
                sx={{
                  minHeight: 48,
                  bgcolor: WHATSAPP_BRAND_HEX,
                  color: '#091A10',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#1EBE5D' },
                }}
              >
                {submitting ? 'Procesando pedido...' : 'Enviar pedido por WhatsApp'}
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>
    </StoreThemeWrapper>
  );
}
