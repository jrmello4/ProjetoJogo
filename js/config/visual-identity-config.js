// ============================================================
// IDENTIDADE VISUAL — arquétipos, eras de carreira, contextos
// ============================================================
// Camada ACIMA do catálogo de índices (appearance-config.js).
// Não substitui o SVG: orquestra paleta, roupa, acessório e
// evolução narrativa. Performance: só funções puras + lookups.
//
// Imagine / concept art: ver IMAGINE_PIPELINE no fim — prompts
// offline, nunca geração em tempo real no hot path do jogo.

/** Raridade de elemento visual — classificação, NÃO monetização. */
export const VISUAL_RARITY = {
  common:    { id: 'common',    label: 'Comum',    weight: 50 },
  uncommon:  { id: 'uncommon',  label: 'Incomum',  weight: 25 },
  rare:      { id: 'rare',      label: 'Raro',     weight: 15 },
  epic:      { id: 'epic',      label: 'Épico',    weight: 7 },
  legendary: { id: 'legendary', label: 'Lendário', weight: 3 },
};

/** Contexto de exibição — mesma pessoa, “guarda-roupa” diferente. */
export const VISUAL_CONTEXTS = {
  default:  { id: 'default',  label: 'Padrão' },
  octagon:  { id: 'octagon',  label: 'Octógono' },
  press:    { id: 'press',    label: 'Coletiva / mídia' },
  street:   { id: 'street',   label: 'Rua / casual' },
  ceremony: { id: 'ceremony', label: 'Cerimônia / glória' },
  coaching: { id: 'coaching', label: 'Corner / treino' },
};

/**
 * Fases de carreira — derivadas de estado do lutador (puro).
 * Ordem de prioridade em resolveCareerStage (primeiro match).
 */
export const CAREER_STAGES = {
  legend: {
    id: 'legend', label: 'Lenda',
    palette: { trunks: [4, 1], accent: [0, 1], hairMood: 'aged' },
    outfitPrefs: [12, 8, 7], accessoryPrefs: [16, 12, 9],
    scarBias: 0.55, flashBias: 0.2, agingBias: 0.7,
  },
  champion: {
    id: 'champion', label: 'Campeão',
    palette: { trunks: [4, 0, 1], accent: [0], hairMood: 'sharp' },
    outfitPrefs: [0, 12, 1], accessoryPrefs: [16, 3, 9],
    scarBias: 0.25, flashBias: 0.55, agingBias: 0.1,
  },
  ex_champion: {
    id: 'ex_champion', label: 'Ex-campeão',
    palette: { trunks: [1, 6, 4], accent: [0, 1], hairMood: 'worn' },
    outfitPrefs: [8, 7, 4], accessoryPrefs: [12, 3, 0],
    scarBias: 0.45, flashBias: 0.25, agingBias: 0.4,
  },
  star: {
    id: 'star', label: 'Estrela em ascensão',
    palette: { trunks: [0, 2, 9], accent: [2, 6], hairMood: 'bold' },
    outfitPrefs: [13, 3, 9], accessoryPrefs: [9, 8, 3],
    scarBias: 0.15, flashBias: 0.65, agingBias: 0.05,
  },
  prospect: {
    id: 'prospect', label: 'Prospecto',
    palette: { trunks: [1, 2, 5], accent: [5, 2], hairMood: 'fresh' },
    outfitPrefs: [2, 3, 1], accessoryPrefs: [4, 1, 0],
    scarBias: 0.05, flashBias: 0.35, agingBias: 0,
  },
  veteran: {
    id: 'veteran', label: 'Veterano',
    palette: { trunks: [1, 6, 7], accent: [5, 1], hairMood: 'aged' },
    outfitPrefs: [0, 11, 4], accessoryPrefs: [0, 7, 1],
    scarBias: 0.6, flashBias: 0.1, agingBias: 0.55,
  },
  journeyman: {
    id: 'journeyman', label: 'Trabalhador do circuito',
    palette: { trunks: [1, 6, 3], accent: [5], hairMood: 'plain' },
    outfitPrefs: [3, 16, 2], accessoryPrefs: [0, 4],
    scarBias: 0.35, flashBias: 0.05, agingBias: 0.25,
  },
  rookie: {
    id: 'rookie', label: 'Iniciante',
    palette: { trunks: [1, 3, 2], accent: [5, 4], hairMood: 'fresh' },
    outfitPrefs: [3, 2, 16], accessoryPrefs: [0, 4],
    scarBias: 0.02, flashBias: 0.1, agingBias: 0,
  },
  retired: {
    id: 'retired', label: 'Aposentado',
    palette: { trunks: [6, 1, 3], accent: [1, 5], hairMood: 'aged' },
    outfitPrefs: [14, 8, 4], accessoryPrefs: [12, 0],
    scarBias: 0.4, flashBias: 0.1, agingBias: 0.65,
  },
  coach: {
    id: 'coach', label: 'Treinador',
    palette: { trunks: [1, 6], accent: [5, 2], hairMood: 'practical' },
    outfitPrefs: [15, 14, 4], accessoryPrefs: [17, 0, 7],
    scarBias: 0.3, flashBias: 0.05, agingBias: 0.35,
  },
  mogul: {
    id: 'mogul', label: 'Empresário',
    palette: { trunks: [1, 4, 6], accent: [0, 1], hairMood: 'sharp' },
    outfitPrefs: [12, 8, 13], accessoryPrefs: [12, 9, 3],
    scarBias: 0.1, flashBias: 0.4, agingBias: 0.2,
  },
  fallen: {
    id: 'fallen', label: 'Queda / redenção',
    palette: { trunks: [6, 1, 7], accent: [5], hairMood: 'worn' },
    outfitPrefs: [16, 4, 10], accessoryPrefs: [0, 1],
    scarBias: 0.5, flashBias: 0.0, agingBias: 0.35,
  },
};

/**
 * Arquétipos visuais — identidade de personagem (além da fase).
 * `weights`: preferências de índices (listas); o serviço amostra com rng.
 * `families`: tags de estilo (casual/luxury/aggressive/eccentric/cultural/career).
 */
export const VISUAL_ARCHETYPES = {
  respected_vet: {
    id: 'respected_vet', label: 'Veterano respeitado',
    families: ['aggressive', 'career'],
    mouth: [1, 6], eyes: [1, 6], hair: [0, 2, 18, 9], beard: [4, 5, 10],
    outfit: [0, 11], accessory: [0, 7], rarity: 'uncommon',
  },
  young_prodigy: {
    id: 'young_prodigy', label: 'Jovem prodígio',
    families: ['casual', 'career'],
    mouth: [2, 3, 5], eyes: [0, 4], hair: [10, 11, 16, 6], beard: [0, 1],
    outfit: [2, 3, 1], accessory: [0, 4], rarity: 'uncommon',
  },
  bad_boy: {
    id: 'bad_boy', label: 'Bad boy',
    families: ['aggressive', 'eccentric'],
    mouth: [6, 3], eyes: [1, 6], hair: [3, 16, 21, 10], beard: [1, 10, 6],
    outfit: [11, 4, 0], accessory: [1, 8, 10, 11], rarity: 'rare',
  },
  arrogant_mogul: {
    id: 'arrogant_mogul', label: 'Milionário arrogante',
    families: ['luxury'],
    mouth: [3, 4], eyes: [1, 5], hair: [17, 12, 22], beard: [0, 3, 12],
    outfit: [12, 13, 8], accessory: [9, 12, 3, 8], rarity: 'epic',
  },
  humble_champ: {
    id: 'humble_champ', label: 'Campeão humilde',
    families: ['career', 'casual'],
    mouth: [0, 2], eyes: [0, 3], hair: [2, 6, 9], beard: [0, 1, 4],
    outfit: [0, 3, 1], accessory: [0, 4], rarity: 'rare',
  },
  showman: {
    id: 'showman', label: 'Palhaço carismático',
    families: ['eccentric', 'luxury'],
    mouth: [2, 3, 5], eyes: [4, 0], hair: [3, 13, 14, 15], beard: [0, 3],
    outfit: [13, 17, 9], accessory: [8, 1, 6], rarity: 'epic',
  },
  intimidator: {
    id: 'intimidator', label: 'Lutador intimidador',
    families: ['aggressive'],
    mouth: [1, 6, 4], eyes: [6, 1], hair: [0, 1, 2, 9], beard: [4, 5, 10],
    outfit: [0, 11, 1], accessory: [0, 7], rarity: 'uncommon',
  },
  tech_nerd: {
    id: 'tech_nerd', label: 'Analítico / nerd tático',
    families: ['casual'],
    mouth: [0, 4], eyes: [5, 0], hair: [12, 6, 10], beard: [0, 1, 11],
    outfit: [3, 4, 14], accessory: [5, 0], rarity: 'uncommon',
  },
  business: {
    id: 'business', label: 'Empresário',
    families: ['luxury', 'career'],
    mouth: [0, 1, 3], eyes: [0, 1], hair: [17, 12, 0], beard: [0, 3, 12],
    outfit: [12, 8, 14], accessory: [12, 9], rarity: 'rare',
  },
  ex_athlete: {
    id: 'ex_athlete', label: 'Ex-atleta',
    families: ['career', 'casual'],
    mouth: [0, 1], eyes: [2, 0], hair: [18, 5, 0], beard: [4, 1],
    outfit: [14, 15, 4], accessory: [17, 0], rarity: 'uncommon',
  },
  celebrity: {
    id: 'celebrity', label: 'Celebridade',
    families: ['luxury', 'eccentric'],
    mouth: [3, 5], eyes: [4, 1], hair: [22, 11, 17], beard: [0, 6],
    outfit: [13, 12, 17], accessory: [9, 8, 13], rarity: 'epic',
  },
  comeback: {
    id: 'comeback', label: 'Fracassado tentando voltar',
    families: ['casual', 'career'],
    mouth: [1, 4, 6], eyes: [2, 5], hair: [16, 18, 6], beard: [1, 11, 10],
    outfit: [16, 3, 4], accessory: [0, 1], rarity: 'rare',
  },
  rebel: {
    id: 'rebel', label: 'Rebelde',
    families: ['aggressive', 'eccentric'],
    mouth: [6, 3], eyes: [1, 6], hair: [3, 21, 16], beard: [6, 8, 1],
    outfit: [11, 10, 4], accessory: [1, 10, 11], rarity: 'rare',
  },
  traditionalist: {
    id: 'traditionalist', label: 'Tradicionalista',
    families: ['career', 'cultural'],
    mouth: [1, 0], eyes: [0, 1], hair: [2, 9, 0], beard: [0, 4],
    outfit: [5, 0, 1], accessory: [0, 7], rarity: 'uncommon',
  },
  eccentric: {
    id: 'eccentric', label: 'Excêntrico',
    families: ['eccentric'],
    mouth: [5, 3, 2], eyes: [4, 3], hair: [12, 13, 15, 3], beard: [12, 3, 0],
    outfit: [17, 13, 9], accessory: [6, 1, 11], rarity: 'epic',
  },
  mysterious: {
    id: 'mysterious', label: 'Misterioso',
    families: ['aggressive', 'luxury'],
    mouth: [4, 1], eyes: [5, 6], hair: [0, 1, 17], beard: [0, 9, 4],
    outfit: [11, 7, 1], accessory: [9, 0], rarity: 'rare',
  },
  everyman: {
    id: 'everyman', label: 'Trabalhador comum',
    families: ['casual'],
    mouth: [0, 2], eyes: [0, 2], hair: [6, 2, 16], beard: [1, 11, 0],
    outfit: [16, 3, 10], accessory: [0, 2], rarity: 'common',
  },
  cocky_prospect: {
    id: 'cocky_prospect', label: 'Prodígio arrogante',
    families: ['luxury', 'eccentric'],
    mouth: [3, 4], eyes: [1, 6], hair: [10, 22, 12], beard: [0, 1],
    outfit: [13, 9, 3], accessory: [9, 3, 8], rarity: 'rare',
  },
  fallen_legend: {
    id: 'fallen_legend', label: 'Lenda decadente',
    families: ['career', 'luxury'],
    mouth: [1, 6, 2], eyes: [2, 0], hair: [18, 5, 0], beard: [5, 4],
    outfit: [8, 16, 12], accessory: [3, 0, 12], rarity: 'legendary',
  },
  champ_to_boss: {
    id: 'champ_to_boss', label: 'Campeão virado empresário',
    families: ['luxury', 'career'],
    mouth: [3, 0], eyes: [1, 0], hair: [17, 0, 12], beard: [0, 3],
    outfit: [12, 14, 8], accessory: [12, 16, 9], rarity: 'epic',
  },
  heritage: {
    id: 'heritage', label: 'Orgulho de origem',
    families: ['cultural', 'career'],
    mouth: [0, 1], eyes: [0, 3], hair: [5, 13, 14, 20], beard: [0, 4, 1],
    outfit: [18, 5, 0], accessory: [18, 7, 0], rarity: 'rare',
  },
  street_grit: {
    id: 'street_grit', label: 'Raiz de rua',
    families: ['casual', 'aggressive'],
    mouth: [1, 6], eyes: [1, 2], hair: [16, 1, 7], beard: [10, 1, 4],
    outfit: [10, 4, 11], accessory: [2, 1, 0], rarity: 'uncommon',
  },
  pure_athlete: {
    id: 'pure_athlete', label: 'Atleta puro',
    families: ['career', 'casual'],
    mouth: [0, 3], eyes: [1, 0], hair: [2, 9, 10], beard: [0, 1],
    outfit: [1, 0, 9], accessory: [4, 7, 0], rarity: 'common',
  },
  media_darling: {
    id: 'media_darling', label: 'Queridinho da mídia',
    families: ['luxury', 'casual'],
    mouth: [2, 5, 3], eyes: [0, 4], hair: [17, 11, 6], beard: [0, 1],
    outfit: [13, 8, 3], accessory: [9, 12, 5], rarity: 'rare',
  },
  silent_killer: {
    id: 'silent_killer', label: 'Silencioso letal',
    families: ['aggressive', 'career'],
    mouth: [4, 1], eyes: [6, 5], hair: [0, 1, 2], beard: [0, 9],
    outfit: [0, 1, 11], accessory: [0], rarity: 'uncommon',
  },
  redemption_arc: {
    id: 'redemption_arc', label: 'Arco de redenção',
    families: ['career', 'casual'],
    mouth: [0, 1, 2], eyes: [0, 2], hair: [6, 9, 18], beard: [1, 4],
    outfit: [3, 1, 16], accessory: [0, 4], rarity: 'epic',
  },
  coach_mentor: {
    id: 'coach_mentor', label: 'Mentor de corner',
    families: ['career'],
    mouth: [0, 1], eyes: [0, 1], hair: [18, 0, 2], beard: [4, 1],
    outfit: [15, 14, 4], accessory: [17, 7], rarity: 'uncommon',
  },
  party_star: {
    id: 'party_star', label: 'Estrela de balada',
    families: ['luxury', 'eccentric'],
    mouth: [3, 5], eyes: [4, 1], hair: [12, 15, 22], beard: [0, 6],
    outfit: [17, 13, 7], accessory: [9, 8, 13, 11], rarity: 'epic',
  },
};

export const VISUAL_ARCHETYPE_IDS = Object.keys(VISUAL_ARCHETYPES);

/** Famílias de estilo (roupas/acessórios) — para filtros e UI futura. */
export const STYLE_FAMILIES = {
  casual:     { label: 'Casual',      desc: 'Dia a dia, treino leve, rua' },
  luxury:     { label: 'Luxuoso',     desc: 'Glamour, mídia, celebridade' },
  aggressive: { label: 'Agressivo',   desc: 'Escuro, intimidador, veterano' },
  eccentric:  { label: 'Excêntrico',  desc: 'Cores, estampas, exagero' },
  cultural:   { label: 'Origem',      desc: 'Traços de herança — com respeito, sem caricatura' },
  career:     { label: 'Carreira',    desc: 'Octógono, gi, coach, glória' },
};

/**
 * Eventos que disparam evolução visual (hooks do jogo).
 * chance: probabilidade base; keys: o que o serviço pode alterar.
 */
export const VISUAL_EVOLUTION_TRIGGERS = {
  year_aged:          { keys: ['hairColor', 'hairStyle', 'faceMarks', 'scarStyle'], intensity: 0.35 },
  title_won:          { keys: ['outfitStyle', 'accessory', 'accentColor', 'trunksColor'], intensity: 0.7 },
  title_lost:         { keys: ['outfitStyle', 'accessory', 'mouthStyle'], intensity: 0.5 },
  popularity_surge:   { keys: ['hairStyle', 'hairColor', 'accessory', 'outfitStyle'], intensity: 0.55 },
  popularity_crash:   { keys: ['outfitStyle', 'accessory', 'hairColor'], intensity: 0.5 },
  lifestyle_luxurious:{ keys: ['outfitStyle', 'accessory', 'accentColor'], intensity: 0.6 },
  lifestyle_modest:   { keys: ['outfitStyle', 'accessory'], intensity: 0.45 },
  injury_scar:        { keys: ['scarStyle', 'faceMarks', 'noseStyle'], intensity: 0.8 },
  retirement:         { keys: ['outfitStyle', 'accessory', 'hairColor', 'beardStyle'], intensity: 0.75 },
  hof_induct:         { keys: ['outfitStyle', 'accessory', 'accentColor'], intensity: 0.9 },
  long_losing_streak: { keys: ['mouthStyle', 'eyeShape', 'outfitStyle', 'faceMarks'], intensity: 0.4 },
  rivalry_heat:       { keys: ['browStyle', 'mouthStyle', 'tattooStyle'], intensity: 0.3 },
};

/**
 * Pipeline Grok Imagine / concept art — OFFLINE / opcional.
 * O jogo NÃO gera imagens no runtime. O serviço monta prompts
 * determinísticos para o dev/jogador exportar (poster, eras, rivalidade).
 */
export const IMAGINE_PIPELINE = {
  enabledInGame: false,
  reason: 'Performance + consistência: retratos SVG determinísticos no hot path; Imagine só para assets de marketing/cinemática.',
  useCases: [
    'concept-sheet por arquétipo',
    'poster de evento com dois rostos',
    'antes/depois de evolução de carreira',
    'card de Hall da Fama',
    'key art de rivalidade',
  ],
  promptTemplate: [
    'Flat stylized MMA fighter portrait bust, fight-poster aesthetic,',
    'Red Corner / Blue Corner sports UI language, bold shapes, limited palette,',
    '{stage}, {archetype}, {outfit}, {hair}, {scars}, {mood},',
    'no photoreal gore, respectful cultural cues only, game concept art',
  ].join(' '),
};

/** Índice de roupa por família (após expansão do catálogo). */
export const OUTFIT_BY_FAMILY = {
  casual:     [2, 3, 4, 10, 16],
  luxury:     [8, 12, 13],
  aggressive: [0, 11, 7],
  eccentric:  [17, 9, 13],
  cultural:   [18, 5],
  career:     [0, 1, 5, 14, 15, 9],
};

/**
 * Desbloqueios visuais por conquista — NÃO monétização.
 * `check(fighter)` puro; `patch` índices de appearance a aplicar
 * quando o jogador tem auto-evolução OU escolhe equipar.
 */
export const VISUAL_UNLOCKS = {
  title_chain: {
    id: 'title_chain',
    label: 'Corrente de título',
    rarity: 'legendary',
    desc: 'Ganhe um cinturão — glória no peito.',
    patch: { accessory: 16, accentColor: 0 },
    check: (f) => (f.titlesWon || 0) >= 1 || f.wasChampion || f.isChampion,
  },
  champion_suit: {
    id: 'champion_suit',
    label: 'Terno de campeão',
    rarity: 'epic',
    desc: 'Visual de coletiva pós-cinturão.',
    patch: { outfitStyle: 12, accentColor: 0 },
    check: (f) => (f.titlesWon || 0) >= 1 || f.wasChampion,
  },
  media_shades: {
    id: 'media_shades',
    label: 'Óculos de celebridade',
    rarity: 'rare',
    desc: 'Popularidade 70+ — holofote constante.',
    patch: { accessory: 9 },
    check: (f) => (f.popularity || 0) >= 70,
  },
  luxury_blazer: {
    id: 'luxury_blazer',
    label: 'Blazer de estrela',
    rarity: 'epic',
    desc: 'Estilo de vida luxuoso ou pop 80+.',
    patch: { outfitStyle: 13, trunksColor: 1 },
    check: (f) => f.lifestyleTier === 'luxurious' || (f.popularity || 0) >= 80,
  },
  veteran_leather: {
    id: 'veteran_leather',
    label: 'Jaqueta de veterano',
    rarity: 'rare',
    desc: '35+ anos e 15+ lutas no cartel.',
    patch: { outfitStyle: 11, scarStyle: 3 },
    check: (f) => (f.age || 0) >= 35 && ((f.totalFights || 0) >= 15
      || ((f.record?.wins || 0) + (f.record?.losses || 0)) >= 15),
  },
  coach_whistle: {
    id: 'coach_whistle',
    label: 'Apito de mentor',
    rarity: 'rare',
    desc: 'Aposentado com carreira longa — vira referência.',
    patch: { outfitStyle: 15, accessory: 17 },
    check: (f) => f.status === 'retired' && ((f.record?.wins || 0) + (f.record?.losses || 0)) >= 12,
  },
  street_simple: {
    id: 'street_simple',
    label: 'Visual raiz',
    rarity: 'common',
    desc: 'Sempre disponível — humildade de academia.',
    patch: { outfitStyle: 16, accessory: 0 },
    check: () => true,
  },
  heat_ink: {
    id: 'heat_ink',
    label: 'Tinta de rivalidade',
    rarity: 'uncommon',
    desc: 'Narrative heat alto — tensão vira marca.',
    patch: { tattooStyle: 3, browStyle: 1 },
    check: (f) => (f.narrativeHeat || 0) >= 12,
  },
  golden_accent: {
    id: 'golden_accent',
    label: 'Detalhe dourado',
    rarity: 'legendary',
    desc: 'Três ou mais cinturões na carreira.',
    patch: { accentColor: 0, trunksColor: 4 },
    check: (f) => (f.titlesWon || 0) >= 3,
  },
};

export const VISUAL_UNLOCK_IDS = Object.keys(VISUAL_UNLOCKS);
