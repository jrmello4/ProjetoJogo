import { Academy } from '../models/academy.js';
import { Promotion } from '../models/promotion.js';
import { DataGenerator } from '../services/data-generator.js';
import { generateId } from '../utils/helpers.js';
import { ACADEMIES, CORE_WEIGHT_CLASSES, PROMOTIONS, WORLD_CONFIG } from '../config/game-config.js';

const WORLD_MODE = 'career-1-fighter';
const WORLD_SCHEMA = 5;

// Cria e migra o mundo persistido. Não conhece telas nem regras semanais.
export class CareerBootstrapRuntime {
  init({ db, fighterCtrl, managerService, titleService }) {
    this.db = db;
    this.fighterCtrl = fighterCtrl;
    this.managerService = managerService;
    this.titleService = titleService;
  }

  async initializeWorld() {
    let meta = await this.db.get('gameState', 'meta');
    if (!meta) {
      await this.bootstrapWorld();
      return;
    }
    meta = await this.migrateWorld(meta);
    await this.applyPatches(meta);
  }

  async bootstrapWorld() {
    for (const store of ['fighters', 'organization', 'events', 'fights', 'rivalries', 'hallOfFame', 'notifications', 'offers']) {
      await this.db.clear(store);
    }
    for (const docId of ['careerLog', 'sponsors', 'retention', 'socialMedia', 'rivalry-prompt']) {
      await this.db.delete('gameState', docId);
    }
    try { localStorage.removeItem('characterCreationDone'); } catch { /* ok */ }

    await this.db.put('gameState', {
      id: 'state', week: 1, year: 1, totalEvents: 0,
      startedAt: new Date().toISOString(),
    });
    await this.db.put('gameState', { id: 'milestones' });
    await this.db.put('gameState', { id: 'career', playerFighterId: null });

    const stagger = { 3: [2, 3], 2: [3, 4], 1: [5] };
    const used = { 1: 0, 2: 0, 3: 0 };
    for (const cfg of PROMOTIONS) {
      const offsets = stagger[cfg.tier];
      const promo = new Promotion({
        ...cfg,
        nextEventAbsWeek: offsets[used[cfg.tier] % offsets.length],
      });
      used[cfg.tier]++;
      await this.db.put('organization', promo);

      const roster = DataGenerator.generatePromotionRoster(promo, CORE_WEIGHT_CLASSES);
      for (const fighter of roster) {
        fighter.id = generateId();
        await this.db.put('fighters', fighter);
      }
    }

    for (const cfg of ACADEMIES) {
      await this.db.put('organization', new Academy({ ...cfg }));
    }

    await this.managerService.bootstrap();

    for (let i = 0; i < WORLD_CONFIG.FREE_AGENT_POOL; i++) {
      const weightClass = CORE_WEIGHT_CLASSES[i % CORE_WEIGHT_CLASSES.length];
      const agent = DataGenerator.generateFighter(null, { weightClass, skillRange: [30, 55] });
      agent.id = generateId();
      if (Math.random() < WORLD_CONFIG.ACADEMY_AFFILIATION_CHANCE) {
        agent.academyId = ACADEMIES[Math.floor(Math.random() * ACADEMIES.length)].id;
      }
      await this.db.put('fighters', agent);
    }

    await this.titleService.seedBelts();
    await this.db.put('gameState', {
      id: 'meta', mode: WORLD_MODE, schemaVersion: WORLD_SCHEMA,
      patches: [], createdAt: new Date().toISOString(),
    });
  }

  async migrateWorld(meta) {
    const sourceVersion = Number.isInteger(meta.schemaVersion) ? meta.schemaVersion : 0;
    if (sourceVersion > WORLD_SCHEMA) {
      throw new Error(`Este save usa schema ${sourceVersion}, mais novo que o suportado (${WORLD_SCHEMA}). Atualize o jogo antes de abrir esta carreira.`);
    }

    let migrated = {
      ...meta,
      id: 'meta',
      mode: meta.mode || WORLD_MODE,
      schemaVersion: sourceVersion,
      patches: Array.isArray(meta.patches) ? meta.patches : [],
      migrationHistory: Array.isArray(meta.migrationHistory) ? meta.migrationHistory : [],
    };

    while (migrated.schemaVersion < WORLD_SCHEMA) {
      const from = migrated.schemaVersion;
      await this._applySchemaMigration(from);
      migrated = {
        ...migrated,
        schemaVersion: from + 1,
        migrationHistory: [...migrated.migrationHistory, {
          from, to: from + 1, appliedAt: new Date().toISOString(),
        }],
      };
      await this.db.put('gameState', migrated);
    }

    await this.db.put('gameState', migrated);
    return migrated;
  }

  async _applySchemaMigration(fromVersion) {
    if (fromVersion <= 4) {
      const state = await this.db.get('gameState', 'state');
      if (!state) {
        await this.db.put('gameState', {
          id: 'state', week: 1, year: 1, totalEvents: 0,
          startedAt: new Date().toISOString(),
        });
      }
      const milestones = await this.db.get('gameState', 'milestones');
      if (!milestones) await this.db.put('gameState', { id: 'milestones' });
      const career = await this.db.get('gameState', 'career');
      if (!career) await this.db.put('gameState', { id: 'career', playerFighterId: null });
    }
  }

  async applyPatches(meta) {
    const applied = new Set(meta.patches || []);
    if (applied.size !== (meta.patches || []).length) {
      await this.db.put('gameState', { ...meta, id: 'meta', patches: [...applied] });
    }

    const fighter = await this.fighterCtrl.getPlayerFighter();
    if (fighter?.campProcessedThisWeek) {
      fighter.campProcessedThisWeek = false;
      await this.fighterCtrl.updateFighter(fighter);
    }
  }
}
