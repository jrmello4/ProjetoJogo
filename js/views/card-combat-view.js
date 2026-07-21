// js/views/card-combat-view.js
import { ACTIVE_CARDS, POSITIONS, POSITION_TRANSITIONS, getCardIllustration } from '../config/card-config.js';

// Canonical position name map — shared across all position-display methods
const POSITION_NAMES = {
  [POSITIONS.DISTANCE]: 'Distância',
  [POSITIONS.RANGE]: 'Alcance',
  [POSITIONS.CLINCH]: 'Clinch',
  [POSITIONS.GROUND_TOP]: 'Chão (Topo)',
  [POSITIONS.GROUND_GUARD]: 'Chão (Guarda)',
};

// Category header shown on each card — icon doubles as the art fallback
// glyph, label is the stamped tag ("coach shorthand" for the card type).
const CARD_CATEGORY = {
  strike: { icon: '👊', label: 'ATAQUE' },
  takedown: { icon: '🤼', label: 'QUEDA' },
  submission: { icon: '🔒', label: 'FINALIZAÇÃO' },
  defense: { icon: '🛡️', label: 'DEFESA' },
};

// Short position labels for the meta readout — full names overflow the
// narrow card, so the tactical chip uses coach shorthand instead.
const POSITION_SHORT = {
  [POSITIONS.DISTANCE]: 'DIST',
  [POSITIONS.RANGE]: 'ALC',
  [POSITIONS.CLINCH]: 'CLIN',
  [POSITIONS.GROUND_TOP]: 'CHÃO↑',
  [POSITIONS.GROUND_GUARD]: 'CHÃO↓',
};

// PRIORIDADE — derived from the card's real tags (not a stored field).
// Heavy/power/risky reads as a high-commitment play; light/fast as a
// low-risk poke; everything else sits in the middle. Colour-coded box.
function derivePriority(card) {
  const t = card.tags || [];
  if (t.includes('heavy') || t.includes('power') || t.includes('risky')) return { label: 'ALTA', cls: 'prio-high' };
  if (t.includes('light') || t.includes('fast')) return { label: 'BAIXA', cls: 'prio-low' };
  return { label: 'MÉDIA', cls: 'prio-mid' };
}

// EFEITO — a 1-2 word tactical essence pulled from the card's real tags,
// same spirit as the coach scribbling the point of the technique. Order
// matters: the most defining tag wins.
const TAG_EFFECT = [
  ['risky', 'Alto risco'],
  ['power', 'Nocaute'],
  ['heavy', 'Impacto alto'],
  ['engage', 'Fecha distância'],
  ['grappling', 'Domínio'],
  ['fast', 'Rápido'],
  ['light', 'Ágil'],
];
function deriveEffect(card) {
  const t = card.tags || [];
  for (const [tag, label] of TAG_EFFECT) if (t.includes(tag)) return label;
  if (card.type === 'defense') return 'Defende';
  if (card.type === 'submission') return 'Finaliza';
  return 'Técnica';
}

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
            <div class="stamina-bar" data-side="A">
              <label>${engineState.fighterA.ref.name}</label>
              <div class="stamina-fill" style="width:${engineState.fighterA.stamina}%"></div>
              <div class="hit-fx" data-side="A"></div>
            </div>
            <div class="stamina-bar opponent" data-side="B">
              <label>${engineState.fighterB.ref.name}</label>
              <div class="stamina-fill opponent" style="width:${engineState.fighterB.stamina}%"></div>
              <div class="hit-fx" data-side="B"></div>
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

      // Notebook card anatomy (coach page): category header + cost stamp ·
      // taped technique photo · title with marker underline · handwritten
      // blue note · labelled tactical stat boxes · DMG stamp + EFEITO note.
      const cost = card.staminaCost ?? card.cost ?? Math.max(1, Math.round((card.baseDamage || 10) / 12));
      const artSrc = getCardIllustration(card);
      const category = CARD_CATEGORY[card.type] || { icon: '👊', label: card.type };
      const artHtml = artSrc
        ? `<img class="card-art-img" src="${artSrc}" alt="" width="120" height="96" loading="lazy" draggable="false" />`
        : `<span class="card-art-fallback" aria-hidden="true">${category.icon}</span>`;
      // Alcance box shows a single legible token: 1-2 positions listed,
      // 3+ collapsed to a count (full list in the title tooltip).
      const posList = card.positions.map(p => POSITION_SHORT[p] || p);
      const posShort = posList.length > 2 ? `${posList.length} POS` : posList.join('/');
      const posTitle = card.positions.map(p => POSITION_NAMES[p] || p).join(', ');
      const priority = derivePriority(card);
      // Movement IS the effect when a card repositions you; otherwise fall
      // back to the tag-derived tactical essence.
      const effect = card.moveTo ? `Move → ${POSITION_SHORT[card.moveTo] || card.moveTo}` : deriveEffect(card);
      const cdVal = onCooldown ? `${cooldowns[id]}T` : (card.cooldown > 1 ? `${card.cooldown}T` : '—');
      const usesVal = card.maxUses !== Infinity ? `${remaining ?? card.maxUses}/${card.maxUses}` : '∞';
      return `
        <div class="card-item mastery-basic ${disabled ? 'disabled' : ''} ${card.type}" data-card-id="${card.id}">
          <span class="card-hole h1"></span><span class="card-hole h2"></span>
          <div class="card-category-bar">
            <span class="cat-icon" aria-hidden="true">${category.icon}</span>
            <span class="cat-label">${category.label}</span>
            <span class="card-cost" title="Custo de stamina"><b>${cost}</b><small>CUSTO</small></span>
          </div>
          <div class="card-art">
            ${artHtml}
          </div>
          <span class="card-tape tape-r"></span>
          <div class="card-body">
            <div class="card-name">${card.name}</div>
            <div class="card-desc">${card.description}</div>
            <div class="card-stats">
              <div class="stat"><span class="stat-label">Alcance</span><span class="stat-val" title="${posTitle}">${posShort}</span></div>
              <div class="stat"><span class="stat-label">Usos</span><span class="stat-val">${usesVal}</span></div>
              <div class="stat"><span class="stat-label">Recarga</span><span class="stat-val">${cdVal}</span></div>
            </div>
            <div class="card-footer">
              <span class="card-dmg" title="Dano base">DMG ${card.baseDamage}</span>
              <span class="card-priority ${priority.cls}" title="Prioridade">${priority.label}</span>
            </div>
            <div class="card-effect">
              <span class="eff-label">Efeito</span>
              <span class="eff-val">${effect}</span>
            </div>
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
