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
import { COACH_SKILLS } from '../config/coach-config.js';
import { CardCombatView } from '../views/card-combat-view.js';
import { CardRewardService } from '../services/card-reward-service.js';
import { TapeService } from '../services/tape-service.js';

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
    // getDefaultLoadout returns a direct reference into DEFAULT_LOADOUTS
    // (not a copy) — shallow-copy both the loadout object and its `active`
    // array here before mutating anything below, or a cardPool merge would
    // permanently graft discovered/earned cards onto the shared config
    // object, leaking into every future fight for every fighter that uses
    // this game plan.
    const baseLoadoutA = getDefaultLoadout(gamePlanKey);
    const loadoutA = { active: [...baseLoadoutA.active], passive: baseLoadoutA.passive };
    // Final whole-branch review, Finding 2 — discovered (training-camp,
    // Task 9) and earned (post-fight reward, Task 8) cards live in
    // fighter.cardPool but were never actually wired into the fight
    // loadout. Simple dedup merge into the active array — no equip/slot
    // UI (explicitly out of scope). loadoutA.passive is left untouched:
    // passives aren't tracked in cardPool per Task 9's scope. The
    // `ACTIVE_CARDS[id]` guard also defensively skips any non-active-card
    // id that might end up in cardPool (see the reward-persistence note
    // near `_showCardReward` below).
    if (fighterA.cardPool && fighterA.cardPool.length > 0) {
      for (const id of fighterA.cardPool) {
        if (ACTIVE_CARDS[id] && !loadoutA.active.includes(id)) {
          loadoutA.active.push(id);
        }
      }
    }
    // Scout the player's (fighterA's) game-plan signature from their tape
    // and have the AI counter it. `state` doesn't exist yet at this point
    // (it's built by _initState just below, from loadoutB itself), and
    // AICombat.selectLoadout's logic doesn't read `state` today — so we
    // pass null rather than restructure the init order for an unused param.
    const tapeData = TapeService.getFavoredPlanData(fighterA);
    const loadoutB = AICombat.selectLoadout(null, tapeData);

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
        state.fighterA.stamina = Math.max(15, state.fighterA.stamina - this._staminaDecayAmount(state.passivesA));
        state.fighterB.stamina = Math.max(15, state.fighterB.stamina - this._staminaDecayAmount(state.passivesB));
      }

      state.turnOwner = 'A';

      while (state.roundTurn < state.maxTurnsPerRound && !state.ended) {
        state.roundTurn++;
        state.currentTurn++;

        // Tick cooldown for player (A) at start of their turn
        this._tickCooldownsWithPassives('A');

        // PLAYER TURN (A): wait for card selection via UI
        this.view.update(this.container, state);
        const playerAction = await this._waitForPlayerAction(state);

        if (playerAction.type === 'card') {
          const preMovePosA = state.fighterA.position;
          this.engine.playCard('A', playerAction.cardId);
          this._maybeResistTakedown('A', playerAction.cardId, preMovePosA);
        } else if (playerAction.type === 'move') {
          this.engine.moveManual('A', playerAction.position);
        }
        // 'pass' = do nothing

        // Tick cooldown for AI
        this._tickCooldownsWithPassives('B');

        // AI TURN (B): decide whether to reposition manually before
        // considering a card. Finding 1 (final whole-branch review) — the
        // AI never called AICombat.selectMoveAction, so it could get stuck
        // at DISTANCE forever whenever its current loadout (via
        // AICombat.selectLoadout) has no moveTo-capable card reachable
        // from DISTANCE (only 'overhand' qualifies, and several countering
        // loadouts don't include it). Checked first, before selectCard: if
        // it returns a target position, the AI spends its turn moving and
        // does NOT also play a card (aiCard stays null) — that naturally
        // routes into the existing cardA && !cardB / uncontested-player-
        // attack branch below, already correct and tested.
        const availB = this.engine.getAvailableCards(state, 'B');
        const moveTargetB = AICombat.selectMoveAction(availB, state);
        let aiCard = null;
        if (moveTargetB) {
          this.engine.moveManual('B', moveTargetB);
        } else {
          aiCard = AICombat.selectCard(availB, state, []);
          if (aiCard) {
            const preMovePosB = state.fighterB.position;
            this.engine.playCard('B', aiCard.id);
            this._maybeResistTakedown('B', aiCard.id, preMovePosB);
          }
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

      // Corner phase — offer a random coach skill between rounds. Skipped
      // on the last round (there's no "next round" left for a corner skill
      // to help with once the fight is over) and skipped after an early
      // finish (state.ended already true in that case).
      if (!state.ended && r < state.maxRounds) {
        // Clear single-round corner effects granted for the round that
        // just ended before deciding this round's offer. finishChanceBonusA
        // and strategistRevealActive are both single-round effects (see
        // _applyCoachSkill) — this keeps them from silently carrying over
        // into a round the player didn't actually earn them for.
        state.finishChanceBonusA = 0;
        state.strategistRevealActive = false;

        const skillEntry = this._pickRandomCoachSkill();
        const accepted = await this._showCornerOffer(skillEntry);
        if (accepted) {
          this._applyCoachSkill(skillEntry, state);
        }
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

    // Final whole-branch review, Finding 2 — persist the chosen/awarded
    // reward card into fighterA.cardPool, same dedup guard training-camp.js
    // already uses for camp discoveries (Task 9), so fight rewards actually
    // stick around the same way. Applied once here, after either reward
    // branch above has resolved, rather than only inside _showCardReward's
    // own resolution — this also covers the isTitleFight branch (a title
    // reward is a reward too, and left it unpersisted would reproduce the
    // exact same bug for title fights). fighterA.cardPool already exists on
    // every real Fighter instance (js/models/fighter.js's constructor
    // default, added in Task 9), but initialize it defensively in case this
    // is ever called with a plain object that skipped that constructor.
    if (result.rewardCard) {
      fighterA.cardPool = fighterA.cardPool || [];
      if (!fighterA.cardPool.includes(result.rewardCard.id)) {
        fighterA.cardPool.push(result.rewardCard.id);
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

  // Picks one of the 3 COACH_SKILLS entries at random — flat, un-scaled
  // selection with no academy/synergy weighting (that's out of scope for
  // this dev-testing entry point per the task's explicit boundaries).
  _pickRandomCoachSkill() {
    const entries = Object.values(COACH_SKILLS);
    return entries[Math.floor(Math.random() * entries.length)];
  }

  // Promise-based wait for the player to accept/decline a corner coach
  // skill offer — same idiom as _showCardReward: fully replace
  // this.container's innerHTML, bind click listeners, resolve the Promise
  // from inside them. Resolves true on accept, false on decline.
  _showCornerOffer(skillEntry) {
    return new Promise(resolve => {
      this.container.innerHTML = `
        <div class="corner-modal">
          <h2>Conselho do Córner</h2>
          <div class="corner-skill">
            <div class="corner-skill-name">${skillEntry.name}</div>
            <div class="corner-skill-desc">${skillEntry.description}</div>
          </div>
          <div class="corner-actions">
            <button class="corner-accept-btn">Aceitar</button>
            <button class="corner-decline-btn">Recusar</button>
          </div>
        </div>
      `;
      const acceptBtn = this.container.querySelector('.corner-accept-btn');
      const declineBtn = this.container.querySelector('.corner-decline-btn');
      acceptBtn.addEventListener('click', () => resolve(true));
      declineBtn.addEventListener('click', () => resolve(false));
    });
  }

  // Applies an accepted coach skill's effect to the fight state. Only side
  // A (the player) is ever affected — corner skills are a player-only
  // mechanic, mirroring the "corner only affects the player" convention
  // used elsewhere in this codebase.
  _applyCoachSkill(skillEntry, state) {
    const effect = skillEntry.effect;
    switch (effect.type) {
      case 'restoreSpecialUses': {
        // Eligible: limited-use active cards (maxUses !== Infinity) in the
        // player's loadout that are currently below their max uses.
        const candidates = (state.activesA || []).filter(id => {
          const card = ACTIVE_CARDS[id];
          if (!card || card.maxUses === Infinity) return false;
          const remaining = state.usesA[id] ?? card.maxUses;
          return remaining < card.maxUses;
        });
        if (candidates.length > 0) {
          const chosenId = candidates[Math.floor(Math.random() * candidates.length)];
          const card = ACTIVE_CARDS[chosenId];
          const remaining = state.usesA[chosenId] ?? card.maxUses;
          state.usesA[chosenId] = Math.min(card.maxUses, remaining + effect.value);
        }
        // No eligible card (all at max, or no limited-use cards in
        // loadout) — no-op, this skill simply has no effect this time.
        break;
      }
      case 'revealPosition':
        // _renderPositionTracker already shows both fighters' positions
        // unconditionally at all times (pre-existing Task 5 design), so
        // this flag has no additional visible UI impact today — it's real
        // state bookkeeping tracked the same way as the other 2 effects.
        state.strategistRevealActive = true;
        break;
      case 'finishChanceBonus':
        state.finishChanceBonusA = (state.finishChanceBonusA || 0) + effect.value;
        break;
      default:
        break;
    }
  }

  // ===== Finding 3 (final whole-branch review) — passive effect hooks =====
  // combat-resolver.js's applyPassiveDamageMods only ever handled
  // `damageMult` (heavyHands). These three effect types aren't damage
  // modifiers at all — they touch stamina decay, position resolution, and
  // cooldown ticking respectively — so each is dispatched from the actual
  // point in this adapter's turn loop where that mechanic already lives,
  // rather than being shoehorned into applyPassiveDamageMods.
  // dirtyFight (foulChance) and student (revealFirstTurn) are intentionally
  // left unhandled — out of scope, see task notes.

  // marathon (fatigueReduction) — reduces the flat per-round stamina decay
  // by the passive's `value` fraction for whichever side has it equipped.
  _staminaDecayAmount(passives) {
    const BASE_DECAY = 10;
    const marathon = (passives || []).find(p => p.effect?.type === 'fatigueReduction');
    if (!marathon) return BASE_DECAY;
    return BASE_DECAY * (1 - marathon.effect.value);
  }

  // solidBase (takedownDefenseBonus) — 20% (passive's `value`) chance to
  // negate a takedown card's position change when the defender (the side
  // that did NOT play the card) holds solidBase and is currently in
  // POSITIONS.RANGE. Implemented as a revert-after-playCard step: playCard
  // already applies `card.moveTo` unconditionally and has no "skip move"
  // flag, so capturing the mover's pre-call position and restoring it on a
  // successful defense roll is the smallest change that works, and avoids
  // touching combat-engine.js at all. Note that in the current position
  // model, playCard only ever moves the CARD OWNER's own position (a
  // takedown moves its player to GROUND_TOP — representing them taking top
  // position); the opponent's position field is never touched by it. So
  // "negating the position change" concretely means the attacker fails to
  // advance to GROUND_TOP and the exchange stays at range — the closest
  // faithful mapping of "defender stays in RANGE" onto this per-fighter-
  // independent position model. Cooldown/uses are already consumed by the
  // playCard call that ran before this — a resisted takedown still costs
  // the attacker resources, per the finding's explicit call-out.
  _maybeResistTakedown(attackerSide, cardId, preMovePosition) {
    const card = ACTIVE_CARDS[cardId];
    if (!card || card.type !== 'takedown') return;
    const state = this.engine.state;
    const attackerFighter = attackerSide === 'A' ? state.fighterA : state.fighterB;
    const defenderFighter = attackerSide === 'A' ? state.fighterB : state.fighterA;
    const defenderPassives = attackerSide === 'A' ? state.passivesB : state.passivesA;
    const solidBase = (defenderPassives || []).find(p => p.effect?.type === 'takedownDefenseBonus');
    if (!solidBase) return;
    if (defenderFighter.position !== solidBase.effect.position) return;
    if (Math.random() < solidBase.effect.value) {
      attackerFighter.position = preMovePosition;
    }
  }

  // bloodCold (cooldownReductionLoser) — when the passive holder is
  // currently BEHIND on the aggregate scorecard (completed rounds only —
  // state.roundScores), their limited-use ("special", maxUses !==
  // Infinity) cards tick down cooldown one extra step per turn. Wraps the
  // existing per-turn `engine._tickCooldowns` call (both call sites in the
  // turn loop above now go through this instead of calling the engine
  // method directly) rather than modifying `_tickCooldowns` itself, since
  // the extra decrement only applies to a subset of cards and only
  // conditionally — keeping combat-engine.js's tick function untouched and
  // ignorant of passives.
  _tickCooldownsWithPassives(side) {
    const state = this.engine.state;
    const cooldowns = side === 'A' ? state.cooldownsA : state.cooldownsB;
    this.engine._tickCooldowns(cooldowns);

    const passives = side === 'A' ? state.passivesA : state.passivesB;
    const bloodCold = (passives || []).find(p => p.effect?.type === 'cooldownReductionLoser');
    if (!bloodCold || !this._isBehindOnScorecard(side)) return;

    for (const cardId of Object.keys(cooldowns)) {
      const card = ACTIVE_CARDS[cardId];
      if (!card || card.maxUses === Infinity) continue;
      if (cooldowns[cardId] > 0) {
        cooldowns[cardId] -= bloodCold.effect.value;
        if (cooldowns[cardId] <= 0) delete cooldowns[cardId];
      }
    }
  }

  // Sums completed rounds only (state.roundScores) — the round in progress
  // hasn't been scored yet at the point cooldowns tick mid-round, so it
  // can't count toward "currently behind" yet.
  _isBehindOnScorecard(side) {
    const state = this.engine.state;
    let totalA = 0, totalB = 0;
    for (const rd of state.roundScores) {
      totalA += rd.scoreA;
      totalB += rd.scoreB;
    }
    return side === 'A' ? totalA < totalB : totalB < totalA;
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
