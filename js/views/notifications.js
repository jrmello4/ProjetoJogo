import { formatDateShort } from '../utils/helpers.js';

export class NotificationsView {
  static render(notifications, unreadCount) {
    if (notifications.length === 0) {
      return `
        <div class="page-header">
          <h2>Notificações</h2>
          <p>Alertas e eventos do jogo</p>
        </div>
        <div class="empty-state">
          <p>Nenhuma notificação.</p>
        </div>
      `;
    }

    const sorted = [...notifications].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return `
      <div class="page-header">
        <h2>Notificações</h2>
        <div class="flex items-center gap-2">
          <span>${unreadCount} não lidas</span>
          <button class="btn btn-sm btn-secondary notif-mark-all">Marcar Todas como Lidas</button>
        </div>
      </div>

      <div class="card">
        ${sorted.map(n => `
          <div class="notif-item ${n.read ? 'notif-read' : 'notif-unread'}" style="padding:0.75rem 0;border-bottom:1px solid var(--border)">
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
    const icons = {
      'contract-expiry': '⚠️',
      injury: '🏥',
      rivalry: '⚔️',
      'hall-of-fame': '🏆',
      'week-advance': '📅',
      info: 'ℹ️',
      warning: '⚠️',
      success: '✅',
    };
    return icons[type] || 'ℹ️';
  }
}
