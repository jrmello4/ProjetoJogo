// js/views/card-combat-view.js
import { ACTIVE_CARDS, PASSIVE_CARDS, POSITIONS, POSITION_TRANSITIONS } from '../config/card-config.js';

export class CardCombatView {
  constructor() {
    this.handlers = null;
  }

  render(container, engineState, actions) {
    this.handlers = actions;
    container.innerHTML = `
      <div class="combat-container">
        <div class="combat-header">
          <div class="position-tracker">${this._renderPositionTracker(engineState)}</div>
          <div class="round-display">Round ${engineState.currentRound} / ${engineState.maxRounds}</div>
          <div class="stamina-display">
            <div class="stamina-bar">
              <label>${engineState.fighterA.ref.name}</label>
              <div class="stamina-fill" style="width:${engineState.fighterA.stamina}%"></div>
            </div>
            <div class="stamina-bar">
              <label>${engineState.fighterB.ref.name}</label>
              <div class="stamina-fill opponent" style="width:${engineState.fighterB.stamina}%"></div>
            </div>
          </div>
        </div>
        <div class="card-hand">
          ${this._renderCardHand(engineState, 'A')}
        </div>
        <div class="action-bar">
          ${this._renderActionButtons(engineState)}
        </div>
        <div class="turn-result hidden"></div>
        <div class="turn-log">
          ${this._renderTurnLog(engineState)}
        </div>
      </div>
    `;

    // Bind card click events
    container.querySelectorAll('.card-item:not(.disabled)').forEach(el => {
      el.addEventListener('click', () => {
        const cardId = el.dataset.cardId;
        if (this.handlers?.onCardPlay) this.handlers.onCardPlay(cardId);
      });
    });

    // Bind move buttons
    container.querySelectorAll('.move-btn').forEach(el => {
      el.addEventListener('click', () => {
        const pos = el.dataset.position;
        if (this.handlers?.onMove) this.handlers.onMove(pos);
      });
    });

    // Bind pass button
    const passBtn = container.querySelector('.pass-btn');
    if (passBtn) {
      passBtn.addEventListener('click', () => {
        if (this.handlers?.onPass) this.handlers.onPass();
      });
    }
  }

  _renderPositionTracker(state) {
    const posA = state.fighterA.position;
    const posB = state.fighterB.position;
    const posNames = {
      [POSITIONS.DISTANCE]: 'Distância',
      [POSITIONS.RANGE]: 'Alcance',
      [POSITIONS.CLINCH]: 'Clinch',
      [POSITIONS.GROUND_TOP]: 'Chão (Topo)',
      [POSITIONS.GROUND_GUARD]: 'Chão (Guarda)',
    };
    return `
      <div class="position-tracker-inner">
        <div class="position-tag player">${posNames[posA] || posA || 'Distância'}</div>
        <span class="position-vs">vs</span>
        <div class="position-tag opponent">${posNames[posB] || posB || 'Distância'}</div>
      </div>
    `;
  }

  _renderCardHand(state, side) {
    const actives = side === 'A' ? state.activesA : state.activesB;
    const cooldowns = side === 'A' ? state.cooldownsA : state.cooldownsB;
    const uses = side === 'A' ? state.usesA : state.usesB;
    const fighter = side === 'A' ? state.fighterA : state.fighterB;

    return actives.map(id => {
      const card = ACTIVE_CARDS[id];
      if (!card) return '';
      const onCooldown = (cooldowns[id] || 0) > 0;
      const remaining = uses[id];
      const noUses = remaining !== undefined && remaining <= 0;
      const wrongPos = !card.positions.includes(fighter.position);
      const disabled = onCooldown || noUses || wrongPos;
      const posNames = {
        [POSITIONS.DISTANCE]: 'Distância',
        [POSITIONS.RANGE]: 'Alcance',
        [POSITIONS.CLINCH]: 'Clinch',
        [POSITIONS.GROUND_TOP]: 'Topo',
        [POSITIONS.GROUND_GUARD]: 'Guarda',
      };

      return `
        <div class="card-item ${disabled ? 'disabled' : ''} ${card.type}" data-card-id="${card.id}">
          <div class="card-name">${card.name}</div>
          <div class="card-desc">${card.description}</div>
          <div class="card-meta">
            <span class="card-pos">${card.positions.map(p => posNames[p]).join('/')}</span>
            <span class="card-dmg">${card.baseDamage}</span>
            ${onCooldown ? `<span class="card-cd">CD:${cooldowns[id]}</span>` : ''}
            ${card.maxUses !== Infinity ? `<span class="card-uses">${remaining ?? card.maxUses}/${card.maxUses}</span>` : ''}
            ${card.moveTo ? `<span class="card-move">→ ${posNames[card.moveTo]}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  _renderActionButtons(state) {
    const fighter = state.fighterA;
    const allowed = POSITION_TRANSITIONS[fighter.position] || [];
    const posNames = {
      [POSITIONS.DISTANCE]: 'Avançar (Distância → Alcance)',
      [POSITIONS.RANGE]: 'Recuar (Alcance → Distância) / Clinch',
      [POSITIONS.CLINCH]: 'Sair (Clinch → Alcance) / Cair (Clinch → Chão)',
      [POSITIONS.GROUND_TOP]: 'Levantar (Chão → Clinch)',
      [POSITIONS.GROUND_GUARD]: 'Levantar (Chão → Clinch)',
    };
    // Show only valid transitions from current position
    return `
      <button class="pass-btn">Passar Turno</button>
      ${allowed.map(pos => `<button class="move-btn" data-position="${pos}">Ir para ${posNames[pos] || pos}</button>`).join('')}
    `;
  }

  _renderTurnLog(state) {
    const log = state.turnLog || [];
    const lastFew = log.slice(-6);
    return `
      <div class="turn-log-title">Ações</div>
      <div class="turn-log-entries">
        ${lastFew.map(entry => {
          const card = entry.cardId ? ACTIVE_CARDS[entry.cardId] : null;
          const text = card ? `${entry.side === 'A' ? 'Jogador' : 'IA'} usou ${card.name}` :
            entry.move ? `${entry.side === 'A' ? 'Jogador' : 'IA'} moveu para ${entry.move}` : '';
          return `<div class="turn-log-entry">${text}</div>`;
        }).join('')}
      </div>
    `;
  }

  update(container, engineState) {
    // Re-render the whole view — in Phase 2 optimize with targeted updates
    const actions = this.handlers;
    this.render(container, engineState, actions);
  }
}
