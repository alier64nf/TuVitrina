import Link from 'next/link';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { TERMS_VERSION } from '@tuvitrina/contracts';

export default function TerminosPage() {
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
                  Términos de uso de TuVitrina
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Versión vigente: {TERMS_VERSION}
                </Typography>
                <Typography variant="body1">
                  1. TuVitrina ofrece a emprendedores y MIPYMES en Cuba herramientas digitales para
                  publicar catálogos en línea y organizar pedidos enviados por canales de mensajería.
                </Typography>
                <Typography variant="body1">
                  2. Cada vendedor es responsable de la veracidad de los precios, existencias,
                  descripciones, licencias comerciales y cumplimiento de las leyes vigentes aplicables
                  a los productos o servicios ofrecidos en su tienda.
                </Typography>
                <Typography variant="body1">
                  3. Está prohibida la publicación de artículos ilícitos, suplantación de identidad o
                  uso automatizado abusivo de la plataforma. TuVitrina puede suspender tiendas ante
                  incumplimientos verificados.
                </Typography>
                <Typography variant="body1">
                  4. Los enlaces cortos (slugs) son únicos por tienda y se asignan por orden de
                  registro verificado.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
