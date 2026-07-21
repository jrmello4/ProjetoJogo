// ============================================================
// DebugService — ferramentas de desenvolvimento e observabilidade
// ============================================================
// Só ativado em modo debug (localStorage.debugMode === 'true').
// Fornece ações de inspeção e manipulação do estado do jogo
// diretamente do painel de configurações.

export class DebugService {
  constructor(gameCtrl) {
    this.game = gameCtrl;
  }

  static isEnabled() {
    return localStorage.getItem('debugMode') === 'true';
  }

  static enable() { localStorage.setItem('debugMode', 'true'); }
  static disable() { localStorage.removeItem('debugMode'); }
  static toggle() {
    if (this.isEnabled()) this.disable();
    else this.enable();
    return this.isEnabled();
  }

  /** Retorna lista de ações de debug disponíveis */
  getActions() {
    return [
      { id: 'inspect_state', label: '🔍 Inspecionar Estado', desc: 'Mostra dados do save atual no console', danger: false },
      { id: 'advance_week', label: '⏩ Avançar 1 Semana', desc: 'Processa 1 semana do mundo', danger: true },
      { id: 'advance_month', label: '⏩⏩ Avançar 4 Semanas', desc: 'Processa 4 semanas seguidas', danger: true },
      { id: 'advance_quarter', label: '⏩⏩⏩ Avançar 12 Semanas', desc: 'Processa 12 semanas', danger: true },
      { id: 'force_injury', label: '🏥 Forçar Lesão', desc: 'Aplica lesão ao lutador do jogador', danger: true },
      { id: 'clear_injury', label: '💊 Curar Lesão', desc: 'Remove lesão do lutador do jogador', danger: false },
      { id: 'boost_money', label: '💰 +$50k', desc: 'Adiciona $50k ao caixa do lutador', danger: false },
      { id: 'set_popularity', label: '👥 Popularidade 80', desc: 'Define popularidade para 80', danger: false },
      { id: 'check_state', label: '✅ Validar Estado', desc: 'Checa consistência do banco de dados', danger: false },
    ];
  }

  async execute(actionId) {
    const f = await this.game.getPlayerFighter();
    const state = await this.game.db.get('gameState', 'state');
    const absWeek = state?.absWeek || 1;

    switch (actionId) {
      case 'inspect_state': {
        const saveInfo = await this.game.saveService.getSaveInfo();
        const issues = await this.game.saveService.validateCurrentState();
        console.log('🔍 DEBUG — Save Info:', saveInfo);
        console.log('🔍 DEBUG — Fighter:', f ? { id: f.id, name: f.name, record: `${f.record?.wins}-${f.record?.losses}`, ovr: f.overallRating } : 'N/A');
        if (issues) console.warn('⚠️ Issues:', issues); else console.log('✅ State OK');
        return { msg: 'Estado logado no console (F12)', type: 'info' };
      }

      case 'advance_week':
      case 'advance_month':
      case 'advance_quarter': {
        const weeks = actionId === 'advance_week' ? 1 : actionId === 'advance_month' ? 4 : 12;
        if (!this.game.simulateWeeks) return { msg: 'simulateWeeks não disponível', type: 'danger' };
        await this.game.simulateWeeks(weeks);
        return { msg: `${weeks} semana(s) avançada(s).`, type: 'success' };
      }

      case 'force_injury': {
        if (!f) return { msg: 'Nenhum lutador do jogador', type: 'danger' };
        if (f.injury) return { msg: `${f.name} já está lesionado`, type: 'warning' };
        f.injury = {
          stage: 'rest', restUntilAbsWeek: absWeek + 6, rehabEndAbsWeek: 0,
          type: 'sprain', description: 'Lesão de debug — 6 semanas',
          rehabCost: 0, rehabChosen: false, resumeStatus: f.status,
        };
        f.status = 'injured';
        await this.game.db.put('fighters', f);
        return { msg: `Lesão forçada em ${f.name} — 6 semanas.`, type: 'warning' };
      }

      case 'clear_injury': {
        if (!f) return { msg: 'Nenhum lutador do jogador', type: 'danger' };
        if (!f.injury) return { msg: `${f.name} não está lesionado`, type: 'info' };
        f.status = f.injury.resumeStatus || 'roster';
        f.injury = null;
        await this.game.db.put('fighters', f);
        return { msg: `${f.name} curado.`, type: 'success' };
      }

      case 'boost_money': {
        if (!f) return { msg: 'Nenhum lutador do jogador', type: 'danger' };
        f.cash = (f.cash || 0) + 50000;
        await this.game.db.put('fighters', f);
        return { msg: `+$50k — agora $${f.cash.toLocaleString()}`, type: 'success' };
      }

      case 'set_popularity': {
        if (!f) return { msg: 'Nenhum lutador do jogador', type: 'danger' };
        f.popularity = 80;
        await this.game.db.put('fighters', f);
        return { msg: `Popularidade de ${f.name} definida para 80.`, type: 'success' };
      }

      case 'check_state': {
        const issues = await this.game.saveService.validateCurrentState();
        if (!issues) return { msg: '✅ Estado consistente.', type: 'success' };
        return { msg: '⚠️ ' + issues.join('; '), type: 'warning' };
      }

      default:
        return { msg: `Ação desconhecida: ${actionId}`, type: 'danger' };
    }
  }
}
