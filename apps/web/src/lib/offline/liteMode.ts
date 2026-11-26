'use client';

import { useCallback, useEffect, useState } from 'react';

const LITE_MODE_KEY = 'tuvitrina:lite-mode:v1';
export const LITE_MODE_EVENT = 'tuvitrina:lite-mode-changed';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export function detectSlowNetwork(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g';
}

export function useLiteMode() {
  const [liteMode, setLiteModeState] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const readPreference = () => {
      const saved = window.localStorage.getItem(LITE_MODE_KEY);
      if (saved === 'on') {
        setLiteModeState(true);
        setAutoDetected(false);
      } else if (saved === 'off') {
        setLiteModeState(false);
        setAutoDetected(false);
      } else {
        const slow = detectSlowNetwork();
        setLiteModeState(slow);
        setAutoDetected(slow);
      }
    };

    readPreference();

    const handleCustom = () => readPreference();
    window.addEventListener(LITE_MODE_EVENT, handleCustom);

    const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
    conn?.addEventListener?.('change', handleCustom);

    return () => {
      window.removeEventListener(LITE_MODE_EVENT, handleCustom);
      conn?.removeEventListener?.('change', handleCustom);
    };
  }, []);

  const setLiteMode = useCallback((enabled: boolean) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LITE_MODE_KEY, enabled ? 'on' : 'off');
    setLiteModeState(enabled);
    setAutoDetected(false);
    window.dispatchEvent(new CustomEvent(LITE_MODE_EVENT));
  }, []);

  const toggleLiteMode = useCallback(() => {
    setLiteMode(!liteMode);
  }, [liteMode, setLiteMode]);

  return { liteMode, autoDetected, setLiteMode, toggleLiteMode };
}
