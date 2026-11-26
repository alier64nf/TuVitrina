'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProductInput } from '@tuvitrina/contracts';
import { ProductForm } from '@/components/ProductForm';
import { SellerShell } from '@/components/SellerShell';
import { PageSkeleton } from '@/components/StateViews';
import { useAuth } from '@/components/ThemeAndQueryProvider';

function NewProductInner({ plan }: { plan: 'free' | 'pro' }) {
  const { apiClient } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['seller-categories'],
    queryFn: () => apiClient.listCategories(),
  });

  if (categoriesQuery.isLoading) return <PageSkeleton />;

  const handleSubmit = async (payload: CreateProductInput) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await apiClient.createProduct(payload);
      await queryClient.invalidateQueries({ queryKey: ['seller-products'] });
      await queryClient.invalidateQueries({ queryKey: ['seller-me'] });
      router.push('/panel/productos');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
      setSubmitting(false);
    }
  };

  return (
    <ProductForm
      categories={categoriesQuery.data ?? []}
      maxImagesAllowed={plan === 'pro' ? 10 : 3}
      submitting={submitting}
      serverError={serverError}
      onSubmit={handleSubmit}
      onCancel={() => router.push('/panel/productos')}
    />
  );
}

export default function NuevoProductoPage() {
  return (
    <SellerShell title="Nuevo producto">
      {(store) => <NewProductInner plan={store.plan} />}
    </SellerShell>
  );
}
