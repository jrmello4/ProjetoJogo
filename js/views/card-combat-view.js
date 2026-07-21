// js/views/card-combat-view.js
import { ACTIVE_CARDS, POSITIONS, POSITION_TRANSITIONS, getCardIllustration } from '../config/card-config.js';
import { CombatStage } from '../motion/combat-stage.js';

// Canonical position name map — shared across all position-display methods
const POSITION_NAMES = {
  [POSITIONS.DISTANCE]: 'Distância',
  [POSITIONS.RANGE]: 'Alcance',
  [POSITIONS.CLINCH]: 'Clinch',
  [POSITIONS.GROUND_TOP]: 'Chão (Topo)',
  [POSITIONS.GROUND_GUARD]: 'Chão (Guarda)',
};

export class CardCombatView {
  constructor() {
    this.handlers = null;
    this.stage = new CombatStage();
  }

  render(container, engineState, actions) {
    this.handlers = actions;
    const fa = engineState.fighterA.ref;
    const fb = engineState.fighterB.ref;

    container.innerHTML = `
      <div class="combat-container">
        <div class="combat-header" data-combat-header>
          ${this._headerHTML(engineState)}
        </div>
        ${CombatStage.buildHTML(fa, fb)}
        <div class="card-hand" data-combat-hand>
          ${this._renderCardHand(engineState, 'A')}
        </div>
        <div class="action-bar" data-combat-actions>
          ${this._renderActionButtons(engineState)}
        </div>
        <div class="turn-result hidden" data-combat-result></div>
        <div class="turn-log" data-combat-log>
          ${this._renderTurnLog(engineState)}
        </div>
      </div>
    `;

    const stageEl = container.querySelector('[data-combat-stage]');
    this.stage.attach(stageEl, fa, fb);
    this.stage.setPositions(engineState.fighterA.position, engineState.fighterB.position);

    this._bindInteractions(container);
  }

  /**
   * Targeted update — keeps the combat stage DOM alive so animations
   * and portraits are not destroyed between turns.
   */
  update(container, engineState) {
    if (!container.querySelector('.combat-container') || !container.querySelector('[data-combat-stage]')) {
      this.render(container, engineState, this.handlers);
      return;
    }

    const header = container.querySelector('[data-combat-header]');
    if (header) header.innerHTML = this._headerHTML(engineState);

    const hand = container.querySelector('[data-combat-hand]');
    if (hand) hand.innerHTML = this._renderCardHand(engineState, 'A');

    const actions = container.querySelector('[data-combat-actions]');
    if (actions) actions.innerHTML = this._renderActionButtons(engineState);

    const log = container.querySelector('[data-combat-log]');
    if (log) log.innerHTML = this._renderTurnLog(engineState);

    // Only snap positions when not mid-animation (stage owns transitions during playExchange)
    if (!this.stage._playing) {
      this.stage.setPositions(engineState.fighterA.position, engineState.fighterB.position);
    }

    this._bindInteractions(container);
  }

  _bindInteractions(container) {
    container.querySelectorAll('.card-item:not(.disabled)').forEach(el => {
      el.addEventListener('click', () => {
        const cardId = el.dataset.cardId;
        if (this.handlers?.onCardPlay) this.handlers.onCardPlay(cardId);
      });
    });

    container.querySelectorAll('.move-btn').forEach(el => {
      el.addEventListener('click', () => {
        const pos = el.dataset.position;
        if (this.handlers?.onMove) this.handlers.onMove(pos);
      });
    });

    const passBtn = container.querySelector('.pass-btn');
    if (passBtn) {
      passBtn.addEventListener('click', () => {
        if (this.handlers?.onPass) this.handlers.onPass();
      });
    }
  }

  _headerHTML(engineState) {
    return `
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
    `;
  }

  _renderPositionTracker(state) {
    const posA = state.fighterA.position;
    const posB = state.fighterB.position;
    return `
      <div class="position-tracker-inner">
        <div class="position-tag player">${POSITION_NAMES[posA] || posA || 'Distância'}</div>
        <span class="position-vs">vs</span>
        <div class="position-tag opponent">${POSITION_NAMES[posB] || posB || 'Distância'}</div>
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

      // Notebook card anatomy: top (name+cost) · middle (illustration) · bottom (meta)
      const cost = card.staminaCost ?? card.cost ?? Math.max(1, Math.round((card.baseDamage || 10) / 12));
      const artSrc = getCardIllustration(card);
      const fallbackIcon = card.type === 'takedown' ? '⬇️' : card.type === 'submission' ? '🔒' : card.type === 'defense' ? '🛡️' : '👊';
      const artHtml = artSrc
        ? `<img class="card-art-img" src="${artSrc}" alt="" width="120" height="96" loading="lazy" draggable="false" />`
        : `<span class="card-art-fallback" aria-hidden="true">${fallbackIcon}</span>`;
      return `
        <div class="card-item mastery-basic ${disabled ? 'disabled' : ''} ${card.type}" data-card-id="${card.id}">
          <div class="card-art">${artHtml}</div>
          <div class="card-top">
            <div class="card-name">${card.name}</div>
            <div class="card-cost" title="Custo">${cost}</div>
          </div>
          <div class="card-desc">${card.description}</div>
          <div class="card-meta">
            <span class="card-pos">${card.positions.map(p => POSITION_NAMES[p]).join('/')}</span>
            <span class="card-dmg">DMG ${card.baseDamage}</span>
            ${onCooldown ? `<span class="card-cd">CD ${cooldowns[id]}</span>` : ''}
            ${card.maxUses !== Infinity ? `<span class="card-uses">${remaining ?? card.maxUses}/${card.maxUses}</span>` : ''}
            ${card.moveTo ? `<span class="card-move">→ ${POSITION_NAMES[card.moveTo]}</span>` : ''}
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
            entry.move ? `${entry.side === 'A' ? 'Jogador' : 'IA'} moveu para ${POSITION_NAMES[entry.move] || entry.move}` : '';
          return `<div class="turn-log-entry">${text}</div>`;
        }).join('')}
      </div>
    `;
  }

  /**
   * Proxy to the stage for the adapter — plays the visual exchange and
   * resolves when the animation sequence finishes.
   */
  playExchange(opts) {
    return this.stage.playExchange(opts);
  }

  setStagePositions(posA, posB) {
    this.stage.setPositions(posA, posB);
  }
}
