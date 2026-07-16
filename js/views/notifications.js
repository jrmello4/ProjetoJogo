import { formatDateShort } from '../utils/helpers.js';
import { ICON_MAP } from '../services/notification-service.js';

const CATEGORIES = {
  all: { label: 'Todas', types: null },
  headline: { label: 'Manchetes', types: ['headline', 'achievement'] },
  rivalry: { label: 'Rivalidade', types: ['rivalry'] },
  expectation: { label: 'Expectativas', types: ['expectation', 'warning', 'info'] },
  other: { label: 'Outros', types: null },
};

const TYPE_CATEGORY = {
  headline: 'headline',
  achievement: 'headline',
  rivalry: 'rivalry',
  expectation: 'expectation',
  'contract-expiry': 'other',
  injury: 'other',
  'hall-of-fame': 'other',
  'week-advance': 'other',
  success: 'other',
};

export class NotificationsView {
  static render(notifications, unreadCount, activeCategory = 'all') {
    if (!notifications || notifications.length === 0) {
      return `
        <div class="page-header">
          <h2>Central</h2>
          <p>Notícias, manchetes e eventos do mundo do MMA</p>
        </div>
        <div class="empty-state">
          <p>Nenhuma notificação.</p>
        </div>
      `;
    }

    const sorted = [...notifications].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const catDef = CATEGORIES[activeCategory];
    let filtered = sorted;
    if (catDef?.types) {
      filtered = sorted.filter(n => catDef.types.includes(n.type));
    } else if (activeCategory === 'other') {
      const namedTypes = new Set();
      for (const [key, cat] of Object.entries(CATEGORIES)) {
        if (key !== 'all' && key !== 'other' && cat.types) {
          cat.types.forEach(t => namedTypes.add(t));
        }
      }
      filtered = sorted.filter(n => !namedTypes.has(n.type));
    }

    const categoryCounts = {};
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      if (key === 'all') {
        categoryCounts[key] = sorted.length;
      } else if (key === 'other') {
        const namedTypes = new Set();
        for (const [k, c] of Object.entries(CATEGORIES)) {
          if (k !== 'all' && k !== 'other' && c.types) {
            c.types.forEach(t => namedTypes.add(t));
          }
        }
        categoryCounts[key] = sorted.filter(n => !namedTypes.has(n.type)).length;
      } else {
        categoryCounts[key] = sorted.filter(n => cat.types ? cat.types.includes(n.type) : false).length;
      }
    }

    return `
      <div class="page-header">
        <h2>Central</h2>
        <p>Notícias, manchetes e eventos do mundo do MMA</p>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-sm text-muted">${unreadCount} não lida${unreadCount !== 1 ? 's' : ''}</span>
          ${unreadCount > 0 ? `<button class="btn btn-sm btn-secondary notif-mark-all">Marcar Todas como Lidas</button>` : ''}
        </div>
      </div>

      <div class="flex gap-1 mb-3" style="flex-wrap:wrap">
        ${Object.entries(CATEGORIES).map(([key, cat]) => `
          <button class="btn btn-sm ${activeCategory === key ? 'btn-primary' : 'btn-secondary'} notif-cat-btn" data-cat="${key}">
            ${cat.label}
            <span class="badge" style="margin-left:4px;font-size:0.6rem">${categoryCounts[key] || 0}</span>
          </button>
        `).join('')}
      </div>

      <div class="card">
        ${filtered.length === 0 ? '<div class="text-muted text-sm p-3">Nenhuma notificação nesta categoria.</div>' : ''}
        ${filtered.map(n => `
          <div class="notif-item ${n.read ? 'notif-read' : 'notif-unread'} ${n.type === 'hall-of-fame' ? 'nav-link' : ''}" style="padding:0.75rem 0;border-bottom:1px solid var(--border)" ${n.type === 'hall-of-fame' ? 'data-view="retirement"' : ''}>
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-2" style="flex:1">
                <span style="font-size:1.2rem">${NotificationsView.iconFor(n.type)}</span>
                <div>
                  <div class="font-bold text-sm">${n.title}</div>
                  <div class="text-xs text-muted">${n.message}</div>
                  <div class="text-xs text-muted" style="margin-top:0.25rem">${formatDateShort(n.timestamp)}</div>
                </div>
              </div>
              ${!n.read ? `<button class="btn btn-sm btn-secondary notif-mark-read" data-id="${n.id}" style="margin-left:0.5rem">✓</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  static iconFor(type) {
    return ICON_MAP[type] || 'ℹ️';
  }

  static renderSaveLoad(saveInfo, slots, currentSlot) {
    return `
      <div class="page-header">
        <h2>Salvar / Carregar</h2>
        <p>Gerenciar dados do jogo — slot atual: <strong>${currentSlot}</strong></p>
      </div>

      <div class="grid grid-cols-2 gap-2 mb-4" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
        ${slots.map((s, i) => `
          <div class="card" style="border:${s.slot === currentSlot ? '2px solid var(--belt)' : '1px solid var(--border)'}">
            <div class="card-header" style="padding:0.5rem">
              <span class="card-title" style="font-size:0.85rem">Slot ${s.slot}</span>
              ${s.slot === currentSlot ? '<span class="badge badge-warning" style="font-size:0.5rem">ATUAL</span>' : ''}
            </div>
            ${s.exists ? `
              <div style="padding:0.5rem">
                <div class="text-xs font-bold">${s.fighterName}</div>
                <div class="text-xs text-muted">Sem ${s.week} · Ano ${s.year}</div>
                <div class="text-xs text-muted">${s.rosterSize} lutadores</div>
                ${!s.corrupted ? `
                  <div class="flex gap-1 mt-2">
                    <button class="btn btn-sm btn-primary slot-save-btn" data-slot="${s.slot}" style="font-size:0.6rem">Salvar</button>
                    <button class="btn btn-sm btn-secondary slot-load-btn" data-slot="${s.slot}" style="font-size:0.6rem">Carregar</button>
                    <button class="btn btn-sm btn-danger slot-delete-btn" data-slot="${s.slot}" style="font-size:0.6rem">X</button>
                  </div>` : '<p class="text-danger text-xs mt-1">Corrompido</p>'}
              </div>` : `
              <div style="padding:0.5rem">
                <div class="text-xs text-muted">Vazio</div>
                <button class="btn btn-sm btn-primary slot-save-btn" data-slot="${s.slot}" style="font-size:0.6rem;margin-top:0.5rem">Salvar</button>
              </div>`}
          </div>
        `).join('')}
      </div>
    `;
  }
}
