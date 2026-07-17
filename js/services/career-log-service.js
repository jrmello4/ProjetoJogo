import { NARRATIVE_EVENTS } from '../config/game-config.js';

const DOC_ID = 'careerLog';
const MAX_ENTRIES = 300;

// Motor de histórias emergentes — ver spec §F. Log append-only de eventos
// notáveis. Todo sistema que produz algo memorável PUBLICA aqui; imprensa
// (§D.2), rivalidades (§D.3) e o documentário de carreira (§B.3) CONSOMEM
// daqui em vez de cada um inventar sua própria noção de "isso importou".
//
// entry: { fighterId, type, atAbsWeek, magnitude (0-100), data }
// types: 'title_won' | 'upset' | 'streak' | 'rematch' | 'dna_discovered' |
//        'permanent_scar' | 'academy_switch' | 'manager_switch' |
//        'rivalry_born' | 'finish' | 'provocation' | 'viral' |
//        'weapon_revealed' | 'figured_out' | 'reinvention' | 'bait_success'
//
// fighterId identifica de QUEM é o momento (o lutador do jogador vivendo
// aquele evento) — obrigatório desde a correção do bug de "Momentos
// marcantes" vazando entre carreiras: o doc 'careerLog' é único e global
// (sobrevive a _bootstrapNewWorld/troca de lutador), então sem esse campo
// topByMagnitude() não tinha como saber a quem cada entrada pertencia.
export class CareerLogService {
  constructor(db) {
    this.db = db;
  }

  async _doc() {
    const raw = await this.db.get('gameState', DOC_ID);
    return raw || { id: DOC_ID, entries: [] };
  }

  async publish(fighterId, type, atAbsWeek, magnitude, data = {}) {
    const doc = await this._doc();
    doc.entries.push({ fighterId, type, atAbsWeek, magnitude: Math.round(magnitude), data });
    if (doc.entries.length > MAX_ENTRIES) {
      // Mantém as de maior magnitude quando precisa cortar, não só as recentes —
      // um título conquistado há 3 anos importa mais pro documentário do que
      // uma vitória qualquer da semana passada.
      doc.entries.sort((a, b) => b.magnitude - a.magnitude);
      doc.entries.length = MAX_ENTRIES;
      doc.entries.sort((a, b) => a.atAbsWeek - b.atAbsWeek);
    }
    await this.db.put('gameState', doc);
    return doc.entries[doc.entries.length - 1];
  }

  async all() {
    return (await this._doc()).entries;
  }

  async byType(type) {
    return (await this._doc()).entries.filter(e => e.type === type);
  }

  // Escopado por fighterId: o doc é global, então sem esse filtro o
  // documentário de aposentadoria (§B.3) podia exibir momentos marcantes de
  // OUTRA carreira (ver comentário no topo do arquivo).
  async topByMagnitude(fighterId, limit = 10) {
    const mine = (await this.all()).filter(e => e.fighterId === fighterId);
    return mine.sort((a, b) => b.magnitude - a.magnitude).slice(0, limit);
  }

  async recentSince(absWeekNow, windowWeeks) {
    return (await this.all()).filter(e => e.atAbsWeek >= absWeekNow - windowWeeks);
  }

  // Retorna um evento narrativo aleatório compatível com o contexto
  // atual do lutador (derrota recente, streak, lesão, rival, título,
  // bastidores P5.2).
  // Retorna null se nenhum pool de eventos se aplicar.
  selectNarrativeEvent(fighter) {
    const events = [];

    // Após derrota recente (últimas 5 lutas)
    const recentFights = fighter.fights?.slice(0, 5) || [];
    const lastFightLost = recentFights.length > 0 && recentFights[0].won === false;
    if (lastFightLost && recentFights[0].won === false) {
      events.push(...(NARRATIVE_EVENTS.after_loss || []));
    }

    // Sequência de vitórias de 3+
    const streak = fighter.winStreak || 0;
    if (streak >= 3) {
      events.push(...(NARRATIVE_EVENTS.after_win_streak || []));
    }

    // Retornou de lesão recentemente
    if (fighter.injury !== null && typeof fighter.injury === 'object' && fighter.status !== 'injured') {
      events.push(...(NARRATIVE_EVENTS.injury_return || []));
    }

    // É campeão ou já conquistou títulos
    if (fighter.ranking === 1 || (fighter.titlesWon || 0) > 0) {
      events.push(...(NARRATIVE_EVENTS.title_reign || []));
    }

    // P5.2: Personal crisis — baixo cash ou série de derrotas
    const lowCash = (fighter.cash || 0) < 5000;
    const consecutiveLosses = (() => {
      let count = 0;
      for (const f of fighter.fights || []) {
        if (f.won === false) count++;
        else break;
      }
      return count;
    })();
    if (lowCash || consecutiveLosses >= 3) {
      events.push(...(NARRATIVE_EVENTS.personal_crisis || []));
    }

    // P5.2: Media pressure — alta popularidade + derrota recente
    if (lastFightLost && (fighter.popularity || 0) >= 60) {
      events.push(...(NARRATIVE_EVENTS.media_pressure || []));
    }

    // P5.2: Post-injury existential
    const wasSeriouslyInjured = fighter.injuryCount >= 2;
    if (wasSeriouslyInjured && fighter.status !== 'injured') {
      events.push(...(NARRATIVE_EVENTS.post_injury || []));
    }

    // P5.2: Post-title loss — perdeu luta recente tendo histórico de títulos
    const lostTitle = lastFightLost && (fighter.titlesWon || 0) > 0;
    if (lostTitle) {
      events.push(...(NARRATIVE_EVENTS.post_title_loss || []));
    }

    if (events.length === 0) return null;

    // Escolhe um evento aleatório do pool reunido
    const pool = events[Math.floor(Math.random() * events.length)];
    return pool;
  }
}
