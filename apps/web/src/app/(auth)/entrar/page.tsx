'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  Divider,
  FormControlLabel,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { TERMS_VERSION } from '@tuvitrina/contracts';
import { useAuth } from '@/components/ThemeAndQueryProvider';
import { SupabaseSetupNotice } from '@/components/StateViews';
import { ES_CU } from '@/lib/i18n/es-cu';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type AuthMode = 'login' | 'register' | 'forgot';

export default function EntrarPage() {
  const router = useRouter();
  const { user, loading: authLoading, supabaseReady, apiClient } = useAuth();

  const [tab, setTab] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [busy, setBusy] = useState(false);
  const [syncingSession, setSyncingSession] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const syncAndRedirect = useCallback(
    async (fallbackName?: string) => {
      setSyncingSession(true);
      setErrorMsg(null);
      try {
        // Primero verificamos si ya existe perfil y tienda
        const me = await apiClient.getMe();
        router.replace(me.store ? '/panel' : '/onboarding');
        return;
      } catch {
        // Si aún no tiene fila en profiles, sincronizamos con aceptación explícita
      }

      try {
        const chosenName =
          fallbackName?.trim() ||
          (user?.user_metadata?.full_name as string | undefined) ||
          (user?.user_metadata?.name as string | undefined) ||
          user?.email?.split('@')[0] ||
          'Vendedor';
        const res = await apiClient.syncProfile({
          displayName: chosenName.slice(0, 100),
          termsAccepted: true,
          termsVersion: TERMS_VERSION,
        });
        router.replace(res.store ? '/panel' : '/onboarding');
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'No se pudo completar la activación de tu cuenta.',
        );
      } finally {
        setSyncingSession(false);
      }
    },
    [apiClient, router, user],
  );

  useEffect(() => {
    if (!authLoading && user && !syncingSession) {
      void syncAndRedirect();
    }
  }, [authLoading, user, syncingSession, syncAndRedirect]);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    if (!termsAccepted && tab === 'register') {
      setErrorMsg('Acepta los términos y la política de privacidad para continuar.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/entrar`,
      },
    });
    if (error) {
      setErrorMsg(error.message);
      setBusy(false);
    }
  };

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    if (tab === 'forgot') {
      if (!email.trim()) {
        setErrorMsg('Escribe tu correo para enviarte el enlace de recuperación.');
        return;
      }
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/entrar/restablecer`,
      });
      setBusy(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setInfoMsg(ES_CU.auth.resetSent);
      }
      return;
    }

    if (tab === 'register') {
      if (displayName.trim().length < 2) {
        setErrorMsg('Escribe tu nombre o apodo (mínimo 2 caracteres).');
        return;
      }
      if (!termsAccepted) {
        setErrorMsg('Debes aceptar los términos y la política de privacidad.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      setBusy(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/entrar`,
          data: {
            full_name: displayName.trim(),
            terms_version: TERMS_VERSION,
          },
        },
      });
      setBusy(false);

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (data.session) {
        await syncAndRedirect(displayName.trim());
      } else {
        setInfoMsg(ES_CU.auth.verifySent);
      }
      return;
    }

    // Login
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setErrorMsg('Correo o contraseña incorrectos, o cuenta aún sin verificar.');
    }
  };

  return (
    <Box
      id="contenido-principal"
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={3}>
          <Box textAlign="center">
            <Typography
              component={Link}
              href="/"
              variant="h4"
              color="primary.main"
              sx={{ textDecoration: 'none' }}
            >
              {ES_CU.brand}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Panel para vendedores en Cuba
            </Typography>
          </Box>

          {!supabaseReady ? <SupabaseSetupNotice /> : null}

          <Card>
            <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Tabs
                value={tab}
                onChange={(_e, val: AuthMode) => {
                  setTab(val);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                variant="fullWidth"
                sx={{ mb: 3 }}
              >
                <Tab value="login" label={ES_CU.auth.loginTab} />
                <Tab value="register" label={ES_CU.auth.registerTab} />
                <Tab value="forgot" label={ES_CU.auth.forgotTab} />
              </Tabs>

              {errorMsg ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errorMsg}
                </Alert>
              ) : null}
              {infoMsg ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {infoMsg}
                </Alert>
              ) : null}

              {tab !== 'forgot' ? (
                <Stack spacing={2} mb={2.5}>
                  <Button
                    variant="outlined"
                    size="large"
                    disabled={!supabaseReady || busy || syncingSession}
                    onClick={handleGoogleLogin}
                  >
                    {ES_CU.auth.googleCta}
                  </Button>
                  <Divider>o con correo</Divider>
                </Stack>
              ) : null}

              <Box component="form" onSubmit={handleSubmit} noValidate>
                <Stack spacing={2}>
                  {tab === 'register' ? (
                    <TextField
                      label={ES_CU.auth.nameLabel}
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoComplete="name"
                    />
                  ) : null}

                  <TextField
                    label={ES_CU.auth.emailLabel}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />

                  {tab !== 'forgot' ? (
                    <TextField
                      label={ES_CU.auth.passwordLabel}
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                    />
                  ) : null}

                  {tab === 'register' ? (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {ES_CU.auth.termsPrefix}
                          <Link href="/terminos" target="_blank">
                            {ES_CU.auth.termsLink}
                          </Link>
                          {ES_CU.auth.termsMiddle}
                          <Link href="/privacidad" target="_blank">
                            {ES_CU.auth.privacyLink}
                          </Link>{' '}
                          ({TERMS_VERSION}).
                        </Typography>
                      }
                    />
                  ) : null}

                  <Button
                    type="submit"
                    variant="contained"
                    color="secondary"
                    size="large"
                    disabled={!supabaseReady || busy || syncingSession}
                  >
                    {syncingSession
                      ? 'Preparando tu cuenta...'
                      : busy
                        ? 'Procesando...'
                        : tab === 'login'
                          ? 'Entrar a mi tienda'
                          : tab === 'register'
                            ? 'Crear cuenta'
                            : 'Enviar enlace de recuperación'}
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
