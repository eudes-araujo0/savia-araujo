import type { CSSProperties } from 'react';

export type SiteMediaSlot = {
  id: string;
  section: string;
  label: string;
  description: string;
  defaultUrl: string;
  defaultAlt: string;
  aspect: string;
  desktopX: number;
  desktopY: number;
  mobileX: number;
  mobileY: number;
  desktopZoom: number;
  mobileZoom: number;
};

export type SiteMediaValue = {
  slotId: string;
  url: string;
  pathname: string | null;
  alt: string;
  desktopX: number;
  desktopY: number;
  mobileX: number;
  mobileY: number;
  desktopZoom: number;
  mobileZoom: number;
  updatedAt: number | null;
  versionId?: string;
};

export type SiteMediaLibraryItem = SiteMediaSlot & {
  current: SiteMediaValue;
  versions: SiteMediaValue[];
};

export const SITE_MEDIA_SLOTS: SiteMediaSlot[] = [
  slot('home.hero', 'Página inicial', 'Capa principal', 'Primeira imagem vista ao abrir o site.', '/media/boss-gold-portrait.webp', 'Retrato de beleza com maquiagem iluminada e produção editorial', '16:9', 58, 35, 50, 22),
  slot('portfolio.boss-main.desktop', 'Portfólio', 'Boss Portrait · computador', 'Card vertical principal do portfólio no computador.', '/media/boss-gold-portrait.webp', 'Ensaio de beleza com maquiagem iluminada em pele negra', '3:5', 50, 18, 50, 18),
  slot('portfolio.boss-main.mobile', 'Portfólio', 'Boss Portrait · celular', 'Versão do primeiro card exibida no celular.', '/media/boss-corset.webp', 'Ensaio editorial do Pacote Boss', '4:5', 50, 16, 50, 16),
  slot('portfolio.bridal-morning', 'Portfólio', 'Bridal Morning', 'Preparação da noiva em preto e branco.', '/media/bride-getting-ready-bw.jpg', 'Noiva sorrindo durante a preparação da maquiagem', '16:9', 50, 25, 50, 25),
  slot('portfolio.soft-glam', 'Portfólio', 'Soft Glam', 'Maquiagem social com acabamento luminoso.', '/media/soft-glam-white.webp', 'Maquiagem social sofisticada com acabamento luminoso', '4:5', 50, 18, 50, 18),
  slot('portfolio.bridal-video-poster', 'Portfólio', 'Capa do vídeo de noiva', 'Imagem exibida antes de o vídeo carregar.', '/media/bridal-story-poster.jpg', 'Making of de noiva, da maquiagem à cerimônia', '3:5', 50, 32, 50, 32),
  slot('portfolio.monochrome', 'Portfólio', 'Editorial Monochrome', 'Retrato editorial em preto e branco.', '/media/boss-close-bw.webp', 'Retrato editorial em preto e branco', '16:9', 50, 20, 50, 20),
  slot('portfolio.melanin', 'Portfólio', 'Melanin Glow', 'Maquiagem iluminada em pele negra.', '/media/melanin-glow.jpg', 'Maquiagem iluminada em pele negra com acabamento sofisticado', '4:5', 50, 17, 50, 17),
  slot('portfolio.bridal-detail', 'Portfólio', 'The Final Touch', 'Detalhe do atendimento de noiva.', '/media/bride-detail-bw.jpg', 'Detalhe da preparação de uma noiva em preto e branco', '4:5', 50, 24, 50, 24),
  slot('portfolio.presence', 'Portfólio', 'Presence', 'Ensaio de posicionamento e direção editorial.', '/media/boss-brown-editorial.webp', 'Ensaio de posicionamento com beleza e direção editorial', '16:9', 50, 20, 50, 20),
  slot('portfolio.radiance', 'Portfólio', 'Natural Radiance', 'Close de maquiagem e cabelo.', '/media/soft-glam-close.jpg', 'Close de maquiagem soft glam com cabelo ondulado', '16:9', 50, 18, 50, 18),
  slot('portfolio.modern-glam', 'Portfólio', 'Modern Glam', 'Beleza natural com acessórios marcantes.', '/media/soft-glam-black.webp', 'Maquiagem elegante com beleza natural e acessórios marcantes', '4:5', 50, 18, 50, 18),
  slot('portfolio.artist', 'Portfólio', 'The Artist', 'Retrato profissional de Sávia no portfólio.', '/media/savia-boss.webp', 'Sávia Araújo em retrato profissional no estúdio', '3:5', 50, 16, 50, 16),
  slot('experience.bridal', 'Experiências', 'Destaque Dia da Noiva', 'Foto ao lado dos pacotes de noiva.', '/media/bride-getting-ready-bw.jpg', 'Noiva recebendo os últimos detalhes da maquiagem', '4:5', 45, 50, 50, 32),
  slot('experience.boss-primary', 'Experiências', 'Pacote Boss · principal', 'Foto grande da seção Sua imagem fala antes de você.', '/media/boss-cover-bw-4k.webp', 'Retrato profissional em preto e branco do Pacote Boss', '3:5', 50, 50, 50, 22),
  slot('experience.boss-secondary', 'Experiências', 'Pacote Boss · detalhe', 'Foto sobreposta na seção do Pacote Boss.', '/media/boss-brown-editorial-4k.webp', 'Retrato editorial com direção de poses', '3:4', 50, 18, 50, 18),
  slot('home.about', 'Página inicial', 'A artista por trás da experiência', 'Retrato da seção sobre Sávia.', '/media/savia-white.webp', 'Sávia Araújo, maquiadora e criadora da experiência', '4:5', 50, 22, 50, 18),
  slot('home.manifesto', 'Página inicial', 'Assinatura do Manifesto', 'Pequeno retrato exibido junto ao manifesto.', '/media/savia-manifesto.jpg', 'Sávia Araújo', '1:1', 50, 50, 50, 50),
  slot('home.closing', 'Página inicial', 'Chamada final', 'Fundo da seção Qual experiência combina com você.', '/media/soft-glam-black.webp', 'Maquiagem elegante em chamada para agendamento', '16:9', 50, 21, 50, 18),
  slot('booking.cover', 'Agendamento', 'Capa do agendamento', 'Imagem lateral do formulário de agendamento.', '/media/bride-getting-ready-bw.jpg', 'Noiva sorrindo enquanto recebe a maquiagem', '4:5', 50, 38, 50, 30),
  slot('admin.login-cover', 'Painel', 'Capa do login administrativo', 'Retrato exibido na entrada do painel.', '/media/savia-admin.jpg', 'Sávia Araújo', '3:4', 50, 8, 50, 8),
  slot('admin.profile', 'Painel', 'Perfil no menu administrativo', 'Pequeno retrato de Sávia no menu do painel.', '/media/savia-admin.jpg', 'Retrato de Sávia Araújo', '1:1', 50, 25, 50, 25),
];

export const SITE_MEDIA_SLOT_IDS = new Set(SITE_MEDIA_SLOTS.map((item) => item.id));

export function getMediaSlot(id: string) {
  return SITE_MEDIA_SLOTS.find((item) => item.id === id) || null;
}

export function defaultMediaValue(slot: SiteMediaSlot): SiteMediaValue {
  return {
    slotId: slot.id,
    url: slot.defaultUrl,
    pathname: null,
    alt: slot.defaultAlt,
    desktopX: slot.desktopX,
    desktopY: slot.desktopY,
    mobileX: slot.mobileX,
    mobileY: slot.mobileY,
    desktopZoom: slot.desktopZoom,
    mobileZoom: slot.mobileZoom,
    updatedAt: null,
  };
}

export function clampMediaNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, numeric));
}

export function managedMediaStyle(value: SiteMediaValue): CSSProperties {
  return {
    '--media-desktop-x': `${value.desktopX}%`, '--media-desktop-y': `${value.desktopY}%`, '--media-desktop-zoom': value.desktopZoom,
    '--media-mobile-x': `${value.mobileX}%`, '--media-mobile-y': `${value.mobileY}%`, '--media-mobile-zoom': value.mobileZoom,
  } as CSSProperties;
}

function slot(
  id: string,
  section: string,
  label: string,
  description: string,
  defaultUrl: string,
  defaultAlt: string,
  aspect: string,
  desktopX: number,
  desktopY: number,
  mobileX: number,
  mobileY: number,
  desktopZoom = 1,
  mobileZoom = 1,
): SiteMediaSlot {
  return { id, section, label, description, defaultUrl, defaultAlt, aspect, desktopX, desktopY, mobileX, mobileY, desktopZoom, mobileZoom };
}
