// ============================================================
// CATÁLOGO DE APARÊNCIA — identidade visual do lutador
// ============================================================
// Busto SVG flat em camadas (PortraitService). Cada categoria é lista
// ordenada; aparência = { key: índice }. Índices fora do range → 0.
//
// REGRA DE COMPAT: só APPEND em listas existentes. Reordenar quebra
// saves do jogador e hashes da IA. Categorias NOVAS são seguras (default 0).
//
// IA: se fighter.appearance for null, PortraitService deriva do id +
// viés de idade/estilo/status (appearanceFor).

// ---- Paletas ----

export const SKIN_TONES = [
  { label: 'Marfim',        base: '#f0c8a0', shade: '#d4a87e' },
  { label: 'Pêssego',       base: '#e8b48a', shade: '#c9925f' },
  { label: 'Dourado',       base: '#d9a066', shade: '#b57f42' },
  { label: 'Oliva',         base: '#c68d5a', shade: '#a06b3a' },
  { label: 'Bronze',        base: '#a76a3e', shade: '#845026' },
  { label: 'Âmbar',         base: '#8d5524', shade: '#6e3f14' },
  { label: 'Mogno',         base: '#6b3f1d', shade: '#502c10' },
  { label: 'Ébano',         base: '#4a2c14', shade: '#331d0a' },
  // novos
  { label: 'Areia',         base: '#e8c9a8', shade: '#c9a882' },
  { label: 'Caramelo',      base: '#b87a45', shade: '#945f32' },
  { label: 'Café',          base: '#5a3418', shade: '#3e2210' },
  { label: 'Noite',         base: '#2e1a0e', shade: '#1a0e08' },
];

export const HAIR_COLORS = [
  { label: 'Preto',           value: '#1a1512' },
  { label: 'Castanho escuro', value: '#3b2a1a' },
  { label: 'Castanho',        value: '#5c3d24' },
  { label: 'Loiro',           value: '#c9a05a' },
  { label: 'Ruivo',           value: '#8f4520' },
  { label: 'Grisalho',        value: '#8e8a84' },
  { label: 'Platinado',       value: '#d8d4cc' },
  // novos — naturais + estilizados
  { label: 'Castanho claro',  value: '#8b6239' },
  { label: 'Loiro sujo',      value: '#a89060' },
  { label: 'Ruivo cobre',     value: '#b05a28' },
  { label: 'Preto azulado',   value: '#12141c' },
  { label: 'Branco neve',     value: '#e8e6e0' },
  { label: 'Azul elétrico',   value: '#2a4a9e' },
  { label: 'Vermelho fogo',   value: '#b82020' },
  { label: 'Verde limão',     value: '#3a7a28' },
  { label: 'Rosa choque',     value: '#c04078' },
  { label: 'Roxo',            value: '#5a2a7a' },
];

export const HAIR_STYLES = [
  // 0–8 originais (não reordenar)
  { label: 'Careca' },
  { label: 'Raspado' },
  { label: 'Buzz cut' },
  { label: 'Moicano' },
  { label: 'Coque samurai' },
  { label: 'Black power' },
  { label: 'Médio' },
  { label: 'Dreads' },
  { label: 'Longo' },
  // novos
  { label: 'Militar' },
  { label: 'Undercut' },
  { label: 'Franja' },
  { label: 'Side part' },
  { label: 'Tranças' },
  { label: 'Afro curto' },
  { label: 'Cacheado' },
  { label: 'Bagunçado' },
  { label: 'Penteado atrás' },
  { label: 'Entradas' },
  { label: 'Top knot' },
  { label: 'Cornrows' },
  { label: 'Mullet' },
  { label: 'Pompadour' },
  { label: 'Rabo de cavalo' },
];

export const BEARD_STYLES = [
  { label: 'Limpo' },
  { label: 'Sombra' },
  { label: 'Cavanhaque' },
  { label: 'Bigode' },
  { label: 'Barba cheia' },
  { label: 'Barba longa' },
  // novos
  { label: 'Barba desenhada' },
  { label: 'Bigode + cavanhaque' },
  { label: 'Costeletas' },
  { label: 'Chin strap' },
  { label: 'Sombra pesada' },
  { label: 'Barba de 3 dias' },
  { label: 'Van Dyke' },
];

export const FACE_SHAPES = [
  { label: 'Oval' },
  { label: 'Quadrado' },
  { label: 'Redondo' },
  { label: 'Alongado' },
  { label: 'Angular' },
  { label: 'Diamante' },
];

export const BROW_STYLES = [
  { label: 'Reta' },
  { label: 'Angulada' },
  { label: 'Grossa' },
  { label: 'Arqueada' },
  { label: 'Rala' },
  { label: 'Monobloc' },
];

export const EYE_SHAPES = [
  { label: 'Neutro' },
  { label: 'Focado' },
  { label: 'Caído' },
  { label: 'Amendoado' },
  { label: 'Largo' },
  { label: 'Estreito' },
  { label: 'Intenso' },
];

export const EYE_COLORS = [
  { label: 'Castanho', value: '#4a2e18' },
  { label: 'Preto',    value: '#201812' },
  { label: 'Verde',    value: '#4a6b3a' },
  { label: 'Azul',     value: '#3a5a7e' },
  { label: 'Mel',      value: '#8a6428' },
  { label: 'Cinza',    value: '#6a6e72' },
  { label: 'Avelã',    value: '#6b4a28' },
  { label: 'Verde-água', value: '#3a7a6a' },
];

export const NOSE_STYLES = [
  { label: 'Reto' },
  { label: 'Largo' },
  { label: 'Amassado' },
  { label: 'Fino' },
  { label: 'Arrebitado' },
  { label: 'Aquilino' },
];

export const MOUTH_STYLES = [
  { label: 'Neutra' },
  { label: 'Séria' },
  { label: 'Meio sorriso' },
  { label: 'Confiante' },
  { label: 'Apertada' },
  { label: 'Sorrisinho' },
  { label: 'Carrancuda' },
];

export const EAR_STYLES = [
  { label: 'Normal' },
  { label: 'Couve-flor' },
  { label: 'Pequenas' },
  { label: 'Proeminentes' },
];

export const SCAR_STYLES = [
  { label: 'Nenhuma' },
  { label: 'Sobrancelha' },
  { label: 'Bochecha' },
  { label: 'Ambas' },
  { label: 'Nariz' },
  { label: 'Lábio' },
  { label: 'Testa' },
  { label: 'Veterano' }, // múltiplas
];

export const FACE_MARKS = [
  { label: 'Limpo' },
  { label: 'Sardas' },
  { label: 'Olheiras' },
  { label: 'Pele marcada' },
  { label: 'Rubor' },
  { label: 'Pintas' },
];

export const TATTOO_STYLES = [
  { label: 'Nenhuma' },
  { label: 'Peitoral' },
  { label: 'Braço' },
  { label: 'Pescoço' },
  { label: 'Fechado' },
  { label: 'Manga completa' },
  { label: 'Têmpora' },
  { label: 'Full body' },
];

export const BODY_TYPES = [
  { label: 'Magro',         shoulderScale: 0.88 },
  { label: 'Atlético',      shoulderScale: 1.0 },
  { label: 'Parrudo',       shoulderScale: 1.14 },
  { label: 'Musculoso',     shoulderScale: 1.08 },
  { label: 'Pesado',        shoulderScale: 1.22 },
  { label: 'Enxuto',        shoulderScale: 0.82 },
];

// Visual do tronco — comunica fase/estilo, não só “cor do calção”.
// `family` / `rarity` = metadados (UI, evolução); render usa `id` + índice.
export const OUTFIT_STYLES = [
  { label: 'Octógono',         id: 'octagon',    family: 'career',     rarity: 'common' },
  { label: 'Rashguard',        id: 'rashguard',  family: 'career',     rarity: 'common' },
  { label: 'Regata',           id: 'tank',       family: 'casual',     rarity: 'common' },
  { label: 'Camiseta',         id: 'tee',        family: 'casual',     rarity: 'common' },
  { label: 'Hoodie / moletom', id: 'hoodie',     family: 'casual',     rarity: 'common' },
  { label: 'Kimono (gi)',      id: 'gi',         family: 'career',     rarity: 'uncommon' },
  { label: 'Colete',           id: 'vest',       family: 'casual',     rarity: 'common' },
  { label: 'Jaqueta',          id: 'jacket',     family: 'casual',     rarity: 'common' },
  { label: 'Camisa social',    id: 'dress',      family: 'luxury',     rarity: 'uncommon' },
  { label: 'Track jacket',     id: 'track',      family: 'career',     rarity: 'common' },
  // 10+ — expansão identidade visual
  { label: 'Jeans + regata',   id: 'jeans',      family: 'casual',     rarity: 'common' },
  { label: 'Jaqueta de couro', id: 'leather',    family: 'aggressive', rarity: 'rare' },
  { label: 'Terno',            id: 'suit',       family: 'luxury',     rarity: 'epic' },
  { label: 'Blazer celebridade', id: 'blazer',   family: 'luxury',     rarity: 'epic' },
  { label: 'Polo de coach',    id: 'coach_polo', family: 'career',     rarity: 'uncommon' },
  { label: 'Moletom de treino', id: 'coach_hood', family: 'career',    rarity: 'common' },
  { label: 'Roupa simples',    id: 'simple',     family: 'casual',     rarity: 'common' },
  { label: 'Visual extravagante', id: 'loud',    family: 'eccentric',  rarity: 'epic' },
  { label: 'Faixa de herança', id: 'heritage',   family: 'cultural',   rarity: 'rare' },
];

export const TRUNKS_COLORS = [
  { label: 'Vermelho', value: '#a01c28' },
  { label: 'Preto',    value: '#1c1815' },
  { label: 'Azul',     value: '#2f4d7e' },
  { label: 'Branco',   value: '#d8d4cc' },
  { label: 'Dourado',  value: '#a8862a' },
  { label: 'Verde',    value: '#3a6b46' },
  { label: 'Grafite',  value: '#4a453e' },
  { label: 'Vinho',    value: '#5e1a2a' },
  { label: 'Laranja',  value: '#c45a18' },
  { label: 'Ciano',    value: '#1a6a7a' },
  { label: 'Rosa',     value: '#a04060' },
  { label: 'Camuflado', value: '#4a5a38' },
];

export const ACCENT_COLORS = [
  { label: 'Ouro',     value: '#c9a227' },
  { label: 'Prata',    value: '#a8a8a8' },
  { label: 'Vermelho', value: '#c02828' },
  { label: 'Azul',     value: '#2860a0' },
  { label: 'Branco',   value: '#e8e4dc' },
  { label: 'Preto',    value: '#1a1814' },
  { label: 'Neon',     value: '#40e0a0' },
  { label: 'Roxo',     value: '#6a28a0' },
];

export const ACCESSORY_STYLES = [
  { label: 'Nenhum',            family: 'casual',     rarity: 'common' },
  { label: 'Bandana',           family: 'aggressive', rarity: 'common' },
  { label: 'Boné',              family: 'casual',     rarity: 'common' },
  { label: 'Corrente',          family: 'luxury',     rarity: 'uncommon' },
  { label: 'Fita de mão',       family: 'career',     rarity: 'common' },
  { label: 'Óculos',            family: 'casual',     rarity: 'common' },
  { label: 'Gorro',             family: 'casual',     rarity: 'common' },
  { label: 'Faixa de suor',     family: 'career',     rarity: 'common' },
  { label: 'Corrente grossa',   family: 'luxury',     rarity: 'rare' },
  // 9+
  { label: 'Óculos de sol',     family: 'luxury',     rarity: 'uncommon' },
  { label: 'Brinco',            family: 'eccentric',  rarity: 'uncommon' },
  { label: 'Piercing',          family: 'aggressive', rarity: 'uncommon' },
  { label: 'Relógio',           family: 'luxury',     rarity: 'rare' },
  { label: 'Anel',              family: 'luxury',     rarity: 'uncommon' },
  { label: 'Chapéu',            family: 'casual',     rarity: 'uncommon' },
  { label: 'Alça de mochila',   family: 'casual',     rarity: 'common' },
  { label: 'Corrente de título', family: 'career',    rarity: 'legendary' },
  { label: 'Apito de coach',    family: 'career',     rarity: 'rare' },
  { label: 'Pulseira de origem', family: 'cultural',  rarity: 'rare' },
];

// Ordem canônica — editor + gerador + DEFAULT_APPEARANCE
export const APPEARANCE_CATEGORIES = [
  { key: 'skinTone',     label: 'Tom de pele',   options: SKIN_TONES,     swatch: true,  group: 'rosto' },
  { key: 'faceShape',    label: 'Formato rosto', options: FACE_SHAPES,                   group: 'rosto' },
  { key: 'bodyType',     label: 'Físico',        options: BODY_TYPES,                    group: 'corpo' },
  { key: 'hairStyle',    label: 'Cabelo',        options: HAIR_STYLES,                   group: 'cabelo' },
  { key: 'hairColor',    label: 'Cor do cabelo', options: HAIR_COLORS,    swatch: true,  group: 'cabelo' },
  { key: 'beardStyle',   label: 'Barba',         options: BEARD_STYLES,                  group: 'cabelo' },
  { key: 'browStyle',    label: 'Sobrancelha',   options: BROW_STYLES,                   group: 'rosto' },
  { key: 'eyeShape',     label: 'Olhar',         options: EYE_SHAPES,                    group: 'rosto' },
  { key: 'eyeColor',     label: 'Cor dos olhos', options: EYE_COLORS,     swatch: true,  group: 'rosto' },
  { key: 'noseStyle',    label: 'Nariz',         options: NOSE_STYLES,                   group: 'rosto' },
  { key: 'mouthStyle',   label: 'Boca',          options: MOUTH_STYLES,                  group: 'rosto' },
  { key: 'earStyle',     label: 'Orelhas',       options: EAR_STYLES,                    group: 'rosto' },
  { key: 'scarStyle',    label: 'Cicatrizes',    options: SCAR_STYLES,                   group: 'marcas' },
  { key: 'faceMarks',    label: 'Marcas',        options: FACE_MARKS,                    group: 'marcas' },
  { key: 'tattooStyle',  label: 'Tatuagem',      options: TATTOO_STYLES,                 group: 'marcas' },
  { key: 'outfitStyle',  label: 'Roupa',         options: OUTFIT_STYLES,                 group: 'estilo' },
  { key: 'trunksColor',  label: 'Cor principal', options: TRUNKS_COLORS,  swatch: true,  group: 'estilo' },
  { key: 'accentColor',  label: 'Detalhe',       options: ACCENT_COLORS,  swatch: true,  group: 'estilo' },
  { key: 'accessory',    label: 'Acessório',     options: ACCESSORY_STYLES,              group: 'estilo' },
];

export const APPEARANCE_GROUPS = [
  { id: 'rosto',  label: 'Rosto',  icon: '👤' },
  { id: 'cabelo', label: 'Cabelo', icon: '💇' },
  { id: 'corpo',  label: 'Corpo',  icon: '💪' },
  { id: 'marcas', label: 'Marcas', icon: '⚔️' },
  { id: 'estilo', label: 'Estilo', icon: '👕' },
];

export const DEFAULT_APPEARANCE = Object.fromEntries(
  APPEARANCE_CATEGORIES.map(c => [c.key, 0])
);

// Índices úteis pro gerador com viés (evita magic numbers espalhados)
export const APPEARANCE_BIAS = {
  HAIR_GREY: 5,
  HAIR_PLATINUM: 6,
  HAIR_WHITE: 11,
  SCAR_NONE: 0,
  SCAR_VETERAN: 7,
  EAR_CAULIFLOWER: 1,
  OUTFIT_OCTAGON: 0,
  OUTFIT_GI: 5,
  OUTFIT_SUIT: 12,
  OUTFIT_LEATHER: 11,
  OUTFIT_SIMPLE: 16,
  ACCESSORY_SUNGLASSES: 9,
  ACCESSORY_TITLE_CHAIN: 16,
  ACCESSORY_NONE: 0,
  OUTFIT_HOODIE: 4,
  BEARD_CLEAN: 0,
  BEARD_FULL: 4,
};

// Acessórios que cobrem o topo da cabeça (boné, gorro, chapéu) — cabelo
// alto por baixo deles atravessava o desenho. O render rebaixa o cabelo
// frontal pra silhueta curta quando um destes está equipado.
export const HEADWEAR_ACCESSORY_IDXS = [2, 6, 14];

// Estilos de cabelo com volume acima da linha do chapéu (moicano, coque,
// black power, afro, bagunçado, top knot, pompadour).
export const TALL_HAIR_IDXS = [3, 4, 5, 14, 16, 19, 22];
