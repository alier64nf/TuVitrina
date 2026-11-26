import Link from 'next/link';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { TERMS_VERSION } from '@tuvitrina/contracts';

export default function PoliticaContenidoPage() {
  return (
    <Box id="contenido-principal" sx={{ minHeight: '100vh', py: 5, bgcolor: 'background.default' }}>
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Button component={Link} href="/" variant="text" sx={{ alignSelf: 'flex-start' }}>
            ← Volver al inicio
          </Button>
          <Card>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Stack spacing={2.5}>
                <Typography variant="h4" fontWeight={700}>
                  Política de Contenido y Convivencia de TuVitrina
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Versión vigente: {TERMS_VERSION} · Aplicable en todo el territorio de Cuba
                </Typography>

                <Typography variant="body1">
                  TuVitrina es una plataforma abierta concebida para apoyar a emprendedores, artesanos,
                  trabajadores por cuenta propia (TCP) y micro, pequeñas y medianas empresas (MIPYMES) cubanas.
                  Para garantizar un entorno seguro, legal y respetuoso para vendedores y compradores,
                  todos los catálogos y tiendas deben cumplir estrictamente las siguientes directrices.
                </Typography>

                <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
                  1. Artículos y Servicios Prohibidos
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Queda terminantemente prohibida la publicación, promoción o intermediación de:
                </Typography>
                <Stack spacing={1} pl={2}>
                  <Typography variant="body2">
                    • Armas de fuego, municiones, explosivos, pirotecnia o réplicas tácticas.
                  </Typography>
                  <Typography variant="body2">
                    • Sustancias psicotrópicas, estupefacientes, precursores o medicamentos sin prescripción ni autorización sanitaria del CECMED.
                  </Typography>
                  <Typography variant="body2">
                    • Especies de flora o fauna protegidas por regulaciones ambientales cubanas o en peligro de extinción.
                  </Typography>
                  <Typography variant="body2">
                    • Contenido para adultos, pornografía o explotación sexual.
                  </Typography>
                  <Typography variant="body2">
                    • Documentos de identidad falsificados, tarjetas SIM no autorizadas o servicios de suplantación.
                  </Typography>
                  <Typography variant="body2">
                    • Productos falsificados que usurpen marcas registradas de terceros sin la debida licencia.
                  </Typography>
                </Stack>

                <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
                  2. Honestidad Comercial y Precios Transparentes
                </Typography>
                <Typography variant="body2">
                  Los vendedores deben indicar precios reales en las monedas admitidas (CUP, USD o MLC).
                  No está permitida la publicidad engañosa, la manipulación arbitraria posterior del precio acordado
                  o la solicitud de pagos fraudulentos sin entrega de los productos o servicios ofrecidos.
                </Typography>

                <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
                  3. Moderación y Reportes Ciudadanos
                </Typography>
                <Typography variant="body2">
                  Cualquier visitante o comprador puede reportar una tienda o producto mediante el botón
                  «Reportar» visible en cada escaparate público. El equipo de soporte y administración
                  de TuVitrina revisa diariamente la cola de moderación y puede suspender temporal
                  o definitivamente las tiendas que violen estas normas sin derecho a reembolso de planes PRO.
                </Typography>

                <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
                  4. Canales de Contacto y Apelaciones
                </Typography>
                <Typography variant="body2">
                  Si consideras que tu tienda fue suspendida por error o deseas denunciar una infracción grave,
                  comunícate con nuestro equipo mediante soporte@tuvitrina.cu o a través de nuestros canales oficiales.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
