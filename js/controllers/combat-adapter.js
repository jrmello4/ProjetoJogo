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
import { CardRewardService } from '../services/card-reward-service.js';

export class CombatAdapter {
  constructor() {
    this.engine = new CombatEngine();
    this.view = new CardCombatView();
    this.container = null;
    this.metaProgressionService = null;
  }

  setContainer(container) {
    this.container = container;
  }

  // Optional — a MetaProgressionService instance to award Legacy Points to
  // on a player win (see runFight below). Left null by default: today's
  // dev-testing entry point (App#runCardFight in app.js) doesn't construct
  // one, and runFight must keep working fine without it.
  setMetaProgressionService(service) {
    this.metaProgressionService = service;
  }

  // promoTier drives which CardRewardService pool a post-fight win draws
  // from (default 3 = Regional, since this standalone entry point isn't
  // wired to a real promotion object yet — see App#runCardFight in app.js).
  // isTitleFight swaps the reward for CardRewardService.getTitleReward()
  // instead of a player-chosen pool.
  async runFight(fighterA, fighterB, fiveRounds, gamePlanKey, promoTier = 3, isTitleFight = false) {
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
        } else if (!cardA && cardB) {
          // Player passed/moved (no card), AI attacked — AI wins turn uncontested
          roundTurns.push({
            winner: 'B', margin: 30, effectiveA: 0, effectiveB: 20,
            cardA: null, cardB, damageA: 0, damageB: 15,
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

    const result = this.engine._buildResult();

    // Post-fight card reward — only the player (side A) can earn a card,
    // and only on a win (loss/draw leaves rewardCard null). Title fights
    // hand out a fixed powerful card with no selection; regular fights let
    // the player pick from a tier-based pool via _showCardReward.
    result.rewardCard = null;
    const playerWon = !result.isDraw && result.winnerId === result.fighterAId;
    if (playerWon) {
      if (isTitleFight) {
        result.rewardCard = CardRewardService.getTitleReward();
      } else {
        const options = CardRewardService.getRewardOptions(promoTier);
        if (options.length > 0) {
          result.rewardCard = await this._showCardReward(options);
        }
      }
    }

    // Legacy points for meta-progression — optional, no-op unless a
    // MetaProgressionService was injected via setMetaProgressionService.
    // Fire-and-forget by design (addLegacyPoints doesn't await save()),
    // same as the rest of MetaProgressionService's mutators.
    if (this.metaProgressionService && playerWon) {
      this.metaProgressionService.addLegacyPoints(
        this.metaProgressionService.constructor.computeLegacyPoints(result, isTitleFight)
      );
    }

    return result;
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

  // Promise-based wait for player to click a reward card option — same
  // pattern as _waitForPlayerAction, but resolves with the chosen card
  // object itself instead of an action descriptor.
  _showCardReward(options) {
    return new Promise(resolve => {
      this.container.innerHTML = `
        <div class="reward-modal">
          <h2>Recompensa</h2>
          <p>Escolha uma carta para adicionar ao seu pool:</p>
          <div class="reward-options">
            ${options.map((card, i) => `
              <button class="reward-card" data-index="${i}">
                <div class="reward-card-name">${card.name}</div>
                <div class="reward-card-desc">${card.description}</div>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      this.container.querySelectorAll('.reward-card').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.index, 10);
          resolve(options[idx]);
        });
      });
    });
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
