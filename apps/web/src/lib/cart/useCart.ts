'use client';

import { useEffect, useState } from 'react';
import type { CurrencyCode, ProductDto, ProductVariantDto } from '@tuvitrina/contracts';

export interface CartItem {
  cartLineId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  unitPrice: number;
  currency: CurrencyCode;
  quantity: number;
  imageUrl?: string;
}

const CART_STORAGE_KEY = 'tuvitrina_cart_v1';

export function useCart(storeSlug: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const storageKey = `${CART_STORAGE_KEY}_${storeSlug}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setItems(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items, loaded, storageKey]);

  const addItem = (product: ProductDto, variant?: ProductVariantDto, quantity = 1) => {
    const variantId = variant?.id ?? null;
    const cartLineId = variantId ? `${product.id}_${variantId}` : product.id;
    const unitPrice = variant?.priceOverride !== null && variant?.priceOverride !== undefined ? variant.priceOverride : product.price;
    const variantLabel = variant?.label ?? null;
    const imageUrl = product.images[0]?.publicUrl;

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.cartLineId === cartLineId);
      if (existingIndex >= 0) {
        const copy = [...prev];
        const current = copy[existingIndex]!;
        copy[existingIndex] = {
          ...current,
          quantity: current.quantity + quantity,
        };
        return copy;
      }
      return [
        ...prev,
        {
          cartLineId,
          productId: product.id,
          variantId,
          productName: product.name,
          variantLabel,
          unitPrice,
          currency: product.currency,
          quantity,
          imageUrl,
        },
      ];
    });
  };

  const updateQuantity = (cartLineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartLineId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.cartLineId === cartLineId ? { ...i, quantity } : i)),
    );
  };

  const removeItem = (cartLineId: string) => {
    setItems((prev) => prev.filter((i) => i.cartLineId !== cartLineId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalCount = items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);

  return {
    items,
    loaded,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    totalCount,
    subtotal,
  };
}
