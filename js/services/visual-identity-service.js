import {
  VISUAL_ARCHETYPES, VISUAL_ARCHETYPE_IDS, CAREER_STAGES,
  VISUAL_CONTEXTS, VISUAL_EVOLUTION_TRIGGERS, IMAGINE_PIPELINE,
  VISUAL_RARITY, VISUAL_UNLOCKS, VISUAL_UNLOCK_IDS,
} from '../config/visual-identity-config.js';
import {
  APPEARANCE_CATEGORIES, DEFAULT_APPEARANCE, APPEARANCE_BIAS,
  OUTFIT_STYLES, ACCESSORY_STYLES, HAIR_STYLES, BEARD_STYLES,
} from '../config/appearance-config.js';
import { PortraitService } from './portrait-service.js';

// ============================================================
// VisualIdentityService — identidade + evolução + contexto
// ============================================================
// Camada narrativa sobre o catálogo de índices. Funções puras
// (exceto RNG injetável). Não toca DB; world/controller chamam.

export class VisualIdentityService {
  // ---- Fase de carreira (puro, a partir do estado do lutador) ----

  static resolveCareerStage(fighter) {
    if (!fighter) return CAREER_STAGES.rookie;
    const status = fighter.status;
    const age = fighter.age ?? 25;
    const pop = fighter.popularity ?? 20;
    const wins = fighter.record?.wins ?? 0;
    const losses = fighter.record?.losses ?? 0;
    const fights = fighter.totalFights ?? (wins + losses + (fighter.record?.draws || 0));
    const isChamp = !!(fighter.isChampion || fighter.titleHolder || fighter.championOf);
    // belts / flags opcionais no save
    const wasChamp = !!(fighter.wasChampion || fighter.careerTitles > 0 || fighter.titlesWon > 0);
    const cash = fighter.cash ?? 0;
    const lifestyle = fighter.lifestyleTier || 'modest';
    const inHof = !!(fighter.hallOfFame || fighter.wasPlayerFighter && status === 'retired' && wins >= 15);

    if (status === 'retired') {
      if (inHof || wins >= 25 && pop >= 70) return CAREER_STAGES.legend;
      if (wasChamp || isChamp) return CAREER_STAGES.ex_champion;
      if (age >= 36 && fights >= 20) return CAREER_STAGES.coach;
      if (cash > 200000 || lifestyle === 'luxurious') return CAREER_STAGES.mogul;
      return CAREER_STAGES.retired;
    }

    if (isChamp) return CAREER_STAGES.champion;
    if (wasChamp && !isChamp) return CAREER_STAGES.ex_champion;
    if (pop >= 75 && wins >= 10) return CAREER_STAGES.star;
    if (age >= 35 && fights >= 15) return CAREER_STAGES.veteran;
    if (pop < 25 && losses >= wins + 3 && fights >= 8) return CAREER_STAGES.fallen;
    // Iniciante antes de prospecto: poucos combates ainda
    if (fights < 4 && age < 28) return CAREER_STAGES.rookie;
    if (age <= 24 && fights <= 10 && pop < 50) return CAREER_STAGES.prospect;
    if (fights >= 12 && pop < 40) return CAREER_STAGES.journeyman;
    if (age <= 26 && wins >= 5 && pop >= 40) return CAREER_STAGES.prospect;
    return CAREER_STAGES.journeyman;
  }

  // ---- Arquétipo determinístico (persistível) ----

  static resolveArchetypeId(fighter) {
    if (fighter?.visualArchetype && VISUAL_ARCHETYPES[fighter.visualArchetype]) {
      return fighter.visualArchetype;
    }
    const key = String(fighter?.id ?? fighter?.name ?? 'x');
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    // Pool enviesado SÓ por traço estável (estilo de luta). Antes também
    // prependia por popularidade/idade/cartel vivos — cruzar pop 70 trocava
    // o tamanho do pool e portanto o ARQUÉTIPO inteiro (facelift total do
    // personagem de uma semana pra outra). Os looks de celebridade/veterano
    // já vêm da camada de FASE (resolveCareerStage), que é o lugar certo
    // pra estado que muda: fase mexe em roupa/acessório/paleta, não na
    // identidade-núcleo do personagem.
    const style = String(fighter?.fightingStyle || fighter?.style || '').toLowerCase();
    let pool = VISUAL_ARCHETYPE_IDS;

    if (style.includes('bjj') || style.includes('wrestl') || style.includes('judô') || style.includes('judo')) {
      pool = ['traditionalist', 'silent_killer', 'pure_athlete', 'respected_vet', 'heritage', ...VISUAL_ARCHETYPE_IDS];
    } else if (style.includes('box') || style.includes('striker') || style.includes('muay') || style.includes('kick')) {
      pool = ['intimidator', 'bad_boy', 'pure_athlete', 'showman', ...VISUAL_ARCHETYPE_IDS];
    }

    return pool[h % pool.length];
  }

  static getArchetype(fighter) {
    return VISUAL_ARCHETYPES[VisualIdentityService.resolveArchetypeId(fighter)] || VISUAL_ARCHETYPES.everyman;
  }

  // ---- Aparência base resolvida ----

  /**
   * Aparência efetiva do lutador (persistida ou derivada) + camadas de
   * arquétipo/fase. Não aplica contexto de cena (use resolveForRender).
   */
  static resolveBaseAppearance(fighter) {
    let base;
    if (fighter?.appearance) {
      base = PortraitService._normalize(fighter.appearance);
    } else {
      base = PortraitService._derivedFromFighter(fighter);
    }
    return VisualIdentityService._blendIdentity(base, fighter);
  }

  /**
   * Mescla arquétipo + fase na aparência. Jogador com appearance persistida
   * só recebe ajustes leves de fase se `visualAutoEvolve !== false`.
   */
  static _blendIdentity(appearance, fighter) {
    const a = { ...appearance };
    const arch = VisualIdentityService.getArchetype(fighter);
    const stage = VisualIdentityService.resolveCareerStage(fighter);
    // roll(tag) independente por decisão — mesmo princípio do
    // PortraitService._roll01: num stream compartilhado, a fase mudar
    // (rookie→prospect) deslocava TODOS os sorteios seguintes e o rosto
    // inteiro trocava; com tags, mudar de fase só mexe no que a fase governa
    // (roupa/acessório/paleta/marcas), nunca na anatomia.
    const id = String(fighter?.id ?? 'x');
    const roll = (tag) => PortraitService._roll01(`${id}:blend:${tag}`);

    const playerLocked = !!(fighter?.appearance && fighter?.visualLock);
    if (playerLocked) return a;

    // Arquétipo empurra cabelo/barba/expressão (IA sempre; jogador se auto-evolve)
    const soft = !fighter?.appearance;
    if (soft || fighter?.visualAutoEvolve) {
      VisualIdentityService._pickInto(a, 'hairStyle', arch.hair, roll, soft ? 0.85 : 0.25);
      VisualIdentityService._pickInto(a, 'beardStyle', arch.beard, roll, soft ? 0.7 : 0.15);
      VisualIdentityService._pickInto(a, 'mouthStyle', arch.mouth, roll, soft ? 0.7 : 0.2);
      VisualIdentityService._pickInto(a, 'eyeShape', arch.eyes, roll, soft ? 0.65 : 0.15);
      VisualIdentityService._pickInto(a, 'outfitStyle', arch.outfit, roll, soft ? 0.75 : 0.2);
      VisualIdentityService._pickInto(a, 'accessory', arch.accessory, roll, soft ? 0.6 : 0.15);
    }

    // Fase de carreira — roupa/acessório/cicatriz/envelhecimento.
    // As tags levam o id da FASE: trocar de fase re-sorteia estas decisões
    // (o glow-up ao virar estrela é intencional), mas dentro da mesma fase
    // o resultado é idêntico render após render.
    if (soft || fighter?.visualAutoEvolve) {
      const s = stage.id;
      if (roll(`${s}:fitGate`) < 0.55) {
        VisualIdentityService._pickInto(a, 'outfitStyle', stage.outfitPrefs, (t) => roll(`${s}:fit:${t}`), 0.9);
      }
      if (roll(`${s}:accGate`) < 0.45) {
        VisualIdentityService._pickInto(a, 'accessory', stage.accessoryPrefs, (t) => roll(`${s}:acc:${t}`), 0.85);
      }
      if (stage.palette?.trunks?.length && roll(`${s}:trunksGate`) < 0.5) {
        a.trunksColor = stage.palette.trunks[Math.floor(roll(`${s}:trunksPick`) * stage.palette.trunks.length)];
      }
      if (stage.palette?.accent?.length && roll(`${s}:accentGate`) < 0.45) {
        a.accentColor = stage.palette.accent[Math.floor(roll(`${s}:accentPick`) * stage.palette.accent.length)];
      }
      if (roll(`${s}:scarGate`) < (stage.scarBias || 0)) {
        a.scarStyle = Math.max(a.scarStyle || 0, 1 + Math.floor(roll(`${s}:scarPick`) * 6));
      }
      if (roll(`${s}:ageGate`) < (stage.agingBias || 0)) {
        if (roll(`${s}:ageGrey`) < 0.5) a.hairColor = APPEARANCE_BIAS.HAIR_GREY;
        if (roll(`${s}:ageRecede`) < 0.25) a.hairStyle = 18;
        if (roll(`${s}:ageMarks`) < 0.3) a.faceMarks = 2;
      }
      if (roll(`${s}:flashGate`) < (stage.flashBias || 0) * 0.5) {
        a.hairColor = 12 + Math.floor(roll(`${s}:flashPick`) * 5);
      }
    }

    return PortraitService._normalize(a);
  }

  // `roll(tag)` — cada chamada interna usa tag própria; funciona tanto com
  // o roll determinístico quanto com um rng que ignora o argumento.
  static _pickInto(a, key, list, roll, chance) {
    if (!list?.length || roll(`${key}:gate`) > chance) return;
    const cat = APPEARANCE_CATEGORIES.find(c => c.key === key);
    if (!cat) return;
    const idx = list[Math.floor(roll(`${key}:pick`) * list.length)];
    if (idx >= 0 && idx < cat.options.length) a[key] = idx;
  }

  // ---- Desbloqueios por conquista ----

  /** Lista de unlock ids elegíveis agora (ainda não necessariamente gravados). */
  static eligibleUnlockIds(fighter) {
    return VISUAL_UNLOCK_IDS.filter(id => {
      try { return !!VISUAL_UNLOCKS[id].check(fighter); }
      catch { return false; }
    });
  }

  /**
   * Grava unlocks novos em `fighter.visualUnlocks` (mutação).
   * @returns {{ newly: string[], all: string[] }}
   */
  static syncUnlocks(fighter) {
    if (!fighter) return { newly: [], all: [] };
    const have = new Set(fighter.visualUnlocks || []);
    const newly = [];
    for (const id of VisualIdentityService.eligibleUnlockIds(fighter)) {
      if (!have.has(id)) {
        have.add(id);
        newly.push(id);
      }
    }
    fighter.visualUnlocks = [...have];
    return { newly, all: fighter.visualUnlocks };
  }

  /** Aplica patch de um unlock na appearance (cópia). */
  static applyUnlockPatch(appearance, unlockId) {
    const u = VISUAL_UNLOCKS[unlockId];
    if (!u?.patch) return PortraitService._normalize(appearance);
    return PortraitService._normalize({ ...appearance, ...u.patch });
  }

  /**
   * Após conquista (título, pop, etc.): sync unlocks + opcionalmente
   * equipa o visual se autoEvolve / IA sem lock.
   * @returns {{ newly: string[], appearance: object|null, equipped: string[] }}
   */
  static applyCareerVisualRewards(fighter, { preferUnlockIds = [], forceEquip = false } = {}) {
    if (!fighter) return { newly: [], appearance: null, equipped: [] };
    const { newly } = VisualIdentityService.syncUnlocks(fighter);
    // Preferência do evento (título etc.) ganha de unlocks genéricos —
    // senão media_shades sobrescreve a corrente de título no mesmo tick.
    const owned = fighter.visualUnlocks || [];
    const preferred = preferUnlockIds.filter(id => owned.includes(id));
    const toEquip = preferred.length > 0 ? preferred : newly;
    const shouldEquip = forceEquip
      || fighter.visualAutoEvolve
      || (!fighter.appearance && !fighter.visualLock);

    if (!shouldEquip || toEquip.length === 0) {
      return { newly, appearance: null, equipped: [] };
    }

    let appearance = fighter.appearance
      ? PortraitService._normalize(fighter.appearance)
      : VisualIdentityService.resolveBaseAppearance(fighter);
    const equipped = [];
    for (const id of toEquip) {
      const before = JSON.stringify(appearance);
      appearance = VisualIdentityService.applyUnlockPatch(appearance, id);
      if (JSON.stringify(appearance) !== before) equipped.push(id);
    }
    fighter.appearance = appearance;
    return { newly, appearance, equipped };
  }

  /**
   * Hook de luta de título — marca wasChampion e recompensa visual.
   */
  static onTitleResolved(fighter, { retained = false } = {}) {
    if (!fighter) return { newly: [], appearance: null, equipped: [] };
    fighter.wasChampion = true;
    // titlesWon já incrementado pelo TitleService quando !retained
    const prefer = retained
      ? ['title_chain', 'golden_accent']
      : ['title_chain', 'champion_suit', 'golden_accent'];
    const result = VisualIdentityService.applyCareerVisualRewards(fighter, {
      preferUnlockIds: prefer,
      forceEquip: !retained && !fighter.appearance, // IA materializa look de campeão
    });
    if (fighter.visualAutoEvolve && !retained) {
      const evo = VisualIdentityService.evolveAppearance(
        { ...fighter, appearance: fighter.appearance || result.appearance },
        'title_won',
        Math.random
      );
      if (evo.changed) {
        fighter.appearance = evo.appearance;
        result.appearance = evo.appearance;
      }
    }
    fighter.visualStage = VisualIdentityService.resolveCareerStage({
      ...fighter,
      isChampion: true,
    }).id;
    return result;
  }

  // ---- Contexto de cena (guarda-roupa sem mutar base salva) ----

  /**
   * @param {object} fighter
   * @param {'default'|'octagon'|'press'|'street'|'ceremony'|'coaching'} context
   */
  static resolveForRender(fighter, context = 'default') {
    const base = VisualIdentityService.resolveBaseAppearance(fighter);
    const stage = VisualIdentityService.resolveCareerStage(fighter);
    const a = { ...base };
    const ctx = VISUAL_CONTEXTS[context] ? context : 'default';
    const unlocks = new Set(fighter?.visualUnlocks || VisualIdentityService.eligibleUnlockIds(fighter));
    const heat = fighter?.narrativeHeat || 0;

    // Rivalidade / heat — tensão legível no rosto (não grava no save)
    if (heat >= 10) {
      a.browStyle = 1;
      if (heat >= 14) a.mouthStyle = 6;
      if (heat >= 18 && (a.tattooStyle || 0) < 3) a.tattooStyle = 3;
    }

    // Desbloqueios “equipados” no look de mídia se tiver autoEvolve
    if (fighter?.visualAutoEvolve || !fighter?.appearance) {
      if (unlocks.has('title_chain') && (stage.id === 'champion' || stage.id === 'ex_champion' || stage.id === 'legend')) {
        a.accessory = 16;
        a.accentColor = 0;
      }
    }

    if (ctx === 'octagon') {
      // pele no peito / rashguard — identidade de luta
      if (a.outfitStyle >= 10 || a.outfitStyle === 8 || a.outfitStyle === 12 || a.outfitStyle === 13) {
        a.outfitStyle = stage.id === 'champion' || stage.id === 'star' ? 0 : 1;
      }
      if ([5, 9, 12, 14, 16].includes(a.accessory)) {
        a.accessory = 4; // fita de mão
      }
    } else if (ctx === 'press') {
      if (unlocks.has('champion_suit') || stage.id === 'champion' || stage.id === 'mogul') {
        a.outfitStyle = 12;
      } else if (unlocks.has('luxury_blazer') || stage.id === 'star') {
        a.outfitStyle = 13;
      } else if (stage.id === 'rookie' || stage.id === 'prospect') {
        a.outfitStyle = 3;
      } else {
        a.outfitStyle = 8;
      }
      if (unlocks.has('media_shades') || unlocks.has('title_chain')) {
        a.accessory = unlocks.has('title_chain') && stage.id === 'champion' ? 16 : 9;
      } else if (a.accessory === 0) {
        a.accessory = stage.id === 'star' ? 9 : 0;
      }
    } else if (ctx === 'street') {
      if (unlocks.has('veteran_leather') && (stage.id === 'veteran' || stage.id === 'fallen')) {
        a.outfitStyle = 11;
      } else if (unlocks.has('street_simple') && (stage.id === 'rookie' || stage.id === 'journeyman' || stage.id === 'fallen')) {
        a.outfitStyle = 16;
      } else {
        a.outfitStyle = [10, 4, 3, 16][Math.abs(String(fighter?.id || 'x').length) % 4];
      }
      if (a.accessory === 16) a.accessory = unlocks.has('media_shades') ? 9 : 2;
    } else if (ctx === 'ceremony') {
      a.outfitStyle = unlocks.has('champion_suit') ? 12 : 8;
      a.accessory = unlocks.has('title_chain') ? 16 : (unlocks.has('media_shades') ? 9 : 3);
      a.accentColor = 0;
      if (unlocks.has('golden_accent')) a.trunksColor = 4;
    } else if (ctx === 'coaching') {
      a.outfitStyle = unlocks.has('coach_whistle') ? 15 : 14;
      a.accessory = unlocks.has('coach_whistle') ? 17 : 0;
    }

    return PortraitService._normalize(a);
  }

  /** Ficha de desbloqueios para UI. */
  static listUnlockStatus(fighter) {
    const have = new Set(fighter?.visualUnlocks || []);
    return VISUAL_UNLOCK_IDS.map(id => {
      const u = VISUAL_UNLOCKS[id];
      const eligible = (() => { try { return !!u.check(fighter); } catch { return false; } })();
      return {
        id,
        label: u.label,
        desc: u.desc,
        rarity: u.rarity,
        unlocked: have.has(id) || eligible,
        owned: have.has(id),
        eligible,
      };
    });
  }

  /** Prompts Imagine para várias eras (export offline). */
  static buildEraImaginePrompts(fighter) {
    const contexts = ['street', 'octagon', 'press', 'ceremony'];
    return contexts.map(ctx => ({
      context: ctx,
      label: VISUAL_CONTEXTS[ctx]?.label || ctx,
      prompt: VisualIdentityService.buildImaginePrompt(fighter, ctx),
    }));
  }

  // ---- Evolução por evento ----

  /**
   * Aplica um trigger de evolução numa cópia da aparência.
   * @returns {{ appearance, changed: boolean, changes: string[] }}
   */
  static evolveAppearance(fighter, triggerId, rng = Math.random) {
    const trigger = VISUAL_EVOLUTION_TRIGGERS[triggerId];
    const appearance = fighter?.appearance
      ? PortraitService._normalize(fighter.appearance)
      : VisualIdentityService.resolveBaseAppearance(fighter);
    if (!trigger) return { appearance, changed: false, changes: [] };

    const stage = VisualIdentityService.resolveCareerStage(fighter);
    const arch = VisualIdentityService.getArchetype(fighter);
    const changes = [];
    const intensity = trigger.intensity ?? 0.4;

    for (const key of trigger.keys) {
      if (rng() > intensity) continue;
      const before = appearance[key];
      if (key === 'scarStyle') {
        appearance.scarStyle = Math.min(7, Math.max(appearance.scarStyle || 0, 1 + Math.floor(rng() * 5)));
      } else if (key === 'hairColor' && (triggerId === 'year_aged' || triggerId === 'retirement')) {
        appearance.hairColor = rng() < 0.5 ? APPEARANCE_BIAS.HAIR_GREY : APPEARANCE_BIAS.HAIR_WHITE;
      } else if (key === 'outfitStyle') {
        const pool = stage.outfitPrefs?.length ? stage.outfitPrefs : arch.outfit;
        appearance.outfitStyle = pool[Math.floor(rng() * pool.length)];
      } else if (key === 'accessory') {
        const pool = stage.accessoryPrefs?.length ? stage.accessoryPrefs : arch.accessory;
        appearance.accessory = pool[Math.floor(rng() * pool.length)];
      } else if (key === 'mouthStyle') {
        const pool = arch.mouth || [0, 1];
        appearance.mouthStyle = pool[Math.floor(rng() * pool.length)];
      } else if (key === 'eyeShape') {
        const pool = arch.eyes || [0, 1];
        appearance.eyeShape = pool[Math.floor(rng() * pool.length)];
      } else if (key === 'hairStyle') {
        const pool = arch.hair || [2, 6];
        appearance.hairStyle = pool[Math.floor(rng() * pool.length)];
      } else if (key === 'beardStyle') {
        const pool = arch.beard || [0, 1];
        appearance.beardStyle = pool[Math.floor(rng() * pool.length)];
      } else if (key === 'faceMarks') {
        appearance.faceMarks = 1 + Math.floor(rng() * 4);
      } else if (key === 'noseStyle') {
        appearance.noseStyle = 2; // amassado pós-guerra
      } else if (key === 'tattooStyle') {
        appearance.tattooStyle = Math.min(7, Math.max(1, (appearance.tattooStyle || 0) + 1));
      } else if (key === 'accentColor') {
        appearance.accentColor = stage.palette?.accent?.[0] ?? 0;
      } else if (key === 'trunksColor') {
        appearance.trunksColor = stage.palette?.trunks?.[0] ?? appearance.trunksColor;
      } else if (key === 'browStyle') {
        appearance.browStyle = 1; // angulada — tensão
      }
      if (appearance[key] !== before) changes.push(key);
    }

    const normalized = PortraitService._normalize(appearance);
    return { appearance: normalized, changed: changes.length > 0, changes };
  }

  /**
   * Snapshot de identidade pra UI (perfil, editor, debug).
   */
  static describeIdentity(fighter) {
    const stage = VisualIdentityService.resolveCareerStage(fighter);
    const arch = VisualIdentityService.getArchetype(fighter);
    const appearance = VisualIdentityService.resolveBaseAppearance(fighter);
    const outfit = OUTFIT_STYLES[appearance.outfitStyle]?.label || '—';
    const acc = ACCESSORY_STYLES[appearance.accessory]?.label || '—';
    const rarity = VISUAL_RARITY[arch.rarity] || VISUAL_RARITY.common;
    return {
      stageId: stage.id,
      stageLabel: stage.label,
      archetypeId: arch.id,
      archetypeLabel: arch.label,
      rarity: rarity.id,
      rarityLabel: rarity.label,
      outfit,
      accessory: acc,
      families: arch.families || [],
      hair: HAIR_STYLES[appearance.hairStyle]?.label,
      beard: BEARD_STYLES[appearance.beardStyle]?.label,
    };
  }

  /**
   * Prompt Grok Imagine / concept art (offline). Nunca chamado no hot path.
   */
  static buildImaginePrompt(fighter, context = 'default') {
    const id = VisualIdentityService.describeIdentity(fighter);
    const a = VisualIdentityService.resolveForRender(fighter, context);
    const mood = id.stageLabel;
    return IMAGINE_PIPELINE.promptTemplate
      .replace('{stage}', id.stageLabel)
      .replace('{archetype}', id.archetypeLabel)
      .replace('{outfit}', OUTFIT_STYLES[a.outfitStyle]?.label || 'outfit')
      .replace('{hair}', HAIR_STYLES[a.hairStyle]?.label || 'hair')
      .replace('{scars}', a.scarStyle > 0 ? 'visible fight scars' : 'clean skin')
      .replace('{mood}', `${mood}, ${context} setting`);
  }

  static listArchetypes() {
    return VISUAL_ARCHETYPE_IDS.map(id => ({
      id,
      label: VISUAL_ARCHETYPES[id].label,
      rarity: VISUAL_ARCHETYPES[id].rarity,
      families: VISUAL_ARCHETYPES[id].families,
    }));
  }

  static listStages() {
    return Object.values(CAREER_STAGES).map(s => ({ id: s.id, label: s.label }));
  }

  /** Garante campos de identidade no objeto fighter (mutação leve, sem DB). */
  static ensureMeta(fighter) {
    if (!fighter) return fighter;
    if (!fighter.visualArchetype) {
      fighter.visualArchetype = VisualIdentityService.resolveArchetypeId(fighter);
    }
    fighter.visualStage = VisualIdentityService.resolveCareerStage(fighter).id;
    return fighter;
  }

  /**
   * Tick de evolução anual — retorna appearance se mudou (caller persiste).
   * Jogador: só se visualAutoEvolve; IA: se tem appearance persistida OU
   * retorna null (IA sem persist continua derivando ao vivo).
   */
  static yearlyTick(fighter, rng = Math.random) {
    if (!fighter) return null;
    VisualIdentityService.ensureMeta(fighter);
    const prevStage = fighter.visualStage;
    const stage = VisualIdentityService.resolveCareerStage(fighter);
    fighter.visualStage = stage.id;
    const stageChanged = prevStage && prevStage !== stage.id;

    // Materializa evolução só se:
    // - visualAutoEvolve (jogador opt-in / IA marcada), ou
    // - IA sem appearance (só reporta stage; look deriva ao vivo), ou
    // - appearance persistida em IA (raro)
    const mayMutate = !!(fighter.visualAutoEvolve || (fighter.appearance && !fighter.visualLock));
    // Jogador com visualLock OU sem autoEvolve: nunca altera índices salvos
    if (fighter.appearance && (fighter.visualLock || !fighter.visualAutoEvolve)) {
      return {
        appearance: null,
        changed: !!stageChanged,
        changes: stageChanged ? ['stage'] : [],
        stage: stage.id,
      };
    }

    if (!fighter.appearance && !fighter.visualAutoEvolve) {
      return {
        appearance: null,
        changed: !!stageChanged,
        changes: stageChanged ? ['stage'] : [],
        stage: stage.id,
      };
    }

    if (!mayMutate) {
      return { appearance: null, changed: false, changes: [], stage: stage.id };
    }

    const triggers = ['year_aged'];
    if (stageChanged) {
      if (stage.id === 'champion') triggers.push('title_won');
      if (prevStage === 'champion' && stage.id !== 'champion') triggers.push('title_lost');
      if (stage.id === 'retired' || stage.id === 'legend') triggers.push('retirement');
      if (stage.id === 'fallen') triggers.push('long_losing_streak');
      if (stage.id === 'star') triggers.push('popularity_surge');
    }
    if (fighter.lifestyleTier === 'luxurious') triggers.push('lifestyle_luxurious');
    if (fighter.lifestyleTier === 'modest' && fighter.everReachedLifestyle?.luxurious) {
      triggers.push('lifestyle_modest');
    }

    let appearance = fighter.appearance
      ? PortraitService._normalize(fighter.appearance)
      : VisualIdentityService.resolveBaseAppearance(fighter);
    const allChanges = [];
    for (const t of triggers) {
      const result = VisualIdentityService.evolveAppearance({ ...fighter, appearance }, t, rng);
      if (result.changed) {
        appearance = result.appearance;
        allChanges.push(...result.changes.map(c => `${t}:${c}`));
      }
    }
    return {
      appearance,
      changed: allChanges.length > 0,
      changes: allChanges,
      stage: stage.id,
    };
  }
}

// Liga o PortraitService à camada de identidade (evita import circular no topo).
PortraitService.registerVisualIdentity(VisualIdentityService);

export { DEFAULT_APPEARANCE };
