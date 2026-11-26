import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from '@material/material-color-utilities';
import { createTheme, type Theme } from '@mui/material/styles';
import type { StoreFontPreset } from '@tuvitrina/contracts';

export const WHATSAPP_BRAND_HEX = '#25D366';
export const MAMEY_ACCENT_HEX = '#FF6B3D';
export const TUVITRINA_SEED_HEX = '#00796B';
export const FIXED_ERROR_HEX = '#B3261E';

export const ORDER_STATUS_COLORS: Record<string, { label: string; color: string }> = {
  created: { label: 'Nuevo', color: '#FF6B3D' },
  confirmed: { label: 'Confirmado', color: '#00796B' },
  preparing: { label: 'Preparando', color: '#0288D1' },
  dispatched: { label: 'Despachado', color: '#7B1FA2' },
  delivered: { label: 'Entregado', color: '#2E7D32' },
  cancelled: { label: 'Cancelado', color: '#C62828' },
};

export const FONT_PRESET_OPTIONS: Array<{
  id: StoreFontPreset;
  label: string;
  description: string;
  headingFont: string;
  bodyFont: string;
}> = [
  {
    id: 'outfit',
    label: 'Outfit + Roboto',
    description: 'Moderna, limpia y de alta legibilidad.',
    headingFont: '"Outfit", "Roboto", sans-serif',
    bodyFont: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  {
    id: 'plus-jakarta',
    label: 'Plus Jakarta + DM Sans',
    description: 'Comercial y dinámica para boutiques y moda.',
    headingFont: '"Plus Jakarta Sans", "DM Sans", sans-serif',
    bodyFont: '"DM Sans", "Roboto", sans-serif',
  },
  {
    id: 'fraunces',
    label: 'Fraunces + DM Sans',
    description: 'Editorial y cálida para dulcería, café y artesanía.',
    headingFont: '"Fraunces", "Georgia", serif',
    bodyFont: '"DM Sans", "Roboto", sans-serif',
  },
  {
    id: 'archivo',
    label: 'Archivo + Roboto',
    description: 'Técnica y contundente para electrónica y ferretería.',
    headingFont: '"Archivo", "Roboto", sans-serif',
    bodyFont: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 121, 107];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function getContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return Math.round(((bright + 0.05) / (dark + 0.05)) * 100) / 100;
}

function blendHex(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function ensureMinContrast(
  fgHex: string,
  bgHex: string,
  minRatio = 4.5,
): { color: string; adjusted: boolean } {
  if (getContrastRatio(fgHex, bgHex) >= minRatio) {
    return { color: fgHex.toUpperCase(), adjusted: false };
  }

  const bgLum = relativeLuminance(bgHex);
  const target = bgLum > 0.4 ? '#0B0F0E' : '#FFFFFF';

  for (let step = 1; step <= 24; step += 1) {
    const candidate = blendHex(fgHex, target, step / 24);
    if (getContrastRatio(candidate, bgHex) >= minRatio) {
      return { color: candidate, adjusted: true };
    }
  }
  return { color: target, adjusted: true };
}

export interface ThemeContrastReport {
  primary: string;
  onPrimary: string;
  background: string;
  paper: string;
  textPrimary: string;
  textSecondary: string;
  outline: string;
  primaryOnBgRatio: number;
  primaryButtonRatio: number;
  textOnBgRatio: number;
  autoAdjusted: boolean;
}

export function inspectThemeContrast(
  mode: 'light' | 'dark' = 'light',
  seedHex = TUVITRINA_SEED_HEX,
): ThemeContrastReport {
  const safeSeed = /^#[0-9A-Fa-f]{6}$/.test(seedHex) ? seedHex : TUVITRINA_SEED_HEX;
  const m3 = themeFromSourceColor(argbFromHex(safeSeed));
  const scheme = mode === 'dark' ? m3.schemes.dark : m3.schemes.light;

  const rawPrimary = hexFromArgb(scheme.primary);
  const rawOnPrimary = hexFromArgb(scheme.onPrimary);
  const background = mode === 'light' ? '#F8FAF9' : hexFromArgb(scheme.background);
  const paper = mode === 'light' ? '#FFFFFF' : hexFromArgb(scheme.surface);
  const rawTextPrimary = hexFromArgb(scheme.onSurface);
  const rawTextSecondary = hexFromArgb(scheme.onSurfaceVariant);
  const outline = hexFromArgb(scheme.outlineVariant);

  const primaryAdj = ensureMinContrast(rawPrimary, paper, 4.5);
  const onPrimaryAdj = ensureMinContrast(rawOnPrimary, primaryAdj.color, 4.5);
  const textAdj = ensureMinContrast(rawTextPrimary, paper, 7.0);
  const textSecAdj = ensureMinContrast(rawTextSecondary, paper, 4.5);

  return {
    primary: primaryAdj.color,
    onPrimary: onPrimaryAdj.color,
    background,
    paper,
    textPrimary: textAdj.color,
    textSecondary: textSecAdj.color,
    outline,
    primaryOnBgRatio: getContrastRatio(primaryAdj.color, paper),
    primaryButtonRatio: getContrastRatio(onPrimaryAdj.color, primaryAdj.color),
    textOnBgRatio: getContrastRatio(textAdj.color, paper),
    autoAdjusted: primaryAdj.adjusted || onPrimaryAdj.adjusted || textAdj.adjusted || textSecAdj.adjusted,
  };
}

export function buildM3Theme(
  mode: 'light' | 'dark' = 'light',
  seedHex = TUVITRINA_SEED_HEX,
  fontPreset: StoreFontPreset = 'outfit',
): Theme {
  const report = inspectThemeContrast(mode, seedHex);
  const fontOpt =
    FONT_PRESET_OPTIONS.find((f) => f.id === fontPreset) ?? FONT_PRESET_OPTIONS[0];

  const secondaryAccent = ensureMinContrast(MAMEY_ACCENT_HEX, '#FFFFFF', 3.0);

  return createTheme({
    palette: {
      mode,
      primary: {
        main: report.primary,
        contrastText: report.onPrimary,
      },
      secondary: {
        main: MAMEY_ACCENT_HEX,
        contrastText: secondaryAccent.color === '#FFFFFF' ? '#FFFFFF' : '#111111',
      },
      background: {
        default: report.background,
        paper: report.paper,
      },
      text: {
        primary: report.textPrimary,
        secondary: report.textSecondary,
      },
      divider: report.outline,
      error: {
        main: FIXED_ERROR_HEX,
        contrastText: '#FFFFFF',
      },
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: fontOpt.bodyFont,
      h1: { fontFamily: fontOpt.headingFont, fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontFamily: fontOpt.headingFont, fontWeight: 700, letterSpacing: '-0.015em' },
      h3: { fontFamily: fontOpt.headingFont, fontWeight: 600 },
      h4: { fontFamily: fontOpt.headingFont, fontWeight: 600 },
      h5: { fontFamily: fontOpt.headingFont, fontWeight: 600 },
      h6: { fontFamily: fontOpt.headingFont, fontWeight: 600 },
      button: {
        fontFamily: fontOpt.bodyFont,
        fontWeight: 600,
        textTransform: 'none',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 48,
            borderRadius: 12,
            paddingLeft: 18,
            paddingRight: 18,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            minWidth: 44,
            minHeight: 44,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            border: `1px solid ${report.outline}`,
            boxShadow: 'none',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          fullWidth: true,
        },
      },
    },
  });
}
