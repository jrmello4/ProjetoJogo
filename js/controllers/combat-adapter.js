// js/controllers/combat-adapter.js
//
// Phase 1 integration adapter: drives CombatEngine/CombatResolver/AICombat
// through a manual turn loop and renders progress via CardCombatView. This
// is a standalone entry point (see App#runCardFight in app.js) — it is NOT
// wired into the game's default fight-trigger flow yet.
import { CombatEngine } from './combat-engine.js';
import { CombatResolver } from './combat-resolver.js';
import { AICombat } from './ai-combat.js';
import { ACTIVE_CARDS, POSITIONS, getDefaultLoadout } from '../config/card-config.js';
import { CardCombatView } from '../views/card-combat-view.js';

export class CombatAdapter {
  constructor() {
    this.engine = new CombatEngine();
    this.view = new CardCombatView();
    this.container = null;
  }

  setContainer(container) {
    this.container = container;
  }

  async runFight(fighterA, fighterB, fiveRounds, gamePlanKey) {
    const loadoutA = getDefaultLoadout(gamePlanKey);
    const loadoutB = getDefaultLoadout('balanced'); // AI uses balanced for now

    const s = this.engine._initState(fighterA, fighterB, fiveRounds, loadoutA, loadoutB);
    const state = s;
    // _initState() only builds and returns the state object — it does not
    // assign it to this.engine.state. CombatEngine's own playCard/moveManual/
    // _computeDecision/_buildResult all read/mutate `this.state` internally
    // (see combat-engine.js), so it has to be wired up here for those calls
    // below to operate on the same state this adapter is driving/rendering.
    this.engine.state = state;

    // Render initial state
    this.view.render(this.container, state, {
      onCardPlay: (cardId) => this._onPlayerCardSelected(cardId),
      onMove: (pos) => this._onPlayerMove(pos),
      onPass: () => this._onPlayerPass(),
    });

    const roundTurns = [];

    for (let r = 1; r <= state.maxRounds; r++) {
      if (state.ended) break;
      state.currentRound = r;
      state.roundTurn = 0;

      if (r > 1) {
        state.fighterA.stamina = Math.max(15, state.fighterA.stamina - 10);
        state.fighterB.stamina = Math.max(15, state.fighterB.stamina - 10);
      }

      state.turnOwner = 'A';

      while (state.roundTurn < state.maxTurnsPerRound && !state.ended) {
        state.roundTurn++;
        state.currentTurn++;

        // Tick cooldown for player (A) at start of their turn
        this.engine._tickCooldowns(state.cooldownsA);

        // PLAYER TURN (A): wait for card selection via UI
        this.view.update(this.container, state);
        const playerAction = await this._waitForPlayerAction(state);

        if (playerAction.type === 'card') {
          this.engine.playCard('A', playerAction.cardId);
        } else if (playerAction.type === 'move') {
          this.engine.moveManual('A', playerAction.position);
        }
        // 'pass' = do nothing

        // Tick cooldown for AI
        this.engine._tickCooldowns(state.cooldownsB);

        // AI TURN (B): AI selects card
        const availB = this.engine.getAvailableCards(state, 'B');
        const aiCard = AICombat.selectCard(availB, state, []);
        if (aiCard) {
          this.engine.playCard('B', aiCard.id);
        }

        // Resolve the turn: compare player's card vs AI's card
        // If player passed or moved (no card), use a basic fallback
        const cardA = playerAction.type === 'card' ? ACTIVE_CARDS[playerAction.cardId] : null;
        const cardB = aiCard || null;

        if (cardA && cardB) {
          const turnResult = CombatResolver.resolveTurn(state, cardA.id, cardB.id);
          roundTurns.push(turnResult);

          // Show turn result briefly
          this._showTurnResult(turnResult);

          // Check for finish
          const finish = CombatResolver.checkFinish(state, turnResult, r);
          if (finish) {
            state.ended = true;
            state.finishMethod = finish.method;
            break;
          }
        } else if (cardA && !cardB) {
          // Player attacked, AI had no card — player wins turn uncontested
          roundTurns.push({
            winner: 'A', margin: 30, effectiveA: 20, effectiveB: 0,
            cardA, cardB: null, damageA: 15, damageB: 0,
          });
        }

        state.turnOwner = state.turnOwner === 'A' ? 'B' : 'A';
      }

      // Score the round
      if (!state.ended && roundTurns.length > 0) {
        const roundScore = CombatResolver.scoreRound(roundTurns);
        state.roundScores.push(roundScore);
        roundTurns.length = 0; // reset for next round
      }
    }

    if (!state.ended) {
      this.engine._computeDecision();
    }

    return this.engine._buildResult();
  }

  // Promise-based wait for player to click a card/move/pass button
  _waitForPlayerAction(state) {
    return new Promise(resolve => {
      this._pendingAction = resolve;
      this.view.update(this.container, state);
    });
  }

  _onPlayerCardSelected(cardId) {
    if (this._pendingAction) {
      const resolve = this._pendingAction;
      this._pendingAction = null;
      resolve({ type: 'card', cardId });
    }
  }

  _onPlayerMove(position) {
    if (this._pendingAction) {
      const resolve = this._pendingAction;
      this._pendingAction = null;
      resolve({ type: 'move', position });
    }
  }

  _onPlayerPass() {
    if (this._pendingAction) {
      const resolve = this._pendingAction;
      this._pendingAction = null;
      resolve({ type: 'pass' });
    }
  }

  _showTurnResult(turnResult) {
    const el = this.container.querySelector('.turn-result');
    if (!el) return;
    const winner = turnResult.winner === 'A' ? 'Você' : 'Oponente';
    const cardA = turnResult.cardA?.name || 'nada';
    const cardB = turnResult.cardB?.name || 'nada';
    el.textContent = `Você jogou ${cardA} vs ${cardB} do oponente — ${winner} venceu o turno!`;
    el.classList.remove('hidden');
    // Brief flash, then clear
    setTimeout(() => el.classList.add('hidden'), 1500);
  }
}
