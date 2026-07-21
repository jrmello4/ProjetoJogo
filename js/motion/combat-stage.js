// js/motion/combat-stage.js
//
// Cinematic card-combat stage — red corner / blue corner sprite fighters
// over a gym backdrop. Poses come from assets/combat/fighters/{red,blue}/;
// js/motion/combat-pose.js owns the card -> pose mapping.

import { POSITIONS } from '../config/card-config.js';
import { escapeHtml } from '../utils/helpers.js';
import { POSES, poseForCard, idlePoseForPosition, isHeavyImpact, spriteSrc } from './combat-pose.js';

const gsap = typeof window !== 'undefined' ? window.gsap : null;

const PHASE_LABEL = {
  distance: 'Distância',
  range: 'Alcance',
  clinch: 'Clinch',
  ground: 'Chão',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function phaseFromPositions(posA, posB) {
  const g = (p) => p === POSITIONS.GROUND_TOP || p === POSITIONS.GROUND_GUARD;
  if (g(posA) || g(posB)) return 'ground';
  if (posA === POSITIONS.CLINCH || posB === POSITIONS.CLINCH) return 'clinch';
  if (posA === POSITIONS.RANGE || posB === POSITIONS.RANGE) return 'range';
  return 'distance';
}

export class CombatStage {
  constructor(root = null) {
    this.root = root;
    this._fighters = { A: null, B: null };
    this._pose = { A: POSES.IDLE, B: POSES.IDLE };
    this.reducedMotion =
      (typeof window !== 'undefined' &&
        (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
          localStorage.getItem('reduceMotion') === 'true')) ||
      false;
    this._playing = false;
  }

  attach(root, fighterA = null, fighterB = null) {
    this.root = root;
    this._pose = { A: POSES.IDLE, B: POSES.IDLE };
    if (fighterA) this._fighters.A = fighterA;
    if (fighterB) this._fighters.B = fighterB;
  }

  static buildHTML(fighterA, fighterB) {
    const nameA = escapeHtml(fighterA?.name || 'Você');
    const nameB = escapeHtml(fighterB?.name || 'Oponente');

    return `
      <div class="combat-stage" data-combat-stage data-phase="distance"
           data-pos-a="${POSITIONS.DISTANCE}" data-pos-b="${POSITIONS.DISTANCE}">

        <div class="cs-atmosphere" aria-hidden="true">
          <div class="cs-vs-mark">VS</div>
        </div>

        <div class="cs-impact-flash" data-cs-impact-flash aria-hidden="true"></div>

        <div class="cs-phase" data-cs-phase>
          <span class="cs-phase-dot"></span>
          <span data-cs-phase-text>Distância</span>
        </div>

        <div class="cs-ring">
          <div class="cs-corner cs-corner--red" data-cs-side="A" data-role="">
            <div class="cs-corner-stripe"></div>
            <div class="cs-sprite-frame">
              <img data-cs-sprite-a class="cs-sprite-img" src="${spriteSrc('A', POSES.IDLE)}" alt="" draggable="false" />
            </div>
            <div class="cs-corner-meta">
              <div class="cs-corner-tag">Canto vermelho</div>
              <div class="cs-corner-name">${nameA}</div>
              <div class="cs-role-badge" data-cs-role-a hidden></div>
            </div>
          </div>

          <div class="cs-center" data-cs-center>
            <div class="cs-caption" data-cs-caption hidden>
              <span data-cs-caption-text></span>
            </div>
          </div>

          <div class="cs-corner cs-corner--blue" data-cs-side="B" data-role="">
            <div class="cs-corner-stripe"></div>
            <div class="cs-sprite-frame">
              <img data-cs-sprite-b class="cs-sprite-img" src="${spriteSrc('B', POSES.IDLE)}" alt="" draggable="false" />
            </div>
            <div class="cs-corner-meta">
              <div class="cs-corner-tag">Canto azul</div>
              <div class="cs-corner-name">${nameB}</div>
              <div class="cs-role-badge" data-cs-role-b hidden></div>
            </div>
          </div>
        </div>

        <div class="cs-floats" data-cs-floats aria-hidden="true"></div>
      </div>
    `;
  }

  _el(sel) {
    return this.root?.querySelector(sel) || null;
  }

  setPositions(posA, posB) {
    if (!this.root) return;
    posA = posA || POSITIONS.DISTANCE;
    posB = posB || POSITIONS.DISTANCE;
    this.root.dataset.posA = posA;
    this.root.dataset.posB = posB;

    const phase = phaseFromPositions(posA, posB);
    this.root.dataset.phase = phase;

    const label = this._el('[data-cs-phase-text]');
    if (label) {
      if (phase === 'ground') {
        if (posA === POSITIONS.GROUND_TOP) label.textContent = 'Chão · Você no topo';
        else if (posB === POSITIONS.GROUND_TOP) label.textContent = 'Chão · Oponente no topo';
        else label.textContent = 'Chão';
      } else {
        label.textContent = PHASE_LABEL[phase] || 'Octógono';
      }
    }

    this._setRole('A', posA);
    this._setRole('B', posB);

    if (!this._playing) {
      this._setPose('A', idlePoseForPosition(posA));
      this._setPose('B', idlePoseForPosition(posB));
    }
  }

  _setRole(side, position) {
    const corner = this._el(`[data-cs-side="${side}"]`);
    const badge = this._el(`[data-cs-role-${side.toLowerCase()}]`);
    if (!corner) return;

    let role = '';
    let text = '';
    if (position === POSITIONS.GROUND_TOP) {
      role = 'top';
      text = 'TOPO';
    } else if (position === POSITIONS.GROUND_GUARD) {
      role = 'guard';
      text = 'GUARDA';
    } else if (position === POSITIONS.CLINCH) {
      role = 'clinch';
      text = 'CLINCH';
    }

    corner.dataset.role = role;
    if (badge) {
      if (text) {
        badge.hidden = false;
        badge.textContent = text;
      } else {
        badge.hidden = true;
        badge.textContent = '';
      }
    }
  }

  _setPose(side, pose) {
    if (!pose || this._pose[side] === pose) return;
    const img = this._el(`[data-cs-sprite-${side.toLowerCase()}]`);
    const src = spriteSrc(side, pose);
    if (!img || !src) return;
    img.src = src;
    this._pose[side] = pose;
  }

  async playExchange(opts = {}) {
    if (!this.root) return;
    if (this._playing) await this._waitIdle();
    this._playing = true;
    this.root.classList.add('cs-busy');

    try {
      const {
        cardA = null,
        cardB = null,
        posA,
        posB,
        prePosA,
        prePosB,
        winner = null,
        takedownStuffed = false,
        moveSide = null,
        damageA = 0,
        damageB = 0,
      } = opts;

      if (prePosA || prePosB) {
        this.setPositions(prePosA || posA, prePosB || posB);
      }

      if (this.reducedMotion) {
        this.setPositions(posA, posB);
        await sleep(200);
        return;
      }

      if (!cardA && !cardB) {
        if (moveSide) await this._pulseCorner(moveSide, 'advance');
        this.setPositions(posA, posB);
        await sleep(180);
        return;
      }

      const aTd = cardA?.type === 'takedown';
      const bTd = cardB?.type === 'takedown';
      const aDef = cardA?.type === 'defense';
      const bDef = cardB?.type === 'defense';
      const stuffed = takedownStuffed || (aTd && bDef) || (bTd && aDef);

      if (cardA && cardB) {
        if (stuffed) {
          const atk = aTd ? 'A' : 'B';
          await this._resolveBlock(atk, atk === 'A' ? 'B' : 'A', atk === 'A' ? cardA : cardB);
        } else if (aTd || bTd) {
          const atk = aTd ? 'A' : 'B';
          await this._resolveTakedown(atk, atk === 'A' ? cardA : cardB);
        } else {
          await this._resolveStrikeExchange(cardA, cardB, winner, damageA, damageB, posA, posB);
        }
      } else {
        const card = cardA || cardB;
        const side = cardA ? 'A' : 'B';
        const pos = cardA ? posA : posB;
        const target = side === 'A' ? 'B' : 'A';
        const dmg = side === 'A' ? (damageB || damageA || 0) : (damageA || damageB || 0);

        const pose = poseForCard(card, pos);
        if (pose) this._setPose(side, pose);

        if (card.type === 'takedown' && !stuffed) {
          await this._resolveTakedown(side, card);
        } else if (card.type === 'takedown' && stuffed) {
          await this._resolveBlock(side, target, card);
        } else if (card.type === 'defense') {
          await this._showCaption(side, card);
          this._setPose(side, POSES.DEFENSE);
          await this._pulseCorner(side, 'block');
        } else if (card.type === 'submission') {
          await this._resolveSubmission(side, target, card, dmg);
        } else {
          await this._landHit(side, target, dmg || 12, card, pos);
        }
      }

      await this._hideCaption();
      this.setPositions(posA, posB);
      await sleep(120);
    } finally {
      this._playing = false;
      this.root?.classList.remove('cs-busy');
    }
  }

  // ── Visual beats ──────────────────────────────────────────

  async _showCaption(side, card) {
    const root = this._el('[data-cs-caption]');
    const text = this._el('[data-cs-caption-text]');
    if (!root || !card) return;
    if (text) text.textContent = card.name || '';
    root.dataset.side = side;
    root.hidden = false;
    root.classList.remove('cs-caption-in', 'cs-caption-out');
    void root.offsetWidth;
    root.classList.add('cs-caption-in');
  }

  async _hideCaption() {
    const root = this._el('[data-cs-caption]');
    if (!root || root.hidden) return;
    root.classList.remove('cs-caption-in');
    root.classList.add('cs-caption-out');
    await sleep(160);
    root.hidden = true;
    root.classList.remove('cs-caption-out');
  }

  async _resolveStrikeExchange(cardA, cardB, winner, damageA, damageB, posA, posB) {
    if (winner === 'A') {
      await this._landHit('A', 'B', damageB || damageA || 14, cardA, posA);
    } else if (winner === 'B') {
      await this._landHit('B', 'A', damageA || damageB || 14, cardB, posB);
    } else {
      this._setPose('A', POSES.HIT);
      this._setPose('B', POSES.HIT);
      this._shake(0.6);
      if (damageB > 0) this._floatDmg('B', damageB, 'hit');
      if (damageA > 0) this._floatDmg('A', damageA, 'hit');
      await Promise.all([this._pulseCorner('A', 'hit'), this._pulseCorner('B', 'hit')]);
      await sleep(160);
    }
  }

  async _resolveTakedown(attacker, card) {
    await this._showCaption(attacker, card);
    await this._pulseCorner(attacker, 'shoot');
    const def = attacker === 'A' ? 'B' : 'A';
    this._setPose(attacker, POSES.TAKEDOWN);
    this._setPose(def, POSES.HIT);
    this._shake(1.15);
    this._impactFlash();
    await this._pulseCorner(def, 'hit');
    this._floatDmg(def, 0, 'down');
    await sleep(200);
  }

  async _resolveBlock(attacker, defender, card) {
    // Spec: blocked takedown gets no screen shake (unlike a landed one) —
    // only a successful/heavy beat shakes the camera.
    await this._showCaption(attacker, card);
    if (card.type === 'takedown') this._setPose(attacker, POSES.TAKEDOWN);
    await this._pulseCorner(attacker, 'attack');
    this._setPose(defender, POSES.DEFENSE);
    await this._pulseCorner(defender, 'block');
    this._floatDmg(attacker, 0, 'block');
    await sleep(200);
  }

  async _resolveSubmission(attacker, defender, card, amount) {
    await this._showCaption(attacker, card);
    await this._tension();
    if (amount > 0) this._floatDmg(defender, amount, 'sub');
    await sleep(200);
  }

  async _landHit(attacker, target, amount, card, attackerPosition) {
    await this._showCaption(attacker, card);
    const heavy = isHeavyImpact(card, amount);
    const pose = poseForCard(card, attackerPosition);
    if (pose) this._setPose(attacker, pose);
    await this._pulseCorner(attacker, 'attack', heavy);
    this._setPose(target, POSES.HIT);
    await this._pulseCorner(target, 'hit', heavy);
    this._shake(heavy ? 1.1 : 0.65);
    if (heavy) this._impactFlash();
    if (amount > 0) this._floatDmg(target, amount, 'hit');
    await sleep(200);
  }

  async _pulseCorner(side, mode = 'attack', heavy = false) {
    const corner = this._el(`[data-cs-side="${side}"]`);
    const img = this._el(`[data-cs-sprite-${side.toLowerCase()}]`);
    if (!corner) return;

    const cls =
      mode === 'hit'
        ? 'cs-corner--hit'
        : mode === 'block'
          ? 'cs-corner--block'
          : mode === 'shoot'
            ? 'cs-corner--shoot'
            : mode === 'advance'
              ? 'cs-corner--advance'
              : 'cs-corner--attack';

    corner.classList.remove(
      'cs-corner--attack',
      'cs-corner--hit',
      'cs-corner--block',
      'cs-corner--shoot',
      'cs-corner--advance'
    );
    void corner.offsetWidth;
    corner.classList.add(cls);

    if (gsap && img && !this.reducedMotion && (mode === 'attack' || mode === 'shoot' || mode === 'hit')) {
      const toward = side === 'A' ? 1 : -1;
      const magnitude = heavy ? 1.6 : 1;
      if (mode === 'hit') {
        const away = -toward;
        gsap.fromTo(
          img,
          { x: 0 },
          {
            duration: 0.32,
            keyframes: [
              { x: away * 8 * magnitude, duration: 0.08 },
              { x: away * 3 * magnitude, duration: 0.1 },
              { x: 0, duration: 0.14 },
            ],
            ease: 'power2.out',
          }
        );
      } else {
        gsap.fromTo(
          img,
          { x: 0 },
          {
            duration: 0.3,
            keyframes: [
              { x: toward * 10 * magnitude, duration: 0.1 },
              { x: 0, duration: 0.2 },
            ],
            ease: 'power2.out',
          }
        );
      }
    }

    await sleep(mode === 'shoot' ? 360 : mode === 'hit' ? 300 : 260);
    corner.classList.remove(cls);
  }

  _impactFlash() {
    const el = this._el('[data-cs-impact-flash]');
    if (!el || this.reducedMotion) return;
    el.classList.remove('cs-impact-flash--on');
    void el.offsetWidth;
    el.classList.add('cs-impact-flash--on');
    setTimeout(() => el.classList.remove('cs-impact-flash--on'), 320);
  }

  async _tension() {
    if (gsap && !this.reducedMotion) {
      ['A', 'B'].forEach((side) => {
        const img = this._el(`[data-cs-sprite-${side.toLowerCase()}]`);
        if (!img) return;
        gsap.fromTo(
          img,
          { scale: 1 },
          {
            duration: 0.5,
            keyframes: [
              { scale: 1.015, duration: 0.25 },
              { scale: 1, duration: 0.25 },
            ],
            ease: 'sine.inOut',
            repeat: 1,
          }
        );
      });
    }
    await sleep(this.reducedMotion ? 0 : 550);
  }

  _shake(intensity = 1) {
    if (!this.root || this.reducedMotion) return;
    if (gsap) {
      gsap.fromTo(
        this.root,
        { x: 0 },
        {
          duration: 0.38,
          keyframes: [
            { x: -5 * intensity, duration: 0.05 },
            { x: 6 * intensity, duration: 0.05 },
            { x: -3 * intensity, duration: 0.06 },
            { x: 2 * intensity, duration: 0.06 },
            { x: 0, duration: 0.1 },
          ],
          ease: 'power2.out',
        }
      );
    } else {
      this.root.classList.remove('cs-shake');
      void this.root.offsetWidth;
      this.root.classList.add('cs-shake');
      setTimeout(() => this.root?.classList.remove('cs-shake'), 380);
    }
  }

  _floatDmg(side, amount, kind = 'hit') {
    const host = this._el('[data-cs-floats]');
    if (!host) return;
    const node = document.createElement('div');
    node.className = `cs-float cs-float--${side.toLowerCase()} cs-float--${kind}`;
    if (kind === 'block') node.textContent = 'DEFENDEU';
    else if (kind === 'down') node.textContent = 'QUEDA';
    else if (kind === 'sub') node.textContent = amount > 0 ? `SUB −${Math.round(amount)}` : 'SUB';
    else node.textContent = amount > 0 ? `−${Math.round(amount)}` : 'HIT';
    host.appendChild(node);
    setTimeout(() => node.remove(), 900);
  }

  async _waitIdle() {
    let n = 0;
    while (this._playing && n < 50) {
      await sleep(40);
      n++;
    }
  }
}
