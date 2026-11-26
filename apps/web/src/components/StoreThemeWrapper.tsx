'use client';

import React, { useMemo } from 'react';
import { Box, ThemeProvider } from '@mui/material';
import type { StoreThemeConfig } from '@tuvitrina/contracts';
import { buildM3Theme, TUVITRINA_SEED_HEX } from '@/lib/theme/m3Theme';

export function StoreThemeWrapper({
  themeConfig,
  children,
}: {
  themeConfig?: StoreThemeConfig | null;
  children: React.ReactNode;
}) {
  const theme = useMemo(() => {
    const mode = themeConfig?.mode === 'dark' ? 'dark' : 'light';
    const seed = themeConfig?.seedColor || TUVITRINA_SEED_HEX;
    const font = themeConfig?.fontFamily || 'outfit';
    return buildM3Theme(mode, seed, font);
  }, [themeConfig?.mode, themeConfig?.seedColor, themeConfig?.fontFamily]);

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary',
        }}
      >
        {children}
      </Box>
    </ThemeProvider>
  );
}
