import Link from 'next/link';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { TERMS_VERSION } from '@tuvitrina/contracts';

export default function PrivacidadPage() {
  return (
    <Box component="main" id="contenido-principal" sx={{ minHeight: '100vh', py: 5, bgcolor: 'background.default' }}>
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Button component={Link} href="/entrar" variant="text" sx={{ alignSelf: 'flex-start' }}>
            ← Volver a entrar
          </Button>
          <Card>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                  Política de privacidad de TuVitrina
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Versión vigente: {TERMS_VERSION}
                </Typography>
                <Typography variant="body1">
                  1. Recopilamos únicamente los datos necesarios para operar tu cuenta de vendedor
                  (correo electrónico, nombre visible, número de WhatsApp del negocio y datos de tu
                  catálogo).
                </Typography>
                <Typography variant="body1">
                  2. Tus datos de negocio están aislados por tienda en el servidor y ningún otro
                  vendedor puede leer ni modificar tu información privada ni tus productos.
                </Typography>
                <Typography variant="body1">
                  3. Registramos la versión de los términos y la fecha en que los aceptaste para
                  respaldar el consentimiento de la cuenta.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
