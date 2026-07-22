import { AudioService } from './audio-service.js';
import { escapeHtml } from '../utils/helpers.js';
import { PixelIcon } from '../views/pixel-icon.js';

const TYPE_META = {
  success: { icon: 'success', mod: 'toast--success' },
  info: { icon: 'notifications', mod: 'toast--info' },
  warning: { icon: 'notifications', mod: 'toast--warning' },
  danger: { icon: 'loss', mod: 'toast--danger' },
  injury: { icon: 'injury', mod: 'toast--warning' },
  'contract-expiry': { icon: 'timeline', mod: 'toast--warning' },
  rivalry: { icon: 'rivalries', mod: 'toast--info' },
  'hall-of-fame': { icon: 'title', mod: 'toast--gold' },
  'week-advance': { icon: 'calendar', mod: 'toast--info' },
  achievement: { icon: 'title', mod: 'toast--gold' },
};

const MAX_VISIBLE = 4;

export class Toast {
  static _container() {
    let el = document.getElementById('toastContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toastContainer';
      el.className = 'toast-container';
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  static show(type, title, message, duration = 4200) {
    const container = this._container();
    const meta = TYPE_META[type] || TYPE_META.info;

    // Som só nos toasts que merecem atenção — semanal ('week-advance') e
    // informativos ficam mudos pra não virar fadiga sonora.
    if (type === 'achievement' || type === 'hall-of-fame') AudioService.play('success');
    else if (type === 'warning' || type === 'danger' || type === 'injury') AudioService.play('notify');

    // Limita a pilha de toasts visíveis
    while (container.children.length >= MAX_VISIBLE) {
      container.firstElementChild.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${meta.mod}`;
    // title/message vêm de notif com nomes de lutadores — escapar evita XSS
    toast.innerHTML = `
      <span class="toast-icon">${PixelIcon.render(meta.icon, { size: 'lg' })}</span>
      <div class="toast-body">
        <div class="toast-title">${escapeHtml(title)}</div>
        ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Fechar">&times;</button>
    `;

    const dismiss = () => {
      if (!toast.isConnected) return;
      toast.classList.add('toast--leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
      // Fallback caso animações estejam desativadas
      setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.toast-close').addEventListener('click', dismiss);
    container.appendChild(toast);

    setTimeout(dismiss, duration);
    return toast;
  }
}
