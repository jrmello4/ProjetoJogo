import { DB } from '../services/db.js';
import { AudioService } from '../services/audio-service.js';
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
      btn.addEventListener('click', () => AudioService.play('click'));
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

  // Sincroniza a classe no <aside> (desliza) com uma classe no <body>
  // (liga o backdrop mobile) — os dois precisam concordar sempre, senão o
  // fundo escurece sem o menu estar de fato aberto ou vice-versa.
  static setSidebarOpen(open) {
    document.getElementById('sidebar')?.classList.toggle('open', open);
    document.body.classList.toggle('sidebar-open', open);
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

        this.setSidebarOpen(false);
        window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }));
      });
    });

    const hamburger = document.getElementById('hamburgerBtn');
    if (hamburger) {
      hamburger.addEventListener('click', () => {
        this.setSidebarOpen(!document.getElementById('sidebar').classList.contains('open'));
      });
    }

    document.getElementById('sidebarBackdrop')?.addEventListener('click', () => this.setSidebarOpen(false));

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
    this._initKeyboardShortcuts();
    this._initModalA11y();

    document.getElementById('shortcutsHintBtn')?.addEventListener('click', () => this._showShortcutsHelp());
  }

  // Atalhos globais — espaço avança semana, Esc fecha modal/cinemática, ?
  // mostra ajuda. Todos desligados quando o foco está em campo de texto,
  // pra não interferir na criação de personagem ou em qualquer input.
  static _initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (isEditable) return;

      if (e.key === 'Escape') {
        const cinematic = document.querySelector('.cinematic-overlay');
        if (cinematic) return; // CinematicService já tem seu próprio handler de Esc
        const closeBtn = document.querySelector('.modal-overlay [data-close]');
        if (closeBtn) { closeBtn.click(); return; }
        const modal = document.querySelector('.modal-overlay');
        if (modal) { modal.remove(); return; }
        if (document.getElementById('sidebar')?.classList.contains('open')) {
          this.setSidebarOpen(false);
        }
        return;
      }

      if (e.code === 'Space') {
        // Bloqueado com modal ou cinemática abertos — espaço não deve
        // disparar avanço de semana por baixo de uma decisão pendente.
        if (document.querySelector('.modal-overlay, .cinematic-overlay')) return;
        const btn = document.getElementById('weekAdvanceBtn');
        if (btn && !btn.disabled && btn.offsetParent !== null) {
          e.preventDefault();
          btn.click();
        }
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        this._showShortcutsHelp();
      }
    });
  }

  static _showShortcutsHelp() {
    if (document.getElementById('shortcutsHelpModal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'shortcutsHelpModal';
    modal.innerHTML = `
      <div class="modal" style="max-width:360px">
        <div class="modal-header">
          <h3>Atalhos</h3>
          <button class="modal-close" data-close="shortcutsHelpModal">&times;</button>
        </div>
        <div class="flex flex-col gap-2 text-sm">
          <div class="flex items-center justify-between"><span>Avançar semana</span><kbd>Espaço</kbd></div>
          <div class="flex items-center justify-between"><span>Fechar janela</span><kbd>Esc</kbd></div>
          <div class="flex items-center justify-between"><span>Esta ajuda</span><kbd>?</kbd></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
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

  // Acessibilidade de modal — genérica, via MutationObserver, em vez de
  // retrofit em cada um dos ~6 pontos do app.js que criam `.modal-overlay`.
  // Sem isto NENHUM modal do jogo (simular período, camp semanal, criação
  // de personagem, tutorial, atalhos) movia foco pra dentro, tinha
  // role="dialog" ou prendia o Tab — um usuário de teclado/leitor de tela
  // abria um modal e o foco continuava em <body>, podendo tabular pra
  // qualquer coisa na página por baixo.
  static _initModalA11y() {
    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    let lastFocused = null;
    let trapHandler = null;

    const onOpen = (modal) => {
      if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
      if (!modal.hasAttribute('aria-modal')) modal.setAttribute('aria-modal', 'true');

      lastFocused = document.activeElement;
      const focusables = [...modal.querySelectorAll(FOCUSABLE)];
      (focusables[0] || modal).focus?.({ preventScroll: true });

      trapHandler = (e) => {
        if (e.key !== 'Tab') return;
        const current = [...modal.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
        if (current.length === 0) return;
        const first = current[0];
        const last = current[current.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      modal.addEventListener('keydown', trapHandler);
    };

    const onClose = () => {
      trapHandler = null;
      // O elemento que abriu o modal pode ter sido substituído por um
      // re-render entretanto — só devolve o foco se ele ainda existe no DOM.
      if (lastFocused?.isConnected) lastFocused.focus?.({ preventScroll: true });
      lastFocused = null;
    };

    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1 && node.classList?.contains('modal-overlay')) onOpen(node);
        }
        for (const node of m.removedNodes) {
          if (node.nodeType === 1 && node.classList?.contains('modal-overlay')) onClose();
        }
      }
    }).observe(document.body, { childList: true });
  }
}
