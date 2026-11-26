# Pruebas manuales de seguridad, RLS y Storage (Fase 1)

En la arquitectura **TuVitrina v2**, las reglas de Firestore y Firebase Storage se corresponden con:
1. **PostgreSQL Row Level Security (RLS) sin políticas** en todas las tablas del esquema `public` (bloqueo total a la API REST automática de Supabase).
2. **NestJS `SupabaseJwtGuard` + `RolesGuard` + verificación de propiedad (`ownerId`)** en todos los endpoints privados.
3. **Supabase Storage con URLs firmadas** generadas únicamente por el servidor (`POST /api/v1/media/signed-upload`) bajo el prefijo `${store.id}/`.

---

## 1. Verificación de RLS en Supabase PostgreSQL (`anon` y `authenticated` denegados)

1. Ejecuta la migración `apps/api/prisma/migrations/20261124000000_init/migration.sql` en tu proyecto Supabase.
2. En el SQL Editor de Supabase, comprueba que las 19 tablas tienen `rowsecurity = true` y 0 políticas públicas:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY tablename;

   SELECT tablename, policyname
   FROM pg_policies
   WHERE schemaname = 'public';
   ```
   **Resultado esperado**: todas las filas muestran `rowsecurity = true` y la consulta de políticas devuelve `0` filas.
3. Prueba una petición directa a PostgREST con la `ANON_KEY` (o un JWT de usuario autenticado):
   ```bash
   curl -i "https://<TU-PROYECTO>.supabase.co/rest/v1/products?select=*" \
     -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
     -H "Authorization: Bearer <NEXT_PUBLIC_SUPABASE_ANON_KEY>"
   ```
   **Resultado esperado**: `200 OK` con arreglo vacío `[]` (o error de permiso) y **nunca** devuelve filas de ninguna tienda; intentos de `POST`/`PATCH`/`DELETE` devuelven `401`/`403` (`new row violates row-level security policy`).

---

## 2. Verificación de políticas de Supabase Storage (`product-images` y `store-assets`)

1. Crea en Supabase Storage los buckets:
   - `product-images` (público para lectura GET, **sin políticas de INSERT/UPDATE/DELETE para `anon` ni `authenticated`**).
   - `store-assets` (público para lectura GET, **sin políticas de escritura directa desde cliente**).
2. Verifica que un cliente autenticado NO puede subir archivos directamente sin URL firmada del backend:
   ```bash
   curl -i -X POST "https://<TU-PROYECTO>.supabase.co/storage/v1/object/product-images/tienda-ajena/hack.webp" \
     -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
     -H "Authorization: Bearer <JWT_VENDEDOR_A>" \
     -H "Content-Type: image/webp" \
     --data-binary "@foto.webp"
   ```
   **Resultado esperado**: `403 Unauthorized` / `new row violates row-level security policy`.
3. Verifica la subida autorizada vía NestJS:
   - Llama `POST /api/v1/media/signed-upload` con `Bearer <JWT_VENDEDOR_A>`, `{ "bucket": "product-images", "mimeType": "image/webp", "sizeBytes": 120000 }`.
   - Comprueba que `objectPath` comienza exactamente por `<storeId_de_A>/<uuid>.webp`.
   - Si intentas guardar un producto adjuntando un `objectPath` que empieza por `<storeId_de_B>/`, `POST /api/v1/stores/me/products` responde `400` (`Una de las imágenes no corresponde a tu tienda`).

---

## 3. Verificación de aislamiento multi-tienda y privilegios

1. Registra dos cuentas (`vendedor-a@correo.cu` y `vendedor-b@correo.cu`) aceptando los términos.
2. Intenta enviar `"role": "admin"` en `POST /api/v1/auth/sync-profile` → el servidor lo ignora y asigna `role: "seller"`.
3. Con el token de B, solicita `GET /api/v1/stores/me/products/<productId_de_A>`, `PATCH .../sold-out`, `DELETE ...` → todas responden `404` sin exponer existencia ni datos de la tienda A.
4. Ejecuta la suite automatizada en `apps/api`:
   ```bash
   npm test
   ```
   Cubre autenticación JWT, registro idempotente, onboarding transaccional con conflicto de `slug` (`409`), reordenamiento atómico de categorías, variantes de hasta 3 atributos, cálculo de descuento con `compareAtPrice` y aislamiento estricto entre tiendas.
