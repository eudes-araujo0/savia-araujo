'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Image, { getImageProps } from 'next/image';
import { ArrowDownRight, ArrowUpRight, Check, Instagram, MoveRight, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useSiteMedia } from '../lib/use-site-media';
import { managedArtDirectionStyle, managedMediaStyle, type SiteMediaValue } from '../lib/site-media';
import type { BookableService } from '../lib/service-catalog';

gsap.registerPlugin(ScrollTrigger);

type PortfolioItem = {
  slot: string;
  mobileSlot?: string;
  posterSlot?: string;
  src: string;
  mobileSrc?: string;
  poster?: string;
  alt: string;
  category: 'social' | 'noivas' | 'boss';
  title: string;
  size: 'tall' | 'wide' | 'standard';
  position?: string;
  mobilePosition?: string;
  type: 'image' | 'video';
};

const portfolio: PortfolioItem[] = [
  {
    slot: 'portfolio.boss-main.desktop',
    mobileSlot: 'portfolio.boss-main.mobile',
    src: '/media/boss-gold-portrait.webp',
    alt: 'Ensaio de beleza com maquiagem iluminada em pele negra',
    category: 'boss',
    title: 'Boss Portrait',
    size: 'tall',
    position: 'center 18%',
    mobileSrc: '/media/boss-corset.webp',
    mobilePosition: 'center 16%',
    type: 'image',
  },
  {
    slot: 'portfolio.bridal-morning',
    src: '/media/bride-getting-ready-bw.jpg',
    alt: 'Noiva sorrindo durante a preparação da maquiagem',
    category: 'noivas',
    title: 'Bridal Morning',
    size: 'wide',
    position: 'center 25%',
    type: 'image',
  },
  {
    slot: 'portfolio.soft-glam',
    src: '/media/soft-glam-white.webp',
    alt: 'Maquiagem social sofisticada com acabamento luminoso',
    category: 'social',
    title: 'Soft Glam',
    size: 'standard',
    position: 'center 18%',
    type: 'image',
  },
  {
    slot: 'portfolio.bridal-video-poster',
    posterSlot: 'portfolio.bridal-video-poster',
    src: '/media/bridal-story.mp4',
    poster: '/media/bridal-story-poster.jpg',
    alt: 'Making of de noiva, da maquiagem à cerimônia',
    category: 'noivas',
    title: 'Do Pincel ao Sim',
    size: 'tall',
    position: 'center 32%',
    type: 'video',
  },
  {
    slot: 'portfolio.monochrome',
    src: '/media/boss-close-bw.webp',
    alt: 'Retrato editorial em preto e branco',
    category: 'boss',
    title: 'Editorial Monochrome',
    size: 'wide',
    position: 'center 20%',
    type: 'image',
  },
  {
    slot: 'portfolio.melanin',
    src: '/media/melanin-glow.jpg',
    alt: 'Maquiagem iluminada em pele negra com acabamento sofisticado',
    category: 'social',
    title: 'Melanin Glow',
    size: 'standard',
    position: 'center 17%',
    type: 'image',
  },
  {
    slot: 'portfolio.bridal-detail',
    src: '/media/bride-detail-bw.jpg',
    alt: 'Detalhe da preparação de uma noiva em preto e branco',
    category: 'noivas',
    title: 'The Final Touch',
    size: 'standard',
    position: 'center 24%',
    type: 'image',
  },
  {
    slot: 'portfolio.presence',
    src: '/media/boss-brown-editorial.webp',
    alt: 'Ensaio de posicionamento com beleza e direção editorial',
    category: 'boss',
    title: 'Presence',
    size: 'wide',
    position: 'center 20%',
    type: 'image',
  },
  {
    slot: 'portfolio.radiance',
    src: '/media/soft-glam-close.jpg',
    alt: 'Close de maquiagem soft glam com cabelo ondulado',
    category: 'social',
    title: 'Natural Radiance',
    size: 'wide',
    position: 'center 18%',
    type: 'image',
  },
  {
    slot: 'portfolio.modern-glam',
    src: '/media/soft-glam-black.webp',
    alt: 'Maquiagem elegante com beleza natural e acessórios marcantes',
    category: 'social',
    title: 'Modern Glam',
    size: 'standard',
    position: 'center 18%',
    type: 'image',
  },
  {
    slot: 'portfolio.artist',
    src: '/media/savia-boss.webp',
    alt: 'Sávia Araújo em retrato profissional no estúdio',
    category: 'boss',
    title: 'The Artist',
    size: 'tall',
    position: 'center 16%',
    type: 'image',
  },
];

export default function HomeClient({ initialMedia, initialServices }: { initialMedia: SiteMediaValue[]; initialServices: BookableService[] }) {
  const scope = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState('todos');
  const getMedia = useSiteMedia(initialMedia);
  const makeupServices = initialServices.filter((service) => service.group === 'makeup');
  const bridalPackages = initialServices.filter((service) => service.group === 'noivas');
  const bossPackages = initialServices.filter((service) => service.group === 'boss');

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const context = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      intro
        .from('.nav-shell', { y: -30, autoAlpha: 0, duration: 0.7 })
        .from('.hero-kicker', { y: 20, autoAlpha: 0, duration: 0.6 }, '-=.25')
        .from('.hero-title span', { yPercent: 110, duration: 1.05, stagger: 0.12 }, '-=.35')
        .from('.hero-lede, .hero-actions', { y: 24, autoAlpha: 0, duration: 0.75, stagger: 0.1 }, '-=.6')
        .from('.hero-proof div', { y: 18, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, '-=.45');

      gsap.to('.hero-media', {
        scale: 1.035,
        yPercent: 3,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
      });

      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
        gsap.from(element, {
          y: 44,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 88%', once: true },
        });
      });
    }, scope);

    return () => context.revert();
  }, []);

  const visiblePortfolio = filter === 'todos' ? portfolio : portfolio.filter((item) => item.category === filter);
  const heroDesktop = getMedia('home.hero-desktop');
  const heroMobile = getMedia('home.hero-mobile');

  return (
    <main ref={scope}>
      <nav className="nav-shell" aria-label="Navegação principal">
        <a className="brand" href="#inicio" aria-label="Sávia Araújo — início">SÁVIA <span>ARAÚJO</span></a>
        <div className="nav-links">
          <a href="#portfolio">Portfólio</a>
          <a href="#noivas">Noivas</a>
          <a href="#boss">Pacote Boss</a>
          <a href="#sobre">Sobre</a>
        </div>
        <a className="nav-cta" href="/agendar">Agendar horário</a>
      </nav>

      <section className="hero" id="inicio">
        <div className="hero-media">
          <ArtDirectedImage className="hero-image managed-media" desktop={heroDesktop} mobile={heroMobile} desktopSize={{ width: 3840, height: 2160 }} mobileSize={{ width: 1440, height: 1920 }} sizes="100vw" fetchPriority="high" />
        </div>
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow hero-kicker">Makeup artist · Beauty & image</p>
          <h1 className="hero-title">
            <span>Beleza com</span>
            <span className="gold-line">intenção.</span>
          </h1>
          <p className="hero-lede">Maquiagem, noivas e ensaios que unem técnica, identidade e presença — para você viver e registrar a sua melhor versão.</p>
          <div className="hero-actions">
            <a className="button button-gold" href="/agendar">Escolher minha experiência</a>
            <a className="text-link" href="#portfolio">Ver portfólio <ArrowDownRight size={17} /></a>
          </div>
        </div>
        <div className="hero-proof" aria-label="Diferenciais do atendimento">
          <div><strong>2018</strong><span>Beleza com<br />experiência</span></div>
          <div><strong>01</strong><span>Atendimento<br />exclusivo</span></div>
          <div><strong>50%</strong><span>Sinal para<br />reservar</span></div>
        </div>
        <p className="image-credit">Makeup · Direção · Fotografia</p>
      </section>

      <div className="marquee" aria-hidden="true">
        <div>MAKEUP <Sparkles size={18} /> DIA DA NOIVA <Sparkles size={18} /> PACOTE BOSS <Sparkles size={18} /> BEAUTY WITH INTENTION <Sparkles size={18} /> MAKEUP <Sparkles size={18} /> DIA DA NOIVA <Sparkles size={18} /> PACOTE BOSS</div>
      </div>

      <section className="portfolio-section" id="portfolio">
        <div className="section-heading" data-reveal>
          <div>
            <p className="eyebrow">Portfólio selecionado</p>
            <h2>Cada imagem,<br /><em>uma presença.</em></h2>
          </div>
          <p>Belezas que respeitam traços, traduzem personalidade e permanecem impecáveis diante das lentes e na memória.</p>
        </div>
        <div className="portfolio-filters" data-reveal role="group" aria-label="Filtrar portfólio">
          {[
            ['todos', 'Todos'],
            ['social', 'Makeup'],
            ['noivas', 'Noivas'],
            ['boss', 'Pacote Boss'],
          ].map(([value, label]) => (
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <div className="portfolio-grid">
          {visiblePortfolio.map((item, index) => (
            <article className={`portfolio-card ${item.size}`} key={item.title} data-reveal>
              {item.type === 'video' ? (
                <>
                  <Image className="managed-media portfolio-video-poster" src={getMedia(item.posterSlot || item.slot).url} alt={getMedia(item.posterSlot || item.slot).alt} fill sizes="(max-width: 760px) 100vw, 35vw" quality={100} style={managedMediaStyle(getMedia(item.posterSlot || item.slot))} />
                  <LazyPortfolioVideo src={item.src} label={getMedia(item.posterSlot || item.slot).alt} style={managedMediaStyle(getMedia(item.posterSlot || item.slot))} />
                </>
              ) : (
                <>
                  {item.mobileSrc ? (
                    <ArtDirectedImage className="managed-media" desktop={getMedia(item.slot)} mobile={getMedia(item.mobileSlot || item.slot)} desktopSize={{ width: 1800, height: 2400 }} mobileSize={{ width: 1600, height: 2000 }} sizes="(max-width: 760px) 100vw, (max-width: 1050px) 50vw, 35vw" />
                  ) : (
                    <Image className="managed-media" src={getMedia(item.slot).url} alt={getMedia(item.slot).alt} fill sizes="(max-width: 760px) 100vw, (max-width: 1050px) 50vw, 35vw" quality={100} style={managedMediaStyle(getMedia(item.slot))} />
                  )}
                </>
              )}
              <div className="portfolio-overlay"><span>{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><ArrowUpRight size={22} /></div>
            </article>
          ))}
        </div>
        <p className="portfolio-signature">Makeup · Noivas · Retratos · Direção de imagem</p>
      </section>

      <section className="services-section" id="servicos">
        <div className="services-intro" data-reveal>
          <p className="eyebrow">Makeup services</p>
          <h2>Seu momento,<br />do essencial ao <em>completo.</em></h2>
        </div>
        <div className="services-list">
          {makeupServices.map((service, index) => (
            <article className="service-row" key={service.code} data-reveal>
              <span className="service-number">{String(index + 1).padStart(2, '0')}</span>
              <div className="service-name"><p>{service.tagline}</p><h3>{service.name}</h3></div>
              <p className="service-description">{service.description}</p>
              <div className="service-price"><small>investimento</small><strong>{money(service.priceCents)}</strong></div>
              <a href={`/agendar?service=${service.code}`} aria-label={`Agendar ${service.name}`}><ArrowUpRight size={23} /></a>
            </article>
          ))}
        </div>
      </section>

      <section className="bridal-section" id="noivas">
        <div className="bridal-editorial">
          <div className="bridal-copy" data-reveal>
            <p className="eyebrow">Dia da Noiva</p>
            <h2>Um dia inteiro<br /><em>reservado para você.</em></h2>
            <p>Pele blindada, penteado resistente e uma presença tranquila ao seu lado. No grande dia, a agenda é dedicada à noiva e à sua família, com pontualidade, cuidado e atenção ao emocional.</p>
            <div className="experience-tags">
              <span><Check size={13} /> Testes prévios</span>
              <span><Check size={13} /> Produtos de alta qualidade</span>
              <span><Check size={13} /> Atendimento exclusivo</span>
            </div>
          </div>
          <figure className="bridal-image" data-reveal>
            <Image className="managed-media" src={getMedia('experience.bridal').url} alt={getMedia('experience.bridal').alt} fill sizes="(max-width: 760px) 100vw, 50vw" quality={100} style={managedMediaStyle(getMedia('experience.bridal'))} />
            <figcaption>Uma preparação pensada para você viver o momento.</figcaption>
          </figure>
        </div>
        <div className="package-grid bridal-package-grid">
          {bridalPackages.map((item, index) => (
            <article className={`package-card ${index === 2 ? 'featured' : ''}`} key={item.name} data-reveal>
              <div className="package-card-head"><span>0{index + 1}</span>{index === 2 && <small>Experiência completa</small>}</div>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <ul>{item.features.map((feature) => <li key={feature}><Check size={13} /> {feature}</li>)}</ul>
              <div className="package-card-footer"><strong>{money(item.priceCents)}</strong><a href={`/agendar?service=${item.code}`}>Reservar <ArrowUpRight size={16} /></a></div>
            </article>
          ))}
        </div>
      </section>

      <section className="boss-section" id="boss">
        <div className="boss-visual" data-reveal>
          <Image className="boss-primary managed-media" src={getMedia('experience.boss-primary').url} alt={getMedia('experience.boss-primary').alt} width={2516} height={3840} sizes="(max-width: 760px) 82vw, 38vw" quality={100} style={managedMediaStyle(getMedia('experience.boss-primary'))} />
          <Image className="boss-secondary managed-media" src={getMedia('experience.boss-secondary').url} alt={getMedia('experience.boss-secondary').alt} width={2561} height={3840} sizes="(max-width: 760px) 45vw, 22vw" quality={100} style={managedMediaStyle(getMedia('experience.boss-secondary'))} />
          <span className="boss-monogram">BOSS</span>
        </div>
        <div className="boss-content" data-reveal>
          <p className="eyebrow">Makeup · Hair · Photography</p>
          <h2>Sua imagem<br /><em>fala antes</em><br /><em>de você.</em></h2>
          <p>O Pacote Boss une maquiagem, babyliss, direção personalizada e ensaio em estúdio. Sávia acompanha poses, expressão e posicionamento para criar imagens fortes, autênticas e prontas para elevar sua presença profissional ou pessoal.</p>
          <div className="boss-details">
            <span>2–3h de experiência</span>
            <span>Estúdio · Usina Santa Teresa/PE</span>
            <span>Entrega em 1 dia útil</span>
            <span>Foto extra · R$ 10</span>
          </div>
          <div className="boss-packages">
            {bossPackages.map((item) => (
              <article key={item.code}>
                <div><h3>{item.name}</h3><small>{item.description} · {item.tagline}</small></div>
                <strong>{money(item.priceCents)}</strong>
                <a href={`/agendar?service=${item.code}`} aria-label={`Reservar Pacote Boss ${item.name}`}><ArrowUpRight size={18} /></a>
              </article>
            ))}
          </div>
          <p className="boss-note">Reserva confirmada mediante sinal de 50%. Looks e peças são de responsabilidade da cliente.</p>
        </div>
      </section>

      <section className="about-section" id="sobre">
        <div className="about-image-wrap" data-reveal>
          <Image className="managed-media" src={getMedia('home.about').url} alt={getMedia('home.about').alt} fill sizes="(max-width: 760px) 100vw, 50vw" quality={100} style={managedMediaStyle(getMedia('home.about'))} />
          <div className="about-stamp"><span>+</span><strong>2018</strong><small>beleza com<br />propósito</small></div>
        </div>
        <div className="about-copy" data-reveal>
          <p className="eyebrow">A artista por trás da experiência</p>
          <h2>Beleza que nasce<br />da escuta e da <em>técnica.</em></h2>
          <p>Desde 2018, Sávia transforma sua paixão pela beleza em experiências que elevam a autoestima e respeitam a identidade de cada mulher.</p>
          <p>Agora, maquiagem e fotografia se encontram em um trabalho ainda mais completo: do cuidado antes do espelho à imagem final que permanece.</p>
          <a className="text-link" href="https://instagram.com/makeup.saviaraujo" target="_blank" rel="noreferrer"><Instagram size={16} /> @makeup.saviaraujo <MoveRight size={18} /></a>
        </div>
      </section>

      <section className="testimonial-section">
        <p className="eyebrow" data-reveal>Manifesto</p>
        <blockquote data-reveal>Não é sobre se tornar outra pessoa.<br /><em>É sobre reconhecer a potência que já existe em você.</em></blockquote>
        <div className="testimonial-author" data-reveal><span className="testimonial-avatar"><Image className="managed-media" src={getMedia('home.manifesto').url} alt={getMedia('home.manifesto').alt} fill sizes="42px" quality={100} style={managedMediaStyle(getMedia('home.manifesto'))} /></span><p><strong>Sávia Araújo</strong><small>Beauty with intention</small></p></div>
      </section>

      <section className="closing-cta">
        <div className="closing-cta-media" aria-hidden="true"><Image className="managed-media" src={getMedia('home.closing').url} alt="" fill sizes="100vw" quality={100} style={managedMediaStyle(getMedia('home.closing'))} /></div>
        <div data-reveal>
          <p className="eyebrow">Seu momento começa aqui</p>
          <h2>Qual experiência<br /><em>combina com você?</em></h2>
          <div className="closing-actions">
            <a className="button button-gold" href="/agendar">Consultar agenda <ArrowUpRight size={18} /></a>
            <a className="text-link" href="https://wa.me/5581981747620" target="_blank" rel="noreferrer">Falar pelo WhatsApp <MoveRight size={18} /></a>
          </div>
        </div>
      </section>

      <footer>
        <a className="brand" href="#inicio">SÁVIA <span>ARAÚJO</span></a>
        <p>Makeup artist · Pernambuco & região</p>
        <div><a href="https://instagram.com/makeup.saviaraujo" target="_blank" rel="noreferrer">Instagram</a><a href="https://wa.me/5581981747620" target="_blank" rel="noreferrer">WhatsApp</a><a href="/agendar">Agendamento</a><a href="/privacidade">Privacidade</a><a href="/termos">Termos</a></div>
        <small>© 2026 Sávia Araújo. Todos os direitos reservados.</small>
      </footer>
    </main>
  );
}

function money(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(cents / 100); }

function ArtDirectedImage({ className, desktop, mobile, desktopSize, mobileSize, sizes, fetchPriority }: {
  className: string;
  desktop: SiteMediaValue;
  mobile: SiteMediaValue;
  desktopSize: { width: number; height: number };
  mobileSize: { width: number; height: number };
  sizes: string;
  fetchPriority?: 'high' | 'low' | 'auto';
}) {
  const common = { alt: desktop.alt, sizes, quality: 100, fetchPriority } as const;
  const { props: { srcSet: desktopSrcSet } } = getImageProps({ ...common, src: desktop.url, ...desktopSize });
  const { props: { srcSet: mobileSrcSet, alt, ...imageProps } } = getImageProps({ ...common, alt: mobile.alt || desktop.alt, src: mobile.url, ...mobileSize });
  return (
    <picture className="art-directed-picture">
      <source media="(min-width: 761px)" srcSet={desktopSrcSet} />
      <source media="(max-width: 760px)" srcSet={mobileSrcSet} />
      <img {...imageProps} alt={alt} className={className} style={managedArtDirectionStyle(desktop, mobile)} />
    </picture>
  );
}

function LazyPortfolioVideo({ src, label, style }: { src: string; label: string; style: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setActive(true);
      observer.disconnect();
    }, { rootMargin: '250px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <video ref={ref} className={`managed-media lazy-portfolio-video${ready ? ' ready' : ''}`} src={active ? src : undefined} aria-label={label} autoPlay={active} muted loop playsInline controls preload="none" onCanPlay={() => setReady(true)} style={style} />;
}
