import { DB } from '../services/db.js';
import { motion } from '../motion/motion-engine.js';
import { riveManager } from '../motion/rive-manager.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm';

export class LayoutView {
  static _renderSeq = 0;

  static render(content, animate = true) {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return Promise.resolve();

    // Renders concorrentes: só o mais recente pode commitar,
    // senão um tween atrasado sobrescreve a tela nova com HTML velho
    const seq = ++LayoutView._renderSeq;

    if (animate) {
      return new Promise((resolve) => {
        if (seq !== LayoutView._renderSeq) return resolve();
        LayoutView._renderSeq++; // invalida commits duplicados deste mesmo render

        // Nunca animar a opacidade do próprio #mainContent: um render
        // concorrente que mate essa tween deixaria o contêiner preso em
        // opacity:0 — tela em branco com o HTML já no DOM. A entrada é
        // toda feita pelos filhos (data-reveal) via animatePageEnter.
        gsap.killTweensOf(mainContent);

        mainContent.innerHTML = content;
        motion.scrollToTop();
        motion.animatePageEnter(mainContent);
        riveManager.mountAll(mainContent);
        this._animateStats(mainContent);
        resolve();
      });
    }

    mainContent.innerHTML = content;
    riveManager.mountAll(mainContent);
    return Promise.resolve();
  }

  static _animateStats(container) {
    container.querySelectorAll('.stat-value').forEach((el) => {
      const text = el.textContent.trim();

      const currencyMatch = text.match(/^\$(-?\d[\d,]*)/);
      if (currencyMatch) {
        const num = parseInt(currencyMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(num)) {
          motion.animateStatCount(el, num, 800, (n) =>
            '$' + n.toLocaleString('pt-BR')
          );
          return;
        }
      }

      const plainMatch = text.match(/^(-?\d+)$/);
      if (plainMatch) {
        const num = parseInt(plainMatch[1], 10);
        if (!isNaN(num) && Math.abs(num) > 0) {
          motion.animateStatCount(el, num);
          return;
        }
      }

      const suffixMatch = text.match(/^(\d+)\s+(.+)/);
      if (suffixMatch) {
        const num = parseInt(suffixMatch[1], 10);
        const suffix = suffixMatch[2];
        if (!isNaN(num) && num > 0) {
          motion.animateStatCount(el, num, 800, (n) => n + ' ' + suffix);
        }
      }
    });

    container.querySelectorAll('.progress-fill').forEach((fill) => {
      const width = fill.style.width;
      if (width) {
        fill.style.width = '0%';
        gsap.to(fill, { width, duration: 1, ease: 'power3.out', delay: 0.3 });
      }
    });

    container.querySelectorAll('.btn').forEach((btn) => {
      btn.addEventListener('click', (e) => this.createRipple(e, btn), { once: true });
    });
  }

  static createRipple(event, button) {
    const ripple = document.createElement('span');
    ripple.className = 'ripple';

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  static initNavigation() {
    riveManager.mountAll(document.getElementById('sidebar'));

    const links = document.querySelectorAll('.nav-link[data-view]');
    links.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        links.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
        motion.animateNavIndicator(link);

        document.getElementById('sidebar').classList.remove('open');
        window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }));
      });
    });

    const hamburger = document.getElementById('hamburgerBtn');
    if (hamburger) {
      hamburger.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
      });
    }

    // Estado inicial já é aplicado por um script inline no <head> (antes do
    // primeiro paint, sem isso o padrão claro pisca em escuro por um frame).
    // Aqui só liga o clique do toggle.
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      });
    }

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) {
        const modalId = e.target.closest('[data-close]').dataset.close;
        const modal = document.getElementById(modalId);
        if (modal) modal.remove();
      }
    });

    const resetDbBtn = document.getElementById('resetDbBtn');
    if (resetDbBtn) {
      resetDbBtn.addEventListener('click', async () => {
        if (confirm('Tem certeza que deseja apagar TODOS os dados do jogo? Esta acao nao pode ser desfeita.')) {
          await DB.reset();
          setTimeout(() => location.reload(), 500);
        }
      });
    }

    this._initScrollProgress();
  }

  static _initScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;

    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = `${progress}%`;
    }, { passive: true });
  }
}
