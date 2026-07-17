// ============================================================
// GAME CONFIG — única fonte de verdade para balanceamento.
// Todo número de tuning do modo academia vive aqui; nenhuma
// mecânica deve hardcodar valores de economia/progresso.
// ============================================================

// Carreira de 1 lutador — não há mais academia-negócio do jogador. "Quem
// é o lutador do jogador" é identidade (`gameState.career.playerFighterId`),
// não posse de academia — ver
// `docs/superpowers/specs/2026-07-13-carreira-sistemica-1-lutador-design.md` §A.6.

// Estrutura de uma Academia — cada nível de instalação muda o bônus de
// treino e recuperação de quem treina lá (você ou IA). Não é mais algo
// que se compra por upgrade: é um atributo da Academia que você escolhe.
export const FACILITY_LEVELS = [
  { level: 1, name: 'Galpão Improvisado', trainingBonus: 0, recoveryBonus: 0 },
  { level: 2, name: 'Academia Equipada', trainingBonus: 0.15, recoveryBonus: 3 },
  { level: 3, name: 'Centro de Alto Rendimento', trainingBonus: 0.30, recoveryBonus: 6 },
  { level: 4, name: 'Complexo Elite Mundial', trainingBonus: 0.45, recoveryBonus: 10 },
];

// Catálogo de academias — lugares no mundo, sem dono. `specialties`
// amplifica o ganho de atributos do foco de treino correspondente
// (substitui COACH_CONFIG de hoje, que era contratação avulsa).
// `weeklyFee` é cobrado do caixa PESSOAL do lutador enquanto treina lá.
// Academia pequena (facilityLevel baixo) cresce sinergia com o técnico
// mais rápido — ver `SYNERGY_CONFIG` — mas tem teto de treino mais baixo.
export const ACADEMIES = [
  {
    id: 'academy-blacktiger', name: 'Black Tiger Academy', reputation: 30,
    facilityLevel: 1, weeklyFee: 150, philosophy: 'Atenção individual',
    specialties: { striking: 0.10, grappling: 0.15, cardio: 0.10 },
    headCoach: { name: 'Sensei Paulo', personality: 'cautious' },
  },
  {
    id: 'academy-fortaleza', name: 'Fortaleza MMA', reputation: 45,
    facilityLevel: 2, weeklyFee: 400, philosophy: 'Tradicional',
    specialties: { striking: 0.20, grappling: 0.30, cardio: 0.15 },
    headCoach: { name: 'Mestre Diego', personality: 'analytical' },
  },
  {
    id: 'academy-elite', name: 'Elite Combat Team', reputation: 55,
    facilityLevel: 3, weeklyFee: 1200, philosophy: 'Alto rendimento',
    specialties: { striking: 0.30, grappling: 0.25, cardio: 0.30 },
    headCoach: { name: 'Coach Marcus', personality: 'aggressive' },
  },
];

// Sinergia técnico-atleta — ver spec §C.2. Ao trocar de Academia, a
// sinergia não zera nem é herdada inteira: `current * CARRY_OVER_RATIO`.
// Academia de facilityLevel baixo cresce sinergia mais rápido (menos
// atletas por treinador = mais atenção) — GROWTH_RATE_BY_FACILITY indexa
// por `facilityLevel - 1`, espelhando FACILITY_LEVELS.
export const SYNERGY_CONFIG = {
  CARRY_OVER_RATIO: 0.4,
  GROWTH_RATE_BY_FACILITY: [1.3, 1.0, 0.8, 0.6],
  GAIN_ON_INSTRUCTION_FOLLOWED_AND_WON: 4,
  LOSS_ON_INSTRUCTION_IGNORED_AND_LOST: -3,
};

// Empresários — ver spec §C.1. `cut` é a fração da bolsa retida antes do
// caixa pessoal (substitui GYM_CONFIG.MANAGER_CUT de hoje, que ficava
// com a academia). `connections` acelera auto-descoberta de DNA (§B.1) e
// dá conhecimento de base sobre adversários (substitui SCOUT_CONFIG de
// hoje, que era um olheiro comprado pela academia).
export const MANAGERS = [
  { id: 'manager-loyal', name: 'Renata Alves', style: 'loyal', cut: 0.12, connections: 30 },
  { id: 'manager-conservative', name: 'João Bittencourt', style: 'conservative', cut: 0.10, connections: 40 },
  { id: 'manager-aggressive', name: 'Marcelo Duarte', style: 'aggressive', cut: 0.15, connections: 60 },
];

export const MANAGER_CONFIG = {
  STARTING_TRUST: 50,
  TERMINATE_FINE_RATIO: 0.5, // igual à multa de rescisão de promoção (NEGOTIATION/ContractService)
  AGGRESSIVE_LEVERAGE_BONUS: 0.3, // soma na leverage de negociação de bolsa
  AGGRESSIVE_RESCIND_BONUS: 0.15, // soma na chance da promoção cancelar a oferta
  CONSERVATIVE_LEVERAGE_PENALTY: -0.2,
  BASELINE_SCOUTING_FROM_CONNECTIONS: 45, // connections acima disto dá SCOUTING_CONFIG.BASELINE_WITH_SCOUT
};

// Custo de vida pessoal — ver spec §E.1. Subir de tier dá pequeno bônus
// de moral/popularidade (aparência de sucesso); descer depois de ter
// subido custa moral (perda de status).
export const LIFESTYLE_TIERS = {
  modest: { label: 'Modesto', weeklyCost: 200, moraleBonus: 0, popularityBonus: 0 },
  comfortable: { label: 'Confortável', weeklyCost: 600, moraleBonus: 3, popularityBonus: 1 },
  luxurious: { label: 'Luxuoso', weeklyCost: 2500, moraleBonus: 6, popularityBonus: 3 },
};
export const LIFESTYLE_DOWNGRADE_MORALE_PENALTY = 15;

export const POTENTIAL_TIERS = [
  { min: 80, label: 'Elite', cls: 'badge-success' },
  { min: 60, label: 'Alto', cls: 'badge-info' },
  { min: 40, label: 'Médio', cls: 'badge-warning' },
  { min: 0, label: 'Baixo', cls: 'badge-danger' },
];

// Foco de treino por lutador — usado no seletor individual (Minha Equipe)
export const TRAINING_FOCUS_META = {
  striking: { label: 'Striking', icon: '🥊', attrs: ['boxing', 'kickboxing', 'muayThai'] },
  grappling: { label: 'Grappling', icon: '🤼', attrs: ['wrestling', 'bjj'] },
  cardio: { label: 'Cardio', icon: '🫁', attrs: ['cardio'] },
  recovery: { label: 'Recuperação', icon: '💆', attrs: [] },
};

export const DIFFICULTIES = [
  { id: 'easy', name: 'Reserva Confortável', cash: 12000, desc: 'Poupança folgada para errar sem medo' },
  { id: 'normal', name: 'Prospecto Profissional', cash: 6000, desc: 'A experiência equilibrada' },
  { id: 'challenging', name: 'Desafiante', cash: 3000, desc: 'Cada dólar exige planejamento' },
  { id: 'hard', name: 'Só o Sonho', cash: 800, desc: 'Cada dólar conta' },
];

// Arquétipo inicial e origem esportiva (§A.7) — viés leve nos atributos
// iniciais via Fighter.expandAttributes. `seedBonus` eleva a base (que o
// jitter/spread de expandAttributes usa pra derivar o resto) antes da
// geração; não é um valor final, só empurra a média de partida.
export const ARCHETYPES = {
  striker: { label: 'Striker', seedAttrs: ['boxing', 'kickboxing', 'muayThai'], seedBonus: 15 },
  grappler: { label: 'Grappler', seedAttrs: ['wrestling', 'bjj'], seedBonus: 15 },
  brawler: { label: 'Brawler', seedAttrs: ['power', 'chin', 'aggression'], seedBonus: 15 },
  generalist: { label: 'Generalista', seedAttrs: [], seedBonus: 0 },
};

export const ORIGINS = {
  kickboxing: { label: 'Kickboxing', seedAttrs: ['kickboxing', 'footwork'], seedBonus: 10 },
  judo: { label: 'Judô', seedAttrs: ['wrestling', 'takedowns'], seedBonus: 10 },
  wrestling: { label: 'Wrestling', seedAttrs: ['wrestling', 'takedowns', 'strength'], seedBonus: 10 },
  muayThai: { label: 'Muay Thai', seedAttrs: ['muayThai', 'clinch'], seedBonus: 10 },
  bjj: { label: 'Jiu-Jitsu', seedAttrs: ['bjj', 'submissionOffense'], seedBonus: 10 },
  boxing: { label: 'Boxe', seedAttrs: ['boxing', 'headMovement'], seedBonus: 10 },
};

// Divisões usadas na geração do mundo — concentra lutadores para
// garantir matchmaking viável dentro de cada promoção.
export const CORE_WEIGHT_CLASSES = [
  'Bantamweight',
  'Featherweight',
  'Lightweight',
  'Welterweight',
  'Middleweight',
];

// Promoções de IA. tier 1 = topo mundial; tier 3 = circuito regional.
// skill = faixa de baseSkill dos lutadores gerados para o roster.
// Rosters dimensionados para o ritmo realista de ~3-5 lutas/ano por
// atleta: cards continuam cheios mesmo com longos descansos entre lutas.
export const PROMOTIONS = [
  { id: 'promo-afc', name: 'Apex Fighting Championship', short: 'AFC', tier: 1, reputation: 92, cadenceWeeks: 4, rosterSize: 44, skill: [58, 82] },
  { id: 'promo-pfc', name: 'Pride Fighting Championship', short: 'PFC', tier: 2, reputation: 68, cadenceWeeks: 4, rosterSize: 36, skill: [46, 66] },
  { id: 'promo-gce', name: 'Global Combat Elite', short: 'GCE', tier: 2, reputation: 61, cadenceWeeks: 4, rosterSize: 36, skill: [44, 62] },
  { id: 'promo-ifp', name: 'Iron Fist Promotions', short: 'IFP', tier: 3, reputation: 38, cadenceWeeks: 3, rosterSize: 28, skill: [32, 52] },
  { id: 'promo-vtr', name: 'Vale Tudo Regional', short: 'VTR', tier: 3, reputation: 27, cadenceWeeks: 3, rosterSize: 28, skill: [28, 48] },
];

// Posição no card do evento — reflete a visibilidade da luta dentro do
// card. A posição sobe com a popularidade: Main Event só para os maiores
// nomes, Co-Main para nomes consolidados, Featured Prelim para quem já
// tem algum reconhecimento. Title fights são sempre Main Event.
export const CARD_POSITION = {
  main_event: { label: 'Main Event', shortLabel: 'Main', badge: 'badge-danger', popMin: 80 },
  co_main: { label: 'Co-Main Event', shortLabel: 'Co-Main', badge: 'badge-warning', popMin: 60 },
  featured_prelim: { label: 'Featured Prelim', shortLabel: 'Featured', badge: 'badge-info', popMin: 35 },
  preliminary: { label: 'Preliminar', shortLabel: 'Prelim', badge: 'badge-secondary', popMin: 0 },
};

export const OFFER_CONFIG = {
  // Chance semanal de um lutador livre da equipe receber oferta.
  // Calibrada para ~2-3 lutas por ano por atleta (no MMA real um
  // atleta ativo faz no máximo 3-4).
  WEEKLY_OFFER_CHANCE: 0.5,
  // Épico F3: chance de uma oferta armar o REENCONTRO com um ex-atleta da
  // academia (só dispara se houver ex-atleta elegível na mesma divisão).
  REUNION_CHANCE: 0.3,
  // Semanas mínimas entre a oferta e a luta — um fight camp de verdade
  MIN_WEEKS_NOTICE: 6,
  // Semanas máximas entre a oferta e a luta (usado para sortear aviso)
  MAX_WEEKS_NOTICE: 10,
  // Semanas até a oferta expirar
  EXPIRY_WEEKS: 3,
  // Diferença máxima de OVR preferida ao escolher adversário
  OPPONENT_OVR_WINDOW: 8,

  // P4.2: Ofertas Short Notice — ~10% das ofertas são de última hora,
  // com 2-3 semanas de aviso e bolsa 1.75x mais alta.
  SHORT_NOTICE: {
    CHANCE: 0.10,
    MIN_WEEKS: 2,
    MAX_WEEKS: 3,
    PURSE_MULT: 1.75,
    WIN_BONUS_MULT: 1.5,
  },

  // P4.3: Super fight — luta entre campeões de promoções diferentes.
  // Ativada quando a popularidade do lutador ultrapassa 85.
  SUPER_FIGHT: {
    POPULARITY_THRESHOLD: 85,
    CHANCE_PER_WEEK: 0.08,      // 8% chance por semana quando elegível
    PURSE_MULT: 2.5,            // 2.5x a bolsa normal
    POPULARITY_GAIN: 10,        // popularidade extra se vencer
    MIN_OVR: 75,                // oponente precisa ter pelo menos este OVR
  },

  // P4.3: Mudança de peso — o lutador pode subir/descer uma categoria.
  // Decisão significativa com custo e período de lockout.
  WEIGHT_MOVE: {
    MIN_LOYALTY: 40,            // precisa ter pelo menos essa lealdade
    PURSE_REDUCTION: 0.7,       // bolsa inicial na nova divisão é 70%
    RECOMMIT_WEEKS: 8,          // semanas até poder voltar ao peso anterior
    POPULARITY_THRESHOLD: 60,   // mínimo de popularidade para tentar
  },

  // Requisitos para receber ofertas de cada tier.
  // Wins calibrados para o ritmo de ~3-4 lutas/ano: subir de tier leva
  // temporadas, não meses.
  TIER_GATES: {
    3: { popularity: 0, wins: 0, gymRep: 0 },
    2: { popularity: 40, wins: 5, gymRep: 30 }, // popularity OU wins, E gymRep
    1: { popularity: 65, wins: 9, gymRep: 55 },
  },
  // Chance de a oferta vir do tier mais alto elegível (senão desce um tier)
  TOP_TIER_CHANCE: 0.35,

  // Bolsas por tier: base + popularidade * fator
  PURSE: {
    1: { base: 15000, perPop: 400 },
    2: { base: 2800, perPop: 90 },
    3: { base: 800, perPop: 25 },
  },
  WIN_BONUS_RATIO: 0.5,
};

// Épico F1: cada ponto de hype gerado na coletiva vale este valor
// em dólar de bônus na bolsa da luta (purse + winBonus).
export const HYPE_PURSE_RATIO = 50;

// Fase 1: bônus pós-luta (FOTN/POTN) — recompensa extra por desempenho
export const POST_FIGHT_BONUSES = {
  FIGHT_OF_NIGHT: { label: 'Fight of the Night', purseBonus: 0.50, popularityGain: 5 },
  PERFORMANCE_OF_NIGHT: { label: 'Performance of the Night', purseBonus: 0.50, popularityGain: 3 },
};

// Épico F2: penalidades e pesos de expectativas de atletas
export const EXPECTATION_CONFIG = {
  // Dano semanal de moral/loyalty quando expectativa em urgência 3 está ativa
  MORALE_DAMAGE_URGENT: 5,   // -5 de morale por semana
  LOYALTY_DAMAGE_URGENT: 2,  // -2 de loyalty por semana

  // A cada quantas semanas reavaliar (existente: 4)
  CHECK_INTERVAL: 4,
};

export const WORLD_CONFIG = {
  FREE_AGENT_POOL: 14,
  FREE_AGENT_MIN: 8,
  // Quantos lutadores do mundo treinam numa academia. Alto de propósito: a sala
  // de treino do jogador precisa ter gente dentro dela desde a semana 1 (§3b).
  ACADEMY_AFFILIATION_CHANCE: 0.6,
  AI_FIGHTS_PER_EVENT: 5, // lutas de IA por evento (fora as do jogador)

  // Lesões pós-luta
  INJURY_CHANCE_LOSER: 0.12,
  INJURY_CHANCE_WINNER: 0.04,
  INJURY_CHANCE_FINISH_BONUS: 0.1, // extra se perdeu por KO/TKO/Sub
  INJURY_CHANCE_PRONE_BONUS: 0.08, // extra com DNA injuryProne
  INJURY_WEEKS_MIN: 2,
  INJURY_WEEKS_MAX: 6,

  // §B.2 — lesão >= este tanto de semanas rola chance de sequela permanente
  SCAR_SEVERE_WEEKS_THRESHOLD: 5,
  SCAR_CHANCE_LIGHT: 0.05,
  SCAR_CHANCE_SEVERE: 0.20,

  // Draft anual (semana 52)
  DRAFT_MIN: 5,
  DRAFT_MAX: 10,

  // Fase 1: teto de população — acima disto, veteranos irrelevantes são
  // aposentados forçadamente para evitar degradação da performance.
  POPULATION_CAP: 300,
};

// §B.2 — sequelas permanentes de lesão. Cada entrada reduz o TETO
// (Fighter.effectiveCeiling) de alguns atributos e compensa um pouco em
// outro (a dor ensina a lutar diferente) — nunca mexe no valor atual.
export const PERMANENT_SCAR_TABLE = [
  { bodyPart: 'joelho', attributeCeilings: { takedowns: -8, wrestling: -5 }, compensation: { fightIQ: 3 } },
  { bodyPart: 'mão', attributeCeilings: { power: -6, boxing: -4 }, compensation: { fightIQ: 2 } },
  { bodyPart: 'costela', attributeCeilings: { cardio: -6 }, compensation: { composure: 3 } },
  { bodyPart: 'cervical', attributeCeilings: { chin: -5, durability: -5 }, compensation: { adaptability: 3 } },
];

// §B.1 — auto-descoberta de DNA. Traços booleanos se descobrem em
// gatilhos de jogo (ver world-service.js/fighter.js); os 3 hidden
// numéricos (potential/discipline/determination) se descobrem em bloco
// depois de lutas suficientes pra ter uma amostra real de evolução.
export const DNA_DISCOVERY_CONFIG = {
  NUMERIC_REVEAL_AT_FIGHTS: 5,
  INJURY_PRONE_WINDOW_WEEKS: 52,
  BIG_MORALE_SWING_THRESHOLD: 20,
};

// Magnitude (0-100) da entrada 'dna_discovered' no careerLog (§F) — os
// traços de pressão psicológica só se revelam num momento de fato dramático
// (§C.3), por isso pesam mais que a revelação em bloco dos 3 numéricos.
export const DNA_DISCOVERY_MAGNITUDE = {
  pressurePerformer: 65,
  bigEventNervous: 65,
  exceptionalRecovery: 45,
  injuryProne: 50,
  emotionallyUnstable: 50,
  potential: 40,
  discipline: 40,
  determination: 40,
};

// Fase 1b: escada de tiers pra lutadores de IA (espelha o Épico B do
// jogador — sem isto, os elencos de Nacional/Elite ficam fixos desde o
// bootstrap do mundo pra sempre, e um prospecto regional nunca sobe).
// Roda uma vez por ano, junto com o draft de prospectos.
export const TIER_MOVEMENT_CONFIG = {
  // Quantas promoções por tier (acima) cada promoção pode receber por ano —
  // mantém a subida gradual, não uma inundação de novatos de uma vez.
  MAX_PROMOTIONS_PER_YEAR: 3,
  // Quantos lutadores uma promoção relega por ano quando está cheia e
  // precisa abrir vaga pra quem subiu — é a reciclagem: sempre tem alguém
  // descendo quando alguém sobe.
  MAX_RELEGATIONS_PER_YEAR: 3,
};

export const TIER_LABELS = {
  1: 'Elite Mundial',
  2: 'Nacional',
  3: 'Regional',
};

// ============================================================
// CINTURÕES — o cume da escada.
// Cada promoção tem um campeão por divisão. Vencer dentro de uma
// promoção te faz desafiante; vencer o campeão te dá o cinturão.
// ============================================================
export const TITLE_CONFIG = {
  // Quem disputa o cinturão não é "quem venceu N lutas" — é o DESAFIANTE
  // MANDATÓRIO: o melhor colocado no ranking daquela divisão, dentro
  // daquela promoção, que esteja disponível e que ainda não tenha perdido
  // para o campeão atual. Vencer 4 seguidas contra ninguém não te leva lá.
  SHOT_MIN_PROMO_WINS: 2,   // piso de credencial: precisa ter lutado ali
  SHOT_MIN_STREAK: 1,       // não se pede título vindo de uma derrota
  SHOT_COOLDOWN_WEEKS: 8,   // após perder um título, espere antes de nova chance

  // Fora do top 5 só se chega ao cinturão sendo um fenômeno em ascensão —
  // e ainda assim só se todos acima estiverem indisponíveis ou já batidos.
  CONTENDER_MAX_RANK: 5,
  LONGSHOT_MIN_STREAK: 4,

  // Um desafiante que perdeu para o campeão atual vai para o fim da fila.
  // Se não sobrar mais ninguém, a revanche acontece.
  REMATCH_BLOCK_FIGHTS: 4,

  PURSE_MULTIPLIER: 2.5,
  WIN_BONUS_MULTIPLIER: 2,

  REP_ON_TITLE_WIN: 12,
  REP_ON_DEFENSE: 5,
  REP_ON_TITLE_LOSS: -4,

  POPULARITY_ON_TITLE_WIN: 18,
  POPULARITY_ON_DEFENSE: 8,

  // A IA disputa um cinturão a cada N eventos de cada promoção
  AI_TITLE_FIGHT_EVERY: 4,

  // Campeão lesionado entre a oferta de título e a data da luta (item
  // "fico preso lutando com o campeão machucado por anos"): indisponível
  // por poucas semanas -> adia o evento, título intacto. Mais que isso ->
  // a luta já marcada vira disputa de cinturão INTERINO em vez de virar um
  // treino qualquer sem valor nenhum.
  POSTPONE_MAX_WEEKS: 6,
};

export const TITLE_ROLE = {
  CHALLENGE: 'challenge', // você desafia o campeão
  DEFENSE: 'defense',     // você é o campeão e defende
  VACANT: 'vacant',       // cinturão vago
};

// Descanso pós-luta — suspensão médica + recuperação + intervalo natural
// entre camps. No MMA real um atleta ativo faz no máximo 3-4 lutas por
// ano; o afastamento cresce com a violência do desfecho (nocaute >
// finalização > decisão).
export const SUSPENSION_CONFIG = {
  DECISION_WEEKS: 8,
  FINISH_WIN_WEEKS: 10,
  SUBMISSION_LOSS_WEEKS: 12,
  KO_TKO_LOSS_WEEKS: 16,
};

export function computeSuspensionWeeks(method, won) {
  const isFinish = method && !method.startsWith('Decision');
  if (!isFinish) return SUSPENSION_CONFIG.DECISION_WEEKS;
  if (won) return SUSPENSION_CONFIG.FINISH_WIN_WEEKS;
  return method === 'Submission' ? SUSPENSION_CONFIG.SUBMISSION_LOSS_WEEKS : SUSPENSION_CONFIG.KO_TKO_LOSS_WEEKS;
}

// ============================================================
// FATIA 2 — A PREPARAÇÃO
// Névoa de guerra + olheiro + plano de jogo.
// Você conhece seus próprios atletas (treina com eles todo dia). De quem
// está do lado de fora, você só sabe o que investigou.
// ============================================================

// Níveis de conhecimento sobre um lutador de fora.
// 0 = nada · 1 = observado · 2 = estudado · 3 = dissecado
export const SCOUTING_LEVELS = [
  { level: 0, label: 'Desconhecido', spread: 14, revealsDna: false, revealsPotential: false },
  { level: 1, label: 'Observado',    spread: 8,  revealsDna: false, revealsPotential: false },
  { level: 2, label: 'Estudado',     spread: 4,  revealsDna: true,  revealsPotential: true },
  { level: 3, label: 'Dissecado',    spread: 0,  revealsDna: true,  revealsPotential: true },
];

export const SCOUTING_CONFIG = {
  // Custo de estudar o adversário, por nível alcançado (1 → 2 → 3)
  STUDY_COST: [0, 1000, 2000, 4000],
  // O olheiro contratado (gym.scoutLevel) dá conhecimento de base a todos
  BASELINE_WITH_SCOUT: 1,
  // Lutar contra alguém ensina muito sobre ele
  KNOWLEDGE_AFTER_FIGHTING: 2,
};

// Planos de jogo — escolhidos ANTES da luta, valem por todos os rounds.
// A instrução de córner ajusta round a round por cima disto.
//
// `counters` é a leitura do adversário: cada plano ganha bônus contra um
// tipo de lutador e apanha contra outro. Sem estudar o adversário você
// escolhe no escuro — e é esse o ponto.
export const GAME_PLANS = {
  balanced: {
    label: 'Luta Equilibrada', icon: '⚖️',
    desc: 'Sem plano específico. Nenhum bônus, nenhum risco.',
    strikingMod: 1.0, grapplingMod: 1.0, cardioMod: 1.0, chinMod: 1.0,
    strongVs: null, weakVs: null,
  },
  striker: {
    label: 'Manter em Pé', icon: '🥊',
    desc: 'Sprawl e trocação. Sufoca quem só sabe lutar no chão.',
    strikingMod: 1.12, grapplingMod: 0.9, cardioMod: 1.0, chinMod: 1.0,
    strongVs: 'grappler', weakVs: 'striker',
  },
  grappler: {
    label: 'Levar para o Chão', icon: '🤼',
    desc: 'Quedas e controle. Tira o pé de quem só sabe bater.',
    strikingMod: 0.9, grapplingMod: 1.2, cardioMod: 0.95, chinMod: 1.05,
    strongVs: 'striker', weakVs: 'grappler',
  },
  pressure: {
    label: 'Sufocar no Ritmo', icon: '🔥',
    desc: 'Pressão constante. Quebra quem tem cardio fraco, morre contra quem não cansa.',
    strikingMod: 1.08, grapplingMod: 1.05, cardioMod: 0.85, chinMod: 0.95,
    strongVs: 'lowCardio', weakVs: 'highCardio',
  },
  patient: {
    label: 'Contragolpear', icon: '🛡️',
    desc: 'Espera o erro. Devora quem é impulsivo, se perde contra quem lê a luta.',
    strikingMod: 0.95, grapplingMod: 0.95, cardioMod: 1.15, chinMod: 1.12,
    strongVs: 'lowIq', weakVs: 'highIq',
  },
};

// Quanto o acerto (ou o erro) de leitura vale na performance de cada round
export const GAME_PLAN_EDGE = { strong: 0.10, weak: -0.08 };

// Escala do bônus/penalidade do plano de jogo por nível de scouting (0-4).
// Indexa por scoutingLevel: nível 0 (sem scouting) = ratio 1.0 (full edge).
export const SCOUTING_PLAN_EDGE_RATIOS = [1.0, 0.85, 0.70, 0.50, 0.30];

// ===== O Livro Sobre Você (Fase 3) =====
// O mundo passa a te estudar de volta. A tese: o plano que te faz vencer é o
// mesmo que te faz previsível. Ver spec 2026-07-14-o-livro-sobre-voce-design.
//
// Contra o que cada assinatura perde. `patient` cai pro `grappler` (não pro
// `pressure`) porque o contragolpeador vive do erro do adversário — e quem te
// leva pro chão nunca comete o erro que você está esperando.
export const COUNTER_OF = {
  striker: 'grappler',
  grappler: 'striker',
  pressure: 'patient',
  patient: 'grappler',
};

// Qual especialidade da academia ensina cada plano. Uma academia só pode
// instalar uma arma se tiver a especialidade correspondente acima do mínimo —
// é isso que faz a academia deixar de ser um bônus numérico e virar o limite
// do seu vocabulário técnico.
export const PLAN_SPECIALTY = {
  striker: 'striking',
  grappler: 'grappling',
  pressure: 'cardio',
  patient: 'striking',
};

export const TAPE_CONFIG = {
  // --- exposição: o quanto o mundo te conhece ---
  EXPOSURE_BASE_PER_FIGHT: 6,
  EXPOSURE_POPULARITY_SCALE: 0.10,
  EXPOSURE_TIER1_BONUS: 6,
  EXPOSURE_TITLE_BONUS: 8,
  EXPOSURE_ROOKIE_FIGHTS: 8,     // ninguém estuda um novato
  EXPOSURE_ROOKIE_SCALE: 0.35,
  EXPOSURE_IDLE_AFTER_WEEKS: 12, // sumir do mapa te torna um enigma de novo
  EXPOSURE_IDLE_DECAY: 1,
  EXPOSURE_NEW_WEAPON_DROP: 15,  // revelar arma nova obriga o mundo a te reestudar (era 25, reduzido para diminuir o ciclo infinito de surpresa → revelar → nova arma)

  // --- assinatura: o plano que você repete ---
  SIGNATURE_WINDOW: 5,
  SIGNATURE_THRESHOLD: 0.6,

  // --- maestria de plano: repetir afia, e entrega ---
  PLAN_MASTERY_PER_USE: 12,
  PLAN_MASTERY_DECAY_PER_FIGHT: 3,
  PLAN_MASTERY_MAX_BONUS: 0.08,

  // --- a leitura do adversário ---
  // Calibrado com harness de 2000 lutas por linha. O motor é hipersensível a
  // vantagem (~3 pontos percentuais de vitória por 0.01 de edge), então estes
  // números são pequenos de propósito. A primeira versão usava READ_EDGE 0.10
  // e derrubava a vitória de 83% pra 65% NUM ÚNICO PASSO de exposição — uma
  // escada, não uma curva.
  READ_IQ_SCALE: 200,           // 0.5 + fightIQ/200 → um burro lê mal mesmo com a fita na mão
  READ_RIVALRY_BONUS: 0.25,     // o rival te conhece por fora da fita
  READ_THRESHOLD: 0.30,         // leitura fraca não vira plano nenhum
  TAPE_READ_EDGE: 0.03,
  EDGE_CEIL: 0.12,              // teto de vantagem — simetria, não punição
  EDGE_FLOOR: -0.12,

  // --- arma nova ---
  // 0.20 (e não 0.15) porque a 0.15 a Fortaleza ensinava exatamente as mesmas
  // 4 armas que a Elite — a academia deixava de ser o limite do seu vocabulário
  // e virava só um preço diferente. A 0.20 vira uma escada de verdade:
  // Black Tiger não ensina NADA (reinventar-se exige sair de lá), Fortaleza
  // ensina 3, Elite ensina as 4.
  WEAPON_MIN_SPECIALTY: 0.20,
  // A 14/semana a arma ficava pronta em 3 semanas — barato demais para o que o
  // design cobra por ela. A 7, um jovem na Elite gasta ~6 semanas (um camp
  // inteiro) e um veterano de 37 gasta ~9 (mais que um camp): a promessa de que
  // "o velho não se reinventa por arma nova, e sim por leitura" passa a ser
  // verdade mecânica, não só texto.
  WEAPON_INSTALL_BASE: 7,       // maestria por semana de camp dedicada
  WEAPON_SYNERGY_SCALE: 1.0,    // técnico com quem você briga instala devagar
  WEAPON_ACADEMY_SPEC_BONUS: 1.5,
  WEAPON_AGE_PENALTY_FROM: 31,  // velho não aprende truque novo
  WEAPON_AGE_PENALTY_PER_YEAR: 0.06,
  WEAPON_READY_MASTERY: 60,
  WEAPON_RAW_PENALTY: 0.12,     // arma crua é pior que não ter plano
  WEAPON_SURPRISE_BONUS: 0.04,
  WEAPON_CAMP_GAIN_SCALE: 0.35, // o camp de instalação ainda treina, só que mal

  // --- isca ---
  // A isca não te deixa mais forte: ela deixa o ADVERSÁRIO fora de posição.
  // Ele preparou uma luta inteira contra um estilo que não apareceu, e é isso
  // que `BAIT_OPPONENT_PENALTY` representa. Premiar o jogador em vez de punir
  // quem se comprometeu não funcionou: medido, a isca ficava negativa para
  // TODO perfil (-15 a -17pp), porque iscar custa o bônus de maestria e o
  // counter evitado valia menos que ele. Ninguém usaria.
  //
  // Com a punição do lado certo e a chance realmente presa ao fightIQ, o
  // resultado bate com a intenção do design: o veterano de leitura alta lucra
  // com a isca, o especialista de IQ médio não. Ele tem que se reinventar por
  // arma nova — que é justamente o que a idade tira dele.
  BAIT_BASE: 0.10,
  BAIT_IQ_SCALE: 0.009,         // fightIQ é oculto: descobrir que ele é burro custa uma luta
  BAIT_REWARD: 0.04,
  BAIT_OPPONENT_PENALTY: -0.15,
  BAIT_PENALTY: -0.05,

  // --- careerLog ---
  FIGURED_OUT_READ: 0.60,       // duas derrotas seguidas sob leitura alta = decifrado
  REINVENTION_WINS: 3,

  // --- o vazamento (Fase 3b) ---
  // Quem dividiu o tatame com você não precisa da fita. A exposição pública é
  // uma coisa; o cara que te viu treinar todo dia por 8 semanas é outra — dele
  // não há arma nova que se esconda. É o custo humano de ter sparring bom.
  // Medido: a 0.04/semana (cap 0.35), 8 semanas de sparring derrubavam a
  // vitória de 67% para 43%. Isso não é uma consequência, é uma proibição —
  // "treinar sozinho" viraria a estratégia dominante e a sala de treino inteira
  // morreria antes de existir. A 0.015 (cap 0.15) o vazamento continua sendo um
  // preço real de ter bom sparring, sem tornar o parceiro um erro.
  READ_SPARRING_PER_WEEK: 0.015,
  READ_SPARRING_CAP: 0.15,
  // A arma nova não surpreende quem estava do outro lado dela no treino.
  WEAPON_SEEN_SPARRING_WEEKS: 3,
};

// ===== A sala de treino viva (Fase 3b) =====
// Os companheiros de academia deixam de ser "cor local" e viram pessoas.
export const PARTNER_CONFIG = {
  BOND_DEFAULT: 30,
  BOND_PER_WEEK: { light: 2, moderate: 3, intense: 4 },
  BOND_ON_INJURY: -25,          // você acabou com a preparação dele
  BOND_AFTER_BETRAYAL: 0,       // aceitar lutar contra ele não deixa vínculo
  BOND_ON_LOYALTY: 20,          // recusar lutar contra ele custa a bolsa, não a pessoa
  MORALE_ON_LOYALTY: 6,
  BETRAYAL_LOG_MIN_BOND: 50,    // abaixo disso não era amizade, era divisão de tatame

  // Osmose: você rouba um pedaço do jogo de quem te bate — mas só de quem
  // gosta de você. Um parceiro ressentido não te ensina, só te machuca.
  OSMOSIS_BASE_CHANCE: 0.30,
  OSMOSIS_INTENSITY: { light: 0.5, moderate: 1.0, intense: 1.5 },

  // Sparring duro machuca gente de verdade. O parceiro tem carreira própria.
  PARTNER_INJURY_CHANCE: { light: 0.005, moderate: 0.02, intense: 0.06 },
  PARTNER_INJURY_MIN_WEEKS: 2,
  PARTNER_INJURY_SPREAD: 5,

  // Não se instala wrestling sem alguém que saiba wrestling te jogando no chão.
  WEAPON_PARTNER_MIN_SCORE: 55,
  WEAPON_PARTNER_BOOST: 0.40,
};

// Instruções de córner — escolhidas pelo jogador entre rounds na luta ao
// vivo. Afetam apenas o lutador da academia (córner A); o adversário luta
// no automático. fatigueMod acumula um débito de stamina para os rounds
// seguintes; chinMod altera a chance de ser finalizado no round.
export const CORNER_INSTRUCTIONS = {
  balanced: { label: 'Manter o Ritmo', icon: '⚖️', desc: 'Sem ajustes — segue o planejado', strikingMod: 1.0, grapplingMod: 1.0, fatigueMod: 1.0, chinMod: 1.0 },
  aggressive: { label: 'Pressionar', icon: '🔥', desc: '+ volume ofensivo, + desgaste, + risco de contragolpe', strikingMod: 1.18, grapplingMod: 1.05, fatigueMod: 1.35, chinMod: 0.92 },
  defensive: { label: 'Recuar e Pontuar', icon: '🛡️', desc: '− dano recebido, − desgaste, menos volume ofensivo', strikingMod: 0.85, grapplingMod: 0.85, fatigueMod: 0.75, chinMod: 1.12 },
  wrestle: { label: 'Levar para o Chão', icon: '🤼', desc: '+ quedas e controle, leve queda no striking', strikingMod: 0.92, grapplingMod: 1.3, fatigueMod: 1.1, chinMod: 1.0 },
};

// Negociação de bolsa — o jogador pode pedir um aumento sobre a oferta
// original. Quanto maior o pedido em relação à "força de barganha" do
// lutador/academia, maior o risco da promoção recusar ou cancelar tudo.
export const NEGOTIATION_CONFIG = {
  BUMP_OPTIONS: [0.10, 0.20, 0.35],
  BASE_ACCEPT_LEVERAGE: 0.5, // leverage máxima (1.0) aceita até +50%
  RESCIND_MARGIN: 0.15, // margem acima do teto antes de arriscar cancelamento
  RESCIND_CHANCE: 0.4,
};

// Momentos críticos na simulação de luta ao vivo — gera eventos discretos
// por round (golpes, quedas, finalizações, clinch, knockdowns) que são
// exibidos durante o Live Fight Hub. Puramente apresentação: não altera
// o resultado da luta nem o placar.
export const MOMENT_CONFIG = {
  MOMENTS_PER_ROUND_MIN: 2,
  MOMENTS_PER_ROUND_MAX: 4,
  MOMENT_TYPES: {
    strike: { weight: 40, attrOffense: 'power', attrDefense: 'chin' },
    takedown: { weight: 20, attrOffense: 'takedowns', attrDefense: 'takedownDefense' },
    submission: { weight: 10, attrOffense: 'submissionOffense', attrDefense: 'submissionDefense' },
    clinch: { weight: 15, attrOffense: 'clinch', attrDefense: 'clinch' },
    knockdown: { weight: 15, attrOffense: 'power', attrDefense: 'chin' },
  },
};

// Rótulos de conquistas — reutilizados no toast semanal e no resumo de
// período (simulação de várias semanas de uma vez).
export const MILESTONE_LABELS = {
  firstFight: '🥊 Estreia Profissional!',
  firstWin: '🎉 Primeira Vitória!',
  fiveWins: '🔥 5 Vitórias da Equipe!',
  tenWins: '💪 10 Vitórias da Equipe!',
  firstFinish: '💥 Primeira Finalização!',
  firstTier2: '📺 Palco Nacional!',
  firstTier1: '⭐ Elite Mundial!',
  popularity50: '🌟 Nome Conhecido no Meio!',
  popularity80: '👑 Superstar do MMA!',
  firstTitleShot: '🎯 Primeira Disputa de Cinturão!',
  firstBelt: '🏆 CAMPEÃO! Primeiro Cinturão da Academia!',
  firstDefense: '🛡️ Primeira Defesa de Cinturão!',
  worldChampion: '🌍 Campeão Mundial! Cinturão da Elite!',
};

// Patrocínios pessoais — ver spec §E.2. Renda recorrente com meta de médio
// prazo ("vença N lutas até a semana X"). Marcas melhores exigem mais
// popularidade PESSOAL (antes era reputação da academia). `imageClause`:
// 'clean' cancela o contrato se você acumular provocações demais nas
// redes (§D.2); 'villain' paga melhor mas exige manter hype/provocação
// ativa pra renovar.
export const SPONSOR_CONFIG = {
  WEEKLY_OFFER_CHANCE: 0.15, // chance semanal de uma marca te procurar
  MAX_ACTIVE: 2,             // contratos simultâneos
  OFFER_EXPIRY_WEEKS: 4,
  COOLDOWN_WEEKS: 8,         // semanas sem novas ofertas após um contrato encerrar (anti-chaining)
  POPULARITY_PER_GOAL_MET: 2,
  POPULARITY_PER_GOAL_FAILED: -1,
  CLEAN_CLAUSE_PROVOCATION_LIMIT: 2, // provocações públicas no período tolerado antes de cancelar
  VILLAIN_CLAUSE_MIN_PROVOCATIONS: 1, // provocações mínimas no período pra renovar
};

// goalWeeks recalibrado pro ritmo real de luta: ~6-9 semanas pra marcar +
// SUSPENSION_CONFIG (8-16 semanas de suspensão médica pós-luta) ≈ 20 semanas
// por ciclo de luta. Fórmula: (goalWins + 1) × 20 — o "+1" reserva um ciclo
// inteiro pra uma derrota no meio (que consome o ciclo mas não conta pra
// meta) sem estourar o prazo. Antes disso, sp-predador/sp-titan/sp-apexmedia
// pediam mais vitórias do que cabiam no prazo mesmo com 0 derrotas.
export const SPONSOR_BRANDS = [
  { id: 'sp-combate',  name: 'Combate Energy',            tier: 3, weekly: 250,  goalWins: 1, goalWeeks: 40,  bonus: 4000,  minPopularity: 0,  imageClause: null },
  { id: 'sp-ferro',    name: 'Ferro & Fibra Suplementos', tier: 3, weekly: 350,  goalWins: 2, goalWeeks: 60,  bonus: 6500,  minPopularity: 20, imageClause: null },
  { id: 'sp-valetudo', name: 'Vale Tudo Wear',            tier: 2, weekly: 600,  goalWins: 2, goalWeeks: 60,  bonus: 12000, minPopularity: 35, imageClause: 'villain' },
  { id: 'sp-predador', name: 'Predador Fightwear',        tier: 2, weekly: 800,  goalWins: 3, goalWeeks: 80,  bonus: 18000, minPopularity: 45, imageClause: 'villain' },
  { id: 'sp-titan',    name: 'Titan Performance',         tier: 1, weekly: 1500, goalWins: 3, goalWeeks: 80,  bonus: 35000, minPopularity: 60, imageClause: 'clean' },
  { id: 'sp-apexmedia',name: 'Apex Global Media',         tier: 1, weekly: 2200, goalWins: 4, goalWeeks: 100, bonus: 60000, minPopularity: 75, imageClause: 'clean' },
];

// Redes sociais como sistema contínuo — ver spec §D.2. ESTENDE o mesmo
// espírito da coletiva de imprensa (PressConference) para semanas LIVRES
// (sem luta marcada): 1-2x/mês (~15% de chance por semana livre) surge um
// prompt leve de "publicar nas redes" com 3-4 escolhas curtas. Deliberadamente
// SEPARADO de `pcHype` (isso é específico de bolsa de luta, já usado pela
// coletiva pré-luta) — aqui só popularidade/moral pequenos e diretos, mais
// (quando provoca) uma entrada no careerLog que o SponsorService já lê para
// decidir cláusulas de imagem 'clean'/'villain' (§E.2).
export const SOCIAL_CONFIG = {
  WEEKLY_CHANCE: 0.15,        // chance por semana livre (sem reserva aceita) de surgir um prompt
  PROMPT_EXPIRY_WEEKS: 3,     // some sozinho se ignorado por tempo demais
  PROVOKE_POPULARITY: 3,
  PROVOKE_MORALE_RISK: -3,
  PROVOKE_RIVALRY_INTENSITY_GAIN: 1,
  PROVOCATION_MAGNITUDE: 20,  // magnitude (0-100) da entrada no careerLog
  TITLE_SHOT_MIN_WINS: 5,     // mínimo de vitórias pra pedido soar plausível
  TITLE_SHOT_POPULARITY: 3,
  TITLE_SHOT_EMBARRASSMENT_MORALE: -4, // penalidade se pedir sem crédito nenhum
  RESPOND_CRITICS_POPULARITY: 1,       // nudge neutro, quase imperceptível
  STAY_QUIET_MORALE: 3,
};

// Pesagem pré-luta: surge na semana anterior ao evento. Não há uma escolha
// universalmente certa: o corte controlado custa energia, o normal preserva
// o estado atual e o agressivo pode render uma ótima reidratação ou cobrar
// muito caro de quem já corta peso com dificuldade.
export const WEIGH_IN_CONFIG = {
  WEEKS_BEFORE_FIGHT: 1,
  AUTO_STRATEGY: 'controlled',
  AGGRESSIVE_SUCCESS_BASE: 0.20,
  AGGRESSIVE_SUCCESS_EASE_FACTOR: 0.50,
  STRATEGIES: {
    controlled: {
      label: 'Corte controlado',
      description: 'Prioriza segurança e reduz o impacto no cardio, mas deixa um débito de energia para a luta.',
      impactMultiplier: 0.70,
      fatigueDelta: 7,
      moraleDelta: 1,
    },
    standard: {
      label: 'Plano habitual',
      description: 'Segue a rotina prevista: risco e desgaste proporcionais ao seu corte de peso.',
      impactMultiplier: 1.00,
      fatigueDelta: 2,
      moraleDelta: 0,
    },
    aggressive: {
      label: 'Corte agressivo',
      description: 'Tenta chegar mais leve e reidratar melhor. Pode sair perfeito ou comprometer a noite.',
      successImpactMultiplier: 0.35,
      failureImpactMultiplier: 1.65,
      successFatigueDelta: 0,
      failureFatigueDelta: 12,
      successMoraleDelta: 3,
      failureMoraleDelta: -5,
    },
  },
};

// Rivalidades com origem e identidade — ver spec §D.3. `Rivalry.type` deixa
// de ser sempre 'competitive': vira 'robbery' quando a luta que criou/
// reacendeu a rivalidade terminou em decisão dividida/majoritária (resultado
// controverso); vira 'grudge' quando existe uma provocação pública recente
// (careerLog §D.2, type 'provocation') mirando um dos dois lutadores; senão
// continua 'competitive' (comportamento de hoje).
export const RIVALRY_CONFIG = {
  GRUDGE_LOOKBACK_WEEKS: 10, // janela pra uma provocação recente ainda "plantar" um grudge
  GRUDGE_PRESSURE_BONUS: 20, // §C.3 — pressão extra numa revanche de rivalidade grudge
  INTERACTION_WEEKLY_CHANCE: 0.30,
  INTERACTION_PROMPT_EXPIRY_WEEKS: 2,
  HYPE_PER_INTENSITY: 3,      // luta de rival vende mais ingresso — mesmo bônus de bolsa do hype de coletiva
  REMATCH_MIN_INTENSITY: 6,   // só rivalidade "Intensa"+ tenta forçar a revanche no matchmaking
  REMATCH_CHANCE: 0.35,       // chance da promoção priorizar o rival como próximo adversário

  // Decaimento (item "sempre o mesmo cara"): intensidade só subia, nunca
  // caía — uma rivalidade que esquentou (mesmo por um motivo que já não
  // existe mais, tipo o loop de campeão lesionado) ficava permanentemente
  // no topo do sorteio pro resto da carreira. A cada DECAY_INTERVAL_WEEKS,
  // toda rivalidade ativa perde DECAY_AMOUNT — quem você continua
  // encontrando/provocando compensa com increaseIntensity(); quem ficou
  // pra trás esfria e libera espaço pra um rival novo aparecer.
  DECAY_INTERVAL_WEEKS: 8,
  DECAY_AMOUNT: 1,
};

// Presets de simulação de período (fast-forward)
export const SIMULATE_PERIOD_PRESETS = [
  { weeks: 4, label: '1 Mês' },
  { weeks: 13, label: '3 Meses' },
  { weeks: 26, label: '6 Meses' },
  { weeks: 52, label: '1 Ano' },
];

// ============================================================
// SISTEMA DE CUSTOMIZAÇÃO — Estilos, Golpes e Perks
// ============================================================

export const FIGHTING_STYLES = {
  boxer: {
    id: 'boxer', label: 'Boxer',
    desc: 'Soco afiado, footwork preciso. Perfura defesas no 1-2.',
    bonusAttrs: ['boxing', 'headMovement', 'footwork'],
    evolutionRate: { striking: 1.3, grappling: 0.8, physical: 1.0, mental: 1.0 },
    matchup: { advantage: ['muayThai'], disadvantage: ['wrestler'] },
    stylePerkId: 'fastHands',
    poolMoves: ['jab', 'cross', 'hook', 'uppercut', 'overhand', 'bodyShot', 'takedown'],
  },
  muayThai: {
    id: 'muayThai', label: 'Muay Thai',
    desc: 'Oito armas. Joelhadas, cotoveladas, clinque mortal.',
    bonusAttrs: ['muayThai', 'clinch', 'kickboxing'],
    evolutionRate: { striking: 1.2, grappling: 1.1, physical: 1.0, mental: 0.9 },
    matchup: { advantage: ['wrestler'], disadvantage: ['boxer'] },
    stylePerkId: 'eightWeapons',
    poolMoves: ['jab', 'cross', 'legKick', 'lowKick', 'headKick', 'elbow', 'knee', 'clinchKnee', 'takedown'],
  },
  wrestler: {
    id: 'wrestler', label: 'Wrestler',
    desc: 'Queda, controle, ground and pound. Ninguém te tira do chão.',
    bonusAttrs: ['wrestling', 'takedowns', 'takedownDefense', 'strength'],
    evolutionRate: { striking: 0.8, grappling: 1.4, physical: 1.2, mental: 0.9 },
    matchup: { advantage: ['boxer'], disadvantage: ['muayThai', 'bjj'] },
    stylePerkId: 'groundAndPound',
    poolMoves: ['jab', 'cross', 'takedown', 'singleLeg', 'doubleLeg', 'slam', 'groundAndPound'],
  },
  bjj: {
    id: 'bjj', label: 'BJJ',
    desc: 'Finalização letal. Do guard à montada, você tem o golpe.',
    bonusAttrs: ['bjj', 'submissionOffense', 'submissionDefense', 'groundControl'],
    evolutionRate: { striking: 0.7, grappling: 1.5, physical: 0.9, mental: 1.1 },
    matchup: { advantage: ['wrestler'], disadvantage: ['boxer'] },
    stylePerkId: 'berimbolo',
    poolMoves: ['takedown', 'groundAndPound', 'armbar', 'guillotine', 'rearNaked', 'triangle'],
  },
  freestyle: {
    id: 'freestyle', label: 'Freestyle',
    desc: 'Versátil. Sem especialidade, sem fraqueza.',
    bonusAttrs: ['fightIQ', 'adaptability'],
    evolutionRate: { striking: 1.0, grappling: 1.0, physical: 1.0, mental: 1.3 },
    matchup: { advantage: [], disadvantage: [] },
    stylePerkId: 'versatility',
    poolMoves: ['jab', 'cross', 'hook', 'uppercut', 'legKick', 'lowKick', 'takedown', 'singleLeg', 'armbar', 'rearNaked', 'groundAndPound'],
  },
};

export const STYLE_SWITCH_CONFIG = {
  LOCK_WEEKS: 4,
  COST: 500,
};

export const MOVES = {
  jab:         { name: 'Jab',     type: 'strike',     baseAttr: 'boxing',             staminaCost: 3,  damage: 1.0, tags: ['quick', 'range'] },
  cross:       { name: 'Cross',   type: 'strike',     baseAttr: 'boxing',             staminaCost: 5,  damage: 1.4, tags: ['power', 'range'] },
  hook:        { name: 'Hook',    type: 'strike',     baseAttr: 'power',              staminaCost: 6,  damage: 1.6, tags: ['power', 'close'] },
  uppercut:    { name: 'Uppercut',type: 'strike',     baseAttr: 'power',              staminaCost: 6,  damage: 1.5, tags: ['power', 'close'] },
  overhand:    { name: 'Overhand',type: 'strike',     baseAttr: 'power',              staminaCost: 7,  damage: 1.8, tags: ['power', 'risky'] },
  bodyShot:    { name: 'Body Shot',type: 'strike',    baseAttr: 'cardio',             staminaCost: 4,  damage: 1.0, tags: ['body', 'setup'] },
  legKick:     { name: 'Leg Kick', type: 'strike',    baseAttr: 'kickboxing',         staminaCost: 4,  damage: 0.8, tags: ['range', 'body'] },
  lowKick:     { name: 'Low Kick', type: 'strike',    baseAttr: 'kickboxing',         staminaCost: 5,  damage: 1.0, tags: ['range', 'cripple'] },
  headKick:    { name: 'Head Kick',type: 'strike',    baseAttr: 'kickboxing',         staminaCost: 8,  damage: 2.0, tags: ['power', 'risky'] },
  elbow:       { name: 'Cotovelada',type: 'strike',   baseAttr: 'muayThai',           staminaCost: 6,  damage: 1.7, tags: ['power', 'close', 'cut'] },
  knee:        { name: 'Joelhada',type: 'strike',     baseAttr: 'muayThai',           staminaCost: 5,  damage: 1.5, tags: ['power', 'close'] },
  clinchKnee:  { name: 'Clinch Knee',type: 'strike',  baseAttr: 'muayThai',           staminaCost: 4,  damage: 1.3, tags: ['clinch', 'body'] },
  takedown:    { name: 'Queda',   type: 'takedown',   baseAttr: 'takedowns',          staminaCost: 6,  damage: 0,   tags: ['grappling'] },
  singleLeg:   { name: 'Single Leg',type: 'takedown', baseAttr: 'takedowns',          staminaCost: 7,  damage: 0,   tags: ['grappling', 'speed'] },
  doubleLeg:   { name: 'Double Leg',type: 'takedown', baseAttr: 'takedowns',          staminaCost: 8,  damage: 0,   tags: ['grappling', 'power'] },
  slam:        { name: 'Slam',    type: 'takedown',   baseAttr: 'strength',           staminaCost: 9,  damage: 1.2, tags: ['grappling', 'power'] },
  armbar:      { name: 'Armbar',  type: 'submission', baseAttr: 'submissionOffense',  staminaCost: 7,  damage: 0,   tags: ['submission'] },
  guillotine:  { name: 'Guilhotina',type: 'submission',baseAttr: 'submissionOffense', staminaCost: 7,  damage: 0,   tags: ['submission'] },
  rearNaked:   { name: 'Mata-Leão',type: 'submission',baseAttr: 'submissionOffense',  staminaCost: 6,  damage: 0,   tags: ['submission'] },
  triangle:    { name: 'Triângulo',type: 'submission',baseAttr: 'submissionOffense',  staminaCost: 8,  damage: 0,   tags: ['submission', 'guard'] },
  groundAndPound: { name: 'Ground and Pound', type: 'strike', baseAttr: 'power',      staminaCost: 5,  damage: 1.3, tags: ['ground'] },
};

export const PERKS = {
  fastHands: {
    id: 'fastHands', name: 'Mão Rápida', category: 'striking',
    desc: 'Combinações de 2+ golpes gastam 15% menos stamina',
    requirements: { attrs: { speed: 50 }, style: null, level: 1, perks: [] },
    effect: { type: 'stamina_combo_reduction', value: 0.85 },
  },
  heavyHands: {
    id: 'heavyHands', name: 'Pé Pesado', category: 'striking',
    desc: 'Dano de power golpes +10%',
    requirements: { attrs: { power: 60 }, style: null, level: 2, perks: [] },
    effect: { type: 'power_multiplier', value: 1.10 },
  },
  lightningJab: {
    id: 'lightningJab', name: 'Jab de Raios', category: 'striking',
    desc: 'Jab gasta 20% menos stamina e acerta 10% mais',
    requirements: { attrs: { boxing: 50, speed: 45 }, style: null, level: 1, perks: [] },
    effect: { type: 'move_buff', moveId: 'jab', staminaMult: 0.80, damageMult: 1.10 },
  },
  crossRespect: {
    id: 'crossRespect', name: 'Cruzado de Respeito', category: 'striking',
    desc: 'Cross tem +15% de chance de knockdown',
    requirements: { attrs: { boxing: 65, power: 55 }, style: 'boxer', level: 3, perks: ['heavyHands'] },
    effect: { type: 'move_buff', moveId: 'cross', kdChanceBonus: 0.15 },
  },
  comboLightning: {
    id: 'comboLightning', name: 'Combinação Relâmpago', category: 'striking',
    desc: 'Combos de 3+ golpes têm +20% de velocidade',
    requirements: { attrs: { boxing: 70, speed: 60 }, style: null, level: 4, perks: ['fastHands', 'heavyHands'] },
    effect: { type: 'stamina_combo_reduction', value: 0.70 },
  },
  knockoutArtist: {
    id: 'knockoutArtist', name: 'Nocauteador', category: 'striking',
    desc: '+8% chance de KO quando oponente está atordoado',
    requirements: { attrs: { power: 70 }, style: null, level: 5, perks: ['heavyHands', 'crossRespect'] },
    effect: { type: 'ko_chance_bonus', value: 0.08 },
  },
  bornFinisher: {
    id: 'bornFinisher', name: 'Finalizador Nato', category: 'grappling',
    desc: 'Finalizações no ground têm +12% de chance de sucesso',
    requirements: { attrs: { submissionOffense: 55, groundControl: 50 }, style: null, level: 2, perks: [] },
    effect: { type: 'submission_chance_mult', value: 1.12 },
  },
  iceOnGround: {
    id: 'iceOnGround', name: 'Gelo no Chão', category: 'grappling',
    desc: 'Nunca é finalizado quando está cansado (stamina < 30)',
    requirements: { attrs: { submissionDefense: 60, composure: 50 }, style: null, level: 3, perks: [] },
    effect: { type: 'never_submitted_low_stamina', value: true },
  },
  suffocatingPressure: {
    id: 'suffocatingPressure', name: 'Pressão Sufocante', category: 'grappling',
    desc: 'Ground control drena 20% mais stamina do oponente',
    requirements: { attrs: { wrestling: 60, groundControl: 55 }, style: null, level: 3, perks: [] },
    effect: { type: 'ground_stamina_drain_mult', value: 1.20 },
  },
  ironBody: {
    id: 'ironBody', name: 'Corpo de Ferro', category: 'physical',
    desc: 'Dano físico recebido -8%',
    requirements: { attrs: { durability: 60, strength: 50 }, style: null, level: 2, perks: [] },
    effect: { type: 'damage_taken_reduction', value: 0.92 },
  },
  warTank: {
    id: 'warTank', name: 'Tanque de Guerra', category: 'physical',
    desc: 'Cardio regenera 10% entre rounds (em vez de cair)',
    requirements: { attrs: { cardio: 65, recovery: 55 }, style: null, level: 3, perks: ['ironBody'] },
    effect: { type: 'cardio_regeneration', value: 0.10 },
  },
  endlessGas: {
    id: 'endlessGas', name: 'Fôlego Infinito', category: 'physical',
    desc: 'Stamina decai 15% menos por round',
    requirements: { attrs: { cardio: 70, recovery: 65 }, style: null, level: 4, perks: ['warTank'] },
    effect: { type: 'stamina_decay_reduction', value: 0.85 },
  },
  coldCalculator: {
    id: 'coldCalculator', name: 'Frio Calculista', category: 'mental',
    desc: 'Composure +10% em rounds de decisão (3o/5o round)',
    requirements: { attrs: { composure: 55, fightIQ: 55 }, style: null, level: 2, perks: [] },
    effect: { type: 'composure_late_rounds', value: 1.10 },
  },
  killerInstinct: {
    id: 'killerInstinct', name: 'Instinto Assassino', category: 'mental',
    desc: '+10% striking nos 2 minutos finais de cada round',
    requirements: { attrs: { aggression: 60, composure: 50 }, style: null, level: 3, perks: [] },
    effect: { type: 'striking_late_round', value: 1.10 },
  },
  lionsHeart: {
    id: 'lionsHeart', name: 'Coração de Leão', category: 'mental',
    desc: 'Se perder, morale cai 50% menos',
    requirements: { attrs: { determination: 40 }, style: null, level: 2, perks: [] },
    effect: { type: 'morale_loss_reduction', value: 0.50 },
  },
  eightWeapons: {
    id: 'eightWeapons', name: 'Oito Armas', category: 'style',
    desc: 'Joelhada e cotovelada no clinch têm +15% de dano',
    requirements: { attrs: {}, style: 'muayThai', level: 1, perks: [] },
    effect: { type: 'style_perk', moveBonus: { elbow: 1.15, knee: 1.15, clinchKnee: 1.15 } },
  },
  groundAndPound: {
    id: 'groundAndPound', name: 'Ground and Pound', category: 'style',
    desc: 'Ground strikes têm +15% de dano e +10% knockdown chance',
    requirements: { attrs: {}, style: 'wrestler', level: 1, perks: [] },
    effect: { type: 'style_perk', moveBonus: { groundAndPound: 1.15 }, kdChanceBonus: 0.10 },
  },
  berimbolo: {
    id: 'berimbolo', name: 'Berimbolo', category: 'style',
    desc: 'Tentativas de finalização têm +12% de chance a partir do round 2',
    requirements: { attrs: {}, style: 'bjj', level: 1, perks: [] },
    effect: { type: 'style_perk', subChanceLateRounds: 0.12 },
  },
  versatility: {
    id: 'versatility', name: 'Versatilidade', category: 'style',
    desc: '10% de chance de anular vantagem de estilo do oponente',
    requirements: { attrs: {}, style: 'freestyle', level: 1, perks: [] },
    effect: { type: 'style_perk', nullifyMatchupChance: 0.10 },
  },
};

export const LEVEL_CONFIG = {
  XP_PER_LEVEL: 100,
  XP_PER_FIGHT: 20,
  XP_PER_WIN_BONUS: 10,
  XP_PER_WEEK_TRAINED: 5,
  PERK_POINT_EVERY_N_LEVELS: 3,
  PERK_POINT_MILESTONES: {
    firstWin: 1,
    fiveWins: 1,
    firstTitleShot: 1,
    firstBelt: 2,
    firstDefense: 1,
  },
  MAX_LEVEL: 50,
};

export function absWeek(state) {
  return (state.year - 1) * 52 + state.week;
}

export function absWeekToLabel(abs) {
  const year = Math.floor((abs - 1) / 52) + 1;
  const week = ((abs - 1) % 52) + 1;
  return `Semana ${week}, Ano ${year}`;
}

// Épico D: configuração do acampamento semanal com sparring partner
export const CAMP_CONFIG = {
  // Bônus de ganho de atributos por intensidade
  GAIN_MULTIPLIER: { light: 1, moderate: 1.5, intense: 2.5 },
  // Risco base de lesão por intensidade
  INJURY_CHANCE: { light: 0.01, moderate: 0.05, intense: 0.15 },
  // Risco base de overtraining por intensidade
  OVERTRAINING_CHANCE: { light: 0.01, moderate: 0.04, intense: 0.12 },
  // Bônus de sparring: arquétipo certo vs adversário
  SPARRING_MATCH_BONUS: 0.25,       // +25% ganho se arquétipo do parceiro == arquétipo do adversário
  SPARRING_CLOSE_WEIGHT_BONUS: 0.10, // +10% se peso próximo (mesma divisão)
  // Custo semanal por intensidade
  WEEKLY_COST: { light: 300, moderate: 600, intense: 1200 },
  // Lesão no camp cancela a luta? (se intensity === intense e tem luta marcada)
  CAMP_INJURY_CANCELS_FIGHT: true,
};

// ===== Prontidão (item 4 — "está tudo muito fácil") =====
// Score 0-100 por luta, calculado na noite do evento a partir do que o
// jogador FEZ na janela do booking. O gap contra a prontidão do adversário
// multiplica a performance por round — é ele que transforma cada tela
// (camp, plano, scouting, pesagem, fadiga) em consequência real. Quem só
// clica "simular" entra com ~30 contra IA que sempre faz camp (~55-75) e
// acumula cartel negativo; quem se prepara inverte a conta.
export const READINESS_CONFIG = {
  BASE: 30,                    // você apareceu na luta
  // Camp: pontos por semana de camp DURANTE a janela do booking, por intensidade
  CAMP_PER_WEEK: { light: 3, moderate: 4.5, intense: 6 },
  CAMP_CAP: 35,                // ~6 semanas de camp intense (MIN_WEEKS_NOTICE)
  PLAN_CONFIRMED: 10,          // plano de jogo definido na tela (mesmo 'balanced' explícito)
  SCOUTING: { 0: 0, 1: 4, 2: 7, 3: 10 },
  FATIGUE_MAX_PENALTY: 10,     // fadiga 100 = -10 (a simulação já pune fadiga; aqui é legibilidade)
  MORALE_SPAN: 5,              // moral 0 = -5, moral 100 = +5
  WEIGH_IN: { success: 5, rough: -5, steady: 0 },

  // IA: baseline por tier — profissional sempre faz camp. Jitter dá textura
  // ("ele aceitou em cima da hora") e vira informação de scouting.
  AI_BASELINE: { 1: 75, 2: 65, 3: 55 },
  AI_TITLE_BONUS: 5,           // ninguém defende cinturão despreparado
  AI_JITTER: 8,                // ±8 aleatório (seed estável por luta)
  AI_MIN: 35,
  AI_MAX: 90,

  // Efeito: multiplicador por round = 1 + gap * SCALE, clampado em ±CAP.
  // Calibrado por script (600 lutas/gap, OVR igual): gap -25 (autopilot vs
  // IA tier 3) → factor 0.925 → 34% de vitória; gap +25 (preparado) →
  // 1.075 → 67%. Em cima disso ainda empilham plan edge, tape e OVR — o
  // autopilot real fica abaixo de 34% e espirala.
  GAP_SCALE: 0.003,
  GAP_CAP: 0.15,
};

// Especialidades de camp expandidas (§PRD: recuperação, estratégia, estudo)
export const CAMP_SPECS = {
  striking:  { label: 'Striking',    attrs: ['boxing','kickboxing','muayThai','power','footwork'],         desc: 'Golpes em pé' },
  grappling: { label: 'Grappling',   attrs: ['wrestling','bjj','takedowns','groundControl'],                  desc: 'Luta agarrada' },
  cardio:    { label: 'Condicionamento', attrs: ['cardio','recovery','durability'],                           desc: 'Resistência física' },
  chin:      { label: 'Resistência', attrs: ['chin','composure'],                                              desc: 'Queixo e compostura' },
  recovery:  { label: 'Recuperação', attrs: [], recoverFatigue: 10, injuryHeal: 2,                             desc: 'Reduz fadiga e acelera recuperação de lesões' },
  strategy:  { label: 'Estratégia',  attrs: ['fightIQ'], planStudyBonus: 1,                                    desc: 'Estuda padrões do oponente — bônus na leitura do plano de luta' },
  study:     { label: 'Estudo do Adversário', attrs: ['fightIQ','adaptability'], scoutingBoost: 1,              desc: 'Escuta o oponente — ganha 1 nível de scouting temporário' },
};

// Serviços opcionais pagos por semana (§PRD: economia detalhada)
export const OPTIONAL_SERVICES = {
  physio:     { label: 'Fisioterapia',  weeklyCost: 400,  desc: 'Recupera 2 de fadiga extra por semana. Acelera cura de lesões.' },
  nutritionist: { label: 'Nutricionista', weeklyCost: 350,  desc: 'Bônus de +3 no teto efetivo de atributos (recuperação mais eficiente).' },
  psychologist: { label: 'Psicólogo',    weeklyCost: 300,  desc: '+1 de moral por semana. Reduz penalidade de derrota em 20%.' },
};

// Atividades de lazer semanais (§PRD: vida fora do octógono)
export const WEEKLY_ACTIVITIES = {
  rest:         { label: 'Descansar',          desc: 'Recupera 5 de fadiga. Pequena chance de recuperar lesão mais rápido.', fatigueRecovery: 5, injuryHealChance: 0.10 },
  family:       { label: 'Tempo com Família',  desc: '+8 de moral. Nenhum efeito físico.', moraleGain: 8 },
  shortTrip:    { label: 'Viagem Curta',       desc: '+5 de moral. +1 de popularidade. Custa $300.', moraleGain: 5, popularityGain: 1, cost: 300 },
  promoEvent:   { label: 'Evento Promocional', desc: '+3 de popularidade. -2 de fadiga (desgaste social). Custa $200.', popularityGain: 3, fatigueCost: 2, cost: 200 },
  extraTraining:{ label: 'Treino Extra',       desc: 'Ganho pequeno em atributo aleatório. +3 de fadiga.', attrGainChance: 0.5, fatigueCost: 3 },
};

// Chance de erro factual no scouting nível 0-1 (§PRD: scouting com erros)
export const SCOUTING_MISREAD_CHANCE = {
  0: 0.40, // 40% de chance de informação errada no nível Desconhecido
  1: 0.15, // 15% no nível Observado
  2: 0,    // 0% no nível Estudado+
};

// ============================================================
// TREINO SEMANAL (Fase 1) — microdecisões a cada ~4 semanas.
// O jogador escolhe o foco da semana: intenso, técnico,
// recuperação ativa ou treino com parceiro.
// ============================================================
export const WEEKLY_TRAINING_CHOICES = {
  intense: {
    label: 'Intenso', description: 'Ganho acelerado, risco de lesão',
    attrMult: 1.5, fatigueGain: 15, moraleEffect: -2, injuryRisk: 0.20,
  },
  technical: {
    label: 'Técnico', description: 'Progressão de golpes, risco baixo',
    attrMult: 1.0, fatigueGain: 8, moraleEffect: 0, injuryRisk: 0.08,
  },
  active_recovery: {
    label: 'Recuperação Ativa', description: 'Pouco ganho, recupera fadiga',
    attrMult: 0.5, fatigueGain: -10, moraleEffect: 3, injuryRisk: 0.02,
  },
  partners: {
    label: 'Parceiro', description: 'Foco em vínculo e osmose',
    attrMult: 0.7, fatigueGain: 10, moraleEffect: 2, injuryRisk: 0.12, bondBoost: true,
  },
};
export const WEEKLY_TRAINING_FREQUENCY = 4;

// Injury recovery stage system — P2.2
export const INJURY_CONFIG = {
  REST_WEEKS_MIN: 2,
  REST_WEEKS_MAX: 4,
  REHAB_FAST_COST: 500,        // cost per week for fast rehab
  REHAB_FAST_WEEKS: 3,         // fast rehab takes this many weeks
  REHAB_FREE_WEEKS: 6,         // free rehab takes this many
  RETURN_TRAINING_MULT: 0.5,   // 50% gains during return stage
  RETURN_REINJURY_MULT: 2.0,   // 2x injury risk during return
  SEVERE_INJURY_CHANCE: 0.3,   // 30% of serious injuries leave sequelae
  RETURN_WEEKS: 2,             // weeks of gradual return
};

// Data sintética para exibição: início do jogo + semanas decorridas
export function absWeekToDate(abs, startedAt) {
  const base = startedAt ? new Date(startedAt) : new Date();
  return new Date(base.getTime() + (abs - 1) * 7 * 86400000);
}

// ============================================================
// EVENTOS NARRATIVOS (Fase 1) — prompts periódicos de carreira
// com escolhas que afetam moral, popularidade, hype e atributos.
// Gatilho: ~a cada 5 semanas (absWeek % 5 === 0).
// ============================================================
export const NARRATIVE_EVENTS = {
  after_loss: [
    {
      prompt: 'Após a derrota, a imprensa quer saber: o que aconteceu?',
      choices: [
        { text: 'Assumir a culpa — "Não estava no meu melhor"', effects: { morale: -3, popularity: 3 } },
        { text: 'Culpar a preparação — "O camp foi mal planejado"', effects: { morale: -5, popularity: 1 } },
        { text: 'Prometer voltar mais forte', effects: { morale: 5, popularity: 2 } },
        { text: 'Recusar entrevistas e focar no treino', effects: { morale: 8, popularity: -2 } },
      ],
    },
  ],
  after_win_streak: [
    {
      prompt: 'Você está embalado! A mídia fala em title shot. Como responde?',
      choices: [
        { text: 'Confiar que o momento chegou — "Mereço essa chance"', effects: { morale: 5, popularity: 3, hype: 5 } },
        { text: 'Manter os pés no chão — "Luta por luta"', effects: { morale: 3, popularity: 5 } },
        { text: 'Provocar o campeão publicamente', effects: { morale: 2, popularity: 8, hype: 10, heat: 3 } },
      ],
    },
  ],
  injury_return: [
    {
      prompt: 'Você voltou de lesão. Sente o ringue diferente?',
      choices: [
        { text: 'Voltar cauteloso — "Vou readquirindo o ritmo"', effects: { morale: 3, composure: 2 } },
        { text: 'Ignorar o medo — "Mesma agressão de sempre"', effects: { morale: -2, power: 2 } },
        { text: 'Mudar o estilo para proteger a lesão', effects: { morale: 1, awareness: 3 } },
      ],
    },
  ],
  rival_victory: [
    {
      prompt: 'Seu rival venceu uma luta importante. Como reage?',
      choices: [
        { text: 'Parabenizar — "Respeito onde merece"', effects: { morale: 2, popularity: 3 } },
        { text: 'Minimizar — "Ele não enfrentou ninguém ainda"', effects: { popularity: 5, heat: 4 } },
        { text: 'Pedir a luta agora — "Marca logo"', effects: { hype: 8, heat: 5, popularity: 2 } },
      ],
    },
  ],
  title_reign: [
    {
      prompt: 'Ser campeão muda tudo. Como você lida com o alvo nas costas?',
      choices: [
        { text: 'Treinar mais que nunca — "Ninguém tira isso de mim"', effects: { morale: 5, discipline: 3 } },
        { text: 'Aproveitar o momento — "Toda atenção, todo o glamour"', effects: { popularity: 5, discipline: -2 } },
        { text: 'Ser um campeão ativo — "Defender contra qualquer um"', effects: { popularity: 3, morale: 3, heat: 2 } },
      ],
    },
  ],
};
