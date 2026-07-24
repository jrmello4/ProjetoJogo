// js/controllers/combat-adapter.js
//
// Drives CombatEngine/CombatResolver/AICombat through a manual turn loop.
// Used as the official engine for the player's booked fights (WorldService)
// and as the standalone/dev entry point (App#runCardFight).
//
// `interactive` (default true): live UI waits for player clicks on side A.
// When false (fast-forward / simulateWeeks, no cornerHooks), side A is also
// driven by AICombat — no DOM, no Promise that waits forever.
import { CombatEngine } from './combat-engine.js';
import { CombatResolver } from './combat-resolver.js';
import { AICombat } from './ai-combat.js';
import { ACTIVE_CARDS, getDefaultLoadout } from '../config/card-config.js';
import { COACH_SKILLS } from '../config/coach-config.js';
import { CardCombatView } from '../views/card-combat-view.js';
import { CardRewardService } from '../services/card-reward-service.js';
import { TapeService } from '../services/tape-service.js';
import { formatCombatDamage } from '../utils/helpers.js';

export class CombatAdapter {
  constructor() {
    this.engine = new CombatEngine();
    this.view = new CardCombatView();
    this.container = null;
    this.metaProgressionService = null;
    this.interactive = true;
    this.isResolving = false;
    this._timers = new Set();
    this._disconnectObserver = null;
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
  // from (default 3 = Regional). isTitleFight swaps the reward for
  // CardRewardService.getTitleReward() instead of a player-chosen pool.
  // interactive=false: both sides use AI, no UI (fast-forward path).
  async runFight(fighterA, fighterB, fiveRounds, gamePlanKey, promoTier = 3, isTitleFight = false, interactive = true, awardReward = true) {
    // Without a DOM host, interactive mode would hang forever waiting for
    // a click that never arrives — fall back to AI-vs-AI resolution.
    if (interactive && !this.container) interactive = false;
    this.interactive = interactive;

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
    state.isResolving = false;
    state.roundDetails = {};
    // _initState() only builds and returns the state object — it does not
    // assign it to this.engine.state. CombatEngine's own playCard/moveManual/
    // _computeDecision/_buildResult all read/mutate `this.state` internally
    // (see combat-engine.js), so it has to be wired up here for those calls
    // below to operate on the same state this adapter is driving/rendering.
    this.engine.state = state;

    // Render initial state only in interactive mode (needs a real container).
    if (interactive && this.container) {
      this.view.render(this.container, state, {
        onCardPlay: (cardId) => this._onPlayerCardSelected(cardId),
        onMove: (pos) => this._onPlayerMove(pos),
        onPass: () => this._onPlayerPass(),
        isResolving: () => this.isResolving,
      });
    }

    const roundTurns = [];
    const cornerTally = [];

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

        // SIDE A: live player click, or AI when non-interactive (fast-forward)
        if (interactive && this.container) {
          this.view.update(this.container, state);
        }
        const playerAction = interactive
          ? await this._waitForPlayerAction(state)
          : this._selectAiSideAction('A');

        // Snapshot stances BEFORE either side mutates position — stage
        // animations start from here and land on post-resolve positions.
        // Card moveTo is DEFERRED until both sides have acted so a
        // defense card remains legal against a same-beat takedown.
        const preExchangePosA = state.fighterA.position;
        const preExchangePosB = state.fighterB.position;
        let moveSide = null;
        let moveTo = null;

        if (playerAction.type === 'card') {
          this.engine.playCard('A', playerAction.cardId, { applyMove: false });
        } else if (playerAction.type === 'move') {
          moveSide = 'A';
          moveTo = playerAction.position;
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
        //
        // Card selection uses the (possibly post-manual-move) positions;
        // deferred card moves mean a standing defense is still available
        // against a deferred takedown from the same beat.
        const availB = this.engine.getAvailableCards(state, 'B');
        const moveTargetB = AICombat.selectMoveAction(availB, state);
        let aiCard = null;
        if (moveTargetB) {
          if (!moveSide) {
            moveSide = 'B';
            moveTo = moveTargetB;
          }
          this.engine.moveManual('B', moveTargetB);
        } else {
          aiCard = AICombat.selectCard(availB, state, []);
          if (aiCard) {
            this.engine.playCard('B', aiCard.id, { applyMove: false });
          }
        }

        // Resolve the turn: compare player's card vs AI's card
        // If player passed or moved (no card), use a basic fallback
        const cardA = playerAction.type === 'card' ? ACTIVE_CARDS[playerAction.cardId] : null;
        const cardB = aiCard || null;

        // Defense vs takedown: neither shoot lands (no moveTo applied).
        // solidBase passive can also stuff a deferred takedown.
        const aShootStuffedByCard = cardA?.type === 'takedown' && cardB?.type === 'defense';
        const bShootStuffedByCard = cardB?.type === 'takedown' && cardA?.type === 'defense';
        const aShootStuffedByPassive =
          !aShootStuffedByCard && cardA?.type === 'takedown' &&
          this._rollSolidBaseStuff('B', preExchangePosB);
        const bShootStuffedByPassive =
          !bShootStuffedByCard && cardB?.type === 'takedown' &&
          this._rollSolidBaseStuff('A', preExchangePosA);
        const takedownStuffed =
          aShootStuffedByCard || bShootStuffedByCard ||
          aShootStuffedByPassive || bShootStuffedByPassive;

        // Apply deferred moveTo + partner ground sync (manual moves already on).
        this._applyDeferredCardMoves(cardA, cardB, {
          skipA: aShootStuffedByCard || aShootStuffedByPassive,
          skipB: bShootStuffedByCard || bShootStuffedByPassive,
        });

        let turnResult = null;
        let finish = null;
        if (cardA && cardB) {
          turnResult = CombatResolver.resolveTurn(state, cardA.id, cardB.id);
          roundTurns.push(turnResult);
          finish = CombatResolver.checkFinish(state, turnResult, r);
        } else if (cardA && !cardB) {
          // Player attacked, AI had no card — player wins turn uncontested
          turnResult = {
            winner: 'A', margin: 30, effectiveA: 20, effectiveB: 0,
            cardA, cardB: null, damageA: 15, damageB: 0,
          };
          roundTurns.push(turnResult);
        } else if (!cardA && cardB) {
          // Player passed/moved (no card), AI attacked — AI wins turn uncontested
          turnResult = {
            winner: 'B', margin: 30, effectiveA: 0, effectiveB: 20,
            cardA: null, cardB, damageA: 0, damageB: 15,
          };
          roundTurns.push(turnResult);
        }

        // Visual beat — only when a live player is watching. Blocks the
        // next input until jab/queda/sprawl/chão sequence finishes.
        if (interactive && this.container) {
          await this.view.playExchange({
            cardA,
            cardB,
            posA: state.fighterA.position,
            posB: state.fighterB.position,
            prePosA: preExchangePosA,
            prePosB: preExchangePosB,
            winner: turnResult?.winner ?? null,
            takedownStuffed,
            moveSide: !cardA && !cardB ? moveSide : null,
            moveTo: !cardA && !cardB ? moveTo : null,
            // damageA = damage dealt BY A (lands on B), and vice-versa
            damageA: turnResult?.damageA ?? 0,
            damageB: turnResult?.damageB ?? 0,
          });
          if (turnResult) {
            this._showTurnResult(turnResult, takedownStuffed);
            this._flashStaminaHit(turnResult);
            await this._delay(400);
          }
          this.isResolving = false;
          state.isResolving = false;
          this.view.update(this.container, state);
        }

        this._recordRoundAction(state, r, turnResult, playerAction, aiCard, moveSide, moveTo, takedownStuffed);

        if (finish) {
          state.ended = true;
          state.finishMethod = finish.method;
          break;
        }

        state.turnOwner = state.turnOwner === 'A' ? 'B' : 'A';
      }

      // Score the round
      if (!state.ended && roundTurns.length > 0) {
        const roundScore = CombatResolver.scoreRound(roundTurns);
        state.roundScores.push(roundScore);
        state.roundDetails[r] = this._buildRoundDetails(state, r, roundScore);
        roundTurns.length = 0; // reset for next round
      }

      // Corner phase — offer a random coach skill between rounds. Skipped
      // on the last round, after an early finish, and entirely in
      // non-interactive mode (no UI to accept/decline; decline by default
      // so fast-forward does not grant free corner buffs).
      if (!state.ended && r < state.maxRounds) {
        // Clear single-round corner effects granted for the round that
        // just ended before deciding this round's offer. finishChanceBonusA
        // and strategistRevealActive are both single-round effects (see
        // _applyCoachSkill) — this keeps them from silently carrying over
        // into a round the player didn't actually earn them for.
        state.finishChanceBonusA = 0;
        state.strategistRevealActive = false;

        if (interactive && this.container) {
          const skillEntry = this._pickRandomCoachSkill();
          const accepted = await this._showCornerOffer(skillEntry);
          cornerTally.push({
            round: r,
            followed: accepted,
            skill: skillEntry.name,
          });
          if (accepted) {
            this._applyCoachSkill(skillEntry, state);
          }
        }
      }
    }

    if (!state.ended) {
      this.engine._computeDecision();
    }

    const result = this.engine._buildResult();
    result.cornerTally = cornerTally;

    // The arena gets a brief result projection before a reward or the
    // fight-night hub replaces it. No outcome data is changed here.
    if (interactive && this.container) {
      const winnerSide = result.isDraw ? null : result.winnerId === result.fighterAId ? 'A' : 'B';
      await this.view.playOutcome({
        winnerSide,
        isDraw: Boolean(result.isDraw),
        method: result.method,
      });
    }

    // Post-fight card reward — only the player (side A) can earn a card,
    // and only on a win (loss/draw leaves rewardCard null). Title fights
    // hand out a fixed powerful card with no selection; regular fights let
    // the player pick from a tier-based pool via _showCardReward (or auto-
    // pick a random option when non-interactive so simulateWeeks still
    // progresses the card pool).
    // awardReward=false (luta IA-vs-IA no mundo): resolve o resultado mas não
    // distribui carta de recompensa nem persiste no cardPool — NPCs não devem
    // acumular loadout por vencer. Só a luta do jogador ganha prêmio.
    result.rewardCard = null;
    const playerWon = !result.isDraw && result.winnerId === result.fighterAId;
    if (playerWon && awardReward) {
      if (isTitleFight) {
        result.rewardCard = CardRewardService.getTitleReward();
      } else {
        const options = CardRewardService.getRewardOptions(promoTier);
        if (options.length > 0) {
          if (interactive && this.container) {
            result.rewardCard = await this._showCardReward(options);
          } else {
            result.rewardCard = options[Math.floor(Math.random() * options.length)];
          }
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
    if (this.metaProgressionService && playerWon && awardReward) {
      this.metaProgressionService.addLegacyPoints(
        this.metaProgressionService.constructor.computeLegacyPoints(result, isTitleFight)
      );
    }

    this._disposeInteractiveWork();
    return result;
  }

  // AI decision for one side — same move-first-then-card policy used for B.
  // Returns an action descriptor compatible with the player-action path.
  _selectAiSideAction(side) {
    const state = this.engine.state;
    const avail = this.engine.getAvailableCards(state, side);
    const moveTarget = AICombat.selectMoveAction(avail, state, side);
    if (moveTarget) return { type: 'move', position: moveTarget };
    const card = AICombat.selectCard(avail, state, [], side);
    if (card) return { type: 'card', cardId: card.id };
    return { type: 'pass' };
  }

  // Promise-based wait for player to click a card/move/pass button.
  // Only valid in interactive mode with a container; callers must not use
  // this on the fast-forward path (use _selectAiSideAction instead).
  _waitForPlayerAction(state) {
    return new Promise(resolve => {
      this.isResolving = false;
      state.isResolving = false;
      this._pendingAction = resolve;
      this._watchContainerDisconnect(() => this._resolvePendingAction({ type: 'pass' }));
      if (this.container) this.view.update(this.container, state);
    });
  }

  _resolvePendingAction(action) {
    if (!this._pendingAction) return;
    const resolve = this._pendingAction;
    this._pendingAction = null;
    this._stopDisconnectWatch();
    resolve(action);
  }

  _onPlayerCardSelected(cardId) {
    if (this._pendingAction && !this.isResolving) {
      this.isResolving = true;
      this.engine.state.isResolving = true;
      this._resolvePendingAction({ type: 'card', cardId });
    }
  }

  _onPlayerMove(position) {
    if (this._pendingAction && !this.isResolving) {
      this.isResolving = true;
      this.engine.state.isResolving = true;
      this._resolvePendingAction({ type: 'move', position });
    }
  }

  _onPlayerPass() {
    if (this._pendingAction && !this.isResolving) {
      this.isResolving = true;
      this.engine.state.isResolving = true;
      this._resolvePendingAction({ type: 'pass' });
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
      const finish = card => {
        this._stopDisconnectWatch();
        resolve(card);
      };
      this._watchContainerDisconnect(() => finish(options[0] || null));
      this.container.querySelectorAll('.reward-card').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.index, 10);
          finish(options[idx]);
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
      this.container.classList.add('corner-active');
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
      const finish = accepted => {
        this._stopDisconnectWatch();
        this.container.classList.remove('corner-active');
        resolve(accepted);
      };
      this._watchContainerDisconnect(() => finish(false));
      acceptBtn.addEventListener('click', () => finish(true));
      declineBtn.addEventListener('click', () => finish(false));
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

  /**
   * solidBase (takedownDefenseBonus) — roll only. Does not mutate state;
   * deferred moves are simply skipped when this returns true.
   * @param {'A'|'B'} defenderSide
   * @param {string} defenderPrePos position before the exchange
   */
  _rollSolidBaseStuff(defenderSide, defenderPrePos) {
    const state = this.engine.state;
    const defenderPassives = defenderSide === 'A' ? state.passivesA : state.passivesB;
    const solidBase = (defenderPassives || []).find(p => p.effect?.type === 'takedownDefenseBonus');
    if (!solidBase) return false;
    if (defenderPrePos !== solidBase.effect.position) return false;
    return Math.random() < solidBase.effect.value;
  }

  /**
   * Apply deferred card.moveTo after both sides acted. Skips stuffed
   * takedowns. When both land non-conflicting moves, A applies first then B
   * (partner sync from the later call wins if both would set ground).
   */
  _applyDeferredCardMoves(cardA, cardB, { skipA = false, skipB = false } = {}) {
    if (cardA?.moveTo && !skipA) {
      this.engine.applyCardMove('A', cardA.id);
    }
    if (cardB?.moveTo && !skipB) {
      this.engine.applyCardMove('B', cardB.id);
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

  _showTurnResult(turnResult, takedownStuffed = false) {
    if (!this.container) return;
    const el = this.container.querySelector('.turn-result');
    if (!el) return;
    const winner = turnResult.winner === 'A' ? 'Você' : 'Oponente';
    const cardA = turnResult.cardA?.name || 'nada';
    const cardB = turnResult.cardB?.name || 'nada';
    let text = `Você jogou ${cardA} vs ${cardB} do oponente — ${winner} venceu o turno!`;
    if (takedownStuffed) {
      text += ' · Queda defendida!';
    } else {
      const td = turnResult.cardA?.type === 'takedown' || turnResult.cardB?.type === 'takedown';
      if (td) {
        const pos = this.engine.state?.fighterA?.position || '';
        if (String(pos).startsWith('ground')) text += ' · Luta vai ao chão!';
      }
    }
    el.textContent = text;
    el.classList.remove('hidden');
    // Brief flash, then clear
    this._schedule(() => el.classList.add('hidden'), 1800);
  }

  /**
   * Pulse stamina bars after an exchange — red flash on the side that
   * absorbed damage, with a brief width-jump already handled by CSS
   * transition on the fill width update.
   */
  _flashStaminaHit(turnResult) {
    if (!this.container || !turnResult) return;
    const bars = this.container.querySelectorAll('.stamina-bar');
    if (!bars.length) return;
    // bars[0] = A, bars[1] = B
    const pulse = (idx, heavy) => {
      const bar = bars[idx];
      if (!bar) return;
      const fill = bar.querySelector('.stamina-fill');
      if (!fill) return;
      fill.classList.remove('stamina-hit', 'stamina-hit-heavy');
      void fill.offsetWidth;
      fill.classList.add(heavy ? 'stamina-hit-heavy' : 'stamina-hit');
      this._schedule(() => fill.classList.remove('stamina-hit', 'stamina-hit-heavy'), 450);
    };
    // damageA is damage dealt by A → B takes the hit
    if ((turnResult.damageA || 0) > 0) pulse(1, (turnResult.damageA || 0) >= 25);
    if ((turnResult.damageB || 0) > 0) pulse(0, (turnResult.damageB || 0) >= 25);
    // Also shake the header strip on heavy exchanges
    const header = this.container.querySelector('[data-combat-header]');
    if (header && ((turnResult.damageA || 0) >= 25 || (turnResult.damageB || 0) >= 25)) {
      header.classList.remove('combat-header-shake');
      void header.offsetWidth;
      header.classList.add('combat-header-shake');
      this._schedule(() => header.classList.remove('combat-header-shake'), 400);
    }
  }

  _recordRoundAction(state, round, turnResult, playerAction, aiCard, moveSide, moveTo, takedownStuffed) {
    const details = (state.roundActionLog ||= {});
    const actions = (details[round] ||= []);
    const cardA = turnResult?.cardA || (playerAction?.type === 'card' ? ACTIVE_CARDS[playerAction.cardId] : null);
    const cardB = turnResult?.cardB || aiCard;
    if (cardA) actions.push({
      fighterId: state.fighterA.ref.id,
      detail: `Você usou ${cardA.name}${turnResult?.damageA ? ` e causou ${formatCombatDamage(turnResult.damageA)} de dano` : ''}.`,
      type: cardA.type === 'takedown' ? 'takedown' : cardA.type === 'submission' ? 'submission' : 'strike',
    });
    if (cardB) actions.push({
      fighterId: state.fighterB.ref.id,
      detail: `${state.fighterB.ref.name} usou ${cardB.name}${turnResult?.damageB ? ` e causou ${formatCombatDamage(turnResult.damageB)} de dano` : ''}.`,
      type: cardB.type === 'takedown' ? 'takedown' : cardB.type === 'submission' ? 'submission' : 'strike',
    });
    if (!cardA && !cardB && moveSide && moveTo) {
      const name = moveSide === 'A' ? 'Você' : state.fighterB.ref.name;
      actions.push({ fighterId: moveSide === 'A' ? state.fighterA.ref.id : state.fighterB.ref.id, detail: `${name} mudou para ${moveTo}.`, type: 'clinch' });
    }
    if (takedownStuffed) actions.push({ fighterId: state.fighterA.ref.id, detail: 'A queda foi defendida.', type: 'takedown' });
  }

  _buildRoundDetails(state, round, score) {
    const roundLog = state.roundActionLog?.[round] || [];
    const moments = roundLog.filter(item => ['takedown', 'submission'].includes(item.type)).map(item => ({
      actorName: item.fighterId === state.fighterA.ref.id ? 'Você' : state.fighterB.ref.name,
      targetName: item.fighterId === state.fighterA.ref.id ? state.fighterB.ref.name : 'Você',
      type: item.type,
      success: true,
    }));
    return {
      scoreA: score.scoreA,
      scoreB: score.scoreB,
      finished: false,
      roundLog,
      moments,
    };
  }

  _delay(ms) {
    return new Promise(resolve => this._schedule(resolve, ms));
  }

  _schedule(callback, delay) {
    const timer = setTimeout(() => {
      this._timers.delete(timer);
      callback();
    }, delay);
    this._timers.add(timer);
    return timer;
  }

  _watchContainerDisconnect(onDisconnect) {
    this._stopDisconnectWatch();
    if (!this.container || typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    this._disconnectObserver = new MutationObserver(() => {
      if (!this.container?.isConnected) onDisconnect();
    });
    this._disconnectObserver.observe(document.body, { childList: true, subtree: true });
  }

  _stopDisconnectWatch() {
    this._disconnectObserver?.disconnect();
    this._disconnectObserver = null;
  }

  _disposeInteractiveWork() {
    this._stopDisconnectWatch();
    this._timers.forEach(timer => clearTimeout(timer));
    this._timers.clear();
    this.view.dispose();
  }
}
