# TuVitrina · Fase 4: Planes, Suscripción PRO, Moderación y Backoffice Administrador

## 1. Resumen de Implementación
En esta fase se implementó la gestión dinámica de planes (Free y PRO), el flujo completo de suscripción y renovación PRO mediante comprobante de pago manual (CUP y USD), la moderación de contenido y abusos ciudadana, y el backoffice integral para administradores y soporte.

## 2. Componentes Clave

### A. Configuración Dinámica de Planes (`plans_config`)
- Colección/tabla `plans_config` en PostgreSQL que almacena los límites de Free y PRO:
  - Plan Free: 50 productos, 3 imágenes por producto, 15 categorías.
  - Plan PRO: 100.000 productos, 10 imágenes por producto, 200 categorías, multimoneda y pasarelas.
  - Tarifas: 3.000 CUP / 10 USD por 60 días.
  - Instrucciones de pago parametrizables.
- Aplicación de límites con mensajes claros en español cubano.
- **Sin pérdida de datos**: si una tienda PRO se degrada a Free tras el vencimiento, los productos y categorías existentes se conservan intactos; únicamente se impide crear nuevos elementos por encima del tope.

### B. Suscripción PRO con Pago Manual
- Pantalla en panel del vendedor (`/panel/suscripcion`):
  - Estado del plan actual y contador de días restantes (`daysUntilPlanExpiration`).
  - Avisos preventivos a los 7 días y urgente a 1 día del vencimiento.
  - Formulario de solicitud con selector de moneda (CUP / USD), medio de pago, código de referencia y subida de comprobante comprimido en el cliente a WebP.
  - Tabla con historial de solicitudes y estados (`pending`, `approved`, `rejected` con motivo).

### C. Moderación Ciudadana y Reportes
- Botón y modal de reporte (`ReportModal`) integrado en el pie del catálogo público (`/[slug]`) y en el detalle de productos (`/[slug]/productos/[productId]`).
- Protección anti-spam mediante límite de frecuencia en Redis (`RateLimit`).
- Estados de reporte: `open`, `reviewing`, `resolved`, `dismissed` con nota de resolución.

### D. Backoffice Administrador y Soporte (`/admin`)
- Control de acceso por roles (`admin` y `support`).
- Dashboard de métricas en tiempo real: tiendas activas, suspendidas, pedidos totales, usuarios y tasa de conversión Free a PRO.
- Cola de revisión de suscripciones: aprobación con activación inmediata del plan PRO y fijación de fecha de expiración (`now + durationDays`), o rechazo con motivo.
- Gestión de tiendas: buscador, filtro por estado y plan, modal de suspensión obligatoria con motivo que invalida la caché en Redis y bloquea el acceso público (404), y reactivación.
- Cola de reportes con acciones de resolución y notas.
- Directorio de usuarios y visor inmutable de registro de auditoría (`audit_log`).

### E. Políticas Legales y Contenido
- `/terminos`: Términos de uso de la plataforma.
- `/privacidad`: Política de privacidad.
- `/contenido`: Política de contenido y convivencia para Cuba con versión `2026-11-v1`.

## 3. Pruebas Automatizadas
- Suite de pruebas de integración `test/phase4.e2e-spec.ts`:
  1. Consulta pública de configuración y límites.
  2. Solicitud de suscripción PRO por el vendedor con comprobante.
  3. Rechazo de acceso a usuarios no autorizados (403 Forbidden).
  4. Aprobación por administrador y activación inmediata del plan PRO con fecha de vencimiento.
  5. Envío de reporte de contenido desde el escaparate público.
  6. Moderación y resolución del reporte por parte del administrador.
  7. Suspensión de tienda con motivo y bloqueo público inmediato (404 Not Found).
- Resultado global: 17/17 pruebas pasando en Jest across Fases 1, 2, 3 y 4.
