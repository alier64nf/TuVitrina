'use client';

import type { StorefrontViewDto } from '@tuvitrina/contracts';

const CACHE_PREFIX = 'tuvitrina:storefront-cache:v1:';

export interface CachedStorefrontEntry {
  data: StorefrontViewDto;
  cachedAt: string;
}

export function saveCachedStorefront(slug: string, data: StorefrontViewDto): void {
  if (typeof window === 'undefined' || !slug) return;
  try {
    const entry: CachedStorefrontEntry = {
      data,
      cachedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(`${CACHE_PREFIX}${slug}`, JSON.stringify(entry));
  } catch {
    // Ignore quota exceeded on low-end devices
  }
}

export function loadCachedStorefront(slug: string): CachedStorefrontEntry | null {
  if (typeof window === 'undefined' || !slug) return null;
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedStorefrontEntry;
    if (!parsed || !parsed.data || !parsed.data.store) return null;
    return parsed;
  } catch {
    return null;
  }
}
