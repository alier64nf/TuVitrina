export const ES_CU = {
  brand: 'TuVitrina',
  tagline: 'Tu catálogo online en minutos, pedidos listos por WhatsApp y cero comisiones.',
  offlineBanner: 'Sin conexión a internet. Algunas acciones esperan a que vuelvas a estar en línea.',
  setupRequiredTitle: 'Configuración de Supabase pendiente',
  setupRequiredBody:
    'Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env para habilitar el inicio de sesión y la subida de fotos.',
  nav: {
    home: 'Inicio',
    products: 'Productos',
    categories: 'Categorías',
    business: 'Negocio',
    signOut: 'Salir',
  },
  auth: {
    loginTab: 'Entrar',
    registerTab: 'Crear cuenta',
    forgotTab: 'Recuperar clave',
    googleCta: 'Continuar con Google',
    emailLabel: 'Correo electrónico',
    passwordLabel: 'Contraseña',
    nameLabel: 'Tu nombre o apodo',
    termsPrefix: 'Acepto los ',
    termsLink: 'Términos de uso',
    termsMiddle: ' y la ',
    privacyLink: 'Política de privacidad',
    verifySent:
      'Te enviamos un correo de confirmación. Abre el enlace en tu bandeja y vuelve para entrar a tu tienda.',
    resetSent:
      'Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña.',
  },
  onboarding: {
    title: 'Abre tu tienda en 3 pasos',
    subtitle: 'Completa estos datos en menos de 5 minutos y comienza a cargar tus productos.',
    step1: 'Nombre y rubro',
    step2: 'WhatsApp cubano',
    step3: 'Enlace corto',
    finish: 'Crear mi tienda',
  },
} as const;
