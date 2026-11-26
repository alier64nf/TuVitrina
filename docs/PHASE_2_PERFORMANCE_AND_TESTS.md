# Fase 2: Tienda pública, recálculo de precios y pedidos (TuVitrina)

## 1. Arquitectura de la Fase 2
1. **Tienda Pública (`/[slug]`)**:
   - Renderizada con componentes de servidor y caché en Redis con invalidación automática al modificar la tienda o el catálogo (`cacheVersion`).
   - Cabecera con estado de apertura automático según los horarios configurados por día (`hours.weekly`).
   - Cuadrícula adaptativa de productos (2, 3 o 4 columnas), chips de categorías y buscador en tiempo real.
2. **Recálculo de precios en el servidor (`POST /api/v1/storefronts/[slug]/orders`)**:
   - El navegador envía únicamente los identificadores de productos, variantes y cantidades.
   - El backend de NestJS consulta la base de datos, valida existencias/estado activo y calcula de forma autoritativa subtotales, descuentos y totales.
   - Asignación atómica de número correlativo (`orderSeq`) por tienda mediante transacciones serializables en PostgreSQL.
3. **Panel de Pedidos del Vendedor (`/panel/pedidos`)**:
   - Listado en tiempo real con filtros por estado (`created`, `confirmed`, `preparing`, `dispatched`, `delivered`, `cancelled`).
   - Al confirmar un pedido por primera vez (`confirmed`), el servidor descuenta automáticamente el stock de los productos.
   - Botón directo para iniciar chat en WhatsApp con el cliente con el mensaje preformateado.
4. **Seguimiento del Cliente (`/[slug]/pedido/[trackingToken]`)**:
   - Página de lectura pública donde el cliente final sigue el estado de su pedido en tiempo real mediante sondeo (polling).

---

## 2. Pruebas de Extremo a Extremo (E2E)
- Ejecuta las pruebas automatizadas del backend con Jest:
  ```bash
  npm test
  ```
  Cubre:
  - Carga de la tienda pública con productos y estado.
  - Checkout como invitado con recálculo de precios en servidor y generación de enlace WhatsApp con formato maestro.
  - Listado y actualización de estados de pedidos en el panel del vendedor.

---

## 3. Presupuesto de Rendimiento
- **Tamaño del bundle inicial (Next.js)**: < 95 KB por página.
- **Tiempo de respuesta de tienda pública (`GET /api/v1/storefronts/:slug`)**: < 45 ms (con caché de Redis).
- **Compresión de imágenes**: Máximo 2 MB por foto comprimida a WebP en el navegador antes de subir a Supabase Storage.
