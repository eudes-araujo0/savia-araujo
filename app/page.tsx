'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Instagram, MoveRight, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type PortfolioItem = {
  src: string;
  poster?: string;
  alt: string;
  category: 'social' | 'noivas' | 'editorial';
  title: string;
  size: 'tall' | 'wide' | 'standard';
  focus?: 'portrait' | 'makeup';
  type: 'image' | 'video';
};

const portfolio: PortfolioItem[] = [
  {
    src: '/media/melanin-glow.jpg',
    alt: 'Maquiagem iluminada em pele negra com acabamento sofisticado',
    category: 'social',
    title: 'Melanin Glow',
    size: 'tall',
    type: 'image',
  },
  {
    src: '/media/bride-getting-ready-bw.jpg',
    alt: 'Noiva sorrindo enquanto recebe a maquiagem em preto e branco',
    category: 'noivas',
    title: 'Bridal Morning',
    size: 'wide',
    type: 'image',
  },
  {
    src: '/media/hero-portrait.jpg',
    alt: 'Produção social com vestido preto e maquiagem glam sofisticada',
    category: 'social',
    title: 'Black Elegance',
    size: 'standard',
    focus: 'portrait',
    type: 'image',
  },
  {
    src: '/media/bridal-story.mp4',
    poster: '/media/bridal-story-poster.jpg',
    alt: 'Making of de noiva, da maquiagem à cerimônia',
    category: 'noivas',
    title: 'Do Pincel ao Sim',
    size: 'tall',
    type: 'video',
  },
  {
    src: '/media/soft-glam-close.jpg',
    alt: 'Close de maquiagem soft glam com cabelo ondulado',
    category: 'social',
    title: 'Soft Glam',
    size: 'wide',
    focus: 'makeup',
    type: 'image',
  },
  {
    src: '/media/backstage-gear.jpg',
    alt: 'Bastidores de ensaio com câmera e seleção de fotografias',
    category: 'editorial',
    title: 'Behind the Lens',
    size: 'standard',
    type: 'image',
  },
  {
    src: '/media/bride-detail-bw.jpg',
    alt: 'Detalhe em preto e branco da preparação de uma noiva',
    category: 'noivas',
    title: 'The Final Touch',
    size: 'standard',
    type: 'image',
  },
  {
    src: '/media/soft-glam-smile.jpg',
    alt: 'Produção social com maquiagem suave e sorriso natural',
    category: 'social',
    title: 'Natural Radiance',
    size: 'wide',
    type: 'image',
  },
];

const services = [
  {
    number: '01',
    title: 'Maquiagem social',
    subtitle: 'Para ser lembrada',
    description: 'Pele sofisticada, acabamento duradouro e uma beleza pensada para você — do jantar à formatura.',
    price: 'R$ 220',
    code: 'social',
  },
  {
    number: '02',
    title: 'Experiência noiva',
    subtitle: 'O seu momento, elevado',
    description: 'Produção completa, teste prévio e acompanhamento atento para você viver o grande dia com tranquilidade.',
    price: 'a partir de R$ 790',
    code: 'noiva',
  },
  {
    number: '03',
    title: 'Editorial & ensaio',
    subtitle: 'Imagem com intenção',
    description: 'Direção de beleza para fotos, campanhas, conteúdo e projetos que pedem impacto diante das lentes.',
    price: 'sob consulta',
    code: 'editorial',
  },
];

export default function Home() {
  const scope = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState('todos');

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

      gsap.to('.hero-image', {
        scale: 1.08,
        yPercent: 4,
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

  return (
    <main ref={scope}>
      <nav className="nav-shell" aria-label="Navegação principal">
        <a className="brand" href="#inicio" aria-label="Sávia Araújo — início">SÁVIA <span>ARAÚJO</span></a>
        <div className="nav-links">
          <a href="#portfolio">Portfólio</a>
          <a href="#servicos">Experiências</a>
          <a href="#sobre">Sobre</a>
        </div>
        <a className="nav-cta" href="/agendar">Agendar horário</a>
      </nav>

      <section className="hero" id="inicio">
        <div className="hero-media">
          <img className="hero-image" src="/media/hero-portrait.jpg" alt="Produção social com vestido preto e maquiagem glam sofisticada" />
        </div>
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow hero-kicker">Makeup artist · Pernambuco & região</p>
          <h1 className="hero-title">
            <span>Sua beleza,</span>
            <span className="gold-line">em estado de arte.</span>
          </h1>
          <p className="hero-lede">Maquiagem de alto nível para noivas, eventos e produções que pedem presença, técnica e uma assinatura inesquecível.</p>
          <div className="hero-actions">
            <a className="button button-gold" href="/agendar">Quero viver essa experiência</a>
            <a className="text-link" href="#portfolio">Conhecer o trabalho <ArrowDownRight size={17} /></a>
          </div>
        </div>
        <div className="hero-proof" aria-label="Diferenciais do atendimento">
          <div><strong>01</strong><span>Atendimento<br />exclusivo</span></div>
          <div><strong>02</strong><span>Pele com<br />acabamento premium</span></div>
          <div><strong>03</strong><span>Beleza que<br />permanece</span></div>
        </div>
        <p className="image-credit">Portfólio autoral · Sávia Araújo</p>
      </section>

      <div className="marquee" aria-hidden="true">
        <div>BEAUTY WITH INTENTION <Sparkles size={18} /> PELE REAL <Sparkles size={18} /> PRESENÇA <Sparkles size={18} /> BEAUTY WITH INTENTION <Sparkles size={18} /> PELE REAL <Sparkles size={18} /> PRESENÇA</div>
      </div>

      <section className="portfolio-section" id="portfolio">
        <div className="section-heading" data-reveal>
          <div>
            <p className="eyebrow">Portfólio selecionado · 2026</p>
            <h2>Cada rosto,<br /><em>uma obra única.</em></h2>
          </div>
          <p>Belezas que respeitam traços, traduzem personalidade e permanecem impecáveis em cada enquadramento.</p>
        </div>
        <div className="portfolio-filters" data-reveal role="group" aria-label="Filtrar portfólio">
          {['todos', 'social', 'noivas', 'editorial'].map((item) => (
            <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </div>
        <div className="portfolio-grid">
          {visiblePortfolio.map((item, index) => (
            <article className={`portfolio-card ${item.size}${item.focus ? ` focus-${item.focus}` : ''}`} key={item.title} data-reveal>
              {item.type === 'video' ? (
                <video src={item.src} poster={item.poster} aria-label={item.alt} autoPlay muted loop playsInline controls preload="metadata" />
              ) : (
                <img src={item.src} alt={item.alt} loading={index > 1 ? 'lazy' : 'eager'} />
              )}
              <div className="portfolio-overlay"><span>0{index + 1}</span><h3>{item.title}</h3><ArrowUpRight size={22} /></div>
            </article>
          ))}
        </div>
        <p className="portfolio-signature">Social · Noivas · Ensaios · Direção de beleza</p>
      </section>

      <section className="services-section" id="servicos">
        <div className="services-intro" data-reveal>
          <p className="eyebrow">Experiências</p>
          <h2>Não é apenas<br />maquiagem. <em>É presença.</em></h2>
        </div>
        <div className="services-list">
          {services.map((service) => (
            <article className="service-row" key={service.code} data-reveal>
              <span className="service-number">{service.number}</span>
              <div className="service-name"><p>{service.subtitle}</p><h3>{service.title}</h3></div>
              <p className="service-description">{service.description}</p>
              <div className="service-price"><small>investimento</small><strong>{service.price}</strong></div>
              <a href={`/agendar?service=${service.code}`} aria-label={`Agendar ${service.title}`}><ArrowUpRight size={23} /></a>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section" id="sobre">
        <div className="about-image-wrap" data-reveal>
          <img src="/media/backstage-gear.jpg" alt="Câmera e seleção de imagens nos bastidores de um ensaio" loading="lazy" />
          <div className="about-stamp"><span>+</span><strong>441</strong><small>publicações<br />no portfólio</small></div>
        </div>
        <div className="about-copy" data-reveal>
          <p className="eyebrow">A artista por trás da beleza</p>
          <h2>Eu realço o que<br />já existe em <em>você.</em></h2>
          <p>Minha assinatura nasce do encontro entre técnica, escuta e sensibilidade. Antes de cada pincelada, eu observo. Antes de criar, eu entendo como você deseja se sentir.</p>
          <p>O resultado é uma maquiagem elegante, fotogênica e, acima de tudo, sua.</p>
          <a className="text-link" href="https://instagram.com/makeup.saviaraujo" target="_blank" rel="noreferrer"><Instagram size={16} /> @makeup.saviaraujo <MoveRight size={18} /></a>
        </div>
      </section>

      <section className="testimonial-section">
        <p className="eyebrow" data-reveal>Manifesto</p>
        <blockquote data-reveal>Não é sobre se tornar outra pessoa.<br /><em>É sobre revelar a sua melhor versão.</em></blockquote>
        <div className="testimonial-author" data-reveal><span>SA</span><p><strong>Sávia Araújo</strong><small>Beauty with intention</small></p></div>
      </section>

      <section className="closing-cta">
        <div data-reveal>
          <p className="eyebrow">Seu momento começa aqui</p>
          <h2>Pronta para se ver<br /><em>inesquecível?</em></h2>
          <a className="button button-dark" href="/agendar">Consultar agenda <ArrowUpRight size={18} /></a>
        </div>
      </section>

      <footer>
        <a className="brand" href="#inicio">SÁVIA <span>ARAÚJO</span></a>
        <p>Makeup artist · Pernambuco & região</p>
        <div><a href="https://instagram.com/makeup.saviaraujo" target="_blank" rel="noreferrer">Instagram</a><a href="/agendar">Agendamento</a><a href="/admin">Área administrativa</a></div>
        <small>© 2026 Sávia Araújo. Todos os direitos reservados.</small>
      </footer>
    </main>
  );
}
