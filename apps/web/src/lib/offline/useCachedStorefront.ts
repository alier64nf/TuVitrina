'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { StorefrontViewDto, TuVitrinaApiClient } from '@tuvitrina/contracts';
import { loadCachedStorefront, saveCachedStorefront } from './storefrontCache';

export function useCachedStorefront(apiClient: TuVitrinaApiClient, slug: string) {
  const [cachedMeta, setCachedMeta] = useState<{
    fromCache: boolean;
    cachedAt: string | null;
    backgroundUpdated: boolean;
  }>({
    fromCache: false,
    cachedAt: null,
    backgroundUpdated: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !slug || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('tuvitrina-sync');
    const handler = (event: MessageEvent) => {
      const msg = event.data as { type?: string; url?: string } | undefined;
      if (msg?.type === 'STOREFRONT_UPDATED' && msg.url?.includes(`/api/v1/storefronts/${slug}`)) {
        setCachedMeta((prev) => ({ ...prev, backgroundUpdated: true }));
      }
    };
    channel.addEventListener('message', handler);
    return () => {
      channel.removeEventListener('message', handler);
      channel.close();
    };
  }, [slug]);

  const query = useQuery<StorefrontViewDto>({
    queryKey: ['storefront', slug],
    enabled: Boolean(slug),
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const fresh = await apiClient.getStorefront(slug);
        saveCachedStorefront(slug, fresh);
        setCachedMeta({
          fromCache: typeof navigator !== 'undefined' ? !navigator.onLine : false,
          cachedAt: new Date().toISOString(),
          backgroundUpdated: false,
        });
        return fresh;
      } catch (err) {
        const fallback = loadCachedStorefront(slug);
        if (fallback) {
          setCachedMeta({
            fromCache: true,
            cachedAt: fallback.cachedAt,
            backgroundUpdated: false,
          });
          return fallback.data;
        }
        throw err;
      }
    },
  });

  return {
    ...query,
    fromCache: cachedMeta.fromCache,
    cachedAt: cachedMeta.cachedAt,
    backgroundUpdated: cachedMeta.backgroundUpdated,
    refreshStorefront: async () => {
      setCachedMeta((prev) => ({ ...prev, backgroundUpdated: false }));
      await query.refetch();
    },
  };
}
