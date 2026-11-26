# Fase 3: Multimoneda, EnZona, Zonas de Envío y Pagos (TuVitrina)

## 1. Arquitectura de la Fase 3
1. **Multimoneda (CUP, USD, MLC)**:
   - Cada tienda define su moneda base (`baseCurrency`) y monedas aceptadas (`acceptedCurrencies`).
   - Tasas de cambio editables en el panel del vendedor con fecha de actualización y conversión automática en el carrito (`convertCurrency`).
2. **Medios de Pago Configurables**:
   - Efectivo (con cálculo de vuelto / "pago con"), transferencia con comprobante adjunto, EnZona y Transfermóvil.
   - Instrucciones y datos de cuenta específicos por medio y filtrados por moneda.
3. **Conexión de EnZona por Tienda**:
   - Almacenamiento seguro de credenciales (`clientId` y `clientSecret`) cifradas en reposo con **AES-256-GCM** y clave maestra en variable de entorno del servidor.
   - Botón de prueba de conexión sandbox antes de activar pasarela en producción.
   - Respaldo automático a pago manual si la pasarela no responde.
4. **Zonas de Envío por Municipio**:
   - Configuración de costos y moneda por provincia y municipio.
   - Cálculo automático de envío en el carrito y soporte para recogida en tienda.

---

## 2. Pruebas Automáticas
- Ejecuta las pruebas unitarias y de integración de API:
  ```bash
  npm test
  ```
  Cubre:
  - Conversión multimoneda.
  - CRUD de medios de pago y zonas de envío.
  - Cifrado AES-256-GCM de credenciales de EnZona y prueba de conexión sandbox.
