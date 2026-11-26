import type { Metadata, Viewport } from 'next';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import './globals.css';
import { ThemeAndQueryProvider } from '@/components/ThemeAndQueryProvider';

export const metadata: Metadata = {
  title: 'VitrinaCU — Tiendas online para Cuba con pedidos por WhatsApp',
  description:
    'Plataforma gratuita para que emprendedores y MIPYMES cubanos creen su tienda online con catálogo y reciban pedidos armados por WhatsApp.',
  applicationName: 'TuVitrina',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TuVitrina',
  },
  icons: {
    icon: [
      { url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'VitrinaCU — Tiendas online para Cuba con pedidos por WhatsApp',
    description:
      'Plataforma gratuita para que emprendedores y MIPYMES cubanos creen su tienda online con catálogo y reciban pedidos armados por WhatsApp.',
  },
};

export const viewport: Viewport = {
  themeColor: '#00796B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CU">
      <body>
        <a className="skip-link" href="#contenido-principal">
          Ir al contenido principal
        </a>
        <ThemeAndQueryProvider>{children}</ThemeAndQueryProvider>
      </body>
    </html>
  );
}
