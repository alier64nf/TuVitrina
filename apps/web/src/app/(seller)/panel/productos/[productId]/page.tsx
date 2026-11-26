'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProductInput } from '@tuvitrina/contracts';
import { ProductForm } from '@/components/ProductForm';
import { SellerShell } from '@/components/SellerShell';
import { ErrorStateCard, PageSkeleton } from '@/components/StateViews';
import { useAuth } from '@/components/ThemeAndQueryProvider';

function EditProductInner({ plan, productId }: { plan: 'free' | 'pro'; productId: string }) {
  const { apiClient } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['seller-categories'],
    queryFn: () => apiClient.listCategories(),
  });

  const productQuery = useQuery({
    queryKey: ['seller-product', productId],
    queryFn: () => apiClient.getProduct(productId),
  });

  if (categoriesQuery.isLoading || productQuery.isLoading) {
    return <PageSkeleton />;
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <ErrorStateCard
        message={
          productQuery.error instanceof Error
            ? productQuery.error.message
            : 'No se encontró el producto.'
        }
        onRetry={() => productQuery.refetch()}
      />
    );
  }

  const handleSubmit = async (payload: CreateProductInput) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await apiClient.updateProduct(productId, payload);
      await queryClient.invalidateQueries({ queryKey: ['seller-products'] });
      await queryClient.invalidateQueries({ queryKey: ['seller-product', productId] });
      router.push('/panel/productos');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'No se pudo actualizar el producto.');
      setSubmitting(false);
    }
  };

  return (
    <ProductForm
      categories={categoriesQuery.data ?? []}
      initialProduct={productQuery.data}
      maxImagesAllowed={plan === 'pro' ? 10 : 3}
      submitting={submitting}
      serverError={serverError}
      onSubmit={handleSubmit}
      onCancel={() => router.push('/panel/productos')}
    />
  );
}

export default function EditarProductoPage() {
  const params = useParams<{ productId: string }>();
  const productId = params?.productId ?? '';

  return (
    <SellerShell title="Editar producto">
      {(store) => <EditProductInner plan={store.plan} productId={productId} />}
    </SellerShell>
  );
}
