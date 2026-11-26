'use client';

import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { ES_CU } from '@/lib/i18n/es-cu';

export function OfflineBanner({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <Alert
      severity="warning"
      icon={<WifiOff size={18} />}
      sx={{ mb: 2, borderRadius: 3 }}
    >
      {ES_CU.offlineBanner}
    </Alert>
  );
}

export function SupabaseSetupNotice() {
  return (
    <Alert severity="info" sx={{ mb: 2, borderRadius: 3 }}>
      <Typography variant="subtitle2" fontWeight={700}>
        {ES_CU.setupRequiredTitle}
      </Typography>
      <Typography variant="body2">{ES_CU.setupRequiredBody}</Typography>
    </Alert>
  );
}

export function PageSkeleton() {
  return (
    <Stack spacing={2} aria-label="Cargando contenido">
      <Skeleton variant="rounded" height={40} width="55%" />
      <Skeleton variant="rounded" height={120} />
      <Skeleton variant="rounded" height={120} />
    </Stack>
  );
}

export function EmptyStateCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card>
      <CardContent sx={{ py: 5, textAlign: 'center' }}>
        <Stack spacing={1.5} alignItems="center" maxWidth={420} mx="auto">
          {icon ? (
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '14px',
                bgcolor: 'rgba(0, 121, 107, 0.1)',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {icon}
            </Box>
          ) : null}
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          {actionLabel && onAction ? (
            <Button variant="contained" onClick={onAction} sx={{ mt: 1 }}>
              {actionLabel}
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ErrorStateCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5} alignItems="flex-start">
          <Stack direction="row" spacing={1} alignItems="center" color="error.main">
            <AlertTriangle size={20} />
            <Typography variant="subtitle1" fontWeight={700}>
              No se pudo cargar esta sección
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
          {onRetry ? (
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={16} />}
              onClick={onRetry}
            >
              Reintentar
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
