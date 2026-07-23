export class PwaService {
  static register() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    // O dev server muda arquivos o tempo todo; cache só pertence ao build final.
    if (import.meta.env?.DEV) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .catch(error => console.warn('PWA offline indisponível:', error));
    }, { once: true });
  }
}
