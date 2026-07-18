import { AudioService } from '../services/audio-service.js';

// Tela de Configurações — áudio, movimento, tema e dados do jogo.
// Estado vive em localStorage (áudio/movimento/tema); dados via SaveService.
export class SettingsView {
  static render() {
    const audio = AudioService.settings;
    const reduceMotion = localStorage.getItem('reduceMotion') === 'true';
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';

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
    `;
  }
}
