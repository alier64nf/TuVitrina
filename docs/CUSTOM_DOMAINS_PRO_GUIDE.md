# Dominio Propio para Tiendas PRO — Guía de Arquitectura y Configuración

## 1. Evaluación del entorno actual
En el entorno de vista previa actual (`*.run.app`), el tráfico HTTP/TLS entra a un contenedor único en el puerto `3000` sin control programático sobre:
- Registros DNS wildcard ni validación ACME/HTTP-01 para dominios de terceros.
- Terminación TLS dinámica multi-inquilino en el balanceador de entrada.

Por este motivo, **no es viable emitir ni enrutar certificados SSL para dominios personalizados en tiempo real dentro de este sandbox**. Las tiendas operan mediante su ruta corta verificada `/{slug}` (ej. `/mi-bodega`).

---

## 2. Cómo habilitar dominios propios PRO en producción
Para ofrecer `tienda.midominio.cu` o `www.mitienda.com` a vendedores con Plan **PRO** activo en despliegue productivo:

### Paso A: Terminación TLS bajo demanda (Edge / Proxy)
Utiliza **Cloudflare for SaaS (Custom Hostnames)** o **Caddy (`on_demand_tls`)** delante de `apps/web`:
1. Configura un endpoint interno de verificación en NestJS (`GET /api/v1/internal/domains/allow?domain=...`) que responda `200 OK` únicamente si existe una tienda `active` con `plan = 'pro'` y `customDomainVerified = true`.
2. Caddy o Cloudflare consulta dicho endpoint antes de emitir el certificado Let's Encrypt / Edge SSL.

### Paso B: Registros DNS del vendedor
El vendedor con Plan PRO configura en su proveedor DNS:
```text
Tipo: CNAME
Host: tienda (o @ con CNAME flattening / ALIAS)
Valor: cname.tuvitrina.cu

Tipo: TXT
Host: _tuvitrina-verify
Valor: tv-verify=<store.slug>
```

### Paso C: Enrutamiento en Next.js (`middleware.ts`)
1. Leer cabecera `Host` (normalizada, sin puerto).
2. Si `host` no coincide con el dominio raíz de la plataforma (`tuvitrina.cu` / `localhost`), resolver `slug` mediante API/Redis (`domain:<host> -> slug`, TTL 300s).
3. Hacer `NextResponse.rewrite(new URL('/' + slug + pathname, req.url))` preservando rutas `/productos/...`, `/checkout` y `/pedido/...`.
4. Al vencer o degradar una tienda de PRO a Free, desactivar `customDomainActive` (conservando el dato en BD sin pérdida por si renueva).
