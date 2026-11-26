'use client';

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Flag } from 'lucide-react';
import { TuVitrinaApiClient } from '@tuvitrina/contracts';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  storeName: string;
  targetType: 'store' | 'product';
  productId?: string | null;
  productName?: string | null;
}

const COMMON_REASONS = [
  'Contenido prohibido o ilícito',
  'Posible estafa o fraude',
  'Publicidad o precio engañoso',
  'Suplantación de identidad o marca comercial',
  'Artículos médicos o sustancias no autorizadas',
  'Tienda abandonada o sin respuesta',
  'Otro motivo',
];

export function ReportModal({
  open,
  onClose,
  slug,
  storeName,
  targetType,
  productId,
  productName,
}: ReportModalProps) {
  const [reason, setReason] = useState(COMMON_REASONS[0]);
  const [details, setDetails] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (details.trim().length < 5) {
      setErrorMsg('Por favor describe con más detalle el problema (mínimo 5 caracteres).');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const client = new TuVitrinaApiClient(
        process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '') || '',
        async () => null,
      );
      await client.reportStoreOrProduct(slug, {
        targetType,
        productId: productId ?? null,
        reason,
        details: details.trim(),
        reporterContact: contact.trim() || null,
      });
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo enviar el reporte. Por favor inténtalo nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setSuccess(false);
      setErrorMsg(null);
      setDetails('');
      setContact('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Flag size={20} color="#DC2626" />
        Reportar {targetType === 'product' ? 'producto' : 'tienda'}
      </DialogTitle>
      <DialogContent dividers>
        {success ? (
          <Stack spacing={2} py={2}>
            <Alert severity="success">
              ¡Gracias por tu reporte! Tu denuncia ha sido registrada en nuestra cola de moderación.
              Revisamos cada aviso para mantener a TuVitrina segura y confiable.
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Si dejaste tus datos de contacto, nuestro equipo de soporte podría comunicarse contigo
              si requiere información adicional.
            </Typography>
          </Stack>
        ) : (
          <Box component="form" id="report-form" onSubmit={handleSubmit}>
            <Stack spacing={2.5} pt={1}>
              <Typography variant="body2" color="text.secondary">
                Estás reportando {targetType === 'product' ? `el producto «${productName ?? ''}» de` : 'la tienda'}{' '}
                <strong>{storeName}</strong>.
              </Typography>

              {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}

              <FormControl fullWidth size="small">
                <InputLabel id="reason-select-label">Motivo principal</InputLabel>
                <Select
                  labelId="reason-select-label"
                  value={reason}
                  label="Motivo principal"
                  onChange={(e) => setReason(e.target.value)}
                >
                  {COMMON_REASONS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Detalles o explicación"
                multiline
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Explica detalladamente qué ocurre y por qué incumple las políticas..."
                helperText="Mínimo 5 caracteres. Sé lo más específico posible."
                required
                fullWidth
              />

              <TextField
                label="Tu teléfono o correo (opcional)"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="+53 5XXXXXXX o correo@ejemplo.com"
                helperText="Solo se usará para notificarte o aclarar el reporte."
                fullWidth
                size="small"
              />
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {success ? (
          <Button onClick={handleClose} variant="contained">
            Entendido
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={submitting} color="inherit">
              Cancelar
            </Button>
            <Button
              type="submit"
              form="report-form"
              variant="contained"
              color="error"
              disabled={submitting || details.trim().length < 5}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Flag size={16} />}
            >
              {submitting ? 'Enviando...' : 'Enviar reporte'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
