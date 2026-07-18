// Coach-marks espaciais — escurece a tela e recorta um "buraco" em volta
// de um elemento real, com balão de texto ancorado nele. Substitui tutorial
// que só descreve a tela em abstrato por algo que aponta pra ela de verdade.
//
// Uso:
//   await TutorialCoach.run([{ selector, title, text }, ...])       // tour
//   TutorialCoach.spotlightOnce(selector, { title, text })          // 1 passo
import { LayoutView } from '../views/layout.js';

export class TutorialCoach {
  static run(steps) {
    // Checa presença real no DOM, não uma flag manual — o atalho global de
    // Esc (layout.js) fecha QUALQUER .modal-overlay chamando .remove()
    // direto, sem passar pelo finish() daqui. Uma flag manual ficaria presa
    // em "ativo" pra sempre depois de um Esc, travando o coach pro resto
    // da sessão.
    if (document.querySelector('.tutorial-coach') || steps.length === 0) return Promise.resolve();

    return new Promise((resolve) => {
      let i = 0;
      let resolved = false;
      const overlay = TutorialCoach._buildOverlay();
      document.body.appendChild(overlay);

      const finish = () => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener('resize', reposition);
        detachObserver.disconnect();
        if (overlay.isConnected) LayoutView.closeModal(overlay);
        resolve();
      };

      // Cobre remoção externa (Esc genérico, clique fora) chamando
      // overlay.remove() sem passar por finish() — sem isto o listener de
      // resize vazava e a Promise nunca resolvia.
      const detachObserver = new MutationObserver(() => {
        if (!overlay.isConnected) finish();
      });
      detachObserver.observe(document.body, { childList: true });

      const reposition = () => TutorialCoach._position(overlay, steps[i]);

      const renderStep = () => {
        const step = steps[i];
        const target = document.querySelector(step.selector);
        if (!target) { i++; if (i >= steps.length) return finish(); return renderStep(); }
        target.scrollIntoView?.({ block: 'center', behavior: 'auto' });
        TutorialCoach._fillCallout(overlay, step, i, steps.length, {
          onNext: () => { i++; if (i >= steps.length) finish(); else renderStep(); },
          onSkip: finish,
          isLast: i === steps.length - 1,
        });
        // Posiciona depois do scroll assentar — layout muda de imediato,
        // mas smooth-scroll (se ligado) ainda está em trânsito por um frame.
        requestAnimationFrame(() => requestAnimationFrame(reposition));
      };

      window.addEventListener('resize', reposition);
      renderStep();
    });
  }

  static spotlightOnce(selector, { title, text } = {}) {
    return TutorialCoach.run([{ selector, title, text }]);
  }

  static _buildOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'tutorial-coach modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="tutorial-coach-hole"></div>
      <div class="tutorial-coach-callout">
        <div class="tutorial-coach-dots"></div>
        <div class="tutorial-coach-title"></div>
        <p class="tutorial-coach-text"></p>
        <div class="tutorial-coach-actions">
          <button class="btn btn-sm btn-secondary tutorial-coach-skip" type="button">Pular</button>
          <button class="btn btn-primary tutorial-coach-next" type="button">Próximo</button>
        </div>
      </div>
    `;
    return overlay;
  }

  static _fillCallout(overlay, step, index, total, { onNext, onSkip, isLast }) {
    overlay.querySelector('.tutorial-coach-title').textContent = step.title || '';
    overlay.querySelector('.tutorial-coach-text').textContent = step.text || '';
    overlay.querySelector('.tutorial-coach-dots').innerHTML = total > 1
      ? Array.from({ length: total }, (_, j) => `<span class="tutorial-coach-dot${j === index ? ' is-active' : ''}"></span>`).join('')
      : '';

    const nextBtn = overlay.querySelector('.tutorial-coach-next');
    nextBtn.textContent = isLast ? '✅ Entendi!' : 'Próximo';
    const skipBtn = overlay.querySelector('.tutorial-coach-skip');
    skipBtn.style.display = isLast ? 'none' : '';

    // Clona pra descartar listeners do passo anterior em vez de empilhar.
    const freshNext = nextBtn.cloneNode(true);
    nextBtn.replaceWith(freshNext);
    freshNext.addEventListener('click', onNext);
    const freshSkip = skipBtn.cloneNode(true);
    skipBtn.replaceWith(freshSkip);
    freshSkip.addEventListener('click', onSkip);

    freshNext.focus({ preventScroll: true });
    TutorialCoach._position(overlay, step);
  }

  static _position(overlay, step) {
    const target = document.querySelector(step?.selector);
    const hole = overlay.querySelector('.tutorial-coach-hole');
    const callout = overlay.querySelector('.tutorial-coach-callout');
    if (!target || !hole || !callout) return;

    const r = target.getBoundingClientRect();
    const pad = 8;
    hole.style.top = `${r.top - pad}px`;
    hole.style.left = `${r.left - pad}px`;
    hole.style.width = `${r.width + pad * 2}px`;
    hole.style.height = `${r.height + pad * 2}px`;

    const calloutRect = callout.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const placeBelow = spaceBelow > calloutRect.height + 32 || spaceBelow > r.top;
    const top = placeBelow
      ? Math.min(r.bottom + pad + 12, window.innerHeight - calloutRect.height - 12)
      : Math.max(r.top - calloutRect.height - pad - 12, 12);
    let left = r.left + r.width / 2 - calloutRect.width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - calloutRect.width - 12));

    callout.style.top = `${top}px`;
    callout.style.left = `${left}px`;
  }
}
