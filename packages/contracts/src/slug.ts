export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'ayuda',
  'configuracion',
  'contenido',
  'cuenta',
  'dashboard',
  'docs',
  'entrar',
  'favicon',
  'health',
  'herramientas',
  'login',
  'logout',
  'onboarding',
  'panel',
  'privacidad',
  'registro',
  'robots',
  'sitemap',
  'soporte',
  'static',
  'terminos',
  'tuvitrina',
  'www',
]);

export function slugifyStoreName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function validateStoreSlug(raw: string): {
  valid: boolean;
  normalized: string;
  reason?: string;
} {
  const normalized = raw.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 40) {
    return {
      valid: false,
      normalized,
      reason: 'El enlace debe tener entre 3 y 40 caracteres.',
    };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      reason: 'Usa solo letras minúsculas, números y guiones medios sin espacios.',
    };
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return {
      valid: false,
      normalized,
      reason: 'Ese enlace está reservado por el sistema. Prueba otro nombre.',
    };
  }
  return { valid: true, normalized };
}
