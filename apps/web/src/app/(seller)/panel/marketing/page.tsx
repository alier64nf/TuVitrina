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
  Grid2 as Grid,
  IconButton,
  ListItemText,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Percent, Plus, Tag, Trash2 } from 'lucide-react';
import {
  CURRENCIES,
  formatMoney,
  type CouponDiscountType,
  type CurrencyCode,
  type PromotionRuleType,
  type StoreSummaryDto,
} from '@tuvitrina/contracts';
import { SellerShell } from '@/components/SellerShell';
import { EmptyStateCard, ErrorStateCard, PageSkeleton } from '@/components/StateViews';
import { useAuth } from '@/components/ThemeAndQueryProvider';

const PROMO_TYPE_LABELS: Record<PromotionRuleType, string> = {
  percent: 'Descuento porcentual',
  min_amount: 'Descuento fijo por monto mínimo',
  bogo_2x1: '2x1 (lleva 2, paga 1)',
  bogo_3x2: '3x2 (lleva 3, paga 2)',
  second_unit: 'Descuento en 2da unidad',
  combo: 'Combo de productos',
};

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function MarketingManager({ store }: { store: StoreSummaryDto }) {
  const { apiClient } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'coupons' | 'promotions'>('coupons');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Coupon dialog state
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [cCode, setCCode] = useState('');
  const [cType, setCType] = useState<CouponDiscountType>('percent');
  const [cValue, setCValue] = useState('10');
  const [cCurrency, setCCurrency] = useState<CurrencyCode>(store.baseCurrency);
  const [cMinOrder, setCMinOrder] = useState('0');
  const [cStartsAt, setCStartsAt] = useState(() => toLocalInputValue(new Date()));
  const [cEndsAt, setCEndsAt] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 30 * 24 * 3600_000)),
  );
  const [cMaxUses, setCMaxUses] = useState('');

  // Promotion dialog state
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [pName, setPName] = useState('');
  const [pType, setPType] = useState<PromotionRuleType>('percent');
  const [pDiscountValue, setPDiscountValue] = useState('15');
  const [pMinAmount, setPMinAmount] = useState('0');
  const [pCategoryId, setPCategoryId] = useState('');
  const [pProductIds, setPProductIds] = useState<string[]>([]);

  const couponsQuery = useQuery({
    queryKey: ['seller-coupons'],
    queryFn: () => apiClient.listCoupons(),
  });

  const promotionsQuery = useQuery({
    queryKey: ['seller-promotions'],
    queryFn: () => apiClient.listPromotions(),
  });

  const categoriesQuery = useQuery({
    queryKey: ['seller-categories'],
    queryFn: () => apiClient.listCategories(),
  });

  const productsQuery = useQuery({
    queryKey: ['seller-products-all'],
    queryFn: () => apiClient.listProducts({ limit: 50 }),
  });

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['seller-coupons'] });
    await queryClient.invalidateQueries({ queryKey: ['seller-promotions'] });
  };

  const handleCreateCoupon = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      await apiClient.createCoupon({
        code: cCode.trim().toUpperCase(),
        discountType: cType,
        discountValue: Number(cValue),
        currency: cCurrency,
        minOrderAmount: Number(cMinOrder) || 0,
        startsAt: new Date(cStartsAt).toISOString(),
        endsAt: new Date(cEndsAt).toISOString(),
        maxUses: cMaxUses.trim() ? Number(cMaxUses) : null,
        active: true,
      });
      setCouponDialogOpen(false);
      setCCode('');
      await refreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo crear el cupón.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleCoupon = async (couponId: string) => {
    const target = couponsQuery.data?.find((c) => c.id === couponId);
    if (!target) return;
    setBusy(true);
    try {
      await apiClient.updateCoupon(target.id, {
        code: target.code,
        discountType: target.discountType,
        discountValue: target.discountValue,
        currency: target.currency,
        minOrderAmount: target.minOrderAmount,
        startsAt: target.startsAt,
        endsAt: target.endsAt,
        maxUses: target.maxUses,
        active: !target.active,
      });
      await refreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar el cupón.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    setBusy(true);
    try {
      await apiClient.deleteCoupon(couponId);
      await refreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo eliminar el cupón.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePromotion = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      await apiClient.createPromotion({
        name: pName.trim(),
        type: pType,
        discountValue: Number(pDiscountValue) || 0,
        minAmount: Number(pMinAmount) || 0,
        categoryId: pCategoryId || null,
        productIds: pProductIds,
        active: true,
      });
      setPromoDialogOpen(false);
      setPName('');
      setPProductIds([]);
      setPCategoryId('');
      await refreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo crear la promoción.');
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePromotion = async (promoId: string) => {
    const target = promotionsQuery.data?.find((p) => p.id === promoId);
    if (!target) return;
    setBusy(true);
    try {
      await apiClient.updatePromotion(target.id, {
        name: target.name,
        type: target.type,
        discountValue: target.discountValue,
        minAmount: target.minAmount,
        categoryId: target.categoryId,
        productIds: target.productIds,
        active: !target.active,
      });
      await refreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar la promoción.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePromotion = async (promoId: string) => {
    setBusy(true);
    try {
      await apiClient.deletePromotion(promoId);
      await refreshAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo eliminar la promoción.');
    } finally {
      setBusy(false);
    }
  };

  if (couponsQuery.isLoading || promotionsQuery.isLoading) return <PageSkeleton />;
  if (couponsQuery.isError || promotionsQuery.isError) {
    return (
      <ErrorStateCard
        message="Error cargando cupones y promociones."
        onRetry={() => void refreshAll()}
      />
    );
  }

  const coupons = couponsQuery.data ?? [];
  const promotions = promotionsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data?.items ?? [];

  return (
    <Stack spacing={3}>
      {errorMsg ? <Alert severity="error">{errorMsg}</Alert> : null}

      <Card>
        <CardContent sx={{ pb: '12px !important' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            gap={2}
          >
            <Tabs value={tab} onChange={(_e, v) => setTab(v)}>
              <Tab value="coupons" label={`Cupones (${coupons.length})`} />
              <Tab value="promotions" label={`Promociones automáticas (${promotions.length})`} />
            </Tabs>
            {tab === 'coupons' ? (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<Plus size={18} />}
                onClick={() => setCouponDialogOpen(true)}
              >
                Nuevo cupón
              </Button>
            ) : (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<Plus size={18} />}
                onClick={() => setPromoDialogOpen(true)}
              >
                Nueva promoción
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {tab === 'coupons' ? (
        coupons.length === 0 ? (
          <EmptyStateCard
            icon={<Tag size={26} />}
            title="Aún no tienes cupones"
            description="Crea códigos de descuento con porcentaje o monto fijo, vigencia y límite de usos."
            actionLabel="Crear primer cupón"
            onAction={() => setCouponDialogOpen(true)}
          />
        ) : (
          <Stack spacing={1.5}>
            {coupons.map((coupon) => (
              <Card key={coupon.id}>
                <CardContent>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ sm: 'center' }}
                    gap={2}
                  >
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        {coupon.code}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Descuento:{' '}
                        <strong>
                          {coupon.discountType === 'percent'
                            ? `${coupon.discountValue}%`
                            : formatMoney(coupon.discountValue, coupon.currency)}
                        </strong>
                        {coupon.minOrderAmount > 0
                          ? ` · Mínimo: ${formatMoney(coupon.minOrderAmount, coupon.currency)}`
                          : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Usos: {coupon.usedCount}
                        {coupon.maxUses !== null ? ` / ${coupon.maxUses}` : ' (ilimitado)'} · Vence:{' '}
                        {new Date(coupon.endsAt).toLocaleDateString('es-CU')}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={coupon.active}
                            disabled={busy}
                            onChange={() => void handleToggleCoupon(coupon.id)}
                          />
                        }
                        label={coupon.active ? 'Activo' : 'Pausado'}
                      />
                      <IconButton
                        color="error"
                        aria-label="Eliminar cupón"
                        disabled={busy}
                        onClick={() => void handleDeleteCoupon(coupon.id)}
                      >
                        <Trash2 size={18} />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )
      ) : promotions.length === 0 ? (
        <EmptyStateCard
          icon={<Percent size={26} />}
          title="No hay promociones automáticas"
          description="Activa descuentos 2x1, 3x2, segunda unidad, combos o descuentos por monto mínimo."
          actionLabel="Crear promoción"
          onAction={() => setPromoDialogOpen(true)}
        />
      ) : (
        <Stack spacing={1.5}>
          {promotions.map((promo) => (
            <Card key={promo.id}>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ sm: 'center' }}
                  gap={2}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {promo.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {PROMO_TYPE_LABELS[promo.type]}
                      {promo.type === 'percent' || promo.type === 'second_unit' || promo.type === 'combo'
                        ? ` · ${promo.discountValue}%`
                        : ''}
                      {promo.type === 'min_amount'
                        ? ` · -${formatMoney(promo.discountValue, store.baseCurrency)} desde ${formatMoney(promo.minAmount, store.baseCurrency)}`
                        : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {promo.productIds.length > 0
                        ? `Aplica a ${promo.productIds.length} productos`
                        : promo.categoryId
                          ? 'Aplica a categoría específica'
                          : 'Aplica a toda la tienda'}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={promo.active}
                          disabled={busy}
                          onChange={() => void handleTogglePromotion(promo.id)}
                        />
                      }
                      label={promo.active ? 'Activa' : 'Pausada'}
                    />
                    <IconButton
                      color="error"
                      aria-label="Eliminar promoción"
                      disabled={busy}
                      onClick={() => void handleDeletePromotion(promo.id)}
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

      {/* Modal Nuevo Cupón */}
      <Dialog
        open={couponDialogOpen}
        onClose={() => setCouponDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <Box component="form" onSubmit={handleCreateCoupon}>
          <DialogTitle>Nuevo cupón de descuento</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField
                label="Código del cupón"
                required
                value={cCode}
                onChange={(e) => setCCode(e.target.value.toUpperCase())}
                placeholder="Ej. VERANO10"
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="Tipo"
                    value={cType}
                    onChange={(e) => setCType(e.target.value as CouponDiscountType)}
                  >
                    <MenuItem value="percent">Porcentaje (%)</MenuItem>
                    <MenuItem value="fixed">Monto fijo</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    type="number"
                    label={cType === 'percent' ? 'Porcentaje (%)' : 'Valor'}
                    required
                    value={cValue}
                    onChange={(e) => setCValue(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="Moneda"
                    value={cCurrency}
                    onChange={(e) => setCCurrency(e.target.value as CurrencyCode)}
                  >
                    {CURRENCIES.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    type="number"
                    label="Pedido mínimo (opcional)"
                    value={cMinOrder}
                    onChange={(e) => setCMinOrder(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    type="number"
                    label="Límite de usos (opcional)"
                    value={cMaxUses}
                    onChange={(e) => setCMaxUses(e.target.value)}
                    placeholder="Ilimitado"
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    type="datetime-local"
                    label="Válido desde"
                    value={cStartsAt}
                    onChange={(e) => setCStartsAt(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    type="datetime-local"
                    label="Válido hasta"
                    value={cEndsAt}
                    onChange={(e) => setCEndsAt(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCouponDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="secondary" disabled={busy}>
              {busy ? 'Guardando...' : 'Crear cupón'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Modal Nueva Promoción */}
      <Dialog
        open={promoDialogOpen}
        onClose={() => setPromoDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <Box component="form" onSubmit={handleCreatePromotion}>
          <DialogTitle>Nueva promoción automática</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField
                label="Nombre visible para clientes"
                required
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="Ej. 2x1 en Cafés o 15% Fin de Semana"
              />
              <TextField
                select
                label="Tipo de promoción"
                value={pType}
                onChange={(e) => setPType(e.target.value as PromotionRuleType)}
              >
                {Object.entries(PROMO_TYPE_LABELS).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>

              {pType === 'percent' || pType === 'second_unit' || pType === 'combo' ? (
                <TextField
                  type="number"
                  label="Porcentaje de descuento (%)"
                  required
                  value={pDiscountValue}
                  onChange={(e) => setPDiscountValue(e.target.value)}
                />
              ) : null}

              {pType === 'min_amount' ? (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      type="number"
                      label={`Monto mínimo (${store.baseCurrency})`}
                      required
                      value={pMinAmount}
                      onChange={(e) => setPMinAmount(e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      type="number"
                      label={`Descuento fijo (${store.baseCurrency})`}
                      required
                      value={pDiscountValue}
                      onChange={(e) => setPDiscountValue(e.target.value)}
                    />
                  </Grid>
                </Grid>
              ) : null}

              {pType !== 'combo' ? (
                <TextField
                  select
                  label="Aplicar a categoría (opcional)"
                  value={pCategoryId}
                  onChange={(e) => setPCategoryId(e.target.value)}
                >
                  <MenuItem value="">Toda la tienda</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}

              <TextField
                select
                label={
                  pType === 'combo'
                    ? 'Productos del combo (elige al menos 2)'
                    : 'Productos específicos (opcional)'
                }
                slotProps={{
                  select: {
                    multiple: true,
                    value: pProductIds,
                    onChange: (e) => setPProductIds(e.target.value as string[]),
                    renderValue: (selected) =>
                      `${(selected as string[]).length} productos seleccionados`,
                  },
                }}
              >
                {products.map((prod) => (
                  <MenuItem key={prod.id} value={prod.id}>
                    <Checkbox checked={pProductIds.includes(prod.id)} />
                    <ListItemText primary={prod.name} />
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPromoDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" color="secondary" disabled={busy}>
              {busy ? 'Guardando...' : 'Crear promoción'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}

export default function MarketingPage() {
  return (
    <SellerShell title="Promociones y Cupones">
      {(store) => <MarketingManager store={store} />}
    </SellerShell>
  );
}
