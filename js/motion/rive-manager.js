// Rive loaded via <script> tag in index.html
const Rive = window.Rive;

/**
 * Rive vector animation manager.
 * Place .riv files in assets/rive/ or set data-rive-src on the element.
 * Falls back to animated SVG icons when no source is available.
 */
export class RiveManager {
  constructor() {
    this.instances = new Map();
  }

  mountAll(container = document) {
    container.querySelectorAll('[data-rive]').forEach((el) => {
      const name = el.dataset.rive;
      const src = el.dataset.riveSrc || null;
      if (src) {
        this._mount(el, src, name);
      } else {
        this._fallback(el, name);
      }
    });
  }

  async _mount(el, src, name) {
    const canvas = document.createElement('canvas');
    canvas.className = 'rive-canvas';
    el.innerHTML = '';
    el.appendChild(canvas);

    try {
      const rive = new Rive({
        src,
        canvas,
        autoplay: true,
        stateMachines: el.dataset.riveState || undefined,
        onLoad: () => {
          rive.resizeDrawingSurfaceToCanvas();
          this.instances.set(el, rive);
        },
        onLoadError: () => this._fallback(el, name),
      });
    } catch {
      this._fallback(el, name);
    }
  }

  _fallback(el, name) {
    el.innerHTML = '';
    el.classList.add('rive-fallback', `rive-fallback--${name}`);
    el.setAttribute('aria-hidden', 'true');

    const icons = {
      dashboard: `<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none"><rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="3" width="8" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="10" width="8" height="11" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="13" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>`,
      roster: `<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none"><circle cx="9" cy="7" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="9" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M14 20c0-2 2-3.5 4-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      market: `<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" stroke="currentColor" stroke-width="1.5"/></svg>`,
      events: `<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none"><path d="M6 4h12v16H6z" stroke="currentColor" stroke-width="1.5"/><path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="18" cy="6" r="4" fill="var(--accent)" opacity="0.9"/></svg>`,
      training: `<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none"><rect x="2" y="10" width="4" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="18" y="10" width="4" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M6 14h12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
      rivalries: `<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none"><path d="M4 4l8 16M20 4l-8 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="3" stroke="var(--accent)" stroke-width="1.5"/></svg>`,
      hall: `<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none"><path d="M4 20V10l8-6 8 6v10" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="14" width="6" height="6" stroke="currentColor" stroke-width="1.5"/><path d="M12 4v3" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"/></svg>`,
      notifications: `<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none"><path d="M12 3a5 5 0 0 1 5 5v4l2 3H5l2-3V8a5 5 0 0 1 5-5z" stroke="currentColor" stroke-width="1.5"/><path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      octagon: `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" fill="none"><polygon points="30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30" stroke="var(--accent)" stroke-width="2" fill="none"/><polygon points="30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30" stroke="var(--accent)" stroke-width="1" fill="var(--accent-subtle)" opacity="0.5" class="rive-pulse-ring"/></svg>`,
      week: `<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="15" r="2" fill="var(--accent)"/></svg>`,
    };

    el.innerHTML = icons[name] || icons.octagon;
    // Force SVG to fit container
    const svg = el.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
    }
  }

  dispose() {
    this.instances.forEach((rive) => rive.cleanup?.());
    this.instances.clear();
  }
}

export const riveManager = new RiveManager();
