'use client';

import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  type ButtonProps,
} from '@mui/material';
import { Download, Share, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/lib/pwa/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: ButtonProps['variant'];
  color?: ButtonProps['color'];
  size?: ButtonProps['size'];
  label?: string;
}

export function PWAInstallButton({
  variant = 'outlined',
  color = 'primary',
  size = 'medium',
  label = 'Instalar app',
}: PWAInstallButtonProps) {
  const { canPrompt, isIos, isInstalled, triggerInstall } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    const res = await triggerInstall();
    if (res !== 'prompted') {
      setGuideOpen(true);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        color={color}
        size={size}
        startIcon={<Download size={18} />}
        onClick={handleClick}
        aria-label="Instalar TuVitrina como aplicación en tu teléfono o computadora"
      >
        {label}
      </Button>

      <Dialog open={guideOpen} onClose={() => setGuideOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Instalar TuVitrina en tu dispositivo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={0.5}>
            {isIos ? (
              <>
                <Typography variant="body2">
                  En iPhone o iPad (Safari), instala la app en 2 pasos para abrir tiendas incluso
                  con mala conexión:
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Share size={20} />
                  <Typography variant="body2">
                    1. Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Smartphone size={20} />
                  <Typography variant="body2">
                    2. Elige <strong>Añadir a pantalla de inicio</strong> y confirma.
                  </Typography>
                </Stack>
              </>
            ) : (
              <>
                <Typography variant="body2">
                  Puedes instalar TuVitrina directamente desde el menú de tu navegador:
                </Typography>
                <Typography variant="body2">
                  • En <strong>Chrome / Edge / Android</strong>: abre el menú (⋮) y selecciona{' '}
                  <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.
                </Typography>
                {!canPrompt ? (
                  <Typography variant="caption" color="text.secondary">
                    Si ya la instalaste o estás en navegación privada, la opción de instalación directa
                    puede no mostrarse.
                  </Typography>
                ) : null}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGuideOpen(false)} variant="contained">
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
