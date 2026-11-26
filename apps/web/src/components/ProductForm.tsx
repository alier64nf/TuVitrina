'use client';

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowLeft, ArrowRight, Plus, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import {
  CURRENCIES,
  computeDiscountPercent,
  type CategoryDto,
  type CreateProductInput,
  type CurrencyCode,
  type ProductDto,
  type ProductImageRef,
  type ProductVariantInput,
} from '@tuvitrina/contracts';
import { useAuth } from '@/components/ThemeAndQueryProvider';
import { compressImageToWebP, uploadToSignedUrl } from '@/lib/media/compressImage';

interface UploadItem {
  localId: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  ref?: ProductImageRef;
}

interface VariantDraft {
  key: string;
  label: string;
  sku: string;
  priceOverride: string;
  stock: string;
  active: boolean;
  attrValues: [string, string, string];
}

export function ProductForm({
  categories,
  initialProduct,
  maxImagesAllowed,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: {
  categories: CategoryDto[];
  initialProduct?: ProductDto;
  maxImagesAllowed: number;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (payload: CreateProductInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { apiClient } = useAuth();

  const [name, setName] = useState(initialProduct?.name ?? '');
  const [description, setDescription] = useState(initialProduct?.description ?? '');
  const [categoryId, setCategoryId] = useState(initialProduct?.categoryId ?? '');
  const [price, setPrice] = useState(initialProduct ? String(initialProduct.price) : '');
  const [compareAtPrice, setCompareAtPrice] = useState(
    initialProduct?.compareAtPrice ? String(initialProduct.compareAtPrice) : '',
  );
  const [currency, setCurrency] = useState<CurrencyCode>(initialProduct?.currency ?? 'CUP');
  const [stock, setStock] = useState(
    initialProduct?.stock !== null && initialProduct?.stock !== undefined
      ? String(initialProduct.stock)
      : '',
  );
  const [active, setActive] = useState(initialProduct?.active ?? true);
  const [soldOut, setSoldOut] = useState(initialProduct?.soldOut ?? false);

  const [savedImages, setSavedImages] = useState<ProductImageRef[]>(
    initialProduct?.images ?? [],
  );
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);

  const initialAttrNames = useMemo(() => {
    const keys = new Set<string>();
    for (const v of initialProduct?.variants ?? []) {
      for (const k of Object.keys(v.attributes)) {
        keys.add(k);
      }
    }
    return Array.from(keys).slice(0, 3);
  }, [initialProduct]);

  const [attrNames, setAttrNames] = useState<[string, string, string]>([
    initialAttrNames[0] ?? '',
    initialAttrNames[1] ?? '',
    initialAttrNames[2] ?? '',
  ]);

  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    (initialProduct?.variants ?? []).map((v, idx) => ({
      key: v.id || `var-${idx}`,
      label: v.label,
      sku: v.sku ?? '',
      priceOverride: v.priceOverride !== null ? String(v.priceOverride) : '',
      stock: v.stock !== null ? String(v.stock) : '',
      active: v.active,
      attrValues: [
        initialAttrNames[0] ? v.attributes[initialAttrNames[0]] ?? '' : '',
        initialAttrNames[1] ? v.attributes[initialAttrNames[1]] ?? '' : '',
        initialAttrNames[2] ? v.attributes[initialAttrNames[2]] ?? '' : '',
      ],
    })),
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  const numericPrice = Number(price);
  const numericCompare = compareAtPrice ? Number(compareAtPrice) : null;
  const liveDiscount = computeDiscountPercent(numericPrice, numericCompare);

  const totalImagesCount = savedImages.length + uploadItems.filter((u) => u.status === 'uploading').length;

  const runUpload = async (item: UploadItem) => {
    setUploadItems((prev) =>
      prev.map((u) =>
        u.localId === item.localId
          ? { ...u, status: 'uploading', progress: 5, error: undefined }
          : u,
      ),
    );
    try {
      const compressed = await compressImageToWebP(item.file);
      setUploadItems((prev) =>
        prev.map((u) => (u.localId === item.localId ? { ...u, progress: 25 } : u)),
      );

      const signed = await apiClient.requestSignedUpload({
        bucket: 'product-images',
        mimeType: compressed.mimeType,
        sizeBytes: compressed.sizeBytes,
      });

      await uploadToSignedUrl(signed.signedUrl, compressed.blob, compressed.mimeType, (pct) => {
        const scaled = 25 + Math.round(pct * 0.75);
        setUploadItems((prev) =>
          prev.map((u) => (u.localId === item.localId ? { ...u, progress: scaled } : u)),
        );
      });

      const ref: ProductImageRef = {
        objectPath: signed.objectPath,
        publicUrl: signed.publicUrl,
        alt: name.trim() || 'Imagen de producto',
      };

      setSavedImages((prev) => [...prev, ref]);
      setUploadItems((prev) => prev.filter((u) => u.localId !== item.localId));
    } catch (err) {
      setUploadItems((prev) =>
        prev.map((u) =>
          u.localId === item.localId
            ? {
                ...u,
                status: 'error',
                error:
                  err instanceof Error
                    ? err.message
                    : 'Error al subir la imagen. Toca Reintentar.',
              }
            : u,
        ),
      );
    }
  };

  const handleFilesSelected = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(evt.target.files ?? []);
    evt.target.value = '';
    if (files.length === 0) return;

    const remaining = Math.max(0, maxImagesAllowed - totalImagesCount);
    if (remaining <= 0) {
      setValidationError(`Tu plan permite hasta ${maxImagesAllowed} imágenes por producto.`);
      return;
    }

    setValidationError(null);
    const slice = files.slice(0, remaining);
    const items: UploadItem[] = slice.map((file) => ({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: 'uploading',
    }));

    setUploadItems((prev) => [...prev, ...items]);
    for (const item of items) {
      void runUpload(item);
    }
  };

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${prev.length}`,
        label: '',
        sku: '',
        priceOverride: '',
        stock: '',
        active: true,
        attrValues: ['', '', ''],
      },
    ]);
  };

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setValidationError(null);

    if (!name.trim() || name.trim().length < 2) {
      setValidationError('Escribe el nombre del producto (mínimo 2 caracteres).');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setValidationError('El precio debe ser mayor a 0.');
      return;
    }
    if (numericCompare !== null && numericCompare <= numericPrice) {
      setValidationError('El precio tachado debe ser mayor que el precio de venta.');
      return;
    }

    const activeAttrNames = attrNames.map((a) => a.trim()).filter(Boolean);
    const builtVariants: ProductVariantInput[] = [];

    for (const row of variants) {
      const attrs: Record<string, string> = {};
      attrNames.forEach((rawAttrName, index) => {
        const key = rawAttrName.trim();
        const val = row.attrValues[index]?.trim();
        if (key && val) {
          attrs[key] = val;
        }
      });
      if (Object.keys(attrs).length === 0) {
        setValidationError('Completa al menos un atributo para cada variante agregada.');
        return;
      }
      const computedLabel = row.label.trim() || Object.values(attrs).join(' / ');
      builtVariants.push({
        label: computedLabel,
        sku: row.sku.trim() || null,
        attributes: attrs,
        priceOverride: row.priceOverride ? Number(row.priceOverride) : null,
        stock: row.stock !== '' ? Number(row.stock) : null,
        active: row.active,
      });
    }

    await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      categoryId: categoryId || null,
      price: numericPrice,
      compareAtPrice: numericCompare,
      currency,
      stock: stock !== '' ? Number(stock) : null,
      active,
      soldOut,
      images: savedImages,
      variantAttributeNames: activeAttrNames,
      variants: builtVariants,
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={3}>
        {validationError ? <Alert severity="error">{validationError}</Alert> : null}
        {serverError ? <Alert severity="error">{serverError}</Alert> : null}

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h6">Datos básicos</Typography>
              <TextField
                label="Nombre del producto"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Torta Tres Leches Artesanal"
              />
              <TextField
                select
                label="Categoría"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <MenuItem value="">Sin categoría</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Descripción (opcional)"
                multiline
                minRows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ingredientes, tamaño, detalles para el cliente..."
              />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h6">Precio, descuento y disponibilidad</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Precio de venta"
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    slotProps={{ htmlInput: { min: 0.01, step: '0.01' } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Precio tachado (antes)"
                    type="number"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    helperText={
                      liveDiscount
                        ? `Muestra -${liveDiscount}% de descuento`
                        : 'Opcional; debe ser mayor al precio'
                    }
                    slotProps={{ htmlInput: { min: 0.01, step: '0.01' } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="Moneda"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  >
                    {CURRENCIES.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Stock disponible (opcional)"
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    helperText="Déjalo vacío si no controlas inventario"
                    slotProps={{ htmlInput: { min: 0, step: 1 } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch checked={active} onChange={(e) => setActive(e.target.checked)} />
                    }
                    label="Visible en tienda"
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch checked={soldOut} onChange={(e) => setSoldOut(e.target.checked)} />
                    }
                    label="Marcar agotado"
                  />
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6">Imágenes</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Se comprimen automáticamente a WebP en tu móvil antes de subir (máx. {maxImagesAllowed} fotos).
                  </Typography>
                </Box>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadCloud size={18} />}
                  disabled={totalImagesCount >= maxImagesAllowed}
                >
                  Subir foto
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleFilesSelected}
                  />
                </Button>
              </Stack>

              <Grid container spacing={2}>
                {savedImages.map((img, idx) => (
                  <Grid key={img.objectPath} size={{ xs: 6, sm: 4, md: 3 }}>
                    <Box
                      sx={{
                        position: 'relative',
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: idx === 0 ? '2px solid' : '1px solid',
                        borderColor: idx === 0 ? 'primary.main' : 'divider',
                        aspectRatio: '1 / 1',
                      }}
                    >
                      <Box
                        component="img"
                        src={img.publicUrl}
                        alt={img.alt || name || 'Imagen del producto'}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {idx === 0 ? (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 6,
                            left: 6,
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            px: 0.75,
                            py: 0.25,
                            borderRadius: 1,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          Principal
                        </Box>
                      ) : null}
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Quitar imagen"
                        onClick={() =>
                          setSavedImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          bgcolor: 'rgba(255,255,255,0.92)',
                        }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                      {savedImages.length > 1 ? (
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          sx={{
                            position: 'absolute',
                            bottom: 4,
                            left: 4,
                            right: 4,
                          }}
                        >
                          <IconButton
                            size="small"
                            aria-label="Mover imagen a la izquierda"
                            disabled={idx === 0}
                            onClick={() =>
                              setSavedImages((prev) => {
                                const copy = [...prev];
                                const [moved] = copy.splice(idx, 1);
                                copy.splice(idx - 1, 0, moved);
                                return copy;
                              })
                            }
                            sx={{ bgcolor: 'rgba(255,255,255,0.92)', minWidth: 32, minHeight: 32 }}
                          >
                            <ArrowLeft size={14} />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label="Mover imagen a la derecha"
                            disabled={idx === savedImages.length - 1}
                            onClick={() =>
                              setSavedImages((prev) => {
                                const copy = [...prev];
                                const [moved] = copy.splice(idx, 1);
                                copy.splice(idx + 1, 0, moved);
                                return copy;
                              })
                            }
                            sx={{ bgcolor: 'rgba(255,255,255,0.92)', minWidth: 32, minHeight: 32 }}
                          >
                            <ArrowRight size={14} />
                          </IconButton>
                        </Stack>
                      ) : null}
                    </Box>
                  </Grid>
                ))}

                {uploadItems.map((item) => (
                  <Grid key={item.localId} size={{ xs: 6, sm: 4, md: 3 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: item.status === 'error' ? 'error.main' : 'divider',
                      }}
                    >
                      <Box
                        component="img"
                        src={item.previewUrl}
                        alt="Subiendo imagen"
                        sx={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          objectFit: 'cover',
                          borderRadius: 1,
                          mb: 1,
                        }}
                      />
                      {item.status === 'uploading' ? (
                        <LinearProgress variant="determinate" value={item.progress} />
                      ) : (
                        <Stack spacing={1}>
                          <Typography variant="caption" color="error">
                            {item.error}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RefreshCw size={14} />}
                            onClick={() => void runUpload(item)}
                          >
                            Reintentar
                          </Button>
                        </Stack>
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="h6">Variantes y opciones (hasta 3 atributos)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Define atributos como Talla, Color o Sabor con precio o stock propio.
                  </Typography>
                </Box>
                <Button
                  type="button"
                  variant="outlined"
                  startIcon={<Plus size={18} />}
                  onClick={addVariantRow}
                >
                  Añadir variante
                </Button>
              </Stack>

              <Grid container spacing={2}>
                {[0, 1, 2].map((idx) => (
                  <Grid key={idx} size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label={`Atributo ${idx + 1}`}
                      value={attrNames[idx]}
                      onChange={(e) => {
                        const copy: [string, string, string] = [...attrNames] as [
                          string,
                          string,
                          string,
                        ];
                        copy[idx] = e.target.value;
                        setAttrNames(copy);
                      }}
                      placeholder={idx === 0 ? 'Ej. Talla' : idx === 1 ? 'Ej. Color' : 'Ej. Sabor'}
                    />
                  </Grid>
                ))}
              </Grid>

              {variants.map((variant, rowIdx) => (
                <Box
                  key={variant.key}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Grid container spacing={1.5} alignItems="center">
                    {attrNames.map((attrName, attrIdx) =>
                      attrName.trim() ? (
                        <Grid key={attrIdx} size={{ xs: 12, sm: 3 }}>
                          <TextField
                            size="small"
                            label={attrName.trim()}
                            value={variant.attrValues[attrIdx]}
                            onChange={(e) => {
                              setVariants((prev) =>
                                prev.map((v, i) => {
                                  if (i !== rowIdx) return v;
                                  const nextVals: [string, string, string] = [...v.attrValues] as [
                                    string,
                                    string,
                                    string,
                                  ];
                                  nextVals[attrIdx] = e.target.value;
                                  return { ...v, attrValues: nextVals };
                                }),
                              );
                            }}
                          />
                        </Grid>
                      ) : null,
                    )}

                    <Grid size={{ xs: 6, sm: 2.5 }}>
                      <TextField
                        size="small"
                        type="number"
                        label="Precio (opcional)"
                        value={variant.priceOverride}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((v, i) =>
                              i === rowIdx ? { ...v, priceOverride: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 2 }}>
                      <TextField
                        size="small"
                        type="number"
                        label="Stock"
                        value={variant.stock}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((v, i) =>
                              i === rowIdx ? { ...v, stock: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 1.5 }} textAlign="right">
                      <IconButton
                        color="error"
                        aria-label="Eliminar variante"
                        onClick={() =>
                          setVariants((prev) => prev.filter((_, i) => i !== rowIdx))
                        }
                      >
                        <Trash2 size={18} />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button type="button" variant="outlined" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={submitting}
          >
            {submitting ? 'Guardando...' : 'Guardar producto'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
