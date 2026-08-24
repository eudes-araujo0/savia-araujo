import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import './globals.css';

const display = Cormorant_Garamond({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

const sans = Manrope({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://savia-araujo.vercel.app'),
  title: 'Sávia Araújo — Makeup Artist',
  description: 'Maquiagem premium para noivas, eventos e produções em Pernambuco e região.',
  openGraph: {
    title: 'Sávia Araújo — Makeup Artist',
    description: 'Maquiagem, arte e presença. Experiências premium em Pernambuco e região.',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'Sávia Araújo — Maquiagem, Arte, Presença' }],
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sávia Araújo — Makeup Artist',
    description: 'Maquiagem, arte e presença. Experiências premium em Pernambuco e região.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
