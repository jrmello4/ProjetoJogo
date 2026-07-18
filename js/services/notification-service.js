import { generateId } from '../utils/helpers.js';
import { Toast } from './toast.js';

const TYPE_ICONS = {
  'contract-expiry': '⚠️',
  injury: '🏥',
  rivalry: '⚔️',
  'hall-of-fame': '🏆',
  'week-advance': '📅',
  info: 'ℹ️',
  warning: '⚠️',
  success: '✅',
  danger: '⛔',       // mesmo ícone de toast.js — recomendação médica forte
  headline: '📰',     // Épico F3: manchetes estilo FM
  expectation: '💭',  // Épico F2: expectativas de atletas
};

export const ICON_MAP = TYPE_ICONS;

export class NotificationService {
  constructor(db) {
    this.db = db;
    this.muted = false; // true durante simulação de período — evita centenas de toasts
  }

  async add(type, title, message) {
    if (this.muted) return null;

    const n = {
      id: generateId(),
      type,
      title,
      message,
      read: false,
      timestamp: new Date().toISOString(),
    };
    await this.db.add('notifications', n);
    try { Toast.show(type, title, message); } catch { /* toast é opcional */ }
    return n;
  }

  async getAll() {
    return await this.db.getAll('notifications');
  }

  async getUnread() {
    // Nota: `read` é boolean em JS — IndexedDB não aceita boolean como chave
    // de índice válida (getAll(false) lança DataError), então o índice
    // 'read' criado no schema não pode ser usado assim. getAll()+filter
    // continua sendo o caminho correto aqui.
    const all = await this.getAll();
    return all.filter(n => !n.read).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async getUnreadCount() {
    const unread = await this.getUnread();
    return unread.length;
  }

  async markRead(id) {
    const n = await this.db.get('notifications', id);
    if (n) {
      n.read = true;
      await this.db.put('notifications', n);
    }
  }

  async markAllRead() {
    const all = await this.getAll();
    for (const n of all) n.read = true;
    if (all.length > 0) await this.db.batchPut('notifications', all);
  }

  async clearOld() {
    const all = await this.getAll();
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    for (const n of all) {
      if (n.timestamp < cutoff && n.read) {
        await this.db.delete('notifications', n.id);
      }
    }
  }

  static iconFor(type) {
    return TYPE_ICONS[type] || 'ℹ️';
  }
}
