import React from 'react';
import Link from 'next/link';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { Home, HelpCircle } from 'lucide-react';

export default function NotFoundPage() {
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
              <Typography variant="h2" component="p" color="primary.main" fontWeight={700}>
                404
              </Typography>
              <Typography variant="h4" component="h1">
                Página o tienda no encontrada
              </Typography>
              <Typography variant="body1" color="text.secondary">
                El enlace que intentaste abrir no existe o fue modificado. Revisa la dirección o
                vuelve al inicio de TuVitrina.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
                <Button component={Link} href="/" variant="contained" startIcon={<Home size={18} />}>
                  Ir al inicio
                </Button>
                <Button component={Link} href="/ayuda" variant="outlined" startIcon={<HelpCircle size={18} />}>
                  Centro de ayuda
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
