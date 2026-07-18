import { PODCAST_CONFIG } from '../config/game-config.js';
import { escapeHtml } from '../utils/helpers.js';

// Podcast narrativo — o mundo "comenta" a carreira do jogador.
// Não é minigame: é memória. Cada episódio só cita fatos do careerLog,
// do último arco de rival e do cartel atual. Sem filler.

const TYPE_HOOK = {
  title_won: (d) => d.defense
    ? `defesa de cinturão${d.promo ? ` no ${d.promo}` : ''}`
    : `conquista de título${d.promo ? ` no ${d.promo}` : ''}`,
  upset: (d) => d.opponentName ? `zebra sobre ${d.opponentName}` : 'uma zebra absurda',
  finish: (d) => d.opponentName
    ? `finalização em ${d.opponentName}${d.method ? ` (${d.method})` : ''}`
    : 'uma finalização limpa',
  rivalry_born: (d) => d.opponentName ? `nascimento da rivalidade com ${d.opponentName}` : 'uma rivalidade nova',
  rival_arc: (d) => d.rivalName
    ? (d.won ? `${d.rivalName} vencendo sem o nosso homem no card` : `a queda de ${d.rivalName}`)
    : 'movimento de um rival',
  provocation: (d) => d.targetName ? `provocação a ${d.targetName}` : 'provocação nas redes',
  viral: () => 'um post que viralizou',
  streak: (d) => typeof d.count === 'number' ? `sequência de ${d.count} vitórias` : 'uma sequência quente',
  permanent_scar: (d) => d.bodyPart ? `sequela no(a) ${d.bodyPart}` : 'uma sequela permanente',
  dna_discovered: (d) => d.traitLabel ? `o traço "${d.traitLabel}" saindo do armário` : 'um traço oculto revelado',
  narrative_choice: (d) => d.choice ? `a decisão: "${String(d.choice).slice(0, 48)}"` : 'uma escolha de bastidores',
  weapon_revealed: (d) => d.plan ? `a arma nova (${d.plan})` : 'uma arma revelada no octógono',
  figured_out: () => 'o mundo abrindo o livro sobre o jogo dele',
  reinvention: () => 'uma reinvenção no meio da carreira',
  rematch: (d) => d.opponentName ? `revanche com ${d.opponentName}` : 'uma revanche',
  crowd_night: (d) => d.chant ? `a arena em "${d.chant}"` : 'uma noite de torcida em êxtase',
  year_review: (d) => d.teaser || `retrospectiva do ano ${d.yearNumber || ''}`,
  super_fight_win: (d) => d.opponentName ? `superfight vs ${d.opponentName}` : 'uma superfight',
};

export class PodcastService {
  constructor(db, careerLogService, notifService) {
    this.db = db;
    this.careerLogService = careerLogService;
    this.notifService = notifService;
  }

  async getLatest() {
    const raw = await this.db.get('gameState', 'podcast');
    return raw?.episode || null;
  }

  /**
   * Gera episódio se a semana cai no intervalo e há matéria-prima.
   * @param {number} absWeekNow
   * @param {object} fighter
   * @param {{ rivalStories?: Array }} [ctx]
   * @returns {object|null} episode
   */
  async processWeek(absWeekNow, fighter, ctx = {}) {
    if (!fighter || fighter.status === 'retired') return null;
    const interval = PODCAST_CONFIG.INTERVAL_WEEKS;
    if (absWeekNow < interval || absWeekNow % interval !== 0) return null;

    const recent = this.careerLogService
      ? await this.careerLogService.recentSince(absWeekNow, PODCAST_CONFIG.LOOKBACK_WEEKS)
      : [];
    const mine = recent.filter(e => e.fighterId === fighter.id);
    const rivalStories = ctx.rivalStories || [];

    if (mine.length < PODCAST_CONFIG.MIN_MOMENTS && rivalStories.length === 0) {
      // Sem drama real: episódio só com cartel se o lutador já tem história mínima
      if ((fighter.totalFights || 0) < 2) return null;
    }

    const episode = this.composeEpisode(fighter, mine, rivalStories, absWeekNow);
    await this.db.put('gameState', {
      id: 'podcast',
      absWeek: absWeekNow,
      episode,
    });

    if (this.notifService) {
      await this.notifService.add(
        'headline',
        `🎙️ ${PODCAST_CONFIG.SHOW_NAME}`,
        episode.teaser
      );
    }

    return episode;
  }

  composeEpisode(fighter, moments, rivalStories, absWeekNow) {
    const rec = fighter.record || { wins: 0, losses: 0, draws: 0 };
    const hooks = [];

    for (const m of moments.slice().sort((a, b) => b.magnitude - a.magnitude).slice(0, 4)) {
      const fn = TYPE_HOOK[m.type];
      if (fn) hooks.push(fn(m.data || {}));
    }
    for (const s of rivalStories.slice(0, 2)) {
      if (s.summary) hooks.push(s.summary);
    }

    const segments = [];
    segments.push({
      kind: 'cold_open',
      text: `${PODCAST_CONFIG.HOST}: Bem-vindos ao ${PODCAST_CONFIG.SHOW_NAME}. Hoje o microfone aponta para ${fighter.name} — cartel ${rec.wins}-${rec.losses}-${rec.draws}.`,
    });

    if (hooks.length === 0) {
      segments.push({
        kind: 'body',
        text: `Semana quieta no octógono? Talvez. Mas ${fighter.name} continua no radar com OVR ${fighter.overallRating} e popularidade ${fighter.popularity || 0}. O silêncio, no MMA, quase sempre precede barulho.`,
      });
    } else {
      const list = hooks.map((h, i) => `${i + 1}) ${h}`).join('; ');
      segments.push({
        kind: 'body',
        text: `O que marcou o período: ${list}. Isso não é ruído de bastidor — é o tipo de coisa que vira capítulo de documentário.`,
      });
    }

    // Fechamento com tensão / pergunta aberta
    const lastFight = fighter.fights?.[0];
    if (lastFight) {
      const tone = lastFight.won === true
        ? `saiu por cima de ${lastFight.opponent}`
        : lastFight.won === false
          ? `caiu para ${lastFight.opponent}`
          : `empatou com ${lastFight.opponent}`;
      segments.push({
        kind: 'close',
        text: `Última vez no cage, ${fighter.name} ${tone} (${lastFight.method}). A pergunta que a torcida leva pra casa: o próximo round da carreira eleva ou apaga isso?`,
      });
    } else {
      segments.push({
        kind: 'close',
        text: `Ainda falta o round que define a persona. Quando ele chegar, este microfone estará ligado.`,
      });
    }

    const teaser = hooks[0]
      ? `${fighter.name} e ${hooks[0]} — novo episódio no ar.`
      : `${fighter.name} sob o holofote do ${PODCAST_CONFIG.SHOW_NAME}.`;

    return {
      showName: PODCAST_CONFIG.SHOW_NAME,
      host: PODCAST_CONFIG.HOST,
      title: hooks[0]
        ? `Ep. — ${fighter.name}: ${hooks[0]}`
        : `Ep. — O radar em ${fighter.name}`,
      teaser,
      absWeek: absWeekNow,
      segments,
      fighterId: fighter.id,
      fighterName: fighter.name,
    };
  }

  /** HTML do card do dashboard. */
  static renderCard(episode) {
    if (!episode) return '';
    return `
      <div class="card mb-4 podcast-card" data-reveal style="border-top-color:var(--accent)">
        <div class="card-header">
          <span class="card-title">🎙️ ${escapeHtml(episode.showName)}</span>
          <span class="text-xs text-muted">Semana ${episode.absWeek}</span>
        </div>
        <div class="text-sm font-bold mb-2">${escapeHtml(episode.title)}</div>
        <div class="podcast-segments" style="display:flex;flex-direction:column;gap:0.6rem">
          ${(episode.segments || []).map(seg => `
            <p class="text-sm" style="line-height:1.5;margin:0;${seg.kind === 'cold_open' ? 'font-style:italic;color:var(--text-muted)' : ''}">${escapeHtml(seg.text)}</p>
          `).join('')}
        </div>
      </div>`;
  }
}
