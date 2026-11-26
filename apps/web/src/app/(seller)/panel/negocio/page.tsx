'use client';

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Grid2 as Grid,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import {
  CUBA_MUNICIPALITIES,
  CUBA_PROVINCES,
  STORE_RUBROS,
  WEEK_DAYS,
  createDefaultWeeklyHours,
  type StoreSummaryDto,
  type WeeklyHours,
} from '@tuvitrina/contracts';
import { SellerShell } from '@/components/SellerShell';
import { useAuth } from '@/components/ThemeAndQueryProvider';

function BusinessProfileEditor({ store }: { store: StoreSummaryDto }) {
  const { apiClient } = useAuth();
  const queryClient = useQueryClient();

  const initialHours = (store.hours ?? {}) as {
    weekly?: WeeklyHours;
    instagram?: string | null;
    facebook?: string | null;
    responseTime?: string | null;
  };

  const [name, setName] = useState(store.name);
  const [category, setCategory] = useState(store.category);
  const [description, setDescription] = useState(store.description ?? '');
  const [whatsapp, setWhatsapp] = useState(store.whatsapp);
  const [telegram, setTelegram] = useState(store.telegram ?? '');
  const [province, setProvince] = useState(store.province || 'La Habana');
  const [municipality, setMunicipality] = useState(
    store.municipality || CUBA_MUNICIPALITIES[store.province || 'La Habana']?.[0] || 'Playa',
  );
  const [streetAddress, setStreetAddress] = useState(store.streetAddress ?? '');
  const [instagram, setInstagram] = useState(initialHours.instagram ?? '');
  const [facebook, setFacebook] = useState(initialHours.facebook ?? '');
  const [responseTime, setResponseTime] = useState(
    initialHours.responseTime ?? 'Menos de 15 minutos',
  );
  const [weekly, setWeekly] = useState<WeeklyHours>(
    initialHours.weekly ?? createDefaultWeeklyHours(),
  );

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const municipalities = CUBA_MUNICIPALITIES[province] ?? [];

  const handleProvinceChange = (nextProv: string) => {
    setProvince(nextProv);
    const list = CUBA_MUNICIPALITIES[nextProv] ?? [];
    setMunicipality(list[0] ?? '');
  };

  const handleSave = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSavedOk(false);
    try {
      await apiClient.updateBusinessProfile({
        name: name.trim(),
        category,
        description: description.trim() || null,
        whatsapp: whatsapp.trim(),
        telegram: telegram.trim() || null,
        province,
        municipality,
        streetAddress: streetAddress.trim() || null,
        hours: {
          weekly,
          instagram: instagram.trim() || null,
          facebook: facebook.trim() || null,
          responseTime: responseTime.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['seller-me'] });
      setSavedOk(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSave} noValidate>
      <Stack spacing={3}>
        {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}
        {savedOk ? (
          <Alert severity="success">Perfil del negocio guardado correctamente.</Alert>
        ) : null}

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h6">Información general</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Nombre de la tienda"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    label="Rubro"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {STORE_RUBROS.map((rubro) => (
                      <MenuItem key={rubro} value={rubro}>
                        {rubro}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <TextField
                label="Descripción del negocio"
                multiline
                minRows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h6">Dirección en Cuba</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    label="Provincia"
                    value={province}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                  >
                    {CUBA_PROVINCES.map((p) => (
                      <MenuItem key={p} value={p}>
                        {p}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    label="Municipio"
                    value={municipality}
                    onChange={(e) => setMunicipality(e.target.value)}
                  >
                    {municipalities.map((m) => (
                      <MenuItem key={m} value={m}>
                        {m}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <TextField
                label="Dirección / referencia de recogida"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="Ej. Calle 23 e/ L y M, Vedado"
              />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h6">Contacto, redes y tiempo de respuesta</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="WhatsApp de pedidos (+53)"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Telegram (@usuario, opcional)"
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    placeholder="@mitienda_cu"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Instagram (opcional)"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@mitienda"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Facebook (opcional)"
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Tiempo de respuesta habitual"
                    value={responseTime}
                    onChange={(e) => setResponseTime(e.target.value)}
                  />
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Horarios de atención por día</Typography>
              {WEEK_DAYS.map((day) => {
                const entry = weekly[day.key];
                return (
                  <Grid container key={day.key} spacing={1.5} alignItems="center">
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={entry.open}
                            onChange={(e) =>
                              setWeekly((prev) => ({
                                ...prev,
                                [day.key]: { ...prev[day.key], open: e.target.checked },
                              }))
                            }
                          />
                        }
                        label={day.label}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <TextField
                        size="small"
                        type="time"
                        label="Abre"
                        disabled={!entry.open}
                        value={entry.from}
                        onChange={(e) =>
                          setWeekly((prev) => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], from: e.target.value },
                          }))
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <TextField
                        size="small"
                        type="time"
                        label="Cierra"
                        disabled={!entry.open}
                        value={entry.to}
                        onChange={(e) =>
                          setWeekly((prev) => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], to: e.target.value },
                          }))
                        }
                      />
                    </Grid>
                  </Grid>
                );
              })}
            </Stack>
          </CardContent>
        </Card>

        <Box textAlign="right">
          <Button type="submit" variant="contained" color="secondary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar perfil del negocio'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

export default function NegocioPage() {
  return (
    <SellerShell title="Perfil del negocio">
      {(store) => <BusinessProfileEditor store={store} />}
    </SellerShell>
  );
}
