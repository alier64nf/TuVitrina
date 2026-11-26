'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid2 as Grid,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  CheckCircle2,
  Download,
  Globe,
  MessageCircle,
  Moon,
  Palette,
  QrCode as QrCodeIcon,
  Sun,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import QRCode from 'qrcode';
import type {
  ProductImageRef,
  StoreFontPreset,
  StoreSummaryDto,
  StoreThemeConfig,
} from '@tuvitrina/contracts';
import { SellerShell } from '@/components/SellerShell';
import { StoreThemeWrapper } from '@/components/StoreThemeWrapper';
import { useAuth } from '@/components/ThemeAndQueryProvider';
import { compressImageToWebP, uploadToSignedUrl } from '@/lib/media/compressImage';
import {
  FONT_PRESET_OPTIONS,
  ORDER_STATUS_COLORS,
  WHATSAPP_BRAND_HEX,
  inspectThemeContrast,
} from '@/lib/theme/m3Theme';

const SEED_PRESETS = [
  { label: 'Esmeralda', hex: '#00796B' },
  { label: 'Azul Caribe', hex: '#1565C0' },
  { label: 'Terracota', hex: '#C64720' },
  { label: 'Ciruela', hex: '#7B1FA2' },
  { label: 'Bosque', hex: '#2E7D32' },
  { label: 'Café', hex: '#5D4037' },
];

function PersonalizacionManager({ store }: { store: StoreSummaryDto }) {
  const { apiClient } = useAuth();
  const queryClient = useQueryClient();

  const initialTheme: StoreThemeConfig = store.theme ?? {
    seedColor: '#00796B',
    mode: 'light',
    fontFamily: 'outfit',
    logo: null,
    cover: null,
  };

  const [seedColor, setSeedColor] = useState(initialTheme.seedColor || '#00796B');
  const [mode, setMode] = useState<'light' | 'dark'>(initialTheme.mode === 'dark' ? 'dark' : 'light');
  const [fontFamily, setFontFamily] = useState<StoreFontPreset>(initialTheme.fontFamily || 'outfit');
  const [logo, setLogo] = useState<ProductImageRef | null>(initialTheme.logo ?? null);
  const [cover, setCover] = useState<ProductImageRef | null>(initialTheme.cover ?? null);

  const [uploadingTarget, setUploadingTarget] = useState<'logo' | 'cover' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [qrPngUrl, setQrPngUrl] = useState<string>('');

  const storePublicUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/${store.slug}`;
    }
    return `https://tuvitrina.cu/${store.slug}`;
  }, [store.slug]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [svg, png] = await Promise.all([
          QRCode.toString(storePublicUrl, { type: 'svg', margin: 1, width: 220 }),
          QRCode.toDataURL(storePublicUrl, { margin: 2, width: 512 }),
        ]);
        if (active) {
          setQrSvg(svg);
          setQrPngUrl(png);
        }
      } catch {
        // Ignorar fallo de render local
      }
    })();
    return () => {
      active = false;
    };
  }, [storePublicUrl]);

  const contrastReport = useMemo(
    () => inspectThemeContrast(mode, seedColor),
    [mode, seedColor],
  );

  const previewThemeConfig: StoreThemeConfig = useMemo(
    () => ({
      seedColor: /^#[0-9A-Fa-f]{6}$/.test(seedColor) ? seedColor : '#00796B',
      mode,
      fontFamily,
      logo,
      cover,
    }),
    [seedColor, mode, fontFamily, logo, cover],
  );

  const handleUploadAsset = async (
    target: 'logo' | 'cover',
    evt: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = evt.target.files?.[0];
    evt.target.value = '';
    if (!file) return;

    setUploadingTarget(target);
    setErrorMsg(null);
    setSaveMessage(null);

    try {
      const compressed = await compressImageToWebP(file);
      const signed = await apiClient.requestSignedUpload({
        bucket: 'store-assets',
        mimeType: compressed.mimeType,
        sizeBytes: compressed.sizeBytes,
      });
      await uploadToSignedUrl(signed.signedUrl, compressed.blob, compressed.mimeType, () => undefined);
      const ref: ProductImageRef = {
        objectPath: signed.objectPath,
        publicUrl: signed.publicUrl,
        alt: target === 'logo' ? `Logo de ${store.name}` : `Portada de ${store.name}`,
      };
      if (target === 'logo') setLogo(ref);
      else setCover(ref);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleSaveTheme = async () => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(seedColor)) {
      setErrorMsg('Introduce un color hexadecimal válido (ej. #00796B).');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    setSaveMessage(null);
    try {
      await apiClient.updateStoreTheme(previewThemeConfig);
      await queryClient.invalidateQueries({ queryKey: ['seller-me'] });
      setSaveMessage('Apariencia guardada y aplicada en tu tienda pública.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error guardando la apariencia.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadQrPng = () => {
    if (!qrPngUrl) return;
    const a = document.createElement('a');
    a.href = qrPngUrl;
    a.download = `qr-${store.slug}.png`;
    a.click();
  };

  const handleDownloadQrSvg = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${store.slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={3}>
      {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}
      {saveMessage ? <Alert severity="success">{saveMessage}</Alert> : null}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Stack spacing={2.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Palette size={20} />
                    <Typography variant="h6">Color, modo y tipografía</Typography>
                  </Stack>

                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Color semilla Material Design 3
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} alignItems="center">
                      <Box
                        component="input"
                        type="color"
                        aria-label="Selector de color semilla"
                        value={/^#[0-9A-Fa-f]{6}$/.test(seedColor) ? seedColor : '#00796B'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setSeedColor(e.target.value.toUpperCase())
                        }
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
                        size="small"
                        value={seedColor}
                        onChange={(e) => setSeedColor(e.target.value.toUpperCase())}
                        sx={{ width: 130 }}
                      />
                      {SEED_PRESETS.map((preset) => (
                        <Button
                          key={preset.hex}
                          size="small"
                          variant={seedColor.toUpperCase() === preset.hex ? 'contained' : 'outlined'}
                          onClick={() => setSeedColor(preset.hex)}
                          sx={{
                            minHeight: 36,
                            px: 1.25,
                            borderColor: preset.hex,
                            bgcolor:
                              seedColor.toUpperCase() === preset.hex ? preset.hex : 'transparent',
                            color:
                              seedColor.toUpperCase() === preset.hex ? '#FFFFFF' : 'text.primary',
                          }}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Modo visual de la tienda
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      value={mode}
                      onChange={(_e, val) => {
                        if (val) setMode(val);
                      }}
                      fullWidth
                    >
                      <ToggleButton value="light">
                        <Sun size={16} style={{ marginRight: 8 }} />
                        Modo claro
                      </ToggleButton>
                      <ToggleButton value="dark">
                        <Moon size={16} style={{ marginRight: 8 }} />
                        Modo oscuro
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  <TextField
                    select
                    label="Tipografía autoalojada (4 opciones)"
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value as StoreFontPreset)}
                  >
                    {FONT_PRESET_OPTIONS.map((opt) => (
                      <MenuItem key={opt.id} value={opt.id}>
                        {opt.label} — {opt.description}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                      <CheckCircle2 size={16} color="#00796B" />
                      <Typography variant="subtitle2" fontWeight={700}>
                        Verificación automática de contraste WCAG AA
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Botón principal: {contrastReport.primaryButtonRatio}:1 · Enlace sobre fondo:{' '}
                      {contrastReport.primaryOnBgRatio}:1 · Texto principal: {contrastReport.textOnBgRatio}:1
                    </Typography>
                    {contrastReport.autoAdjusted ? (
                      <Typography variant="caption" color="primary.main" fontWeight={600} display="block" mt={0.5}>
                        Tono ajustado automáticamente para garantizar lectura nítida (mínimo 4.5:1).
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={2.5}>
                  <Typography variant="h6">Logo y portada de tienda</Typography>

                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          borderRadius: 2,
                          bgcolor: 'action.hover',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        {logo?.publicUrl ? (
                          <Box
                            component="img"
                            src={logo.publicUrl}
                            alt="Logo"
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Typography fontWeight={700}>{store.name.slice(0, 2).toUpperCase()}</Typography>
                        )}
                      </Box>
                      <Box>
                        <Typography variant="subtitle2">Logo cuadrado</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Se comprime a WebP automáticamente.
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      {logo ? (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => setLogo(null)}
                          startIcon={<Trash2 size={14} />}
                        >
                          Quitar
                        </Button>
                      ) : null}
                      <Button
                        component="label"
                        size="small"
                        variant="outlined"
                        disabled={uploadingTarget !== null}
                        startIcon={<UploadCloud size={14} />}
                      >
                        {uploadingTarget === 'logo' ? 'Subiendo...' : 'Subir'}
                        <input
                          hidden
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => void handleUploadAsset('logo', e)}
                        />
                      </Button>
                    </Stack>
                  </Stack>

                  <Divider />

                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle2">Imagen de portada (banner)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Recomendado formato horizontal 16:9.
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        {cover ? (
                          <Button
                            size="small"
                            color="error"
                            onClick={() => setCover(null)}
                            startIcon={<Trash2 size={14} />}
                          >
                            Quitar
                          </Button>
                        ) : null}
                        <Button
                          component="label"
                          size="small"
                          variant="outlined"
                          disabled={uploadingTarget !== null}
                          startIcon={<UploadCloud size={14} />}
                        >
                          {uploadingTarget === 'cover' ? 'Subiendo...' : 'Subir'}
                          <input
                            hidden
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => void handleUploadAsset('cover', e)}
                          />
                        </Button>
                      </Stack>
                    </Stack>
                    {cover?.publicUrl ? (
                      <Box
                        component="img"
                        src={cover.publicUrl}
                        alt="Portada"
                        sx={{
                          width: '100%',
                          height: 120,
                          objectFit: 'cover',
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    ) : null}
                  </Stack>

                  <Button
                    variant="contained"
                    color="secondary"
                    size="large"
                    disabled={saving || uploadingTarget !== null}
                    onClick={() => void handleSaveTheme()}
                  >
                    {saving ? 'Guardando cambios...' : 'Guardar apariencia de la tienda'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Vista previa en vivo
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  El botón de WhatsApp, los estados del pedido y los avisos de error mantienen sus
                  colores fijos para seguridad del comprador.
                </Typography>

                <Box
                  sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <StoreThemeWrapper themeConfig={previewThemeConfig}>
                    <Box sx={{ minHeight: 'auto', p: 2.5 }}>
                      {cover?.publicUrl ? (
                        <Box
                          component="img"
                          src={cover.publicUrl}
                          alt="Portada"
                          sx={{
                            width: '100%',
                            height: 110,
                            objectFit: 'cover',
                            borderRadius: 2,
                            mb: 2,
                          }}
                        />
                      ) : null}

                      <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            overflow: 'hidden',
                          }}
                        >
                          {logo?.publicUrl ? (
                            <Box
                              component="img"
                              src={logo.publicUrl}
                              alt="Logo"
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            store.name.slice(0, 2).toUpperCase()
                          )}
                        </Box>
                        <Box>
                          <Typography variant="h6">{store.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {store.category} · /{store.slug}
                          </Typography>
                        </Box>
                      </Stack>

                      <Card sx={{ mb: 2 }}>
                        <CardContent sx={{ p: 2 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography variant="subtitle1" fontWeight={700}>
                                Producto de muestra
                              </Typography>
                              <Typography variant="body2" color="primary.main" fontWeight={700}>
                                1,250 {store.baseCurrency}
                              </Typography>
                            </Box>
                            <Button variant="contained" color="primary" size="small">
                              Agregar
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>

                      <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} alignItems="center">
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<MessageCircle size={15} />}
                          sx={{
                            bgcolor: WHATSAPP_BRAND_HEX,
                            color: '#0A2E1A',
                            '&:hover': { bgcolor: '#20BD5A' },
                          }}
                        >
                          WhatsApp fijo
                        </Button>
                        <Box
                          sx={{
                            px: 1.25,
                            py: 0.5,
                            borderRadius: 1,
                            fontSize: 12,
                            fontWeight: 700,
                            bgcolor: `${ORDER_STATUS_COLORS.confirmed.color}20`,
                            color: ORDER_STATUS_COLORS.confirmed.color,
                          }}
                        >
                          Estado fijo: Confirmado
                        </Box>
                      </Stack>

                      <Alert severity="error" sx={{ mt: 2 }}>
                        Ejemplo de error con color fijo accesible.
                      </Alert>
                    </Box>
                  </StoreThemeWrapper>
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <QrCodeIcon size={20} />
                    <Typography variant="h6">Código QR de tu tienda</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Imprímelo para tu local, tarjetas o envíos. Apunta a <strong>/{store.slug}</strong>.
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems="center">
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: '#FFFFFF',
                        border: '1px solid',
                        borderColor: 'divider',
                        width: 168,
                        height: 168,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {qrPngUrl ? (
                        <Box
                          component="img"
                          src={qrPngUrl}
                          alt={`QR de ${store.name}`}
                          sx={{ width: '100%', height: '100%' }}
                        />
                      ) : null}
                    </Box>
                    <Stack spacing={1.5} flexGrow={1}>
                      <Button
                        variant="outlined"
                        startIcon={<Download size={16} />}
                        disabled={!qrPngUrl}
                        onClick={handleDownloadQrPng}
                      >
                        Descargar PNG (Alta calidad)
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Download size={16} />}
                        disabled={!qrSvg}
                        onClick={handleDownloadQrSvg}
                      >
                        Descargar SVG (Vectorial)
                      </Button>
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Globe size={20} aria-hidden="true" />
                    <Typography variant="h6">Dominio propio (Plan PRO)</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    En producción con proxy TLS multi-inquilino (Cloudflare / Caddy / Vercel Domains),
                    las tiendas PRO pueden conectar un dominio como <strong>tienda.midominio.cu</strong>{' '}
                    mediante estos registros DNS:
                  </Typography>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                    }}
                  >
                    CNAME tienda → cname.tuvitrina.cu
                    <br />
                    TXT _tuvitrina-verify → tv-verify={store.slug}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Nota del entorno actual: este sandbox de vista previa no permite enlazar certificados
                    TLS personalizados dinámicamente, por lo que tu tienda opera en{' '}
                    <strong>/{store.slug}</strong>. Consulta la guía completa en el{' '}
                    <Link href="/ayuda#tema-10">Centro de ayuda</Link>.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default function PersonalizacionPage() {
  return (
    <SellerShell title="Apariencia y QR">
      {(store) => <PersonalizacionManager store={store} />}
    </SellerShell>
  );
}
