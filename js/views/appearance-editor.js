import { APPEARANCE_CATEGORIES, APPEARANCE_GROUPS } from '../config/appearance-config.js';
import { PortraitService } from '../services/portrait-service.js';
import { VisualIdentityService } from '../services/visual-identity-service.js';
import { e } from '../utils/helpers.js';

// Editor de aparência — criação de personagem + "Editar visual" do perfil.
// Abas por grupo (rosto/cabelo/corpo/marcas/estilo); preview grande;
// aleatório livre ou contextual (se opts de carreira forem passados).
export class AppearanceEditor {
  /**
   * @param {object} appearance — mutado no lugar
   * @param {{ group?: string, context?: object, fighter?: object, preview?: boolean }} [ui]
   *   preview:false omite o bloco de preview embutido — usado quando um
   *   retrato externo unificado (ex.: criação full-screen) já mostra o busto.
   */
  static render(appearance, ui = {}) {
    const activeGroup = ui.group || 'rosto';
    const desc = PortraitService.describe(appearance);
    const groupCats = APPEARANCE_CATEGORIES.filter(c => c.group === activeGroup);
    const activeGroupMeta = APPEARANCE_GROUPS.find(group => group.id === activeGroup);
    const identity = ui.fighter
      ? VisualIdentityService.describeIdentity({ ...ui.fighter, appearance })
      : null;
    const showPreview = ui.preview !== false;

    return `
      <div class="appearance-editor" data-active-group="${e(activeGroup)}">
        ${showPreview ? `
        <div class="appearance-preview-wrap">
          <div class="appearance-preview appearance-preview--studio">
            <span class="appearance-preview-kicker">FICHA DO LUTADOR</span>
            <span class="appearance-preview-corner" aria-hidden="true"></span>
            ${PortraitService.render(appearance, { size: 156 })}
            <span class="appearance-preview-caption">PREVIEW AO VIVO</span>
            <span class="appearance-preview-status" aria-live="polite">${e(activeGroupMeta?.label || 'Aparência')} selecionado</span>
          </div>
          <div class="appearance-identity">
            ${identity ? `
              <div class="appearance-identity-line"><span>Arco</span> ${e(identity.archetypeLabel)}</div>
              <div class="appearance-identity-line"><span>Era</span> ${e(identity.stageLabel)}</div>
            ` : ''}
            <div class="appearance-identity-line"><span>Cabelo</span> ${e(desc.hair)}</div>
            <div class="appearance-identity-line"><span>Rosto</span> ${e(desc.face)}</div>
            <div class="appearance-identity-line"><span>Estilo</span> ${e(desc.style)}</div>
            <div class="appearance-identity-line"><span>Marcas</span> ${e(desc.marks)}</div>
          </div>
        </div>` : ''}

        <div class="appearance-tabs" role="tablist" aria-label="Categorias de aparência">
          ${APPEARANCE_GROUPS.map(g => `
            <button type="button" role="tab" class="appearance-tab ${g.id === activeGroup ? 'is-active' : ''}"
              id="appearance-tab-${g.id}" data-appearance-group="${g.id}"
              aria-label="${e(g.label)}"
              aria-selected="${g.id === activeGroup}" tabindex="${g.id === activeGroup ? '0' : '-1'}">
              <span class="appearance-tab-icon">${g.icon}</span>
              <span class="appearance-tab-label">${e(g.label)}</span>
            </button>
          `).join('')}
        </div>

        <div class="appearance-controls" role="tabpanel" aria-labelledby="appearance-tab-${e(activeGroup)}">
          ${groupCats.map(cat => AppearanceEditor._controlRow(cat, appearance)).join('')}
        </div>

        <div class="appearance-actions">
          <button type="button" class="btn btn-sm btn-secondary appearance-random" title="Mistura total">
            🎲 Aleatório
          </button>
          <button type="button" class="btn btn-sm btn-secondary appearance-random-smart" title="Aleatório com cara de lutador">
            🥊 Visual de atleta
          </button>
        </div>
      </div>`;
  }

  static _controlRow(cat, appearance) {
    const idx = appearance[cat.key] ?? 0;
    const opt = cat.options[idx] || cat.options[0];
    if (cat.swatch) {
      return `
        <div class="appearance-row" data-appearance-key="${cat.key}">
          <span class="appearance-label">${e(cat.label)}</span>
          <span class="appearance-swatches">
            ${cat.options.map((o, i) => `
              <button type="button" class="appearance-swatch ${i === idx ? 'is-active' : ''}"
                data-swatch="${i}" title="${e(o.label)}"
                aria-label="${e(cat.label)}: ${e(o.label)}" aria-pressed="${i === idx}"
                style="background:${o.base || o.value}"></button>`).join('')}
          </span>
        </div>`;
    }
    return `
      <div class="appearance-row" data-appearance-key="${cat.key}">
        <span class="appearance-label">${e(cat.label)}</span>
        <span class="appearance-stepper">
          <button type="button" class="appearance-arrow" data-dir="-1" aria-label="${e(cat.label)} anterior">‹</button>
          <span class="appearance-value" title="${e(opt.label)}" aria-live="polite">${e(opt.label)}</span>
          <button type="button" class="appearance-arrow" data-dir="1" aria-label="Próximo ${e(cat.label)}">›</button>
        </span>
      </div>`;
  }

  /**
   * @param {HTMLElement} root
   * @param {object} state — mutado
   * @param {{ context?: object, preview?: boolean, onChange?: (state:object)=>void }} [opts]
   *   context alimenta "Visual de atleta"; preview:false espelha render sem
   *   busto embutido; onChange dispara após cada mudança (retrato externo).
   */
  static wire(root, state, opts = {}) {
    const editor = root.querySelector('.appearance-editor');
    if (!editor) return;

    let activeGroup = editor.dataset.activeGroup || 'rosto';

    const rerender = () => {
      editor.outerHTML = AppearanceEditor.render(state, {
        group: activeGroup,
        fighter: opts.fighter,
        context: opts.context,
        preview: opts.preview,
      });
      const preview = root.querySelector('.appearance-preview--studio');
      preview?.classList.add('is-changing');
      clearTimeout(root._appearancePreviewTimer);
      root._appearancePreviewTimer = setTimeout(() => {
        preview?.classList.remove('is-changing');
        root._appearancePreviewTimer = null;
      }, 220);
      AppearanceEditor.wire(root, state, opts);
      opts.onChange?.(state);
    };

    const tabs = [...editor.querySelectorAll('.appearance-tab')];
    tabs.forEach((tab, tabIndex) => {
      tab.addEventListener('click', () => {
        activeGroup = tab.dataset.appearanceGroup || 'rosto';
        rerender();
      });
      tab.addEventListener('keydown', (event) => {
        const last = tabs.length - 1;
        let target = null;
        if (event.key === 'ArrowRight') target = tabIndex === last ? 0 : tabIndex + 1;
        if (event.key === 'ArrowLeft') target = tabIndex === 0 ? last : tabIndex - 1;
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = last;
        if (target == null) return;
        event.preventDefault();
        tabs[target].click();
      });
    });

    editor.querySelectorAll('.appearance-row').forEach(row => {
      const key = row.dataset.appearanceKey;
      const cat = APPEARANCE_CATEGORIES.find(c => c.key === key);
      if (!cat) return;

      row.querySelectorAll('.appearance-arrow').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = parseInt(btn.dataset.dir, 10);
          state[key] = ((state[key] ?? 0) + dir + cat.options.length) % cat.options.length;
          rerender();
        });
      });

      row.querySelectorAll('.appearance-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
          state[key] = parseInt(btn.dataset.swatch, 10);
          rerender();
        });
      });
    });

    editor.querySelector('.appearance-random')?.addEventListener('click', () => {
      Object.assign(state, PortraitService.randomAppearance());
      rerender();
    });

    editor.querySelector('.appearance-random-smart')?.addEventListener('click', () => {
      Object.assign(state, PortraitService.contextualAppearance(opts.context || {
        age: 26,
        fightingStyle: 'balanced',
        popularity: 25,
        totalFights: 4,
      }));
      rerender();
    });
  }
}
