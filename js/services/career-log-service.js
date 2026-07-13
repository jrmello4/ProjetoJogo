const DOC_ID = 'careerLog';
const MAX_ENTRIES = 300;

// Motor de histórias emergentes — ver spec §F. Log append-only de eventos
// notáveis. Todo sistema que produz algo memorável PUBLICA aqui; imprensa
// (§D.2), rivalidades (§D.3) e o documentário de carreira (§B.3) CONSOMEM
// daqui em vez de cada um inventar sua própria noção de "isso importou".
//
// entry: { type, atAbsWeek, magnitude (0-100), data }
// types: 'title_won' | 'upset' | 'streak' | 'rematch' | 'dna_discovered' |
//        'permanent_scar' | 'academy_switch' | 'manager_switch' |
//        'rivalry_born'
export class CareerLogService {
  constructor(db) {
    this.db = db;
  }

  async _doc() {
    const raw = await this.db.get('gameState', DOC_ID);
    return raw || { id: DOC_ID, entries: [] };
  }

  async publish(type, atAbsWeek, magnitude, data = {}) {
    const doc = await this._doc();
    doc.entries.push({ type, atAbsWeek, magnitude: Math.round(magnitude), data });
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

  async topByMagnitude(limit = 10) {
    return [...(await this.all())].sort((a, b) => b.magnitude - a.magnitude).slice(0, limit);
  }

  async recentSince(absWeekNow, windowWeeks) {
    return (await this.all()).filter(e => e.atAbsWeek >= absWeekNow - windowWeeks);
  }
}
