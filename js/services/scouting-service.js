import { clamp } from '../utils/helpers.js';
import { SCOUTING_LEVELS, SCOUTING_CONFIG, GYM_CONFIG } from '../config/game-config.js';

const DOC_ID = 'scouting';

// Névoa de guerra.
//
// Você conhece seus próprios atletas — treina com eles todo dia. De quem está
// do lado de fora (adversários, agentes livres), você só sabe o que investigou.
// Este serviço decide o que a interface pode mostrar sobre cada lutador.
export class ScoutingService {
  constructor(db, notifService) {
    this.db = db;
    this.notifService = notifService;
  }

  async _doc() {
    const raw = await this.db.get('gameState', DOC_ID);
    return raw || { id: DOC_ID, reports: {} };
  }

  async _save(doc) {
    doc.id = DOC_ID; // keyPath do store gameState
    await this.db.put('gameState', doc);
  }

  // Nível de conhecimento sobre um lutador (0..3).
  // Os seus são sempre nível 3: você os vê treinar.
  async knowledgeOf(fighter, gym) {
    if (!fighter) return 0;
    if (fighter.gymId === GYM_CONFIG.ID) return 3;

    const doc = await this._doc();
    const studied = doc.reports[fighter.id] || 0;
    const baseline = gym?.scoutLevel > 0 ? SCOUTING_CONFIG.BASELINE_WITH_SCOUT : 0;
    return Math.max(studied, baseline);
  }

  // Mapa id -> nível, para telas com muitos lutadores (Recrutamento).
  async knowledgeMap(fighters, gym) {
    const doc = await this._doc();
    const baseline = gym?.scoutLevel > 0 ? SCOUTING_CONFIG.BASELINE_WITH_SCOUT : 0;
    const map = {};
    for (const f of fighters) {
      map[f.id] = f.gymId === GYM_CONFIG.ID ? 3 : Math.max(doc.reports[f.id] || 0, baseline);
    }
    return map;
  }

  // Lutar contra alguém ensina sobre ele — de graça, tarde demais.
  async observeAfterFight(fighterId) {
    const doc = await this._doc();
    const current = doc.reports[fighterId] || 0;
    if (current >= SCOUTING_CONFIG.KNOWLEDGE_AFTER_FIGHTING) return current;
    doc.reports[fighterId] = SCOUTING_CONFIG.KNOWLEDGE_AFTER_FIGHTING;
    await this._save(doc);
    return doc.reports[fighterId];
  }

  studyCost(nextLevel) {
    return SCOUTING_CONFIG.STUDY_COST[nextLevel] ?? 0;
  }

  // Investir dinheiro para levantar a névoa sobre um adversário específico.
  async study(fighter, gym, absWeekNow) {
    const current = await this.knowledgeOf(fighter, gym);
    if (current >= 3) return { ok: false, reason: 'Você já sabe tudo o que há para saber sobre ele.' };

    const next = current + 1;
    const cost = this.studyCost(next);
    if (gym.cash < cost) {
      return { ok: false, reason: `Caixa insuficiente. Estudar até "${SCOUTING_LEVELS[next].label}" custa $${cost.toLocaleString()}.` };
    }

    gym.addTransaction(absWeekNow, `Scouting — ${fighter.name}`, -cost);

    const doc = await this._doc();
    doc.reports[fighter.id] = next;
    await this._save(doc);

    return { ok: true, level: next, cost, label: SCOUTING_LEVELS[next].label };
  }

  // ===== Leitura: o que a interface pode mostrar =====

  // Um atributo vira uma faixa. Nível 3 devolve o número exato.
  static blur(value, level) {
    const spread = SCOUTING_LEVELS[level]?.spread ?? 14;
    if (spread === 0) return { exact: true, value: Math.round(value), min: Math.round(value), max: Math.round(value) };
    return {
      exact: false,
      value: Math.round(value),
      min: Math.round(clamp(value - spread, 0, 99)),
      max: Math.round(clamp(value + spread, 0, 99)),
    };
  }

  // A leitura do adversário que o plano de jogo usa. Nível 0 devolve null:
  // sem estudar, você escolhe o plano no escuro.
  static readTendencies(fighter, level) {
    if (level < 1) return null;

    const a = fighter.attributes;
    const striking = fighter.strikingScore;
    const grappling = fighter.grapplingScore;
    const gap = striking - grappling;

    const r = {
      archetype: gap > 6 ? 'striker' : gap < -6 ? 'grappler' : 'mixed',
      cardio: a.cardio >= 60 ? 'highCardio' : a.cardio <= 45 ? 'lowCardio' : 'midCardio',
      iq: a.fightIQ >= 60 ? 'highIq' : a.fightIQ <= 45 ? 'lowIq' : 'midIq',
      chin: a.chin,
    };

    // Épico C: atributos expandidos revelados em níveis mais altos
    if (level >= 2) {
      r.power = (a.power ?? 50) >= 65 ? 'powerful' : (a.power ?? 50) <= 35 ? 'weak' : 'average';
      r.takedowns = (a.takedowns ?? 50) >= 65 ? 'wrestler' : (a.takedowns ?? 50) <= 35 ? 'poorTakedowns' : 'average';
      r.submissionOffense = (a.submissionOffense ?? 50) >= 65 ? 'submission' : 'average';
      r.speed = (a.speed ?? 50) >= 65 ? 'fast' : 'average';
      r.composure = (a.composure ?? 50) >= 65 ? 'composed' : (a.composure ?? 50) <= 35 ? 'nervous' : 'average';
    }

    return r;
  }

  static levelLabel(level) {
    return SCOUTING_LEVELS[level]?.label ?? 'Desconhecido';
  }

  static revealsDna(level) {
    return !!SCOUTING_LEVELS[level]?.revealsDna;
  }

  static revealsPotential(level) {
    return !!SCOUTING_LEVELS[level]?.revealsPotential;
  }
}
