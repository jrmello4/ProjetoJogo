import { DB } from '../services/db.js';

export class LayoutView {
  static render(content, animate = true) {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;
    mainContent.innerHTML = content;

    if (animate) {
      this.triggerPageTransition(mainContent);
    }
  }

  static triggerPageTransition(container) {
    container.classList.remove('page-enter');
    void container.offsetWidth; // force reflow
    container.classList.add('page-enter');

    // Stagger all cards
    const cards = container.querySelectorAll('.card');
    if (cards.length > 0) {
      cards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.animation = `staggerFadeIn var(--anim-slow) var(--ease-out-quint) ${i * 60}ms forwards`;
      });
    }

    // Animate stat values with count-up
    const statValues = container.querySelectorAll('.stat-value');
    statValues.forEach(el => {
      const text = el.textContent.trim();

      // Currency: $123,456
      const currencyMatch = text.match(/\$?(-?\d[\d,]*)/);
      if (currencyMatch) {
        const num = parseInt(currencyMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(num) && Math.abs(num) > 0 && text.startsWith('$')) {
          el.classList.add('stat-count');
          this.countUpCurrency(el, 0, num, 600);
          return;
        }
      }

      // Plain number
      const plainMatch = text.match(/^(-?\d+)$/);
      if (plainMatch) {
        const num = parseInt(plainMatch[1], 10);
        if (!isNaN(num) && Math.abs(num) > 0) {
          el.classList.add('stat-count');
          this.countUp(el, 0, num, 600);
          return;
        }
      }

      // "N something" pattern: "15 lutadores", "3 livres"
      const suffixMatch = text.match(/^(\d+)\s+(.+)/);
      if (suffixMatch) {
        const num = parseInt(suffixMatch[1], 10);
        const suffix = suffixMatch[2];
        if (!isNaN(num) && num > 0) {
          el.classList.add('stat-count');
          this.countUpSuffix(el, 0, num, 600, suffix);
        }
      }
    });

    // Animate progress bars
    const fills = container.querySelectorAll('.progress-fill');
    fills.forEach(fill => {
      const width = fill.style.width;
      if (width) {
        fill.style.width = '0%';
        requestAnimationFrame(() => {
          fill.style.transition = `width 0.8s var(--ease-out-quint)`;
          fill.style.width = width;
        });
      }
    });

    // Animate table rows
    const rows = container.querySelectorAll('tbody tr');
    rows.forEach((row, i) => {
      row.classList.add('table-row-enter');
      row.style.animationDelay = `${i * 30}ms`;
    });

    // Animate timeline items
    const timelineItems = container.querySelectorAll('.timeline-item');
    timelineItems.forEach((item, i) => {
      item.style.animationDelay = `${i * 80}ms`;
    });

    // Gold pulse on champion badges
    const goldBadges = container.querySelectorAll('.badge-gold');
    goldBadges.forEach(badge => {
      badge.parentElement?.classList.add('gold-pulse');
    });

    // Button ripple effect
    container.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.createRipple(e, btn);
      });
    });
  }

  static countUp(el, start, end, duration) {
    const startTime = performance.now();

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out quint
      const eased = 1 - Math.pow(1 - progress, 5);
      const current = Math.round(start + (end - start) * eased);

      el.textContent = current.toLocaleString('pt-BR');
      el.classList.add('animating');

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.classList.remove('animating');
      }
    };

    requestAnimationFrame(step);
  }

  static countUpCurrency(el, start, end, duration) {
    const startTime = performance.now();

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 5);
      const current = Math.round(start + (end - start) * eased);

      el.textContent = '$' + current.toLocaleString('pt-BR');
      el.classList.add('animating');

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.classList.remove('animating');
      }
    };

    requestAnimationFrame(step);
  }

  static countUpSuffix(el, start, end, duration, suffix) {
    const startTime = performance.now();

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 5);
      const current = Math.round(start + (end - start) * eased);

      el.textContent = current + ' ' + suffix;
      el.classList.add('animating');

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.classList.remove('animating');
      }
    };

    requestAnimationFrame(step);
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
    const links = document.querySelectorAll('.nav-link[data-view]');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('open');

        window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }));
      });
    });

    const hamburger = document.getElementById('hamburgerBtn');
    if (!hamburger) return;
    hamburger.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    themeToggle.addEventListener('click', () => {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });

    const saved = localStorage.getItem('theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) {
        const modalId = e.target.closest('[data-close]').dataset.close;
        const modal = document.getElementById(modalId);
        if (modal) modal.remove();
      }
    });

    // Reset DB button
    const resetDbBtn = document.getElementById('resetDbBtn');
    if (resetDbBtn) {
      resetDbBtn.addEventListener('click', async () => {
        if (confirm('Tem certeza que deseja apagar TODOS os dados do jogo? Esta acao nao pode ser desfeita.')) {
          await DB.reset();
          // Small delay to ensure the browser fully releases the old DB
          setTimeout(() => location.reload(), 500);
        }
      });
    }
  }
}
