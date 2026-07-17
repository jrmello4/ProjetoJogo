// Lenis loaded via <script> tag in index.html
const Lenis = window.Lenis;

// GSAP + ScrollTrigger loaded via <script> tags in index.html
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

/**
 * Central motion hub — Lenis smooth scroll + GSAP ScrollTrigger.
 * Webflow-style scroll-driven reveals and parallax.
 */
export class MotionEngine {
  constructor() {
    this.lenis = null;
    this.rafId = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scrollTriggers = [];
  }

  init() {
    if (this.reducedMotion) return;
    if (!gsap || !ScrollTrigger || !Lenis) {
      console.warn('GSAP/ScrollTrigger/Lenis not loaded — motion disabled');
      return;
    }

    this.lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.85,
      // Lenis por padrão sequestra o wheel da página inteira — sem excluir
      // a sidebar e os modais (criação de personagem, etc.), o scroll do
      // mouse dentro deles nunca chegava no overflow-y:auto nativo deles.
      // .lenis.lenis-smooth [data-lenis-prevent] já existia no CSS pra isso,
      // mas nenhum elemento real usava o atributo — a exclusão nunca
      // acontecia de verdade.
      prevent: (node) => !!node.closest?.('.sidebar, .modal-overlay'),
    });

    this.lenis.on('scroll', ScrollTrigger.update);

    this._tickerFn = (time) => this.lenis?.raf(time * 1000);
    gsap.ticker.add(this._tickerFn);
    gsap.ticker.lagSmoothing(0);

    ScrollTrigger.scrollerProxy(document.documentElement, {
      scrollTop: (value) => {
        if (value !== undefined) {
          this.lenis?.scrollTo(value, { immediate: true });
        }
        return this.lenis?.scroll ?? window.scrollY;
      },
      getBoundingClientRect: () => ({
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    });

    ScrollTrigger.addEventListener('refresh', () => this.lenis?.resize());

    window.addEventListener('resize', () => {
      this.lenis?.resize();
      ScrollTrigger.refresh();
    });
  }

  /** Page enter — called after view HTML is injected */
  animatePageEnter(container) {
    if (!container) return;

    // Never animate the container's own opacity. A render that overlaps this
    // one calls gsap.killTweensOf(container) and would strand it at opacity 0
    // — a blank page with the HTML sitting right there. The children carry the
    // entrance; the container just stays visible.
    gsap.set(container, { opacity: 1, y: 0 });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    const header = container.querySelector('.page-header');
    if (header) {
      tl.fromTo(
        header.querySelector('h2'),
        { opacity: 0, y: 40, skewY: 2 },
        { opacity: 1, y: 0, skewY: 0, duration: 0.7 }
      );
      tl.fromTo(
        header.querySelector('p'),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5 },
        '-=0.45'
      );
    }

    this._staggerCards(container);
    this._bindScrollReveals(container);
    this._bindParallax(container);

    return tl;
  }

  _staggerCards(container) {
    const cards = container.querySelectorAll('.card, .stat-card');
    if (!cards.length) return;

    gsap.fromTo(
      cards,
      { opacity: 0, y: 48, scale: 0.96 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.65,
        stagger: 0.07,
        ease: 'power3.out',
        clearProps: 'transform',
      }
    );
  }

  _bindScrollReveals(container) {
    this._clearScrollTriggers();

    container.querySelectorAll('[data-reveal]').forEach((el) => {
      gsap.set(el, { opacity: 0, y: 40 });
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => {
          gsap.fromTo(
            el,
            { opacity: 0, y: 60 },
            { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
          );
        },
      });
      this.scrollTriggers.push(trigger);
    });

    container.querySelectorAll('[data-reveal-stagger]').forEach((group) => {
      const children = group.children;
      gsap.set(children, { opacity: 0, y: 30 });
      const trigger = ScrollTrigger.create({
        trigger: group,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.fromTo(
            children,
            { opacity: 0, y: 40 },
            { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }
          );
        },
      });
      this.scrollTriggers.push(trigger);
    });
  }

  _bindParallax(container) {
    container.querySelectorAll('[data-parallax]').forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0.15;
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          gsap.set(el, { y: self.progress * speed * -200 });
        },
      });
      this.scrollTriggers.push(trigger);
    });
  }

  animateStatCount(el, end, duration = 800, formatter = (n) => n.toLocaleString('pt-BR')) {
    const obj = { val: 0 };
    gsap.to(obj, {
      val: end,
      duration: duration / 1000,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = formatter(Math.round(obj.val));
      },
    });
  }

  animateNavIndicator(activeLink) {
    if (!activeLink) return;
    gsap.fromTo(
      activeLink,
      { scale: 0.95 },
      { scale: 1, duration: 0.35, ease: 'back.out(2)' }
    );
  }

  scrollToTop() {
    if (this.lenis) {
      this.lenis.scrollTo(0, { duration: 1.2 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  refresh() {
    ScrollTrigger.refresh();
  }

  _clearScrollTriggers() {
    this.scrollTriggers.forEach((t) => t.kill());
    this.scrollTriggers = [];
  }

  dispose() {
    this._clearScrollTriggers();
    if (this._tickerFn) gsap.ticker.remove(this._tickerFn);
    this.lenis?.destroy();
    this.lenis = null;
  }
}

export const motion = new MotionEngine();
