'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowDownRight, ArrowUpRight, Check, Instagram, MoveRight, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type PortfolioItem = {
  src: string;
  poster?: string;
  alt: string;
  category: 'social' | 'noivas' | 'boss';
  title: string;
  size: 'tall' | 'wide' | 'standard';
  position?: string;
  type: 'image' | 'video';
};

const portfolio: PortfolioItem[] = [
  {
    src: '/media/boss-gold-portrait.webp',
    alt: 'Ensaio de beleza com maquiagem iluminada em pele negra',
    category: 'boss',
    title: 'Boss Portrait',
    size: 'tall',
    type: 'image',
  },
  {
    src: '/media/bride-getting-ready-bw.jpg',
    alt: 'Noiva sorrindo durante a preparação da maquiagem',
    category: 'noivas',
    title: 'Bridal Morning',
    size: 'wide',
    type: 'image',
  },
  {
    src: '/media/soft-glam-white.webp',
    alt: 'Maquiagem social sofisticada com acabamento luminoso',
    category: 'social',
    title: 'Soft Glam',
    size: 'standard',
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
    src: '/media/boss-close-bw.webp',
    alt: 'Retrato editorial em preto e branco',
    category: 'boss',
    title: 'Editorial Monochrome',
    size: 'wide',
    position: 'center 20%',
    type: 'image',
  },
  {
    src: '/media/melanin-glow.jpg',
    alt: 'Maquiagem iluminada em pele negra com acabamento sofisticado',
    category: 'social',
    title: 'Melanin Glow',
    size: 'standard',
    type: 'image',
  },
  {
    src: '/media/bride-detail-bw.jpg',
    alt: 'Detalhe da preparação de uma noiva em preto e branco',
    category: 'noivas',
    title: 'The Final Touch',
    size: 'standard',
    type: 'image',
  },
  {
    src: '/media/boss-brown-editorial.webp',
    alt: 'Ensaio de posicionamento com beleza e direção editorial',
    category: 'boss',
    title: 'Presence',
    size: 'wide',
    type: 'image',
  },
  {
    src: '/media/soft-glam-close.jpg',
    alt: 'Close de maquiagem soft glam com cabelo ondulado',
    category: 'social',
    title: 'Natural Radiance',
    size: 'wide',
    position: 'center 18%',
    type: 'image',
  },
  {
    src: '/media/soft-glam-black.webp',
    alt: 'Maquiagem elegante com beleza natural e acessórios marcantes',
    category: 'social',
    title: 'Modern Glam',
    size: 'standard',
    type: 'image',
  },
  {
    src: '/media/savia-boss.webp',
    alt: 'Sávia Araújo em retrato profissional no estúdio',
    category: 'boss',
    title: 'The Artist',
    size: 'tall',
    type: 'image',
  },
];

const makeupServices = [
  {
    number: '01',
    title: 'Make Express',
    subtitle: 'Leve & essencial',
    description: 'Maquiagem natural para uma produção rápida e elegante. Não inclui cílios.',
    price: 'R$ 90',
    code: 'make-express',
  },
  {
    number: '02',
    title: 'Make Social',
    subtitle: 'Para ser lembrada',
    description: 'Produção elaborada para festas, fotos e eventos, com acabamento pensado para durar.',
    price: 'R$ 120',
    code: 'make-social',
  },
  {
    number: '03',
    title: 'Make & Hair',
    subtitle: 'Produção completa',
    description: 'Maquiagem e babyliss em uma experiência completa, do primeiro pincel ao acabamento final.',
    price: 'R$ 180',
    code: 'make-hair',
  },
];

const bridalPackages = [
  {
    name: 'Rubi',
    price: 'R$ 500',
    code: 'noiva-rubi',
    description: 'O essencial do grande dia, com preparação cuidadosa e testes prévios.',
    features: ['Teste de maquiagem', 'Teste de penteado', 'Skin care + massagem facial', 'Assessoria de véu, acessórios e vestido'],
  },
  {
    name: 'Ouro',
    price: 'R$ 700',
    code: 'noiva-ouro',
    description: 'Uma experiência mais completa, com cuidado, celebração e atenção aos detalhes.',
    features: ['Testes de maquiagem e penteado', 'Assessoria completa', 'Massagem facial e corporal', 'Mimo, robe e momento do brinde'],
  },
  {
    name: 'Master',
    price: 'R$ 900',
    code: 'noiva-master',
    description: 'O ritual completo para viver o dia com tranquilidade, presença e exclusividade.',
    features: ['Maquiagem e penteado + testes', 'Coffee break e massagem relaxante', 'Mimo e robe personalizado', 'Kit retoque e taças para o brinde'],
  },
];

const bossPackages = [
  { photos: '10 fotos', looks: 'até 2 looks', price: 'R$ 300', code: 'boss-10' },
  { photos: '15 fotos', looks: 'até 2 looks', price: 'R$ 400', code: 'boss-15' },
  { photos: '20 fotos', looks: 'até 3 looks', price: 'R$ 500', code: 'boss-20' },
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
          <Image className="hero-image" src="/media/boss-gold-portrait.webp" alt="Retrato de beleza com maquiagem iluminada e produção editorial" fill sizes="100vw" preload />
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
                <video src={item.src} poster={item.poster} aria-label={item.alt} autoPlay muted loop playsInline controls preload="metadata" />
              ) : (
                <Image src={item.src} alt={item.alt} fill sizes="(max-width: 760px) 100vw, (max-width: 1050px) 50vw, 35vw" style={item.position ? { objectPosition: item.position } : undefined} />
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
          {makeupServices.map((service) => (
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
            <Image src="/media/bride-getting-ready-bw.jpg" alt="Noiva recebendo os últimos detalhes da maquiagem" fill sizes="(max-width: 760px) 100vw, 50vw" />
            <figcaption>Uma preparação pensada para você viver o momento.</figcaption>
          </figure>
        </div>
        <div className="package-grid bridal-package-grid">
          {bridalPackages.map((item, index) => (
            <article className={`package-card ${index === 2 ? 'featured' : ''}`} key={item.name} data-reveal>
              <div className="package-card-head"><span>0{index + 1}</span>{index === 2 && <small>Experiência completa</small>}</div>
              <h3>Noiva <em>{item.name}</em></h3>
              <p>{item.description}</p>
              <ul>{item.features.map((feature) => <li key={feature}><Check size={13} /> {feature}</li>)}</ul>
              <div className="package-card-footer"><strong>{item.price}</strong><a href={`/agendar?service=${item.code}`}>Reservar <ArrowUpRight size={16} /></a></div>
            </article>
          ))}
        </div>
      </section>

      <section className="boss-section" id="boss">
        <div className="boss-visual" data-reveal>
          <Image className="boss-primary" src="/media/boss-cover-bw.webp" alt="Retrato profissional em preto e branco do Pacote Boss" width={1359} height={2074} sizes="(max-width: 760px) 82vw, 38vw" />
          <Image className="boss-secondary" src="/media/boss-brown-editorial.webp" alt="Retrato editorial com direção de poses" width={1063} height={1594} sizes="(max-width: 760px) 45vw, 22vw" />
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
                <div><h3>{item.photos}</h3><small>Maquiagem + babyliss · {item.looks}</small></div>
                <strong>{item.price}</strong>
                <a href={`/agendar?service=${item.code}`} aria-label={`Reservar Pacote Boss com ${item.photos}`}><ArrowUpRight size={18} /></a>
              </article>
            ))}
          </div>
          <p className="boss-note">Reserva confirmada mediante sinal de 50%. Looks e peças são de responsabilidade da cliente.</p>
        </div>
      </section>

      <section className="about-section" id="sobre">
        <div className="about-image-wrap" data-reveal>
          <Image src="/media/savia-white.webp" alt="Sávia Araújo, maquiadora e criadora da experiência" fill sizes="(max-width: 760px) 100vw, 50vw" />
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
        <div className="testimonial-author" data-reveal><Image src="/media/savia-manifesto.jpg" alt="Sávia Araújo" width={42} height={42} /><p><strong>Sávia Araújo</strong><small>Beauty with intention</small></p></div>
      </section>

      <section className="closing-cta">
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
        <div><a href="https://instagram.com/makeup.saviaraujo" target="_blank" rel="noreferrer">Instagram</a><a href="https://wa.me/5581981747620" target="_blank" rel="noreferrer">WhatsApp</a><a href="/agendar">Agendamento</a><a href="/admin">Área administrativa</a></div>
        <small>© 2026 Sávia Araújo. Todos os direitos reservados.</small>
      </footer>
    </main>
  );
}
