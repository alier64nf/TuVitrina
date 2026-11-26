'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid2 as Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  ArrowLeft,
  Calculator,
  Check,
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  QrCode as QrCodeIcon,
  Wrench,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  convertCurrency,
  CURRENCIES,
  formatMoney,
  normalizeCubanWhatsApp,
  type CurrencyCode,
} from '@tuvitrina/contracts';
import { WHATSAPP_BRAND_HEX } from '@/lib/theme/m3Theme';

export default function FreeToolsPage() {
  const [tab, setTab] = useState(0);

  // 1. QR Generator
  const [qrInput, setQrInput] = useState('https://tuvitrina.cu/mi-tienda');
  const [qrColor, setQrColor] = useState('#00796B');
  const [qrPngUrl, setQrPngUrl] = useState('');
  const [qrSvg, setQrSvg] = useState('');

  useEffect(() => {
    const clean = qrInput.trim() || 'https://tuvitrina.cu';
    let active = true;
    void (async () => {
      try {
        const [png, svg] = await Promise.all([
          QRCode.toDataURL(clean, {
            margin: 2,
            width: 512,
            color: { dark: qrColor, light: '#FFFFFF' },
          }),
          QRCode.toString(clean, {
            type: 'svg',
            margin: 1,
            width: 240,
            color: { dark: qrColor, light: '#FFFFFF' },
          }),
        ]);
        if (active) {
          setQrPngUrl(png);
          setQrSvg(svg);
        }
      } catch {
        // Ignore transient invalid QR input
      }
    })();
    return () => {
      active = false;
    };
  }, [qrInput, qrColor]);

  // 2. WhatsApp Link Generator
  const [waPhone, setWaPhone] = useState('+53 51234567');
  const [waMessage, setWaMessage] = useState(
    'Hola, vi tu catálogo en TuVitrina y quiero hacer un pedido.',
  );
  const [waCopied, setWaCopied] = useState(false);

  const normalizedWa = useMemo(() => normalizeCubanWhatsApp(waPhone), [waPhone]);
  const generatedWaLink = useMemo(() => {
    if (!normalizedWa) return null;
    const digits = normalizedWa.replace(/\D/g, '');
    const textPart = waMessage.trim() ? `?text=${encodeURIComponent(waMessage.trim())}` : '';
    return `https://wa.me/${digits}${textPart}`;
  }, [normalizedWa, waMessage]);

  const handleCopyWa = async () => {
    if (!generatedWaLink || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(generatedWaLink);
    setWaCopied(true);
    setTimeout(() => setWaCopied(false), 2500);
  };

  // 3. Selling Price Calculator
  const [calcCurrency, setCalcCurrency] = useState<CurrencyCode>('CUP');
  const [costPrice, setCostPrice] = useState('800');
  const [extraExpenses, setExtraExpenses] = useState('120');
  const [desiredMarginPercent, setDesiredMarginPercent] = useState('35');
  const [anchorMarkupPercent, setAnchorMarkupPercent] = useState('15');
  const [rateUsd, setRateUsd] = useState('320');
  const [rateMlc, setRateMlc] = useState('270');

  const calcResult = useMemo(() => {
    const cost = Math.max(0, Number(costPrice) || 0);
    const extra = Math.max(0, Number(extraExpenses) || 0);
    const totalCost = cost + extra;
    const margin = Math.min(90, Math.max(0, Number(desiredMarginPercent) || 0));
    const anchorMarkup = Math.max(0, Number(anchorMarkupPercent) || 0);

    // Margin over selling price: price = totalCost / (1 - margin/100)
    const sellingPrice = margin >= 90 ? totalCost * 10 : totalCost / (1 - margin / 100);
    const roundedSellingPrice =
      calcCurrency === 'CUP'
        ? Math.ceil(sellingPrice / 10) * 10
        : Math.round(sellingPrice * 100) / 100;
    const netProfit = Math.max(0, roundedSellingPrice - totalCost);
    const compareAtPrice =
      anchorMarkup > 0
        ? calcCurrency === 'CUP'
          ? Math.ceil((roundedSellingPrice * (1 + anchorMarkup / 100)) / 10) * 10
          : Math.round(roundedSellingPrice * (1 + anchorMarkup / 100) * 100) / 100
        : null;

    const rates = {
      USD: Math.max(1, Number(rateUsd) || 320),
      MLC: Math.max(1, Number(rateMlc) || 270),
    };

    return {
      totalCost,
      sellingPrice: roundedSellingPrice,
      netProfit,
      compareAtPrice,
      inCup: convertCurrency(roundedSellingPrice, calcCurrency, 'CUP', rates),
      inUsd: convertCurrency(roundedSellingPrice, calcCurrency, 'USD', rates),
      inMlc: convertCurrency(roundedSellingPrice, calcCurrency, 'MLC', rates),
    };
  }, [
    costPrice,
    extraExpenses,
    desiredMarginPercent,
    anchorMarkupPercent,
    calcCurrency,
    rateUsd,
    rateMlc,
  ]);

  const handleDownloadPng = () => {
    if (!qrPngUrl) return;
    const a = document.createElement('a');
    a.href = qrPngUrl;
    a.download = 'codigo-qr-tuvitrina.png';
    a.click();
  };

  const handleDownloadSvg = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codigo-qr-tuvitrina.svg';
    a.click();
    URL.revokeObjectURL(url);
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
              <Button component={Link} href="/ayuda" variant="text" size="small" sx={{ minHeight: 40 }}>
                Centro de ayuda
              </Button>
              <Button component={Link} href="/entrar" variant="contained" color="secondary" size="small" sx={{ minHeight: 40 }}>
                Crear tienda gratis
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Container component="main" id="contenido-principal" maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={4}>
          <Box maxWidth={720}>
            <Stack direction="row" spacing={1} alignItems="center" color="primary.main" mb={1}>
              <Wrench size={20} aria-hidden="true" />
              <Typography variant="overline" fontWeight={700}>
                HERRAMIENTAS GRATUITAS PARA EMPRENDEDORES
              </Typography>
            </Stack>
            <Typography variant="h3" component="h1" fontWeight={700} gutterBottom>
              Utilidades prácticas para tu negocio en Cuba
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Úsalas gratis sin registrarte y directamente desde tu dispositivo, incluso con conexión lenta.
            </Typography>
          </Box>

          <Card>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
              <Tabs
                value={tab}
                onChange={(_e, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Selector de herramientas gratuitas"
              >
                <Tab
                  icon={<QrCodeIcon size={18} />}
                  iconPosition="start"
                  label="Generador de QR"
                  sx={{ minHeight: 54 }}
                />
                <Tab
                  icon={<MessageCircle size={18} />}
                  iconPosition="start"
                  label="Enlace de WhatsApp (+53)"
                  sx={{ minHeight: 54 }}
                />
                <Tab
                  icon={<Calculator size={18} />}
                  iconPosition="start"
                  label="Calculadora de precio"
                  sx={{ minHeight: 54 }}
                />
              </Tabs>
            </Box>

            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              {tab === 0 ? (
                <Grid container spacing={4} alignItems="center">
                  <Grid size={{ xs: 12, md: 7 }}>
                    <Stack spacing={2.5}>
                      <Typography variant="h5" component="h2" fontWeight={700}>
                        Generador de Código QR imprimible
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Pega el enlace de tu tienda TuVitrina, menú o tarjeta de contacto y descarga
                        el QR en PNG o SVG vectorial.
                      </Typography>
                      <TextField
                        label="Enlace o URL de destino"
                        value={qrInput}
                        onChange={(e) => setQrInput(e.target.value)}
                        placeholder="https://tuvitrina.cu/mi-bodega"
                      />
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                          component="input"
                          type="color"
                          aria-label="Color del código QR"
                          value={qrColor}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQrColor(e.target.value)}
                          sx={{
                            width: 48,
                            height: 44,
                            p: 0.5,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            cursor: 'pointer',
                            bgcolor: 'transparent',
                          }}
                        />
                        <TextField
                          label="Color hexadecimal"
                          size="small"
                          value={qrColor}
                          onChange={(e) => setQrColor(e.target.value)}
                          sx={{ width: 160 }}
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <Button
                          variant="contained"
                          startIcon={<Download size={18} />}
                          onClick={handleDownloadPng}
                          disabled={!qrPngUrl}
                        >
                          Descargar PNG
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<Download size={18} />}
                          onClick={handleDownloadSvg}
                          disabled={!qrSvg}
                        >
                          Descargar SVG vectorial
                        </Button>
                      </Stack>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Box
                      sx={{
                        p: 3,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: '#FFFFFF',
                        maxWidth: 260,
                        mx: 'auto',
                      }}
                    >
                      {qrPngUrl ? (
                        <Box
                          component="img"
                          src={qrPngUrl}
                          alt={`Código QR generado para ${qrInput}`}
                          sx={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                      ) : null}
                    </Box>
                  </Grid>
                </Grid>
              ) : null}

              {tab === 1 ? (
                <Stack spacing={3} maxWidth={680}>
                  <Box>
                    <Typography variant="h5" component="h2" fontWeight={700}>
                      Generador de enlace de WhatsApp (+53)
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                      Valida cualquier móvil cubano y crea un enlace directo para Instagram, Facebook o tarjetas.
                    </Typography>
                  </Box>

                  <TextField
                    label="Número móvil cubano"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="51234567 o +53 51234567"
                    error={Boolean(waPhone.trim()) && !normalizedWa}
                    helperText={
                      normalizedWa
                        ? `Número válido: ${normalizedWa}`
                        : 'Introduce 8 dígitos comenzando por 5 (ej. 51234567).'
                    }
                  />

                  <TextField
                    label="Mensaje automático sugerido"
                    multiline
                    minRows={2}
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                  />

                  {generatedWaLink ? (
                    <Alert severity="success" icon={<MessageCircle size={18} />}>
                      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                        Enlace generado listo para compartir:
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ wordBreak: 'break-all', fontFamily: 'monospace' }}
                      >
                        {generatedWaLink}
                      </Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mt={2}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={waCopied ? <Check size={16} /> : <Copy size={16} />}
                          onClick={handleCopyWa}
                        >
                          {waCopied ? '¡Copiado!' : 'Copiar enlace'}
                        </Button>
                        <Button
                          component="a"
                          href={generatedWaLink}
                          target="_blank"
                          rel="noreferrer"
                          variant="contained"
                          size="small"
                          startIcon={<ExternalLink size={16} />}
                          sx={{
                            bgcolor: WHATSAPP_BRAND_HEX,
                            color: '#091A10',
                            fontWeight: 700,
                            '&:hover': { bgcolor: '#1EBE5D' },
                          }}
                        >
                          Probar en WhatsApp
                        </Button>
                      </Stack>
                    </Alert>
                  ) : null}
                </Stack>
              ) : null}

              {tab === 2 ? (
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack spacing={2.5}>
                      <Typography variant="h5" component="h2" fontWeight={700}>
                        Calculadora de precio de venta
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Calcula el precio final cubriendo costos, empaque/mensajería, margen deseado y su equivalente en CUP, USD y MLC.
                      </Typography>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            select
                            label="Moneda base"
                            value={calcCurrency}
                            onChange={(e) => setCalcCurrency(e.target.value as CurrencyCode)}
                          >
                            {CURRENCIES.map((c) => (
                              <MenuItem key={c} value={c}>
                                {c}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            label="Costo del producto"
                            type="number"
                            value={costPrice}
                            onChange={(e) => setCostPrice(e.target.value)}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            label="Empaque / gastos"
                            type="number"
                            value={extraExpenses}
                            onChange={(e) => setExtraExpenses(e.target.value)}
                          />
                        </Grid>
                      </Grid>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="Margen de ganancia (%)"
                            type="number"
                            value={desiredMarginPercent}
                            onChange={(e) => setDesiredMarginPercent(e.target.value)}
                            helperText="Porcentaje sobre el precio final"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="Inflado p/ precio tachado (%)"
                            type="number"
                            value={anchorMarkupPercent}
                            onChange={(e) => setAnchorMarkupPercent(e.target.value)}
                            helperText="Opcional para ofertas"
                          />
                        </Grid>
                      </Grid>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            label="Tasa 1 USD en CUP"
                            type="number"
                            value={rateUsd}
                            onChange={(e) => setRateUsd(e.target.value)}
                          />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            label="Tasa 1 MLC en CUP"
                            type="number"
                            value={rateMlc}
                            onChange={(e) => setRateMlc(e.target.value)}
                          />
                        </Grid>
                      </Grid>
                    </Stack>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ bgcolor: 'background.default', height: '100%' }}>
                      <CardContent sx={{ p: 3 }}>
                        <Stack spacing={2}>
                          <Typography variant="overline" color="primary.main" fontWeight={700}>
                            RESULTADO SUGERIDO
                          </Typography>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Precio de venta recomendado
                            </Typography>
                            <Typography variant="h3" component="p" fontWeight={700} color="primary.main" className="tabular-nums">
                              {formatMoney(calcResult.sellingPrice, calcCurrency)}
                            </Typography>
                          </Box>

                          <Stack spacing={1} pt={1} borderTop="1px solid" borderColor="divider">
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="body2" color="text.secondary">
                                Costo total unitario
                              </Typography>
                              <Typography variant="body2" fontWeight={600} className="tabular-nums">
                                {formatMoney(calcResult.totalCost, calcCurrency)}
                              </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="body2" color="text.secondary">
                                Ganancia neta por unidad
                              </Typography>
                              <Typography variant="body2" fontWeight={700} color="success.main" className="tabular-nums">
                                +{formatMoney(calcResult.netProfit, calcCurrency)}
                              </Typography>
                            </Stack>
                            {calcResult.compareAtPrice ? (
                              <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2" color="text.secondary">
                                  Precio tachado sugerido (oferta)
                                </Typography>
                                <Typography variant="body2" className="tabular-nums" sx={{ textDecoration: 'line-through' }}>
                                  {formatMoney(calcResult.compareAtPrice, calcCurrency)}
                                </Typography>
                              </Stack>
                            ) : null}
                          </Stack>

                          <Box pt={1.5} borderTop="1px solid" borderColor="divider">
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                              Equivalente referencial por moneda
                            </Typography>
                            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                              <Typography variant="body2" className="tabular-nums">
                                <strong>CUP:</strong> {formatMoney(calcResult.inCup, 'CUP')}
                              </Typography>
                              <Typography variant="body2" className="tabular-nums">
                                <strong>USD:</strong> {formatMoney(calcResult.inUsd, 'USD')}
                              </Typography>
                              <Typography variant="body2" className="tabular-nums">
                                <strong>MLC:</strong> {formatMoney(calcResult.inMlc, 'MLC')}
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              ) : null}
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
