'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function RestablecerClavePage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setErrorMsg(null);
    if (password.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMsg('Supabase no está configurado en el entorno.');
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.replace('/entrar'), 1400);
  };

  return (
    <Box
      id="contenido-principal"
      sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}
    >
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={2.5}>
              <Typography variant="h5">Nueva contraseña</Typography>
              {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}
              {done ? (
                <Alert severity="success">
                  Contraseña actualizada. Redirigiendo al inicio de sesión...
                </Alert>
              ) : null}
              <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Nueva contraseña"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <TextField
                    label="Repite la contraseña"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <Button type="submit" variant="contained" color="secondary" disabled={busy}>
                    {busy ? 'Guardando...' : 'Actualizar contraseña'}
                  </Button>
                  <Button component={Link} href="/entrar" variant="text">
                    Volver a entrar
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
