import { e } from '../utils/helpers.js';

export const PIXEL_ICON_KEYS = Object.freeze([
  'unknown', 'octagon', 'dashboard', 'hall', 'events', 'market',
  'training', 'rivalries', 'notifications', 'settings', 'calendar',
  'cash', 'energy', 'morale', 'rank', 'offer', 'injury', 'title',
  'fight', 'plan', 'scout', 'timeline', 'legacy', 'world',
  'management', 'save', 'simulate', 'next', 'success', 'loss', 'draw',
]);

const ICON_SET = new Set(PIXEL_ICON_KEYS);
const STATUS_ICON_SET = new Set([
  'cash', 'energy', 'morale', 'rank', 'offer', 'injury', 'title', 'training', 'success',
]);

const ICON_ALIASES = Object.freeze({
  finance: 'cash',
  academy: 'training',
  fighter: 'fight',
  trophy: 'title',
  money: 'cash',
  alert: 'notifications',
  warning: 'injury',
});

const LEGACY_ICON_MAP = new Map([
  ['🏋️', 'training'], ['⚠️', 'injury'], ['🥊', 'fight'], ['🏆', 'title'],
  ['👑', 'title'], ['🏅', 'title'], ['📩', 'offer'], ['✉️', 'offer'],
  ['📅', 'calendar'], ['💵', 'cash'], ['💰', 'cash'], ['💲', 'cash'],
  ['⚡', 'energy'], ['🔥', 'energy'], ['💪', 'energy'], ['🧘', 'morale'],
  ['💔', 'loss'], ['😤', 'rivalries'], ['⚔️', 'rivalries'], ['🤝', 'management'],
  ['💼', 'management'], ['🛒', 'market'], ['🌍', 'world'], ['👥', 'world'],
  ['📈', 'rank'], ['📊', 'rank'], ['⚖️', 'rank'], ['🎯', 'scout'],
  ['🧭', 'scout'], ['🎣', 'scout'], ['📋', 'plan'], ['🧰', 'plan'],
  ['🧠', 'plan'], ['🛡️', 'plan'], ['📰', 'events'], ['📡', 'events'],
  ['📱', 'notifications'], ['📣', 'notifications'], ['🔊', 'notifications'],
  ['🏥', 'injury'], ['🩹', 'injury'], ['⚠', 'injury'], ['🔒', 'loss'],
  ['📖', 'timeline'], ['📜', 'timeline'], ['📁', 'timeline'], ['📼', 'timeline'],
  ['🎬', 'timeline'], ['🌱', 'legacy'], ['🕊️', 'legacy'], ['🏟️', 'fight'],
  ['👊', 'fight'], ['🤼', 'fight'], ['🥋', 'fight'], ['💥', 'fight'],
  ['🔁', 'next'], ['🔄', 'next'], ['⏩', 'next'], ['💾', 'save'],
  ['🎲', 'simulate'], ['⚙️', 'settings'], ['🔧', 'settings'], ['🎨', 'settings'],
  ['✏️', 'plan'], ['🖼', 'dashboard'], ['🌟', 'title'], ['✅', 'success'],
  ['✓', 'success'], ['❌', 'loss'], ['✕', 'loss'], ['×', 'loss'],
  ['👤', 'fight'], ['💇', 'settings'], ['👕', 'settings'], ['👴', 'legacy'],
  ['🎓', 'hall'], ['👉', 'next'], ['📉', 'loss'], ['💬', 'management'],
  ['⏳', 'calendar'], ['⬆', 'rank'], ['↔', 'draw'], ['✉', 'offer'],
  ['✒', 'plan'], ['✨', 'title'], ['⛔', 'loss'], ['⭐', 'title'], ['ℹ', 'notifications'],
  ['🃏', 'training'], ['🌑', 'world'], ['🎉', 'success'], ['🎙', 'events'],
  ['👇', 'next'], ['💆', 'morale'], ['💊', 'injury'], ['💛', 'morale'],
  ['💭', 'morale'], ['📄', 'timeline'], ['📌', 'timeline'], ['📤', 'offer'],
  ['📺', 'events'], ['🔍', 'scout'], ['🔴', 'fight'], ['🔵', 'fight'],
  ['🕵', 'scout'], ['🗣', 'notifications'], ['🙌', 'success'], ['🟡', 'notifications'],
  ['😈', 'rivalries'], ['😐', 'morale'], ['😔', 'morale'], ['😟', 'morale'],
  ['😱', 'morale'], ['🤕', 'injury'], ['🥈', 'title'], ['🧬', 'scout'], ['🫁', 'energy'],
]);

const LEGACY_PATTERN = new RegExp(
  [...new Set([...LEGACY_ICON_MAP.keys()].map(icon => icon.replace(/\uFE0F/g, '')))]
    .sort((a, b) => b.length - a.length)
    .map(icon => `${icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\uFE0F?`)
    .join('|'),
  'gu'
);

export class PixelIcon {
  static key(key) {
    const normalized = ICON_ALIASES[key] || key;
    return ICON_SET.has(normalized) ? normalized : 'unknown';
  }

  static render(key, { size = 'md', label = null, className = '' } = {}) {
    const icon = this.key(key);
    const classes = `pixel-icon pixel-icon--${e(size)}${className ? ` ${e(className)}` : ''}`;
    const accessibility = label
      ? `role="img" aria-label="${e(label)}"`
      : 'aria-hidden="true"';
    const useStatusAtlas = (size === 'lg' || size === 'xl') && STATUS_ICON_SET.has(icon);
    const href = useStatusAtlas
      ? `assets/pixel/status-icons.svg#status-${icon}`
      : `assets/pixel/ui-icons.svg#icon-${icon}`;
    return `<svg class="${classes}" ${accessibility} focusable="false"><use href="${href}"></use></svg>`;
  }

  static replaceLegacy(html) {
    return String(html ?? '').replace(LEGACY_PATTERN, icon => this.render(
      LEGACY_ICON_MAP.get(icon) || LEGACY_ICON_MAP.get(icon.replace(/\uFE0F/g, '')),
      { className: 'pixel-icon--legacy' }
    ));
  }

  static enhance(root) {
    if (!root || typeof document === 'undefined' || typeof window.NodeFilter === 'undefined') return;
    const walker = document.createTreeWalker(root, window.NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const parent = node.parentElement;
      if (!parent || parent.closest('script, style, textarea, select, option, svg')) return;
      if (!LEGACY_PATTERN.test(node.nodeValue || '')) {
        LEGACY_PATTERN.lastIndex = 0;
        return;
      }
      LEGACY_PATTERN.lastIndex = 0;
      const template = document.createElement('template');
      template.innerHTML = this.replaceLegacy(node.nodeValue);
      node.replaceWith(template.content);
    });
  }

  static mountLegacyObserver() {
    if (this._observer || typeof MutationObserver === 'undefined') return;
    this.enhance(document.body);
    this._observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === 1) this.enhance(node);
        else if (node.nodeType === 3 && node.parentElement) this.enhance(node.parentElement);
      }));
    });
    this._observer.observe(document.body, { childList: true, subtree: true });
  }
}
