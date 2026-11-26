'use client';

import React, { useState } from 'react';
import { Box, Button, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { Image as ImageIcon } from 'lucide-react';

interface AdaptiveImageProps {
  src?: string | null;
  alt: string;
  liteMode?: boolean;
  deferInLiteMode?: boolean;
  priority?: boolean;
  sx?: SxProps<Theme>;
  fallbackIcon?: React.ReactNode;
}

export function AdaptiveImage({
  src,
  alt,
  liteMode = false,
  deferInLiteMode = true,
  priority = false,
  sx,
  fallbackIcon,
}: AdaptiveImageProps) {
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          color: 'text.secondary',
          ...sx,
        }}
        aria-label={alt}
      >
        {fallbackIcon ?? <ImageIcon size={28} aria-hidden="true" />}
      </Box>
    );
  }

  if (liteMode && deferInLiteMode && !revealed) {
    return (
      <Stack
        spacing={0.5}
        alignItems="center"
        justifyContent="center"
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: 'action.hover',
          color: 'text.secondary',
          p: 1.5,
          textAlign: 'center',
          ...sx,
        }}
      >
        <ImageIcon size={22} aria-hidden="true" />
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
          Modo ligero activo
        </Typography>
        <Button
          type="button"
          size="small"
          variant="outlined"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setRevealed(true);
          }}
          sx={{ minHeight: 32, py: 0.25, px: 1.25, fontSize: 11 }}
        >
          Ver foto
        </Button>
      </Stack>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'low'}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      sx={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        ...sx,
      }}
    />
  );
}
