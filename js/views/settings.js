import { AudioService } from '../services/audio-service.js';
import { COSMETIC_ITEMS, MONETIZATION_CONFIG } from '../config/game-config.js';
import { e } from '../utils/helpers.js';

// Tela de Configurações — áudio, movimento, tema, dados e loja do jogo.
// Estado vive em localStorage (áudio/movimento/tema); dados via SaveService;
// loja via MonetizationService (IndexedDB, store gameState/monetization).
export class SettingsView {
  static render(monetization = { isSupporter: false, ownedItems: [], equipped: {} }, player = null) {
    const audio = AudioService.settings;
    const reduceMotion = localStorage.getItem('reduceMotion') === 'true';
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const autoEvolve = !!(player?.visualAutoEvolve);

    return `
      <div class="page-header">
        <h2>⚙️ Configurações</h2>
        <p>Áudio, movimento, tema e dados do jogo</p>
      </div>

      <div class="section-label" data-reveal>Áudio</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">🔊 Som</span>
          <button class="btn btn-sm btn-secondary" id="settingsTestSound">Testar</button>
        </div>
        <div class="flex items-center gap-3 mb-2">
          <label class="text-sm" for="settingsVolume" style="min-width:100px">Volume geral</label>
          <input type="range" id="settingsVolume" min="0" max="100" value="${Math.round(audio.volume * 100)}"
                 style="flex:1" ${audio.muted ? 'disabled' : ''}>
          <span class="text-sm font-bold" id="settingsVolumeLabel" style="min-width:42px;text-align:right">${Math.round(audio.volume * 100)}%</span>
        </div>
        <label class="flex items-center gap-2 text-sm" style="cursor:pointer">
          <input type="checkbox" id="settingsMute" ${audio.muted ? 'checked' : ''}>
          Silenciar todos os sons
        </label>
        <label class="flex items-center gap-2 text-sm mt-2" style="cursor:pointer">
          <input type="checkbox" id="settingsAmbient" ${audio.ambientEnabled ? 'checked' : ''} ${audio.muted ? 'disabled' : ''}>
          Ambiência de fundo (murmúrio sutil de arena)
        </label>
      </div>

      <div class="section-label" data-reveal>Acessibilidade</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header"><span class="card-title">🎬 Movimento</span></div>
        <label class="flex items-center gap-2 text-sm" style="cursor:pointer">
          <input type="checkbox" id="settingsReduceMotion" ${reduceMotion ? 'checked' : ''}>
          Reduzir animações (scroll suave, cinemáticas e efeitos de entrada)
        </label>
        <p class="text-xs text-muted mt-2">Também respeitamos a preferência de movimento reduzido do seu sistema operacional automaticamente. Recarrega a página ao alterar.</p>
      </div>

      <div class="section-label" data-reveal>Aparência</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header"><span class="card-title">🎨 Tema</span></div>
        <div class="flex gap-2">
          <button class="btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}" data-set-theme="dark">Escuro</button>
          <button class="btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}" data-set-theme="light">Claro</button>
        </div>
      </div>

      <div class="section-label" data-reveal>Identidade visual</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header"><span class="card-title">🥊 Evolução da aparência</span></div>
        <label class="flex items-center gap-2 text-sm" style="cursor:pointer">
          <input type="checkbox" id="settingsVisualAutoEvolve" ${autoEvolve ? 'checked' : ''} ${player ? '' : 'disabled'}>
          Evoluir visual com a carreira
        </label>
        <p class="text-xs text-muted mt-2">
          Quando ativo, títulos, popularidade e envelhecimento podem mudar roupa, acessórios e marcas do seu lutador.
          Edição manual no perfil trava o look até você reativar. ${player ? '' : 'Disponível após criar um lutador.'}
        </p>
      </div>

      <div class="section-label" data-reveal>Dados</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header"><span class="card-title">💾 Salvamento</span></div>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-secondary" id="settingsSaveLoad">Salvar / Carregar</button>
          <button class="btn btn-secondary" id="settingsExport">Exportar backup</button>
          <button class="btn btn-secondary" id="settingsImport">Importar backup</button>
          <input type="file" id="settingsImportFile" accept="application/json" style="display:none">
        </div>
        <p class="text-xs text-muted mt-2">O backup é um arquivo JSON com o mundo inteiro — guarde antes de experimentar decisões arriscadas.</p>
      </div>

      ${SettingsView._renderStore(monetization)}
    `;
  }

  static _renderStore(monetization) {
    const { isSupporter, ownedItems, equipped } = monetization;

    const items = COSMETIC_ITEMS.map(item => {
      const owned = ownedItems.includes(item.id);
      const isEquipped = equipped[item.slot] === item.id;
      const action = !owned
        ? `<span class="text-xs" style="color:var(--ash)">🔒 Bloqueado</span>`
        : `<button class="btn btn-sm ${isEquipped ? 'btn-primary' : 'btn-secondary'}" data-cosmetic-slot="${item.slot}" data-cosmetic-item="${isEquipped ? '' : item.id}">${isEquipped ? '✓ Equipado' : 'Equipar'}</button>`;
      return `
        <div class="flex items-center justify-between gap-2" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
          <div>
            <span>${item.icon} ${e(item.name)}</span>
            <div class="text-xs text-muted">${e(item.description)}</div>
          </div>
          ${action}
        </div>`;
    }).join('');

    const redeemHtml = isSupporter ? `
      <p class="text-sm mt-3" style="color:var(--money)">✓ Obrigado por apoiar o jogo — todos os cosméticos estão desbloqueados.</p>
    ` : `
      <div class="mt-3" style="border-top:1px solid var(--border);padding-top:0.75rem">
        <p class="text-xs text-muted mb-2">
          Jogo é grátis e sempre vai ser. Apoiar é opcional — veja como em
          <a href="${e(MONETIZATION_CONFIG.SUPPORT_URL)}" target="_blank" rel="noopener noreferrer">${e(MONETIZATION_CONFIG.SUPPORT_URL)}</a>,
          e resgate o código que você recebe aqui embaixo.
        </p>
        <div class="flex gap-2">
          <input type="text" id="supporterCodeInput" class="form-input" style="flex:1" placeholder="Código de apoiador">
          <button class="btn btn-sm btn-primary" id="supporterCodeRedeem">Resgatar</button>
        </div>
        <p class="text-xs mt-2" id="supporterCodeMsg"></p>
      </div>`;

    return `
      <div class="section-label" data-reveal>Loja</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header"><span class="card-title">🛒 Cosméticos de Apoiador</span></div>
        <p class="text-xs text-muted mb-2">100% visual — nunca afeta economia, dificuldade ou resultado de luta.</p>
        <div class="flex flex-col">${items}</div>
        ${redeemHtml}
      </div>`;
  }
}
