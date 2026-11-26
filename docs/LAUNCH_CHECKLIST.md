# Launch Checklist — TuVitrina (Producción Cuba)

## 1. Respaldos de Base de Datos (PostgreSQL / Supabase)
- [x] Esquema versionado con Prisma (`apps/api/prisma/schema.prisma`) e índices críticos en `orders`, `payment_transactions`, `stores`, `products`, `support_tickets` y `audit_log`.
- [ ] **En producción:** Activar **Point-in-Time Recovery (PITR)** o snapshots diarios automáticos en Supabase/PostgreSQL + exportación cifrada semanal (`pg_dump --format=custom`) hacia almacenamiento externo redundante.
- [ ] Verificar restauración mensual en base de staging ejecutando `prisma migrate status`.

## 2. Monitoreo y Salud del Servicio
- [x] Endpoint público `GET /api/v1/health` verificando conectividad real de **PostgreSQL** (`up`/`down`) y **Redis** (`up`/`degraded`/`down`) con timestamp ISO.
- [x] Logs estructurados JSON con `pino-http` redactando automáticamente `authorization`, `cookie` y `set-cookie`.
- [ ] **En producción:** Configurar alerta externa (Uptime Kuma / Better Stack / Cloud Monitoring) sobre `GET /api/v1/health` cada 60 s y alerta ante picos de respuestas `5xx` o caída de PostgreSQL.

## 3. Límites, Cuotas y Protección Anti-Abuso
- [x] `RedisThrottlerGuard` activo globalmente (`120 req/min` por defecto) y políticas estrictas en rutas públicas sensibles:
  - `POST /api/v1/storefronts/:slug/orders` (idempotencia por `storeId + idempotencyKey`)
  - `POST /api/v1/storefronts/:slug/reports` (`5 req/min`)
  - `POST /api/v1/support/tickets` (`6 req/min`)
- [x] Límite de payload HTTP en `1mb` (`express.json` y `express.urlencoded`).
- [x] Cuotas por plan (Free vs PRO) leídas dinámicamente desde la tabla `plans_config` (sin valores quemados en frontend ni pérdida de datos al degradar).
- [x] Validación de tamaño y tipo MIME de imágenes comprimidas WebP (`<= 2 MB`) antes de emitir URLs firmadas en Supabase Storage.

## 4. Auditoría Final de Seguridad y Reglas
- [x] Autenticación JWT verificada en servidor (`SupabaseJwtGuard` via JWKS) + control de roles (`RolesGuard` para `seller`, `support`, `admin`).
- [x] Aislamiento estricto por inquilino: toda consulta del panel vendedor filtra por `store.ownerId === req.authUser.profile.id`.
- [x] Credenciales de pasarela **EnZona** cifradas en reposo con AES-256-GCM (`CryptoService`) usando `ENZONA_ENCRYPTION_KEY`; nunca se devuelven en respuestas API.
- [x] Recálculo completo de precios, tasas, promociones, cupones y envío en servidor (`calculateOrderPricing`).
- [x] Neutralización contra inyección de fórmulas CSV en exportación de pedidos (`=`, `+`, `-`, `@`).
- [x] Cabeceras HTTP de seguridad con `helmet` y CORS restringido a `CORS_ORIGINS`.

## 5. Plan de Contingencia
1. **Caída o lentitud de pasarela EnZona:** El backend cambia automáticamente a flujo de respaldo manual (transferencia con comprobante / efectivo contra entrega) y ejecuta conciliación periódica mediante `pg-boss` (`JobsService`).
2. **Caída de Redis:** `RedisService` degrada de forma segura (`checkHealth -> 'down'`) sin tumbar el proceso NestJS; las lecturas públicas consultan PostgreSQL directamente.
3. **Cortes de conectividad en clientes finales:** El Service Worker (`public/sw.js`) + `storefrontCache` mantienen navegables los catálogos visitados y `orderQueue` encola los pedidos offline con clave de idempotencia para sincronizarlos automáticamente sin duplicados al reconectar.
4. **Incidencia en despliegue web:** Revertir al artefacto previo de Turborepo (`pnpm build`) sin alterar datos en PostgreSQL; verificar migraciones antes de cualquier rollback de código.
