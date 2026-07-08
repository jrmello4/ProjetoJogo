// ============================================================
// GAME CONFIG — única fonte de verdade para balanceamento.
// Todo número de tuning do modo academia vive aqui; nenhuma
// mecânica deve hardcodar valores de economia/progresso.
// ============================================================

export const GYM_CONFIG = {
  ID: 'gym-player',
  STARTING_REPUTATION: 10,
  STARTING_TEAM_SIZE: 3,
  MANAGER_CUT: 0.2, // % da bolsa que fica com a academia

  // Economia semanal
  WEEKLY_RENT: 1200,
  WEEKLY_COACHING_PER_FIGHTER: 300,
  STUDENT_INCOME_BASE: 1500, // mensalidades de alunos comuns
  STUDENT_INCOME_PER_REP: 20,

  // Recrutamento de agentes livres para a equipe
  RECRUIT_FEE_PER_OVR: 150,
  RECRUIT_FEE_BASE: 2000,

  // Reputação da academia
  REP_PER_WIN: 2,
  REP_PER_FINISH: 2,
  REP_PER_LOSS: -1,
  REP_TIER_BONUS: { 1: 3, 2: 1, 3: 0 },
};

// Estrutura da academia — cada nível aumenta vagas no time, bônus de
// treino e recuperação semanal. maxTeamSize do nível 1 mantém o valor
// original (4) para não encolher partidas já em andamento.
export const FACILITY_LEVELS = [
  { level: 1, name: 'Galpão Improvisado', maxTeamSize: 4, trainingBonus: 0, recoveryBonus: 0, coachSlots: 1, upgradeCost: 0 },
  { level: 2, name: 'Academia Equipada', maxTeamSize: 5, trainingBonus: 0.15, recoveryBonus: 3, coachSlots: 2, upgradeCost: 25000 },
  { level: 3, name: 'Centro de Alto Rendimento', maxTeamSize: 6, trainingBonus: 0.30, recoveryBonus: 6, coachSlots: 3, upgradeCost: 65000 },
  { level: 4, name: 'Complexo Elite Mundial', maxTeamSize: 8, trainingBonus: 0.45, recoveryBonus: 10, coachSlots: 3, upgradeCost: 150000 },
];

// Treinadores auxiliares — cada um amplifica o ganho de atributos dos
// lutadores cujo foco semanal bate com a categoria do treinador.
export const COACH_CONFIG = {
  striking: { label: 'Técnico de Striking', icon: '🥊', weeklyCost: 900, gainBonus: 0.35 },
  grappling: { label: 'Técnico de Grappling', icon: '🤼', weeklyCost: 900, gainBonus: 0.35 },
  cardio: { label: 'Preparador Físico', icon: '🫁', weeklyCost: 700, gainBonus: 0.35, recoveryBonus: 4 },
};

// Olheiro — revela o potencial oculto dos agentes livres no Recrutamento,
// a principal informação escondida que hoje é desperdiçada.
export const SCOUT_CONFIG = {
  unlockCost: 15000,
  weeklyCost: 400,
};

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
  { id: 'easy', name: 'Mestre Estabelecido', cash: 60000, desc: 'Caixa folgado para errar sem medo' },
  { id: 'normal', name: 'Treinador Profissional', cash: 35000, desc: 'A experiência equilibrada' },
  { id: 'hard', name: 'Garagem e Sonho', cash: 18000, desc: 'Cada dólar conta' },
];

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

export const OFFER_CONFIG = {
  // Chance semanal de um lutador livre da equipe receber oferta.
  // Calibrada para ~2-3 lutas por ano por atleta (no MMA real um
  // atleta ativo faz no máximo 3-4).
  WEEKLY_OFFER_CHANCE: 0.5,
  // Semanas mínimas entre a oferta e a luta — um fight camp de verdade
  MIN_WEEKS_NOTICE: 6,
  // Semanas até a oferta expirar
  EXPIRY_WEEKS: 3,
  // Diferença máxima de OVR preferida ao escolher adversário
  OPPONENT_OVR_WINDOW: 8,

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
    2: { base: 3500, perPop: 90 },
    3: { base: 800, perPop: 25 },
  },
  WIN_BONUS_RATIO: 0.5,
};

export const WORLD_CONFIG = {
  FREE_AGENT_POOL: 14,
  FREE_AGENT_MIN: 8,
  AI_FIGHTS_PER_EVENT: 5, // lutas de IA por evento (fora as do jogador)

  // Lesões pós-luta
  INJURY_CHANCE_LOSER: 0.12,
  INJURY_CHANCE_WINNER: 0.04,
  INJURY_CHANCE_FINISH_BONUS: 0.1, // extra se perdeu por KO/TKO/Sub
  INJURY_CHANCE_PRONE_BONUS: 0.08, // extra com DNA injuryProne
  INJURY_WEEKS_MIN: 2,
  INJURY_WEEKS_MAX: 6,

  // Draft anual (semana 52)
  DRAFT_MIN: 5,
  DRAFT_MAX: 10,
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
  STUDY_COST: [0, 1500, 3500, 7000],
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
  rep50: '🏛️ Academia Respeitada!',
  topGym: '👑 Academia Nº1 do Ranking!',
  firstTitleShot: '🎯 Primeira Disputa de Cinturão!',
  firstBelt: '🏆 CAMPEÃO! Primeiro Cinturão da Academia!',
  firstDefense: '🛡️ Primeira Defesa de Cinturão!',
  worldChampion: '🌍 Campeão Mundial! Cinturão da Elite!',
};

// Academias rivais — o verdadeiro antagonista do treinador: competem pelos
// mesmos agentes livres e podem seduzir atletas insatisfeitos da sua equipe.
export const RIVAL_GYMS = [
  { id: 'rivalgym-fortaleza', name: 'Fortaleza MMA', reputation: 45 },
  { id: 'rivalgym-elite', name: 'Elite Combat Team', reputation: 55 },
  { id: 'rivalgym-blacktiger', name: 'Black Tiger Academy', reputation: 30 },
];

export const RIVAL_GYM_CONFIG = {
  // Chance semanal de CADA academia rival tentar recrutar um agente livre
  RECRUIT_CHANCE_PER_GYM: 0.35,
  REP_PER_SIGNING: 1,
  REP_PER_POACH: 3,

  // Assédio a atletas da sua equipe: só um rival tenta por atleta por
  // semana (não soma chance de todas as academias), chance-base pequena,
  // amplificada por moral baixa e por reputação do rival acima da sua
  // (com teto pra não punir demais o início de jogo, quando o gap é maior).
  MIN_TENURE_WEEKS: 8, // carência antes de um atleta poder ser assediado
  POACH_BASE_CHANCE: 0.008,
  POACH_MORALE_WEIGHT: 0.10, // moral 0 soma até +10%
  POACH_REP_WEIGHT: 0.05, // vantagem de reputação (capada em 40) soma até +2%
  POACH_REP_EDGE_CAP: 40,
  MAX_POACH_PER_WEEK: 1,
};

// Patrocínios — renda recorrente com metas de médio prazo. Preenchem as
// semanas entre lutas com um objetivo concreto: "vença N lutas até a
// semana X e leve o bônus". Marcas melhores exigem mais reputação.
export const SPONSOR_CONFIG = {
  WEEKLY_OFFER_CHANCE: 0.15, // chance semanal de uma marca procurar a academia
  MAX_ACTIVE: 2,             // contratos simultâneos
  OFFER_EXPIRY_WEEKS: 4,
  REP_PER_GOAL_MET: 2,
  REP_PER_GOAL_FAILED: -1,
};

export const SPONSOR_BRANDS = [
  { id: 'sp-combate',  name: 'Combate Energy',            tier: 3, weekly: 250,  goalWins: 1, goalWeeks: 26, bonus: 4000,  minRep: 0 },
  { id: 'sp-ferro',    name: 'Ferro & Fibra Suplementos', tier: 3, weekly: 350,  goalWins: 2, goalWeeks: 39, bonus: 6500,  minRep: 20 },
  { id: 'sp-valetudo', name: 'Vale Tudo Wear',            tier: 2, weekly: 600,  goalWins: 2, goalWeeks: 32, bonus: 12000, minRep: 35 },
  { id: 'sp-predador', name: 'Predador Fightwear',        tier: 2, weekly: 800,  goalWins: 3, goalWeeks: 39, bonus: 18000, minRep: 45 },
  { id: 'sp-titan',    name: 'Titan Performance',         tier: 1, weekly: 1500, goalWins: 3, goalWeeks: 32, bonus: 35000, minRep: 60 },
  { id: 'sp-apexmedia',name: 'Apex Global Media',         tier: 1, weekly: 2200, goalWins: 4, goalWeeks: 39, bonus: 60000, minRep: 75 },
];

// Presets de simulação de período (fast-forward)
export const SIMULATE_PERIOD_PRESETS = [
  { weeks: 4, label: '1 Mês' },
  { weeks: 13, label: '3 Meses' },
  { weeks: 26, label: '6 Meses' },
  { weeks: 52, label: '1 Ano' },
];

export function absWeek(state) {
  return (state.year - 1) * 52 + state.week;
}

export function absWeekToLabel(abs) {
  const year = Math.floor((abs - 1) / 52) + 1;
  const week = ((abs - 1) % 52) + 1;
  return `Semana ${week}, Ano ${year}`;
}

// Data sintética para exibição: início do jogo + semanas decorridas
export function absWeekToDate(abs, startedAt) {
  const base = startedAt ? new Date(startedAt) : new Date();
  return new Date(base.getTime() + (abs - 1) * 7 * 86400000);
}
