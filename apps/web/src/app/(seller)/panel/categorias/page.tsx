'use client';

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Clock, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { WEEK_DAYS, type CategoryDto, type CategorySchedule, type WeekDayKey } from '@tuvitrina/contracts';
import { SellerShell } from '@/components/SellerShell';
import { EmptyStateCard, ErrorStateCard, PageSkeleton } from '@/components/StateViews';
import { useAuth } from '@/components/ThemeAndQueryProvider';

const DEFAULT_SCHEDULE: CategorySchedule = {
  enabled: false,
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  from: '08:00',
  to: '18:00',
};

function CategoriesManager() {
  const { apiClient } = useAuth();
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [scheduleTarget, setScheduleTarget] = useState<CategoryDto | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<CategorySchedule>(DEFAULT_SCHEDULE);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['seller-categories'],
    queryFn: () => apiClient.listCategories(),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['seller-categories'] });
    await queryClient.invalidateQueries({ queryKey: ['seller-me'] });
  };

  const handleCreate = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (newName.trim().length < 2) {
      setErrorMsg('Escribe al menos 2 caracteres para la categoría.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      await apiClient.createCategory({ name: newName.trim(), active: true });
      setNewName('');
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo crear la categoría.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (categoryId: string) => {
    if (editingName.trim().length < 2) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await apiClient.updateCategory(categoryId, { name: editingName.trim() });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar.');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenSchedule = (cat: CategoryDto) => {
    setScheduleTarget(cat);
    setScheduleDraft(
      cat.schedule
        ? {
            enabled: cat.schedule.enabled,
            days: cat.schedule.days?.length ? cat.schedule.days : DEFAULT_SCHEDULE.days,
            from: cat.schedule.from || '08:00',
            to: cat.schedule.to || '18:00',
          }
        : DEFAULT_SCHEDULE,
    );
  };

  const handleSaveSchedule = async () => {
    if (!scheduleTarget) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await apiClient.updateCategory(scheduleTarget.id, {
        schedule: scheduleDraft.enabled ? scheduleDraft : null,
      });
      setScheduleTarget(null);
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar el horario.');
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (categories: CategoryDto[], index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= categories.length) return;
    const copy = [...categories];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);

    setBusy(true);
    setErrorMsg(null);
    try {
      await apiClient.reorderCategories({ categoryIds: copy.map((c) => c.id) });
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo reordenar.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (category: CategoryDto) => {
    setBusy(true);
    try {
      await apiClient.updateCategory(category.id, { active: !category.active });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await apiClient.deleteCategory(categoryId);
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo eliminar.');
    } finally {
      setBusy(false);
    }
  };

  const toggleDay = (dayKey: WeekDayKey) => {
    setScheduleDraft((prev) => {
      const exists = prev.days.includes(dayKey);
      const nextDays = exists ? prev.days.filter((d) => d !== dayKey) : [...prev.days, dayKey];
      return { ...prev, days: nextDays };
    });
  };

  if (categoriesQuery.isLoading) return <PageSkeleton />;
  if (categoriesQuery.isError) {
    return (
      <ErrorStateCard
        message={
          categoriesQuery.error instanceof Error
            ? categoriesQuery.error.message
            : 'Error cargando categorías.'
        }
        onRetry={() => categoriesQuery.refetch()}
      />
    );
  }

  const categories = categoriesQuery.data ?? [];

  return (
    <Stack spacing={3}>
      {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}

      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleCreate}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                label="Nueva categoría"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Bebidas frías, Desayunos, Combos familiares..."
              />
              <Button
                type="submit"
                variant="contained"
                color="secondary"
                disabled={busy}
                startIcon={<Plus size={18} />}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Agregar
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {categories.length === 0 ? (
        <EmptyStateCard
          icon={<FolderTree size={26} />}
          title="Aún no tienes categorías"
          description="Organiza tus productos en secciones claras y define horarios especiales si lo necesitas."
        />
      ) : (
        <Stack spacing={1.5}>
          {categories.map((cat, index) => (
            <Card key={cat.id}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  justifyContent="space-between"
                  gap={1.5}
                >
                  {editingId === cat.id ? (
                    <Stack direction="row" spacing={1} flexGrow={1}>
                      <TextField
                        size="small"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                      />
                      <Button
                        size="small"
                        variant="contained"
                        disabled={busy}
                        onClick={() => void handleSaveEdit(cat.id)}
                      >
                        Guardar
                      </Button>
                      <Button size="small" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </Stack>
                  ) : (
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {cat.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Orden #{index + 1} · {cat.active ? 'Visible' : 'Oculta'}
                        {cat.schedule?.enabled
                          ? ` · Horario ${cat.schedule.from}–${cat.schedule.to}`
                          : ''}
                      </Typography>
                    </Box>
                  )}

                  <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap">
                    <Switch
                      checked={cat.active}
                      disabled={busy}
                      onChange={() => void handleToggleActive(cat)}
                      inputProps={{ 'aria-label': `Visibilidad de ${cat.name}` }}
                    />
                    <IconButton
                      aria-label="Horario de categoría"
                      color={cat.schedule?.enabled ? 'primary' : 'default'}
                      disabled={busy}
                      onClick={() => handleOpenSchedule(cat)}
                    >
                      <Clock size={18} />
                    </IconButton>
                    <IconButton
                      aria-label="Subir categoría"
                      disabled={busy || index === 0}
                      onClick={() => void handleMove(categories, index, -1)}
                    >
                      <ArrowUp size={18} />
                    </IconButton>
                    <IconButton
                      aria-label="Bajar categoría"
                      disabled={busy || index === categories.length - 1}
                      onClick={() => void handleMove(categories, index, 1)}
                    >
                      <ArrowDown size={18} />
                    </IconButton>
                    <IconButton
                      aria-label="Editar categoría"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditingName(cat.name);
                      }}
                    >
                      <Pencil size={18} />
                    </IconButton>
                    <IconButton
                      color="error"
                      aria-label="Eliminar categoría"
                      disabled={busy}
                      onClick={() => void handleDelete(cat.id)}
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog
        open={Boolean(scheduleTarget)}
        onClose={() => setScheduleTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          Horario de {scheduleTarget?.name}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <FormControlLabel
              control={
                <Switch
                  checked={scheduleDraft.enabled}
                  onChange={(e) =>
                    setScheduleDraft((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                />
              }
              label="Restringir pedidos de esta categoría por horario (hora de Cuba)"
            />

            {scheduleDraft.enabled ? (
              <>
                <Stack direction="row" spacing={2}>
                  <TextField
                    type="time"
                    label="Desde"
                    value={scheduleDraft.from}
                    onChange={(e) =>
                      setScheduleDraft((prev) => ({ ...prev, from: e.target.value }))
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    type="time"
                    label="Hasta"
                    value={scheduleDraft.to}
                    onChange={(e) =>
                      setScheduleDraft((prev) => ({ ...prev, to: e.target.value }))
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Días activos
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {WEEK_DAYS.map((day) => (
                      <FormControlLabel
                        key={day.key}
                        control={
                          <Checkbox
                            size="small"
                            checked={scheduleDraft.days.includes(day.key)}
                            onChange={() => toggleDay(day.key)}
                          />
                        }
                        label={day.label.slice(0, 3)}
                      />
                    ))}
                  </Stack>
                </Box>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Sin restricción horaria: disponible todo el tiempo mientras la tienda esté abierta.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleTarget(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={busy || (scheduleDraft.enabled && scheduleDraft.days.length === 0)}
            onClick={() => void handleSaveSchedule()}
          >
            {busy ? 'Guardando...' : 'Guardar horario'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default function CategoriasPage() {
  return (
    <SellerShell title="Categorías">
      {() => <CategoriesManager />}
    </SellerShell>
  );
}
