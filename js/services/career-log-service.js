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
}
