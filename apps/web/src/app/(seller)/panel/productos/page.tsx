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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import {
  formatMoney,
  type CsvImportResultDto,
  type ProductDto,
  type StoreSummaryDto,
} from '@tuvitrina/contracts';
import { SellerShell } from '@/components/SellerShell';
import { EmptyStateCard, ErrorStateCard, PageSkeleton } from '@/components/StateViews';
import { useAuth } from '@/components/ThemeAndQueryProvider';

const SAMPLE_CSV = [
  'nombre,precio,precio_anterior,moneda,categoria,descripcion,stock,activo',
  'Café Serrano 500g,1200,1400,CUP,Alimentos,Café molido artesanal,25,si',
  'Miel de Abeja 1L,850,,CUP,Alimentos,Miel pura de campo,12,si',
].join('\n');

function ProductsManager({ store }: { store: StoreSummaryDto }) {
  const { apiClient } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvImportResultDto | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['seller-categories'],
    queryFn: () => apiClient.listCategories(),
  });

  const productsQuery = useInfiniteQuery({
    queryKey: ['seller-products', search.trim(), categoryId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.listProducts({
        q: search.trim() || undefined,
        categoryId: categoryId || undefined,
        cursor: pageParam,
        limit: 50,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['seller-products'] });
    await queryClient.invalidateQueries({ queryKey: ['seller-categories'] });
    await queryClient.invalidateQueries({ queryKey: ['seller-me'] });
  };

  const handleToggleSoldOut = async (product: ProductDto) => {
    setBusyId(product.id);
    setActionError(null);
    try {
      await apiClient.toggleSoldOut(product.id, !product.soldOut);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (productId: string) => {
    setBusyId(productId);
    setActionError(null);
    try {
      await apiClient.duplicateProduct(productId);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo duplicar el producto.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (productId: string) => {
    setBusyId(productId);
    setActionError(null);
    try {
      await apiClient.deleteProduct(productId);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el producto.');
    } finally {
      setBusyId(null);
    }
  };

  const items = productsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const totalCount = productsQuery.data?.pages[0]?.totalCount ?? 0;
  const canReorder = !search.trim() && !categoryId && items.length > 1;

  const handleMoveProduct = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);

    setBusyId(moved.id);
    setActionError(null);
    try {
      await apiClient.reorderProducts({ productIds: copy.map((p) => p.id) });
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo reordenar los productos.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCsvFileUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    evt.target.value = '';
    if (!file) return;
    const content = await file.text();
    setCsvText(content);
    setCsvResult(null);
    setCsvError(null);
  };

  const handleDownloadCsvTemplate = () => {
    const blob = new Blob([`\uFEFF${SAMPLE_CSV}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-productos-tuvitrina.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunCsvImport = async () => {
    if (!csvText.trim()) {
      setCsvError('Carga un archivo CSV o pega el contenido antes de importar.');
      return;
    }
    setCsvBusy(true);
    setCsvError(null);
    try {
      const res = await apiClient.importProductsCsv({ csvContent: csvText });
      setCsvResult(res);
      if (res.importedCount > 0) {
        await refresh();
      }
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Error importando el CSV.');
    } finally {
      setCsvBusy(false);
    }
  };

  const handleDownloadPdfCatalog = async () => {
    setPdfBusy(true);
    setActionError(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tuvitrina.cu';
      const storeUrl = `${origin}/${store.slug}`;
      const qrDataUrl = await QRCode.toDataURL(storeUrl, { width: 160, margin: 1 });

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      doc.setFontSize(20);
      doc.text(store.name, 14, 20);
      doc.setFontSize(10);
      doc.text(`Rubro: ${store.category} | WhatsApp: ${store.whatsapp}`, 14, 27);
      doc.text(`Tienda online: ${storeUrl}`, 14, 33);
      doc.addImage(qrDataUrl, 'PNG', 165, 10, 30, 30);

      doc.setDrawColor(210);
      doc.line(14, 44, 196, 44);

      let y = 52;
      const catById = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c.name]));

      for (const product of items.filter((p) => p.active)) {
        if (y > 272) {
          doc.addPage();
          y = 20;
        }
        const catLabel = product.categoryId ? catById.get(product.categoryId) ?? '' : '';
        const statusTag = product.soldOut ? ' [AGOTADO]' : '';
        doc.setFontSize(12);
        doc.text(`${product.name}${statusTag}`, 14, y);
        doc.setFontSize(11);
        doc.text(formatMoney(product.price, product.currency), 196, y, { align: 'right' });

        y += 5;
        doc.setFontSize(9);
        const subtitle = [catLabel, product.description?.slice(0, 95)].filter(Boolean).join(' · ');
        if (subtitle) {
          doc.text(subtitle, 14, y);
          y += 5;
        }
        doc.setDrawColor(235);
        doc.line(14, y, 196, y);
        y += 6;
      }

      doc.save(`catalogo-${store.slug}.pdf`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo generar el catálogo PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Stack spacing={3}>
      {actionError ? <Alert severity="error">{actionError}</Alert> : null}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField
                  label="Buscar producto"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre o descripción..."
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  select
                  label="Categoría"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <MenuItem value="">Todas las categorías</MenuItem>
                  {(categoriesQuery.data ?? []).map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Button
                  component={Link}
                  href="/panel/productos/nuevo"
                  variant="contained"
                  color="secondary"
                  fullWidth
                  startIcon={<Plus size={18} />}
                >
                  Nuevo
                </Button>
              </Grid>
            </Grid>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<FileSpreadsheet size={18} />}
                onClick={() => {
                  setCsvOpen(true);
                  setCsvResult(null);
                  setCsvError(null);
                }}
              >
                Importar CSV
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileText size={18} />}
                disabled={pdfBusy || items.length === 0}
                onClick={() => void handleDownloadPdfCatalog()}
              >
                {pdfBusy ? 'Generando PDF...' : 'Descargar catálogo PDF'}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="body2" color="text.secondary" className="tabular-nums">
        Mostrando {items.length} de {totalCount} productos
        {canReorder ? ' · Usa las flechas para ajustar el orden en tu tienda' : ''}
      </Typography>

      {productsQuery.isLoading ? (
        <PageSkeleton />
      ) : productsQuery.isError ? (
        <ErrorStateCard
          message={
            productsQuery.error instanceof Error
              ? productsQuery.error.message
              : 'Error cargando productos.'
          }
          onRetry={() => productsQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyStateCard
          icon={<Package size={26} />}
          title="No hay productos para mostrar"
          description="Publica tu primer producto, importa desde CSV o ajusta los filtros de búsqueda."
          actionLabel="Crear producto"
          onAction={() => router.push('/panel/productos/nuevo')}
        />
      ) : (
        <Stack spacing={1.5}>
          {items.map((product, index) => {
            const thumb = product.images[0]?.publicUrl;
            const busy = busyId === product.id;

            return (
              <Card key={product.id}>
                <CardContent>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                  >
                    <Stack direction="row" spacing={2} alignItems="center" minWidth={0}>
                      <Box
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: 2,
                          bgcolor: 'action.hover',
                          overflow: 'hidden',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {thumb ? (
                          <Box
                            component="img"
                            src={thumb}
                            alt={product.name}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Package size={24} color="#757575" />
                        )}
                      </Box>

                      <Box minWidth={0}>
                        <Typography variant="subtitle1" fontWeight={700} noWrap>
                          {product.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
                          <Typography variant="body2" fontWeight={700} className="tabular-nums">
                            {formatMoney(product.price, product.currency)}
                          </Typography>
                          {product.compareAtPrice ? (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              className="tabular-nums"
                              sx={{ textDecoration: 'line-through' }}
                            >
                              {formatMoney(product.compareAtPrice, product.currency)}
                            </Typography>
                          ) : null}
                          {product.discountPercent ? (
                            <Typography variant="caption" color="secondary.main" fontWeight={700}>
                              -{product.discountPercent}%
                            </Typography>
                          ) : null}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {product.variants.length > 0
                            ? `${product.variants.length} variantes`
                            : 'Producto simple'}
                          {product.images.length > 1 ? ` · ${product.images.length} fotos` : ''}
                          {product.stock !== null ? ` · Stock: ${product.stock}` : ''}
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={0.5}
                      flexWrap="wrap"
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            checked={product.soldOut}
                            disabled={busy}
                            onChange={() => void handleToggleSoldOut(product)}
                          />
                        }
                        label="Agotado"
                      />
                      {canReorder ? (
                        <>
                          <IconButton
                            aria-label="Subir producto"
                            disabled={busy || index === 0}
                            onClick={() => void handleMoveProduct(index, -1)}
                          >
                            <ArrowUp size={18} />
                          </IconButton>
                          <IconButton
                            aria-label="Bajar producto"
                            disabled={busy || index === items.length - 1}
                            onClick={() => void handleMoveProduct(index, 1)}
                          >
                            <ArrowDown size={18} />
                          </IconButton>
                        </>
                      ) : null}
                      <IconButton
                        aria-label="Duplicar producto"
                        disabled={busy}
                        onClick={() => void handleDuplicate(product.id)}
                      >
                        <Copy size={18} />
                      </IconButton>
                      <IconButton
                        component={Link}
                        href={`/panel/productos/${product.id}`}
                        aria-label="Editar producto"
                        disabled={busy}
                      >
                        <Pencil size={18} />
                      </IconButton>
                      <IconButton
                        color="error"
                        aria-label="Eliminar producto"
                        disabled={busy}
                        onClick={() => void handleDelete(product.id)}
                      >
                        <Trash2 size={18} />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}

          {productsQuery.hasNextPage ? (
            <Button
              variant="outlined"
              disabled={productsQuery.isFetchingNextPage}
              onClick={() => void productsQuery.fetchNextPage()}
            >
              {productsQuery.isFetchingNextPage ? 'Cargando más...' : 'Cargar más productos'}
            </Button>
          ) : null}
        </Stack>
      )}

      <Dialog open={csvOpen} onClose={() => setCsvOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Importar productos desde CSV</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Typography variant="body2" color="text.secondary">
              Columnas admitidas: <strong>nombre</strong> (obligatorio), <strong>precio</strong> (obligatorio),
              precio_anterior, moneda (CUP/USD/MLC), categoria, descripcion, stock y activo.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<Download size={16} />}
                onClick={handleDownloadCsvTemplate}
              >
                Descargar plantilla CSV
              </Button>
              <Button
                component="label"
                variant="outlined"
                startIcon={<Upload size={16} />}
              >
                Seleccionar archivo .csv
                <input
                  hidden
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileUpload}
                />
              </Button>
            </Stack>

            <TextField
              label="Contenido CSV"
              multiline
              minRows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={SAMPLE_CSV}
            />

            {csvError ? <Alert severity="error">{csvError}</Alert> : null}

            {csvResult ? (
              <Stack spacing={1.5}>
                <Alert severity={csvResult.errors.length > 0 ? 'warning' : 'success'}>
                  Importados: <strong>{csvResult.importedCount}</strong> productos · Omitidos por error:{' '}
                  <strong>{csvResult.skippedCount}</strong>
                </Alert>

                {csvResult.errors.length > 0 ? (
                  <Box sx={{ maxHeight: 240, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Fila</TableCell>
                          <TableCell>Campo</TableCell>
                          <TableCell>Detalle del error</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {csvResult.errors.map((err, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="tabular-nums">#{err.row}</TableCell>
                            <TableCell>{err.field}</TableCell>
                            <TableCell>{err.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCsvOpen(false)}>Cerrar</Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={csvBusy}
            onClick={() => void handleRunCsvImport()}
          >
            {csvBusy ? 'Importando...' : 'Importar ahora'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default function ProductosPage() {
  return (
    <SellerShell title="Productos">
      {(store) => <ProductsManager store={store} />}
    </SellerShell>
  );
}
