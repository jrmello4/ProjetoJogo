// ============================================================
// NarrativeChainService — cadeias de consequência pós-luta
// ============================================================
// Gera 3-5 consequências narrativas após cada luta do jogador
// e persiste como "cadeias" visíveis no feed do dashboard.
// Cada consequência é auto-contida (ícone + título + descrição).

import { generateId } from '../utils/helpers.js';

const WIN_ELEMENTS = {
  rankingUp: (oldRank, newRank, wc) => ({
    icon: '📊', title: 'Subiu no ranking',
    desc: `Você subiu da #${oldRank} para #${newRank} nos ${wc}.`,
  }),
  rankingUnchanged: (rank, wc) => ({
    icon: '📊', title: 'Ranking mantido',
    desc: `Você permanece na #${rank} dos ${wc}.`,
  }),
  rankingEntered: (rank, wc) => ({
    icon: '📊', title: 'Entrou no ranking!',
    desc: `Com essa vitória, você entra no ranking dos ${wc} na #${rank}.`,
  }),
  popularityGain: (gain, total) => ({
    icon: '👥', title: 'Popularidade cresceu',
    desc: `+${gain} de popularidade (agora ${total}). ${gain >= 8 ? 'Essa vitória chamou atenção!' : ''}`,
  }),
  mediaPraise: (style) => ({
    icon: '📰', title: 'Mídia elogia',
    desc: style === 'dominant'
      ? 'A imprensa destaca sua dominação absoluta do início ao fim.'
      : style === 'ko'
        ? 'O nocaute foi o assunto mais comentado da noite nos canais esportivos.'
        : style === 'comeback'
          ? 'A imprensa chama sua recuperação de "uma das maiores viradas do ano".'
          : 'Sua vitória foi mencionada nos principais portais de MMA.',
  }),
  rivalProvoke: (rivalName) => ({
    icon: '⚔️', title: 'Rival responde',
    desc: `${rivalName} postou uma provocação: "Não me impressiona. Marca a luta."`,
  }),
  rivalSilence: (rivalName) => ({
    icon: '⚔️', title: 'Rival em silêncio',
    desc: `${rivalName} não comentou sua vitória — talvez esteja sentindo a pressão.`,
  }),
  sponsorInterest: (name) => ({
    icon: '💰', title: 'Patrocinador interessado',
    desc: `${name} quer conversar sobre um acordo de patrocínio.`,
  }),
  viralMoment: (platform) => ({
    icon: '📱', title: 'Momento viral',
    desc: `O vídeo do seu momento mais impactante na luta viralizou no ${platform}.`,
  }),
  streakAlive: (streak) => ({
    icon: '🔥', title: 'Sequência mantida',
    desc: `São ${streak} vitórias consecutivas — você está construindo uma trajetória consistente.`,
  }),
  titleShotWhisper: () => ({
    icon: '🏆', title: 'Fala-se em title shot',
    desc: 'Analistas começam a especular se você merece uma chance ao cinturão.',
  }),
  fansCelebrate: () => ({
    icon: '🎉', title: 'Torcida celebra',
    desc: 'Seus fãs estão comemorando a vitória nas redes sociais.',
  }),
};

const LOSS_ELEMENTS = {
  rankingDrop: (oldRank, newRank, wc) => ({
    icon: '📉', title: 'Caiu no ranking',
    desc: `Você caiu da #${oldRank} para #${newRank} nos ${wc}.`,
  }),
  rankingUnranked: (oldRank, wc) => ({
    icon: '📉', title: 'Fora do ranking',
    desc: `Com essa derrota, você saiu do ranking dos ${wc} (estava #${oldRank}).`,
  }),
  popularityLoss: (loss, total) => ({
    icon: '👥', title: 'Popularidade abalada',
    desc: `-${loss} de popularidade (agora ${total}). ${total < 40 ? 'Sua imagem pública está fragilizada.' : ''}`,
  }),
  mediaQuestion: (style) => ({
    icon: '📰', title: 'Mídia questiona',
    desc: style === 'upset'
      ? 'A imprensa chama de "zebra" — ninguém esperava essa derrota.'
      : style === 'finished'
        ? 'Os comentaristas analisam sua fragilidade defensiva.'
        : 'Sua derrota gerou discussão nos canais esportivos.',
  }),
  confidenceHit: () => ({
    icon: '💔', title: 'Confiança afetada',
    desc: 'Uma derrota como essa mexe com a cabeça. Você precisa reavaliar sua estratégia.',
  }),
  trainerConcern: () => ({
    icon: '🎯', title: 'Treinador preocupado',
    desc: 'Seu treinador sugere focar em pontos fracos antes da próxima luta.',
  }),
  rivalGloat: (rivalName) => ({
    icon: '⚔️', title: 'Rival provoca',
    desc: `${rivalName} fez questão de comentar: "Eu avisei que ele não era tudo isso."`,
  }),
  rivalDismiss: (rivalName) => ({
    icon: '⚔️', title: 'Rival desdenha',
    desc: `${rivalName} disse em entrevista: "Nem perder ele sabe fazer direito."`,
  }),
  fansWorried: () => ({
    icon: '😟', title: 'Torcida preocupada',
    desc: 'Seus fãs estão preocupados — muitos comentam que você parecia fora de ritmo.',
  }),
  podcastDebate: () => ({
    icon: '🎙️', title: 'Podcast debate',
    desc: 'Um podcast popular debate se você ainda tem futuro na divisão.',
  }),
  injuryConcern: (bodyPart) => ({
    icon: '🏥', title: 'Preocupação com lesão',
    desc: `O ${bodyPart} que você lesionou no combate preocupa a equipe médica para a sequência.`,
  }),
  comeback: () => ({
    icon: '💪', title: 'Já pensa na volta',
    desc: 'Você sabe que uma derrota não define sua carreira. A fome de voltar maior já está aqui.',
  }),
  fansSupport: () => ({
    icon: '💛', title: 'Fãs apoiam',
    desc: 'Mesmo na derrota, sua torcida mandou mensagens de apoio — isso mostra o respeito que você construiu.',
  }),
};

// Probabilidades relativas — cada elemento tem chance de aparecer
const WIN_WEIGHTS = {
  rankingUp: 40, rankingUnchanged: 5, rankingEntered: 15,
  popularityGain: 80,
  mediaPraise: 65,
  rivalProvoke: 30, rivalSilence: 10,
  sponsorInterest: 25,
  viralMoment: 20,
  streakAlive: 25,
  titleShotWhisper: 10,
  fansCelebrate: 30,
};

const LOSS_WEIGHTS = {
  rankingDrop: 40, rankingUnranked: 10,
  popularityLoss: 75,
  mediaQuestion: 60,
  confidenceHit: 50,
  trainerConcern: 40,
  rivalGloat: 25, rivalDismiss: 10,
  fansWorried: 25,
  podcastDebate: 20,
  injuryConcern: 15,
  comeback: 15,
  fansSupport: 20,
};

export class NarrativeChainService {
  constructor(db) {
    this.db = db;
  }

  // Gera e persiste uma cadeia de consequências após uma luta.
  // Retorna a chain salva.
  async generateAfterFight(fighter, opponent, result, booking, absWeek, isDraw = false) {
    if (isDraw) return null;

    const won = result.winnerId === fighter.id;
    const wc = fighter.weightClass ? fighter.weightClass.replace(/_/g, ' ') : 'peso';

    const ctx = this._buildContext(fighter, opponent, result, booking, won, wc);
    const elements = won
      ? this._rollWinChain(ctx)
      : this._rollLossChain(ctx);

    const chain = {
      id: 'nchain_' + generateId(),
      absWeek,
      fighterId: fighter.id,
      won,
      opponentName: opponent?.name || booking.opponentName || 'Desconhecido',
      method: result.method || '—',
      round: result.round || 1,
      isTitleFight: !!booking.isTitleFight,
      title: won ? '🏆 Consequências da Vitória' : '💔 Consequências da Derrota',
      icon: won ? '🏆' : '💔',
      consequences: elements,
    };

    await this.db.add('narrativeChains', chain);
    return chain;
  }

  // Pega as últimas N chains
  async getRecent(fighterId, limit = 3) {
    const all = await this.db.getAll('narrativeChains');
    const mine = all
      .filter(c => c.fighterId === fighterId)
      .sort((a, b) => (b.absWeek || 0) - (a.absWeek || 0))
      .slice(0, limit);
    return mine;
  }

  // Pega chains recentes (sem filtrar por fighterId) — output do getDashboard
  async getAllRecent(limit = 3) {
    const all = await this.db.getAll('narrativeChains');
    return all
      .sort((a, b) => (b.absWeek || 0) - (a.absWeek || 0))
      .slice(0, limit);
  }

  // ---- helpers internos ----

  _buildContext(fighter, opponent, result, booking, won, wc) {
    const oldRank = (fighter.ranking || 0) + (won ? 1 : -1); // heuristic delta
    const newRank = fighter.ranking || 0;
    const totalWins = fighter.record?.wins || 0;
    const streak = fighter.winStreak || 0;
    const oppRank = opponent?.ranking || 0;
    const oppDiff = oldRank - oppRank; // positive = beat someone lower
    const isDominant = result.method && ['KO', 'TKO'].includes(result.method) && result.round <= 2;
    const isComeback = result.method && !isDominant && !['Decision'].includes(result.method || '');
    const method = result.method || 'Decision';

    return { oldRank, newRank, wc, totalWins, streak, oppRank, oppDiff, isDominant, isComeback, method };
  }

  _rollWinChain(ctx) {
    const pool = [];
    const add = (key, fn) => {
      if (Math.random() * 100 < WIN_WEIGHTS[key]) pool.push(fn(ctx));
    };

    // Ranking
    if (ctx.oldRank > 0 && ctx.newRank > 0 && ctx.newRank < ctx.oldRank) {
      pool.push(WIN_ELEMENTS.rankingUp(ctx.oldRank, ctx.newRank, ctx.wc));
    } else if (ctx.oldRank <= 0 && ctx.newRank > 0) {
      pool.push(WIN_ELEMENTS.rankingEntered(ctx.oldRank <= 0 ? ctx.newRank : ctx.newRank, ctx.wc));
    } else if (ctx.newRank > 0) {
      add('rankingUnchanged', () => WIN_ELEMENTS.rankingUnchanged(ctx.newRank, ctx.wc));
    }

    // Popularidade
    const popGain = ctx.isDominant ? 5 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 3);
    pool.push(WIN_ELEMENTS.popularityGain(popGain, 50));

    // Mídia
    const mediaStyle = ctx.isDominant ? 'dominant' : ctx.method === 'KO' || ctx.method === 'TKO' ? 'ko' : ctx.isComeback ? 'comeback' : 'solid';
    add('mediaPraise', () => WIN_ELEMENTS.mediaPraise(mediaStyle));

    // Streak
    add('streakAlive', () => WIN_ELEMENTS.streakAlive(ctx.streak));

    // Rival
    add('rivalProvoke', () => WIN_ELEMENTS.rivalProvoke('um rival'));
    add('rivalSilence', () => WIN_ELEMENTS.rivalSilence('um rival'));

    // Sponsor
    add('sponsorInterest', () => WIN_ELEMENTS.sponsorInterest('Uma marca'));

    // Viral
    add('viralMoment', () => WIN_ELEMENTS.viralMoment('Twitter'));

    // Title shot
    add('titleShotWhisper', () => WIN_ELEMENTS.titleShotWhisper());

    // Fans
    add('fansCelebrate', () => WIN_ELEMENTS.fansCelebrate());

    return this._sample(pool, 3 + Math.floor(Math.random() * 2)); // 3-4 items
  }

  _rollLossChain(ctx) {
    const pool = [];
    const add = (key, fn) => {
      if (Math.random() * 100 < LOSS_WEIGHTS[key]) pool.push(fn(ctx));
    };

    // Ranking
    if (ctx.oldRank > 0 && ctx.newRank > 0 && ctx.newRank > ctx.oldRank) {
      pool.push(LOSS_ELEMENTS.rankingDrop(ctx.oldRank, ctx.newRank, ctx.wc));
    } else if (ctx.oldRank > 0 && !ctx.newRank) {
      pool.push(LOSS_ELEMENTS.rankingUnranked(ctx.oldRank, ctx.wc));
    } else {
      add('rankingDrop', () => LOSS_ELEMENTS.rankingDrop(ctx.oldRank, ctx.newRank || 0, ctx.wc));
    }

    // Popularidade
    const popLoss = 3 + Math.floor(Math.random() * 4);
    pool.push(LOSS_ELEMENTS.popularityLoss(popLoss, 50));

    // Mídia
    const mediaStyle = ctx.oppDiff > 5 ? 'upset' : ctx.method === 'KO' || ctx.method === 'TKO' ? 'finished' : 'decision';
    add('mediaQuestion', () => LOSS_ELEMENTS.mediaQuestion(mediaStyle));

    // Confiança
    add('confidenceHit', () => LOSS_ELEMENTS.confidenceHit());

    // Treinador
    add('trainerConcern', () => LOSS_ELEMENTS.trainerConcern());

    // Rival
    add('rivalGloat', () => LOSS_ELEMENTS.rivalGloat('um rival'));
    add('rivalDismiss', () => LOSS_ELEMENTS.rivalDismiss('um rival'));

    // Torcida
    add('fansWorried', () => LOSS_ELEMENTS.fansWorried());
    add('fansSupport', () => LOSS_ELEMENTS.fansSupport());

    // Podcast
    add('podcastDebate', () => LOSS_ELEMENTS.podcastDebate());

    // Lesão
    add('injuryConcern', () => LOSS_ELEMENTS.injuryConcern('ombro'));

    // Comeback
    add('comeback', () => LOSS_ELEMENTS.comeback());

    return this._sample(pool, 3 + Math.floor(Math.random() * 2)); // 3-4 items
  }

  _sample(arr, count) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
}
