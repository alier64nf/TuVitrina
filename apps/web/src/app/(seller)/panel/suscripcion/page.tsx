'use client';

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  Grid2 as Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Crown, FileText, Image as ImageIcon, Sparkles, UploadCloud, XCircle } from 'lucide-react';
import {
  formatMoney,
  type CurrencyCode,
  type PlansConfigDto,
  type StoreSummaryDto,
  type SubscriptionRequestDto,
} from '@tuvitrina/contracts';
import { SellerShell } from '@/components/SellerShell';
import { useAuth } from '@/components/ThemeAndQueryProvider';
import { compressImageToWebP } from '@/lib/media/compressImage';

async function uploadToSignedUrl(
  signedUrl: string,
  blob: Blob,
  mimeType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl, true);
    xhr.setRequestHeader('Content-Type', mimeType);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Fallo de subida HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Error de red al subir la imagen.'));
    xhr.send(blob);
  });
}

export default function SuscripcionPage() {
  const { apiClient } = useAuth();
  const queryClient = useQueryClient();

  const [currency, setCurrency] = useState<CurrencyCode>('CUP');
  const [paymentMethodLabel, setPaymentMethodLabel] = useState('Transfermóvil');
  const [reference, setReference] = useState('');
  const [receiptKey, setReceiptKey] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const configQuery = useQuery<PlansConfigDto>({
    queryKey: ['plans-config'],
    queryFn: () => apiClient.getPlansConfig(),
  });

  const subsQuery = useQuery<SubscriptionRequestDto[]>({
    queryKey: ['my-subscriptions'],
    queryFn: () => apiClient.listMySubscriptions(),
  });

  const config = configQuery.data;
  const targetAmount = currency === 'USD' ? config?.proPriceUsd ?? 10 : config?.proPriceCup ?? 3000;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadProgress(10);

    try {
      const compressed = await compressImageToWebP(file);
      setUploadProgress(35);

      const signed = await apiClient.requestSignedUpload({
        bucket: 'store-assets',
        mimeType: compressed.mimeType,
        sizeBytes: compressed.sizeBytes,
      });

      setUploadProgress(50);

      await uploadToSignedUrl(signed.signedUrl, compressed.blob, compressed.mimeType, (pct) => {
        setUploadProgress(50 + Math.round(pct * 0.5));
      });

      setReceiptKey(signed.objectPath);
      setReceiptPreview(signed.publicUrl);
      setUploadProgress(null);
    } catch (err: any) {
      setUploadProgress(null);
      setUploadError(err.message || 'Error al procesar y subir el comprobante.');
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!receiptKey) throw new Error('Debes subir el comprobante de pago.');
      return apiClient.requestProSubscription({
        currency,
        amount: targetAmount,
        paymentMethodLabel,
        reference: reference.trim(),
        receiptObjectKey: receiptKey,
      });
    },
    onSuccess: () => {
      setFormSuccess(true);
      setReference('');
      setReceiptKey(null);
      setReceiptPreview(null);
      queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['seller-me'] });
    },
  });

  return (
    <SellerShell title="Planes y Suscripción PRO">
      {(store: StoreSummaryDto) => {
        const isPro = store.plan === 'pro';
        const daysRemaining = store.daysUntilPlanExpiration;

        return (
          <Stack spacing={4}>
            {/* Estado actual del Plan */}
            <Card
              sx={{
                border: '1px solid',
                borderColor: isPro ? 'primary.main' : 'divider',
                bgcolor: isPro ? 'primary.50' : 'background.paper',
              }}
            >
              <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      {isPro ? <Crown size={32} color="#00796B" /> : <Sparkles size={32} color="#757575" />}
                      <Box>
                        <Typography variant="h5" fontWeight={700}>
                          {isPro ? 'Tu tienda tiene Plan PRO Activo' : 'Tu tienda está en Plan Free (Gratuito)'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {isPro
                            ? `Vencimiento programado: ${store.planExpiresAt ? new Date(store.planExpiresAt).toLocaleDateString('es-CU', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Vigente'}`
                            : 'Disfruta de las funciones básicas sin costo. Pasa a PRO para catálogo sin límites.'}
                        </Typography>
                      </Box>
                    </Stack>

                    {isPro && typeof daysRemaining === 'number' ? (
                      <Box
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: 2,
                          bgcolor: daysRemaining <= 7 ? '#FFF3E0' : 'white',
                          border: '1px solid',
                          borderColor: daysRemaining <= 7 ? '#FFA726' : 'divider',
                          textAlign: 'center',
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" display="block">
                          Días restantes
                        </Typography>
                        <Typography
                          variant="h6"
                          fontWeight={700}
                          className="tabular-nums"
                          color={daysRemaining <= 1 ? '#D32F2F' : daysRemaining <= 7 ? '#E65100' : 'primary.main'}
                        >
                          {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}
                        </Typography>
                      </Box>
                    ) : null}
                  </Stack>

                  {isPro && typeof daysRemaining === 'number' && daysRemaining <= 7 ? (
                    <Alert severity={daysRemaining <= 1 ? 'error' : 'warning'}>
                      {daysRemaining <= 1
                        ? '¡Atención! Tu suscripción PRO vence hoy. Envía tu comprobante de renovación para evitar la degradación a Free.'
                        : `Tu suscripción PRO vence en ${daysRemaining} días. Puedes renovar ahora mismo enviando tu comprobante abajo.`}
                    </Alert>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            {/* Comparativa de Planes */}
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      Plan Free
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="text.primary" gutterBottom>
                      $0 CUP
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Para probar tu vitrina y comenzar a vender.
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Stack spacing={1.5}>
                      <Typography variant="body2">✓ Hasta {config?.freeLimits.maxProducts ?? 50} productos en catálogo</Typography>
                      <Typography variant="body2">✓ Hasta {config?.freeLimits.maxImagesPerProduct ?? 3} fotos por producto</Typography>
                      <Typography variant="body2">✓ Hasta {config?.freeLimits.maxCategories ?? 15} categorías</Typography>
                      <Typography variant="body2">✓ Pedidos armados directos a WhatsApp</Typography>
                      <Typography variant="body2">✓ Enlace corto único /{store.slug}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card
                  sx={{
                    height: '100%',
                    border: '2px solid',
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                    position: 'relative',
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6" fontWeight={700} color="primary.main">
                        Plan PRO
                      </Typography>
                      <Box px={1.5} py={0.5} bgcolor="primary.main" color="white" borderRadius={1} fontSize="0.75rem" fontWeight={700}>
                        RECOMENDADO
                      </Box>
                    </Stack>
                    <Typography variant="h4" fontWeight={700} color="primary.main" gutterBottom>
                      {formatMoney(config?.proPriceCup ?? 3000, 'CUP')} <Typography component="span" variant="body1" color="text.secondary">/ {config?.proDurationDays ?? 60} días</Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      O {formatMoney(config?.proPriceUsd ?? 10, 'USD')} para máxima capacidad y automatización.
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Stack spacing={1.5}>
                      <Typography variant="body2" fontWeight={600}>✓ Catálogo ilimitado ({config?.proLimits.maxProducts?.toLocaleString('es-CU') ?? '100,000'} productos)</Typography>
                      <Typography variant="body2" fontWeight={600}>✓ Hasta {config?.proLimits.maxImagesPerProduct ?? 10} fotos en alta resolución por producto</Typography>
                      <Typography variant="body2" fontWeight={600}>✓ Multimoneda oficial (CUP, USD y MLC con conversión automática)</Typography>
                      <Typography variant="body2" fontWeight={600}>✓ Integración con pasarela EnZona y pagos automatizados</Typography>
                      <Typography variant="body2" fontWeight={600}>✓ Zonas de entrega por municipio y costo personalizado</Typography>
                      <Typography variant="body2" fontWeight={600}>✓ Soporte técnico prioritario</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Formulario de Pago y Activación PRO */}
            <Card>
              <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      {isPro ? 'Renovar Plan PRO' : 'Activar Plan PRO por Pago Manual'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                      {config?.paymentInstructions ??
                        'Transfiere el monto a nuestra cuenta EnZona o Transfermóvil y sube la captura de pantalla de la transacción.'}
                    </Typography>
                  </Box>

                  {formSuccess ? (
                    <Alert severity="success" onClose={() => setFormSuccess(false)}>
                      ¡Solicitud de activación enviada con éxito! Nuestro equipo revisará el comprobante y tu tienda PRO se activará de inmediato.
                    </Alert>
                  ) : null}

                  {submitMutation.isError ? (
                    <Alert severity="error">
                      {submitMutation.error instanceof Error ? submitMutation.error.message : 'Error al enviar la solicitud.'}
                    </Alert>
                  ) : null}

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="currency-select-label">Moneda de pago</InputLabel>
                        <Select
                          labelId="currency-select-label"
                          value={currency}
                          label="Moneda de pago"
                          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                        >
                          <MenuItem value="CUP">CUP ({formatMoney(config?.proPriceCup ?? 3000, 'CUP')})</MenuItem>
                          <MenuItem value="USD">USD ({formatMoney(config?.proPriceUsd ?? 10, 'USD')})</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="method-select-label">Medio de pago</InputLabel>
                        <Select
                          labelId="method-select-label"
                          value={paymentMethodLabel}
                          label="Medio de pago"
                          onChange={(e) => setPaymentMethodLabel(e.target.value)}
                        >
                          <MenuItem value="Transfermóvil">Transfermóvil (+53 52000000)</MenuItem>
                          <MenuItem value="EnZona">EnZona (@tuvitrina)</MenuItem>
                          <MenuItem value="Transferencia Bancaria">Transferencia Bancaria</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label="Referencia o Código de Transacción"
                        placeholder="Ej. FT2601029302"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        fullWidth
                        size="small"
                        required
                        helperText="Aparece en el SMS o comprobante"
                      />
                    </Grid>
                  </Grid>

                  {/* Subida de Comprobante */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Comprobante de pago (captura o foto)
                    </Typography>

                    {receiptPreview ? (
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                          component="img"
                          src={receiptPreview}
                          alt="Comprobante subido"
                          sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 2, border: '1px solid #ccc' }}
                        />
                        <Box>
                          <Typography variant="body2" color="success.main" fontWeight={600} display="flex" alignItems="center" gap={0.5}>
                            <CheckCircle2 size={16} /> Comprobante cargado correctamente
                          </Typography>
                          <Button size="small" color="inherit" onClick={() => { setReceiptKey(null); setReceiptPreview(null); }}>
                            Cambiar imagen
                          </Button>
                        </Box>
                      </Stack>
                    ) : (
                      <Box
                        sx={{
                          border: '2px dashed',
                          borderColor: uploadError ? 'error.main' : 'divider',
                          borderRadius: 2,
                          p: 3,
                          textAlign: 'center',
                          bgcolor: 'background.default',
                        }}
                      >
                        <input
                          accept="image/*"
                          style={{ display: 'none' }}
                          id="receipt-file-upload"
                          type="file"
                          onChange={handleFileSelect}
                        />
                        <label htmlFor="receipt-file-upload">
                          <Button
                            variant="outlined"
                            component="span"
                            startIcon={<UploadCloud size={18} />}
                            disabled={uploadProgress !== null}
                          >
                            Seleccionar comprobante
                          </Button>
                        </label>
                        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                          Formatos aceptados: JPG, PNG o WebP. Se comprimirá automáticamente en tu dispositivo.
                        </Typography>

                        {uploadProgress !== null ? (
                          <Box mt={2}>
                            <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 6, borderRadius: 3 }} />
                            <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
                              Subiendo... {uploadProgress}%
                            </Typography>
                          </Box>
                        ) : null}

                        {uploadError ? (
                          <Typography variant="caption" color="error.main" display="block" mt={1}>
                            {uploadError}
                          </Typography>
                        ) : null}
                      </Box>
                    )}
                  </Box>

                  <Button
                    variant="contained"
                    size="large"
                    disabled={!reference.trim() || !receiptKey || submitMutation.isPending}
                    onClick={() => submitMutation.mutate()}
                    startIcon={submitMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <Crown size={18} />}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {submitMutation.isPending ? 'Enviando solicitud...' : 'Enviar comprobante para activar PRO'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Historial de Pagos y Solicitudes */}
            <Card>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="h6" fontWeight={700} mb={2}>
                  Historial de Pagos y Solicitudes PRO
                </Typography>

                {subsQuery.isLoading ? (
                  <CircularProgress size={24} />
                ) : (subsQuery.data?.length ?? 0) === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No has realizado solicitudes de pago previas.
                  </Typography>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Fecha</TableCell>
                          <TableCell>Monto</TableCell>
                          <TableCell>Medio</TableCell>
                          <TableCell>Referencia</TableCell>
                          <TableCell>Comprobante</TableCell>
                          <TableCell>Estado</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {subsQuery.data?.map((sub) => (
                          <TableRow key={sub.id}>
                            <TableCell className="tabular-nums">
                              {new Date(sub.createdAt).toLocaleDateString('es-CU')}
                            </TableCell>
                            <TableCell className="tabular-nums" sx={{ fontWeight: 600 }}>
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
                                  Ver foto
                                </Button>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell>
                              {sub.status === 'approved' ? (
                                <Box
                                  component="span"
                                  sx={{
                                    color: '#2E7D32',
                                    fontWeight: 700,
                                    fontSize: '0.8125rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                  }}
                                >
                                  <CheckCircle2 size={15} /> Aprobado
                                </Box>
                              ) : sub.status === 'rejected' ? (
                                <Stack spacing={0.25}>
                                  <Box
                                    component="span"
                                    sx={{
                                      color: '#D32F2F',
                                      fontWeight: 700,
                                      fontSize: '0.8125rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 0.5,
                                    }}
                                  >
                                    <XCircle size={15} /> Rechazado
                                  </Box>
                                  {sub.rejectionReason ? (
                                    <Typography variant="caption" color="text.secondary">
                                      Motivo: {sub.rejectionReason}
                                    </Typography>
                                  ) : null}
                                </Stack>
                              ) : (
                                <Box
                                  component="span"
                                  sx={{
                                    color: '#ED6C02',
                                    fontWeight: 700,
                                    fontSize: '0.8125rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                  }}
                                >
                                  <Clock size={15} /> En revisión
                                </Box>
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
          </Stack>
        );
      }}
    </SellerShell>
  );
}
