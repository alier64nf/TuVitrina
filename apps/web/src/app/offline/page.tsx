'use client';

import React from 'react';
import Link from 'next/link';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { RefreshCw, Store, WifiOff } from 'lucide-react';

export default function OfflineFallbackPage() {
  return (
    <Box
      component="main"
      id="contenido-principal"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
        py: 6,
      }}
    >
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
            <Stack spacing={2.5} alignItems="center">
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 4,
                  bgcolor: 'warning.light',
                  color: 'warning.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <WifiOff size={32} aria-hidden="true" />
              </Box>
              <Typography variant="h4" component="h1">
                Sin conexión en este momento
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Esta página aún no se ha guardado en la caché de tu dispositivo. Si ya visitaste una
                tienda antes, puedes volver a abrirla y explorar su catálogo sin internet; los pedidos
                se guardarán en cola y se enviarán solos al reconectar.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} width="100%" justifyContent="center">
                <Button
                  variant="contained"
                  startIcon={<RefreshCw size={18} />}
                  onClick={() => window.location.reload()}
                >
                  Reintentar ahora
                </Button>
                <Button
                  component={Link}
                  href="/"
                  variant="outlined"
                  startIcon={<Store size={18} />}
                >
                  Ir al inicio
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
