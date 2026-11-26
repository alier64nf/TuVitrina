# Fase 6: PWA, Modo Ligero, Accesibilidad WCAG 2.2 AA, Centro de Ayuda, Herramientas y Lanzamiento (TuVitrina)

## 1. PWA Instalable y Modo Sin Conexión
- **Manifiesto Web (`/manifest.webmanifest`) y Assets**:
  - Definido en `apps/web/src/app/manifest.ts` con `display: 'standalone'`, `theme_color: '#00796B'`, iconos `/pwa-192x192.png`, `/pwa-512x512.png`, `/apple-touch-icon.png` y `/icon.svg`, más accesos rápidos (`/ayuda`, `/herramientas`).
  - Prompt de instalación contextual (`PWAInstallButton` + `usePWAInstall`) disponible en la cabecera de la tienda pública y en la landing principal.
- **Service Worker (`apps/web/public/sw.js`)**:
  - **Precaché de App Shell**: `/`, `/offline`, `/ayuda`, `/herramientas`, `/manifest.webmanifest` e iconos PWA.
  - **Catálogo con Stale-While-Revalidate (`GET /api/v1/storefronts/*`)**: devuelve inmediatamente la copia en caché y actualiza en segundo plano; al detectar un nuevo catálogo emite `STOREFRONT_UPDATED` por `BroadcastChannel('tuvitrina-sync')`.
  - **Imágenes Cache-First**: almacenamiento acotado en `tuvitrina-images-v6`.
  - **Respaldo de navegación**: página `/offline` cuando no existe caché previa para la ruta solicitada.
- **Caché de Catálogo y Cola de Pedidos Sin Conexión**:
  - `storefrontCache.ts` persiste el último catálogo por tienda en `localStorage` con marca de tiempo (`cachedAt`).
  - `orderQueue.ts` guarda pedidos en cola cuando no hay conexión (o ante fallo transitorio de red) junto con una `idempotencyKey` única.
  - `OfflineSyncManager.tsx` detecta el evento `online`, reintenta automáticamente contra `POST /api/v1/storefronts/:slug/orders` y muestra avisos accesibles (`aria-live="polite"`) de estado sin conexión, actualización en segundo plano y pedidos sincronizados.
  - **Idempotencia en Backend (`StorefrontService.placeOrder`)**: busca pedidos existentes por `(storeId, idempotencyKey)` y maneja colisiones `P2002`, garantizando que los reintentos offline nunca dupliquen pedidos ni incrementen `orderSeq` dos veces.

---

## 2. Modo Ligero y Presupuestos de Rendimiento (Medidos)
- **Controles de Modo Ligero (`apps/web/src/lib/offline/liteMode.ts` y `AdaptiveImage.tsx`)**:
  - Detección automática de `navigator.connection.saveData` o conexiones `slow-2g` / `2g`, más interruptor manual persistente por usuario en la cabecera de cada tienda.
  - En Modo Ligero activo, las imágenes de catálogo pasan a carga diferida bajo demanda (`Cargar foto` por producto) evitando descargas innecesarias en redes móviles lentas.
  - División de código (`next/dynamic`) aplicada a componentes secundarios como `ReportModal`.
- **Medición real de compilación (`NODE_ENV=production next build` — Next.js 15.5.29)**:
  - **JS compartido global**: `103 kB`
  - **Landing pública (`/`)**: `8.0 kB` de ruta (`226 kB` First Load JS) — presupuesto ruta `<= 15 kB` (cumplido)
  - **Página offline (`/offline`)**: `3.0 kB` de ruta (`148 kB` First Load JS) — presupuesto total `<= 180 kB` (cumplido)
  - **Centro de Ayuda (`/ayuda`)**: `7.49 kB` de ruta (`237 kB` First Load JS) — presupuesto ruta `<= 15 kB` (cumplido)
  - **Herramientas gratuitas (`/herramientas`)**: `7.16 kB` de ruta (`247 kB` First Load JS) — presupuesto ruta `<= 15 kB` (cumplido)
  - **Tienda pública (`/[slug]`)**: `10.5 kB` de ruta (`264 kB` First Load JS) — presupuesto ruta `<= 20 kB` (cumplido)
  - **Detalle de producto (`/[slug]/productos/[productId]`)**: `4.41 kB` de ruta (`252 kB` First Load JS) — presupuesto ruta `<= 15 kB` (cumplido)
  - **Checkout (`/[slug]/checkout`)**: `14.9 kB` de ruta (`254 kB` First Load JS) — presupuesto ruta `<= 20 kB` (cumplido)
  - **Seguimiento (`/[slug]/pedido/[trackingToken]`)**: `8.25 kB` de ruta (`218 kB` First Load JS) — presupuesto total `<= 250 kB` (cumplido)

---

## 3. Auditoría WCAG 2.2 AA, Soporte, Onboarding, Herramientas y Documentación Operativa
- **Informe de Accesibilidad**: ver `/docs/WCAG_2_2_AA_AUDIT_REPORT.md` (skip-links válidos hacia `<main id="contenido-principal">`, jerarquía `<h1>` única, foco `:focus-visible`, objetivos táctiles `>= 40px–46px`, miniaturas de galería con `<ButtonBase>`, regiones `aria-live="polite"` y `@media (prefers-reduced-motion: reduce)`).
- **Landing Pública (`/`)**: funcionalidades, flujo en 3 pasos, planes Free y PRO dinámicos, preguntas frecuentes y enlaces directos a Ayuda y Herramientas.
- **Centro de Ayuda y Soporte (`/ayuda`)**: buscador sobre los 10 temas principales de operación en Cuba, canales directos de WhatsApp y Telegram, y formulario persistente conectado a `POST /api/v1/support/tickets` con gestión en `/admin` (pestaña Soporte).
- **Onboarding y Checklist de Activación (`/onboarding` y `/panel`)**: checklist interactivo de 6 pasos con barra de progreso y accesos directos según el estado real de la tienda.
- **Herramientas Gratuitas (`/herramientas`)**: generador de QR descargable (PNG/SVG), generador de enlace de WhatsApp `+53` con mensaje previo y calculadora de precio de venta en CUP/USD/MLC considerando margen, costo de envío y comisión.
- **Dominios Propios PRO**: documentado en `/docs/CUSTOM_DOMAINS_PRO_GUIDE.md` y visible en `/panel/personalizacion` (explica el flujo CNAME/TXT y la limitación de sandbox).
- **Lista de Verificación de Lanzamiento**: ver `/docs/LAUNCH_CHECKLIST.md` (respaldos PostgreSQL/Supabase, monitoreo, límites de frecuencia, verificación de guards/reglas y plan de contingencia).

---

## 4. Pruebas Automatizadas (Fase 6)
- Suite backend `apps/api/test/phase6.e2e-spec.ts` ejecutada con Jest:
  - Idempotencia de pedidos ante reintentos de cola sin conexión (`idempotencyKey` duplicado devuelve el mismo `orderId`, `orderSeq` y `trackingToken` sin descontar ni duplicar).
  - Creación de tickets de soporte en `/api/v1/support/tickets`, listado y actualización de estado en `/api/v1/admin/support-tickets` con control de acceso por rol (`admin`/`support` vs `seller`).
