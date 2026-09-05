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
  title: 'Sávia Araújo — Makeup, Noivas & Fotografia',
  description: 'Maquiagem, Dia da Noiva e Pacote Boss com produção completa e fotografia em Pernambuco.',
  openGraph: {
    title: 'Sávia Araújo — Beauty with intention',
    description: 'Maquiagem, Dia da Noiva e Pacote Boss. Beleza, identidade e presença em uma experiência completa.',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'Sávia Araújo — Maquiagem, Arte, Presença' }],
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sávia Araújo — Beauty with intention',
    description: 'Maquiagem, Dia da Noiva e Pacote Boss em Pernambuco.',
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
