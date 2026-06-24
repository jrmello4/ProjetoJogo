import { generateId } from '../utils/helpers.js';

const TYPE_ICONS = {
  'contract-expiry': '⚠️',
  injury: '🏥',
  rivalry: '⚔️',
  'hall-of-fame': '🏆',
  'week-advance': '📅',
  info: 'ℹ️',
  warning: '⚠️',
  success: '✅',
};

export class NotificationService {
  constructor(db) {
    this.db = db;
  }

  async add(type, title, message) {
    const n = {
      id: generateId(),
      type,
      title,
      message,
      read: false,
      timestamp: new Date().toISOString(),
    };
    await this.db.add('notifications', n);
    return n;
  }

  async getAll() {
    return await this.db.getAll('notifications');
  }

  async getUnread() {
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
    for (const n of all) {
      n.read = true;
      await this.db.put('notifications', n);
    }
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
