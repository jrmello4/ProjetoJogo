import {
  APPEARANCE_CATEGORIES, DEFAULT_APPEARANCE, APPEARANCE_BIAS,
  SKIN_TONES, HAIR_COLORS, EYE_COLORS, TRUNKS_COLORS, ACCENT_COLORS,
  OUTFIT_STYLES, HAIR_STYLES, BEARD_STYLES,
  HEADWEAR_ACCESSORY_IDXS, TALL_HAIR_IDXS,
} from '../config/appearance-config.js';
import { paintPortrait, PIXEL_GRID } from './portrait-pixels.js';

// Retrato de lutador — pixel art procedural (portrait-pixels.js). Todo
// lutador tem cara sem asset: jogador edita; IA deriva do id + viés de
// carreira. Este serviço resolve QUAL aparência renderizar (identidade,
// viés, normalização); o COMO desenhar vive no motor de pixels.

export class PortraitService {
  static appearanceFor(fighter) {
    // Prefer identity layer (arquétipo + era) when registered — AI gets
    // storytelling looks; player with saved appearance stays stable unless
    // visualAutoEvolve.
    if (PortraitService._visualIdentity?.resolveBaseAppearance) {
      return PortraitService._visualIdentity.resolveBaseAppearance(fighter);
    }
    if (fighter?.appearance) return PortraitService._normalize(fighter.appearance);
    return PortraitService._derivedFromFighter(fighter);
  }

  static randomAppearance(rng = Math.random) {
    const a = {};
    for (const cat of APPEARANCE_CATEGORIES) {
      a[cat.key] = Math.floor(rng() * cat.options.length);
    }
    // Evita combinações bregas óbvias no "aleatório" do editor.
    // Tinturas começam no índice 12 (7–11 são cores naturais novas).
    if (a.hairStyle === 0 && a.hairColor >= 12 && rng() < 0.7) a.hairColor = Math.floor(rng() * 5);
    if (a.beardStyle > 0 && a.hairStyle === 0 && rng() < 0.35) a.beardStyle = 0;
    return a;
  }

  // Aparência aleatória enviesada por contexto (criação de personagem / IA).
  // opts: { age, fightingStyle, archetype, origin, popularity, totalFights, status }
  static contextualAppearance(opts = {}, rng = Math.random) {
    const a = PortraitService.randomAppearance(rng);
    PortraitService._applyCareerBias(a, opts, rng);
    return a;
  }

  static _derived(key) {
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    const a = {};
    APPEARANCE_CATEGORIES.forEach((cat, ci) => {
      let x = (h ^ Math.imul(ci + 1, 0x9e3779b9)) >>> 0;
      x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
      a[cat.key] = x % cat.options.length;
    });
    return a;
  }

  // Valor [0,1) determinístico por (semente, decisão). CADA decisão de viés
  // usa sua própria tag em vez de consumir um stream compartilhado — num
  // stream, qualquer branch que liga/desliga (idade cruzou 34, pop cruzou
  // 70) desloca todos os sorteios seguintes e o lutador inteiro muda de
  // cara por causa de UM stat. Com tag por decisão, cruzar um limiar só
  // mexe nas categorias que aquele limiar realmente governa.
  static _roll01(seed) {
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    return (h >>> 0) / 0x100000000;
  }

  static _derivedFromFighter(fighter) {
    const key = String(fighter?.id ?? fighter?.name ?? 'x');
    const a = PortraitService._derived(key);
    // roll(tag) determinístico e independente por decisão — identidade
    // estável entre semanas/telas (ver _roll01).
    const roll = (tag) => PortraitService._roll01(`${key}:bias:${tag}`);
    PortraitService._applyCareerBias(a, {
      age: fighter?.age,
      fightingStyle: fighter?.fightingStyle || fighter?.style,
      style: fighter?.style,
      popularity: fighter?.popularity,
      totalFights: fighter?.totalFights ?? ((fighter?.record?.wins || 0) + (fighter?.record?.losses || 0)),
      status: fighter?.status,
      weightClass: fighter?.weightClass,
    }, roll);
    return a;
  }

  // `roll(tag)` → [0,1). Determinístico por lutador (IA) ou Math.random
  // ignorando a tag (editor "Visual de atleta", que quer variedade).
  static _applyCareerBias(a, opts, roll) {
    const age = opts.age ?? 28;
    const fights = opts.totalFights ?? 0;
    const pop = opts.popularity ?? 30;
    const style = String(opts.fightingStyle || opts.style || '').toLowerCase();
    const wc = String(opts.weightClass || '').toLowerCase();

    // Idade — grisalho, entradas, cicatriz de veterano
    if (age >= 34) {
      if (roll('grey') < 0.55) a.hairColor = APPEARANCE_BIAS.HAIR_GREY;
      if (roll('white') < 0.25) a.hairColor = APPEARANCE_BIAS.HAIR_WHITE;
      if (roll('recede') < 0.4) a.hairStyle = 18; // entradas
      if (roll('tired') < 0.35) a.faceMarks = 2; // olheiras
    }
    if (age >= 38) {
      if (roll('vetScar') < 0.45) a.scarStyle = APPEARANCE_BIAS.SCAR_VETERAN;
      if (roll('bald') < 0.3) a.hairStyle = 0; // careca
    }
    if (age < 24 && roll('young') < 0.5) {
      // prospecto: cabelo ousado, pouca cicatriz
      a.scarStyle = APPEARANCE_BIAS.SCAR_NONE;
      if (roll('youngDye') < 0.35) a.hairColor = 12 + Math.floor(roll('youngDyePick') * 5); // tinturas
      if (roll('youngFit') < 0.4) a.outfitStyle = 2 + Math.floor(roll('youngFitPick') * 3); // regata/tee/hoodie
    }

    // Estilo de luta
    if (style.includes('wrestl') || style.includes('bjj') || style.includes('grappl')) {
      if (roll('cauli') < 0.55) a.earStyle = APPEARANCE_BIAS.EAR_CAULIFLOWER;
      if (roll('gi') < 0.35) a.outfitStyle = APPEARANCE_BIAS.OUTFIT_GI;
      if (roll('grapplerNose') < 0.3) a.noseStyle = 2; // amassado
    }
    if (style.includes('box') || style.includes('striker') || style.includes('muay') || style.includes('kick')) {
      if (roll('browScar') < 0.4) a.scarStyle = Math.max(a.scarStyle, 1); // sobrancelha
      if (roll('strikerNose') < 0.35) a.noseStyle = 2;
      if (roll('bareChest') < 0.3) a.outfitStyle = 0; // peito nu
    }

    // Cartel — mais lutas = mais marcas
    if (fights >= 12 && roll('warScars') < 0.5) a.scarStyle = Math.min(7, Math.max(a.scarStyle, 3 + Math.floor(roll('warScarsPick') * 4)));
    if (fights >= 20 && roll('warEars') < 0.4) a.earStyle = APPEARANCE_BIAS.EAR_CAULIFLOWER;

    // Popularidade — flash
    if (pop >= 70) {
      if (roll('flashInk') < 0.4) a.tattooStyle = 4 + Math.floor(roll('flashInkPick') * 4);
      if (roll('flashAcc') < 0.35) a.accessory = 1 + Math.floor(roll('flashAccPick') * 4);
      if (roll('flashDye') < 0.3) a.hairColor = 12 + Math.floor(roll('flashDyePick') * 5);
    }
    if (pop < 20 && roll('plain') < 0.5) {
      a.tattooStyle = 0;
      a.accessory = 0;
      a.outfitStyle = APPEARANCE_BIAS.OUTFIT_OCTAGON;
    }

    // Peso
    if (wc.includes('heavy')) {
      if (roll('heavyBody') < 0.5) a.bodyType = 4; // pesado
      if (roll('heavyBody2') < 0.3) a.bodyType = 2;
    }
    if (wc.includes('fly') || wc.includes('bantam')) {
      if (roll('lightBody') < 0.45) a.bodyType = 0;
      if (roll('lightBody2') < 0.25) a.bodyType = 5;
    }

    // Clamp seguro
    for (const cat of APPEARANCE_CATEGORIES) {
      if (a[cat.key] >= cat.options.length) a[cat.key] = a[cat.key] % cat.options.length;
      if (a[cat.key] < 0) a[cat.key] = 0;
    }
  }

  static _normalize(appearance) {
    const a = { ...DEFAULT_APPEARANCE };
    for (const cat of APPEARANCE_CATEGORIES) {
      const v = Number(appearance?.[cat.key]);
      a[cat.key] = Number.isInteger(v) && v >= 0 && v < cat.options.length ? v : 0;
    }
    return a;
  }


  /**
   * Render pixel art — busto 40×48 pintado em portrait-pixels.js
   * (buffer com máscara por material + contorno único + compilação em
   * 1 path por cor). viewBox mantém a proporção 5:6 do sistema antigo,
   * então nenhum call site muda. crispEdges + .portrait { image-rendering:
   * pixelated } garantem pixel duro em qualquer tamanho.
   */
  static render(appearance, { size = 96, className = '' } = {}) {
    const a = PortraitService._normalize(appearance);
    const skinTone = SKIN_TONES[a.skinTone] || SKIN_TONES[0];
    const colors = {
      skin: skinTone.base,
      skinSh: skinTone.shade,
      hair: (HAIR_COLORS[a.hairColor] || HAIR_COLORS[0]).value,
      eye: (EYE_COLORS[a.eyeColor] || EYE_COLORS[0]).value,
      cloth: (TRUNKS_COLORS[a.trunksColor] || TRUNKS_COLORS[0]).value,
      accent: (ACCENT_COLORS[a.accentColor] || ACCENT_COLORS[0]).value,
    };

    // Boné/gorro/chapéu × cabelo alto: rebaixa o cabelo de COROA (frontal
    // e traseiro) pra silhueta de buzz (2) — volume de coroa atravessaria
    // o chapéu. Cabelos de QUEDA (longo, mullet, dreads, tranças, rabo)
    // não estão em TALL_HAIR e mantêm o traseiro: cabelo comprido saindo
    // por baixo do boné é como fica na vida real.
    const flattened = HEADWEAR_ACCESSORY_IDXS.includes(a.accessory) && TALL_HAIR_IDXS.includes(a.hairStyle);
    a.hairFrontStyle = flattened ? 2 : a.hairStyle;
    a.hairBackStyle = flattened ? 2 : a.hairStyle;

    const px = paintPortrait(a, colors);
    const { W: GW, H: GH } = PIXEL_GRID;

    return `<svg viewBox="0 0 ${GW} ${GH}" width="${size}" height="${Math.round(size * 1.2)}"
      class="portrait portrait--pixel ${className}" role="img" aria-label="Retrato do lutador"
      shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <rect width="${GW}" height="${GH}" fill="#241e18"/>
      <rect y="${GH - 10}" width="${GW}" height="10" fill="#1a1611"/>
      ${px}</svg>`;
  }

  /**
   * Render com identidade visual + contexto de cena.
   * Import dinâmico evitado: caller pode passar appearance já resolvida
   * ou fighter (usa resolve se VisualIdentity estiver no grafo — lazy).
   */
  static renderFighter(fighter, opts = {}) {
    const { context = 'default', size = 96, className = '' } = opts;
    // Lazy require pattern via global registry to avoid circular import at load
    const VIS = PortraitService._visualIdentity;
    let appearance;
    if (VIS) {
      appearance = VIS.resolveForRender(fighter, context);
    } else {
      appearance = PortraitService.appearanceFor(fighter);
    }
    return PortraitService.render(appearance, { size, className });
  }

  static registerVisualIdentity(service) {
    PortraitService._visualIdentity = service;
  }

  // Meta legível pro UI (resumo de identidade)
  static describe(appearance) {
    const a = PortraitService._normalize(appearance);
    const pick = (key) => {
      const cat = APPEARANCE_CATEGORIES.find(c => c.key === key);
      return cat?.options[a[key]]?.label || '';
    };
    return {
      hair: `${pick('hairStyle')} · ${pick('hairColor')}`,
      face: `${pick('faceShape')} · ${pick('eyeShape')}`,
      style: `${pick('outfitStyle')} · ${pick('trunksColor')}`,
      marks: [pick('scarStyle'), pick('tattooStyle'), pick('beardStyle')].filter(x => x && x !== 'Nenhuma' && x !== 'Limpo' && x !== 'Nenhum').join(' · ') || 'Visual limpo',
    };
  }

  // Contagem de combinações (debug / testes)
  static catalogStats() {
    let combos = 1;
    const per = {};
    for (const cat of APPEARANCE_CATEGORIES) {
      per[cat.key] = cat.options.length;
      combos *= cat.options.length;
    }
    return { categories: APPEARANCE_CATEGORIES.length, options: per, combosLog10: Math.log10(combos) };
  }
}

// re-export labels used by tests / tooling
export { HAIR_STYLES, BEARD_STYLES, OUTFIT_STYLES };
