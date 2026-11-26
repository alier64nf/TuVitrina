'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import {
  STORE_RUBROS,
  normalizeCubanWhatsApp,
  slugifyStoreName,
  validateStoreSlug,
} from '@tuvitrina/contracts';
import { useAuth } from '@/components/ThemeAndQueryProvider';
import { PageSkeleton, SupabaseSetupNotice } from '@/components/StateViews';
import { ES_CU } from '@/lib/i18n/es-cu';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, supabaseReady, apiClient } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(STORE_RUBROS[0]);
  const [whatsapp, setWhatsapp] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  const [slugCheckState, setSlugCheckState] = useState<{
    checking: boolean;
    available: boolean | null;
    reason?: string;
  }>({ checking: false, available: null });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && supabaseReady && !user) {
      router.replace('/entrar');
    }
  }, [authLoading, supabaseReady, user, router]);

  useEffect(() => {
    if (!user) return;
    apiClient
      .getMe()
      .then((me) => {
        if (me.store) {
          router.replace('/panel');
        }
      })
      .catch(() => undefined);
  }, [user, apiClient, router]);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyStoreName(name));
    }
  }, [name, slugTouched]);

  useEffect(() => {
    if (step !== 2 || !slug.trim()) {
      setSlugCheckState({ checking: false, available: null });
      return;
    }

    const local = validateStoreSlug(slug);
    if (!local.valid) {
      setSlugCheckState({ checking: false, available: false, reason: local.reason });
      return;
    }

    const timer = setTimeout(async () => {
      setSlugCheckState({ checking: true, available: null });
      try {
        const res = await apiClient.checkSlug(local.normalized);
        setSlugCheckState({
          checking: false,
          available: res.available,
          reason: res.reason,
        });
      } catch {
        setSlugCheckState({ checking: false, available: null });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [slug, step, apiClient]);

  const normalizedPhone = normalizeCubanWhatsApp(whatsapp);

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 0) {
      if (name.trim().length < 2) {
        setErrorMsg('El nombre de la tienda debe tener al menos 2 caracteres.');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!normalizedPhone) {
        setErrorMsg('Introduce un número móvil cubano válido (ej. 51234567 o +53 51234567).');
        return;
      }
      setStep(2);
    }
  };

  const handleCreateStore = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setErrorMsg(null);
    const local = validateStoreSlug(slug);
    if (!local.valid) {
      setErrorMsg(local.reason ?? 'Enlace no válido.');
      return;
    }
    if (!normalizedPhone) {
      setErrorMsg('Número móvil cubano inválido.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.createStore({
        name: name.trim(),
        category,
        whatsapp: normalizedPhone,
        slug: local.normalized,
      });
      router.replace('/panel');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo crear la tienda. Intenta de nuevo.',
      );
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <PageSkeleton />
      </Container>
    );
  }

  return (
    <Box
      component="main"
      id="contenido-principal"
      sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 3, md: 6 } }}
    >
      <Container maxWidth="sm">
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" component="h1">
              {ES_CU.onboarding.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {ES_CU.onboarding.subtitle}
            </Typography>
          </Box>

          {!supabaseReady ? <SupabaseSetupNotice /> : null}

          <Stepper activeStep={step} alternativeLabel>
            <Step>
              <StepLabel>{ES_CU.onboarding.step1}</StepLabel>
            </Step>
            <Step>
              <StepLabel>{ES_CU.onboarding.step2}</StepLabel>
            </Step>
            <Step>
              <StepLabel>{ES_CU.onboarding.step3}</StepLabel>
            </Step>
          </Stepper>

          <Card>
            <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Box component="form" onSubmit={handleCreateStore} noValidate>
                <Stack spacing={2.5}>
                  <Box aria-live="polite">
                    {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}
                  </Box>

                  {step === 0 ? (
                    <>
                      <TextField
                        label="Nombre de tu tienda"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Dulcería La Habana"
                      />
                      <TextField
                        select
                        label="Rubro principal"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        {STORE_RUBROS.map((rubro) => (
                          <MenuItem key={rubro} value={rubro}>
                            {rubro}
                          </MenuItem>
                        ))}
                      </TextField>
                    </>
                  ) : null}

                  {step === 1 ? (
                    <>
                      <TextField
                        label="Número de WhatsApp de pedidos"
                        required
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="Ej. 51234567 o +53 51234567"
                        helperText={
                          normalizedPhone
                            ? `Número verificado: ${normalizedPhone}`
                            : 'Solo móviles de Cuba que empiezan con 5 (8 dígitos).'
                        }
                      />
                    </>
                  ) : null}

                  {step === 2 ? (
                    <>
                      <TextField
                        label="Tu enlace corto único"
                        required
                        value={slug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setSlug(e.target.value.toLowerCase());
                        }}
                        placeholder="dulceria-la-habana"
                        helperText={
                          slugCheckState.checking
                            ? 'Comprobando disponibilidad...'
                            : slugCheckState.available === true
                              ? `Disponible: tuvitrina.cu/${slug}`
                              : slugCheckState.reason || `Vista previa: tuvitrina.cu/${slug || 'mi-tienda'}`
                        }
                        error={slugCheckState.available === false}
                      />
                    </>
                  ) : null}

                  <Stack direction="row" justifyContent="space-between" pt={1}>
                    <Button
                      type="button"
                      variant="text"
                      disabled={step === 0 || submitting}
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                    >
                      Atrás
                    </Button>

                    {step < 2 ? (
                      <Button type="button" variant="contained" onClick={handleNext}>
                        Siguiente
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        variant="contained"
                        color="secondary"
                        disabled={submitting || slugCheckState.available === false}
                      >
                        {submitting ? 'Creando tienda...' : ES_CU.onboarding.finish}
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
