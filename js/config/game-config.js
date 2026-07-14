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
    facilityLevel: 3, weeklyFee: 800, philosophy: 'Alto rendimento',
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
  AGGRESSIVE_LEVERAGE_BONUS: 0.5, // soma na leverage de negociação de bolsa
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
  luxurious: { label: 'Luxuoso', weeklyCost: 1500, moraleBonus: 6, popularityBonus: 3 },
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

// Épico F1: cada ponto de hype gerado na coletiva vale este valor
// em dólar de bônus na bolsa da luta (purse + winBonus).
export const HYPE_PURSE_RATIO = 50;

// Épico F2: penalidades e pesos de expectativas de atletas
export const EXPECTATION_CONFIG = {
  // Dano semanal de moral/loyalty quando expectativa em urgência 3 está ativa
  MORALE_DAMAGE_URGENT: 5,   // -5 de morale por semana
  LOYALTY_DAMAGE_URGENT: 2,  // -2 de loyalty por semana

  // Bônus de chance de ser sondado por rival (sobre a base)
  RIVAL_APPROACH_BONUS: 0.15,   // +15% se tem expectativa urgente
  RIVAL_RETENTION_PENALTY: 0.15, // -15% na chance de reter

  // A cada quantas semanas reavaliar (existente: 4)
  CHECK_INTERVAL: 4,
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
  POPULARITY_PER_GOAL_MET: 2,
  POPULARITY_PER_GOAL_FAILED: -1,
  CLEAN_CLAUSE_PROVOCATION_LIMIT: 2, // provocações públicas no período tolerado antes de cancelar
  VILLAIN_CLAUSE_MIN_PROVOCATIONS: 1, // provocações mínimas no período pra renovar
};

export const SPONSOR_BRANDS = [
  { id: 'sp-combate',  name: 'Combate Energy',            tier: 3, weekly: 250,  goalWins: 1, goalWeeks: 26, bonus: 4000,  minPopularity: 0,  imageClause: null },
  { id: 'sp-ferro',    name: 'Ferro & Fibra Suplementos', tier: 3, weekly: 350,  goalWins: 2, goalWeeks: 39, bonus: 6500,  minPopularity: 20, imageClause: null },
  { id: 'sp-valetudo', name: 'Vale Tudo Wear',            tier: 2, weekly: 600,  goalWins: 2, goalWeeks: 32, bonus: 12000, minPopularity: 35, imageClause: 'villain' },
  { id: 'sp-predador', name: 'Predador Fightwear',        tier: 2, weekly: 800,  goalWins: 3, goalWeeks: 39, bonus: 18000, minPopularity: 45, imageClause: 'villain' },
  { id: 'sp-titan',    name: 'Titan Performance',         tier: 1, weekly: 1500, goalWins: 3, goalWeeks: 32, bonus: 35000, minPopularity: 60, imageClause: 'clean' },
  { id: 'sp-apexmedia',name: 'Apex Global Media',         tier: 1, weekly: 2200, goalWins: 4, goalWeeks: 39, bonus: 60000, minPopularity: 75, imageClause: 'clean' },
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

// Rivalidades com origem e identidade — ver spec §D.3. `Rivalry.type` deixa
// de ser sempre 'competitive': vira 'robbery' quando a luta que criou/
// reacendeu a rivalidade terminou em decisão dividida/majoritária (resultado
// controverso); vira 'grudge' quando existe uma provocação pública recente
// (careerLog §D.2, type 'provocation') mirando um dos dois lutadores; senão
// continua 'competitive' (comportamento de hoje).
export const RIVALRY_CONFIG = {
  GRUDGE_LOOKBACK_WEEKS: 10, // janela pra uma provocação recente ainda "plantar" um grudge
  GRUDGE_PRESSURE_BONUS: 20, // §C.3 — pressão extra numa revanche de rivalidade grudge
};

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

// Data sintética para exibição: início do jogo + semanas decorridas
export function absWeekToDate(abs, startedAt) {
  const base = startedAt ? new Date(startedAt) : new Date();
  return new Date(base.getTime() + (abs - 1) * 7 * 86400000);
}
