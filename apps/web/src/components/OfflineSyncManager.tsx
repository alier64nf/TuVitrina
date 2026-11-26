'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Box, Button, Snackbar, Stack, Typography } from '@mui/material';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import type { TuVitrinaApiClient } from '@tuvitrina/contracts';
import {
  flushOrderQueue,
  ORDER_QUEUE_EVENT,
  readOrderQueue,
  type QueuedOrderItem,
} from '@/lib/offline/orderQueue';

interface OfflineSyncManagerProps {
  apiClient: TuVitrinaApiClient;
}

export function OfflineSyncManager({ apiClient }: OfflineSyncManagerProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<QueuedOrderItem | null>(null);

  const refreshQueueCount = () => {
    const queue = readOrderQueue();
    setPendingCount(queue.filter((q) => q.status === 'pending' || q.status === 'error' || q.status === 'syncing').length);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(window.navigator.onLine);
    refreshQueueCount();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    }

    const triggerSync = async () => {
      if (!window.navigator.onLine) return;
      const pending = readOrderQueue().some((q) => q.status === 'pending' || q.status === 'error');
      if (!pending) {
        refreshQueueCount();
        return;
      }
      setSyncing(true);
      try {
        const res = await flushOrderQueue(apiClient);
        if (res.syncedItems.length > 0) {
          setLastSynced(res.syncedItems[res.syncedItems.length - 1]);
        }
      } finally {
        setSyncing(false);
        refreshQueueCount();
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      void triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleQueueUpdated = () => {
      refreshQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(ORDER_QUEUE_EVENT, handleQueueUpdated);

    // Initial check + periodic retry every 25s when tab is active
    void triggerSync();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void triggerSync();
      }
    }, 25_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(ORDER_QUEUE_EVENT, handleQueueUpdated);
      window.clearInterval(timer);
    };
  }, [apiClient]);

  const handleManualRetry = async () => {
    setSyncing(true);
    try {
      const res = await flushOrderQueue(apiClient);
      if (res.syncedItems.length > 0) {
        setLastSynced(res.syncedItems[res.syncedItems.length - 1]);
      }
    } finally {
      setSyncing(false);
      refreshQueueCount();
    }
  };

  return (
    <>
      {!isOnline || pendingCount > 0 ? (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1300,
            bgcolor: !isOnline ? '#7C2D12' : '#065F46',
            color: '#FFFFFF',
            px: 2,
            py: 1,
            borderBottom: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            maxWidth="lg"
            mx="auto"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              {!isOnline ? <WifiOff size={18} aria-hidden="true" /> : <Wifi size={18} aria-hidden="true" />}
              <Typography variant="body2" fontWeight={600}>
                {!isOnline
                  ? `Sin conexión · Puedes navegar el catálogo en caché${
                      pendingCount > 0 ? ` (${pendingCount} pedido${pendingCount === 1 ? '' : 's'} en cola)` : ''
                    }.`
                  : syncing
                    ? `Enviando ${pendingCount} pedido${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}...`
                    : `${pendingCount} pedido${pendingCount === 1 ? '' : 's'} guardado${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'} de envío.`}
              </Typography>
            </Stack>
            {isOnline && pendingCount > 0 ? (
              <Button
                size="small"
                variant="contained"
                onClick={handleManualRetry}
                disabled={syncing}
                startIcon={<RefreshCw size={14} />}
                sx={{
                  bgcolor: '#FFFFFF',
                  color: '#065F46',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#ECFDF5' },
                }}
              >
                Reintentar envío
              </Button>
            ) : null}
          </Stack>
        </Box>
      ) : null}

      <Snackbar
        open={Boolean(lastSynced)}
        autoHideDuration={12000}
        onClose={() => setLastSynced(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {lastSynced ? (
          <Alert
            severity="success"
            variant="filled"
            onClose={() => setLastSynced(null)}
            action={
              lastSynced.syncedTrackingToken ? (
                <Button
                  component={Link}
                  href={`/${lastSynced.slug}/pedido/${lastSynced.syncedTrackingToken}`}
                  size="small"
                  color="inherit"
                  sx={{ fontWeight: 700 }}
                >
                  Ver pedido #{lastSynced.syncedOrderNumber}
                </Button>
              ) : null
            }
          >
            Tu pedido guardado sin conexión en {lastSynced.storeName} se envió automáticamente (#
            {lastSynced.syncedOrderNumber}).
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
