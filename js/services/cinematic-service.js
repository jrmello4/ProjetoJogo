// Cinemáticas de marcos da carreira — vídeos WebM com canal alpha
// renderizados via Remotion (pasta cinematics/), tocados em overlay
// fullscreen com texto dinâmico (nome, cartel) sobreposto via DOM.
//
// Uso: await CinematicService.play('BeltWin', { title: 'João Silva', subtitle: '18-2-0' })
// Resolve quando o vídeo termina, é pulado (clique/Esc) ou falha ao carregar —
// nunca bloqueia o fluxo do jogo.

import { AudioService } from './audio-service.js';
import { escapeHtml } from '../utils/helpers.js';

const VIDEO_BASE = 'assets/cinematics';

export const CINEMATICS = {
  BeltWin: 'BeltWin',
  WorldChampion: 'WorldChampion',
  TitleDefense: 'TitleDefense',
  Retirement: 'Retirement',
  HallOfFame: 'HallOfFame',
};

const ALLOWED_CINEMATIC_IDS = new Set(Object.values(CINEMATICS));

export class CinematicService {
  static _active = null;

  static play(id, { title = '', subtitle = '' } = {}) {
    // Respeita tanto a preferência do SO quanto o toggle manual das
    // Configurações do jogo.
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      localStorage.getItem('reduceMotion') === 'true'
    ) {
      return Promise.resolve();
    }
    if (CinematicService._active) return Promise.resolve();
    // Só IDs do catálogo — evita path injection em src do <video>
    if (!ALLOWED_CINEMATIC_IDS.has(id)) return Promise.resolve();

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'cinematic-overlay';
      overlay.innerHTML = `
        <video class="cinematic-video" muted playsinline preload="auto"
               src="${VIDEO_BASE}/${id}.webm"></video>
        <div class="cinematic-text">
          ${title ? `<div class="cinematic-title">${escapeHtml(title)}</div>` : ''}
          ${subtitle ? `<div class="cinematic-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        <div class="cinematic-skip">clique para pular</div>
      `;

      const video = overlay.querySelector('video');
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        CinematicService._active = null;
        AudioService.duckAmbient(false);
        document.removeEventListener('keydown', onKey);
        overlay.classList.add('cinematic-out');
        setTimeout(() => overlay.remove(), 350);
        resolve();
      };
      const onKey = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
      };

      video.addEventListener('ended', finish);
      video.addEventListener('error', finish);
      overlay.addEventListener('click', finish);
      document.addEventListener('keydown', onKey);

      // Se o vídeo não estiver pronto em 4s (arquivo faltando, rede), desiste.
      const bail = setTimeout(() => {
        if (video.readyState < 2) finish();
      }, 4000);
      video.addEventListener('canplay', () => clearTimeout(bail), { once: true });

      CinematicService._active = overlay;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('cinematic-in'));
      AudioService.duckAmbient(true);
      AudioService.play('impact');
      video.play().catch(finish);

      // Texto dinâmico entra junto com o título do vídeo (~0.9s).
      const text = overlay.querySelector('.cinematic-text');
      setTimeout(() => text?.classList.add('cinematic-text-in'), 900);
    });
  }
}
