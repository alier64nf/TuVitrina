# Informe de Auditoría de Accesibilidad WCAG 2.2 AA — TuVitrina

**Fecha:** 26 de noviembre de 2026  
**Alcance evaluado:** Landing pública (`/`), Centro de Ayuda (`/ayuda`), Herramientas (`/herramientas`), Tienda Pública (`/[slug]`, `/[slug]/productos/[productId]`, `/[slug]/checkout`, `/[slug]/pedido/[trackingToken]`), Onboarding (`/onboarding`) y Panel del Vendedor (`/panel`).  
**Nivel objetivo:** WCAG 2.2 Nivel AA.

---

## 1. Hallazgos encontrados y correcciones implementadas

| # | Criterio WCAG 2.2 | Problema detectado antes de Fase 6 | Corrección implementada | Archivos modificados |
|---|-------------------|------------------------------------|-------------------------|----------------------|
| 1 | **1.3.1 Info y Relaciones / 2.4.1 Omitir bloques** | El enlace `Ir al contenido principal` (`#contenido-principal`) apuntaba a un destino inexistente en las rutas públicas de tienda (`/[slug]`, `/[slug]/productos/[productId]`, `/[slug]/checkout`, `/[slug]/pedido/[trackingToken]`) y faltaba `<main>` semántico. | Se envolvió el contenido principal con `<Container component="main" id="contenido-principal">` en todas las rutas públicas de tienda, onboarding, ayuda, herramientas, offline y landing. | `apps/web/src/app/[slug]/page.tsx`, `productos/[productId]/page.tsx`, `checkout/page.tsx`, `pedido/[trackingToken]/page.tsx`, `onboarding/page.tsx`, `(marketing)/page.tsx`, `ayuda/page.tsx`, `herramientas/page.tsx` |
| 2 | **1.3.1 / 2.4.6 Encabezados y etiquetas** | Las rutas públicas de tienda usaban `<Typography variant="h6">` (`<h6>`) como título principal sin un `<h1>` único en la página, rompiendo la jerarquía secuencial de lectores de pantalla. | Se asignó `component="h1"` al encabezado principal de tienda (`[slug]`), detalle de producto, checkout, seguimiento, onboarding, landing, ayuda y herramientas, y `component="h2"`/`<h3>` en tarjetas subordinadas. | Todas las rutas mencionadas arriba |
| 3 | **2.4.11 / 2.4.13 Apariencia del foco** | El foco por teclado dependía del estilo por defecto del navegador, poco visible sobre fondos M3 personalizados o botones oscuros. | Se añadieron reglas globales `:focus-visible` con contorno sólido de `3px` (`#00796B`) y `outline-offset: 2px`, además de soporte `.skip-link:focus-visible`. | `apps/web/src/app/globals.css` |
| 4 | **2.5.8 Tamaño del objetivo (Mínimo)** | Controles táctiles en tarjetas del carrito (`IconButton size="small"` `-`, `+`, `Trash2`), botones de categoría y botones de cabecera medían `< 36px` de alto/ancho. | Se ampliaron objetivos táctiles interactivos a un mínimo de `40px–46px` (`width/height >= 40px` en carrito y `minHeight: 44px` en navegación, filtros y CTAs). | `apps/web/src/app/[slug]/page.tsx`, `productos/[productId]/page.tsx`, `checkout/page.tsx`, `(marketing)/page.tsx` |
| 5 | **2.1.1 Teclado / 4.1.2 Nombre, función, valor** | Las miniaturas de galería de producto usaban `<Box component="img" onClick={...} />` sin rol ni activación por teclado (`Enter`/`Space`). | Se envolvieron las miniaturas en `<ButtonBase>` accesible con `aria-label` descriptivo por imagen. | `apps/web/src/app/[slug]/productos/[productId]/page.tsx` |
| 6 | **4.1.3 Mensajes de estado** | Al agregar productos al carrito o recibir errores de formulario/envío/estado sin conexión no existían regiones `aria-live`. | Se añadieron regiones `aria-live="polite"` y `role="status"` en `OfflineSyncManager`, carrito (`[slug]`), checkout, onboarding y formulario de soporte (`/ayuda`). | `apps/web/src/components/OfflineSyncManager.tsx`, `[slug]/page.tsx`, `checkout/page.tsx`, `ayuda/page.tsx`, `onboarding/page.tsx` |
| 7 | **1.4.3 Contraste (Mínimo)** | Los temas personalizables por vendedor podían elegir colores claros sobre botones blancos o viceversa. | Se mantiene verificación y ajuste automático WCAG AA (`>= 4.5:1`) en `inspectThemeContrast` / `ensureMinContrast` (`StoreThemeWrapper`), con colores fijos accesibles para WhatsApp, estados de pedido y errores (`#B3261E`). | `apps/web/src/lib/theme/m3Theme.ts`, `apps/web/src/components/StoreThemeWrapper.tsx` |
| 8 | **2.3.3 Animación por interacciones** | No existía regla global para desactivar transiciones/animaciones cuando el usuario activa «Reducir movimiento». | Se agregó `@media (prefers-reduced-motion: reduce)` en `globals.css`. | `apps/web/src/app/globals.css` |

---

## 2. Verificación posterior a correcciones
- Navegación completa por teclado (`Tab`, `Shift+Tab`, `Enter`, `Space`) desde el skip-link hasta el carrito, filtros, formularios y modales (`Dialog` de MUI con trampa de foco y cierre `Esc`).
- Etiquetado explícito en botones de íconos (`aria-label`) y textos alternativos (`alt`) en todas las imágenes de catálogo, marketing y QR.
- Validación TypeScript (`npm run lint`) y compilación Next.js (`npm run build`) sin advertencias ni errores de accesibilidad estructural.
