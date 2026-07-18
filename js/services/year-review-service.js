import { PODCAST_CONFIG } from '../config/game-config.js';
import { escapeHtml } from '../utils/helpers.js';

// Retrospectiva anual — no fim do ano de jogo (semana múltipla de 52),
// monta um "documentário de temporada" a partir do careerLog. O jogador
// não joga minigame: ele vê a história do ano contada de volta.

const TYPE_LINE = {
  title_won: (d) => d.defense
    ? `defendeu o cinturão${d.promo ? ` (${d.promo})` : ''}`
    : `conquistou o ouro${d.promo ? ` no ${d.promo}` : ''}`,
  upset: (d) => d.opponentName ? `zebra sobre ${d.opponentName}` : 'uma zebra',
  finish: (d) => d.opponentName ? `finalizou ${d.opponentName}${d.method ? ` (${d.method})` : ''}` : 'finalizou alguém',
  rivalry_born: (d) => d.opponentName ? `nasceu a rivalidade com ${d.opponentName}` : 'nasceu uma rivalidade',
  rival_arc: (d) => d.rivalName
    ? (d.won ? `${d.rivalName} subiu sem você no card` : `${d.rivalName} tropeçou`)
    : 'o rival se mexeu',
  provocation: (d) => d.targetName ? `provocou ${d.targetName}` : 'provocou nas redes',
  viral: () => 'viralizou',
  streak: (d) => typeof d.count === 'number' ? `sequência de ${d.count}` : 'sequência quente',
  permanent_scar: (d) => d.bodyPart ? `sequela no(a) ${d.bodyPart}` : 'sequela permanente',
  dna_discovered: (d) => d.traitLabel ? `descobriu "${d.traitLabel}"` : 'revelou um traço',
  narrative_choice: (d) => d.choice ? `escolheu: ${String(d.choice).slice(0, 40)}` : 'decisão de bastidores',
  super_fight_win: (d) => d.opponentName ? `venceu superfight vs ${d.opponentName}` : 'venceu uma superfight',
  weapon_revealed: () => 'mostrou arma nova',
  figured_out: () => 'foi decifrado pelo circuito',
  reinvention: () => 'se reinventou',
};

export class YearReviewService {
  constructor(db, careerLogService, notifService) {
    this.db = db;
    this.careerLogService = careerLogService;
    this.notifService = notifService;
  }

  async getLatest() {
    const raw = await this.db.get('gameState', 'yearReview');
    return raw?.review || null;
  }

  /**
   * Chamar quando absWeek % 52 === 0 (fim de ano).
   * Gera review do ano que fechou (últimas 52 semanas).
   */
  async processYearEnd(absWeekNow, fighter) {
    if (!fighter || absWeekNow <= 0 || absWeekNow % 52 !== 0) return null;

    const yearNumber = absWeekNow / 52;
    const windowStart = absWeekNow - 52;
    const all = this.careerLogService ? await this.careerLogService.all() : [];
    const yearMoments = all
      .filter(e => e.fighterId === fighter.id && e.atAbsWeek > windowStart && e.atAbsWeek <= absWeekNow)
      .sort((a, b) => b.magnitude - a.magnitude);

    const rec = fighter.record || { wins: 0, losses: 0, draws: 0 };
    const chapters = [];

    // Capítulo 1 — números
    chapters.push({
      title: 'O cartel que importa',
      body: `${fighter.name} fecha o Ano ${yearNumber} com ${rec.wins}-${rec.losses}-${rec.draws} na carreira e OVR ${fighter.overallRating}. Popularidade: ${fighter.popularity || 0}.`,
    });

    // Capítulo 2 — momentos (top 5)
    const top = yearMoments.slice(0, 5);
    if (top.length) {
      const bullets = top.map(m => {
        const fn = TYPE_LINE[m.type];
        const line = fn ? fn(m.data || {}) : m.type;
        return `• ${line}`;
      });
      chapters.push({
        title: 'O que a temporada não esquece',
        body: bullets.join('\n'),
      });
    } else {
      chapters.push({
        title: 'Ano de construção',
        body: 'Poucos holofotes. Às vezes o documentário começa no silêncio — e o Ano 2 cobra o enredo.',
      });
    }

    // Capítulo 3 — persona / legado do ano
    const heat = fighter.narrativeHeat || 0;
    const titles = fighter.titlesWon || 0;
    let closing;
    if (titles > 0) closing = 'Ouro na cintura ou na memória — o ano te colocou na conversa de elite.';
    else if (heat >= 8) closing = 'Você saiu vilão da temporada. A torcida vaiou — e comprou o PPV.';
    else if ((fighter.popularity || 0) >= 70) closing = 'Superstar em formação. O microfone já te procura antes da luta.';
    else closing = 'Ainda há capítulos em branco. O próximo ano não perdoa quem fica quieto demais.';

    chapters.push({ title: 'Plano de fundo', body: closing });

    const review = {
      yearNumber,
      absWeek: absWeekNow,
      fighterId: fighter.id,
      fighterName: fighter.name,
      headline: `Temporada ${yearNumber} — ${fighter.name}`,
      teaser: top[0]
        ? `Ano ${yearNumber}: ${(TYPE_LINE[top[0].type] || (() => top[0].type))(top[0].data || {})}.`
        : `Ano ${yearNumber} de ${fighter.name}: construção.`,
      chapters,
      momentCount: yearMoments.length,
    };

    await this.db.put('gameState', { id: 'yearReview', absWeek: absWeekNow, review });

    if (this.notifService) {
      await this.notifService.add(
        'headline',
        `🎬 Retrospectiva Ano ${yearNumber}`,
        review.teaser
      );
    }

    // Também publica no career log — entra no documentário final
    if (this.careerLogService) {
      await this.careerLogService.publish(fighter.id, 'year_review', absWeekNow, 55, {
        yearNumber,
        momentCount: yearMoments.length,
        teaser: review.teaser,
      });
    }

    return review;
  }

  static renderCard(review) {
    if (!review) return '';
    return `
      <div class="card mb-4" data-reveal style="border-top-color:var(--gold)">
        <div class="card-header">
          <span class="card-title">🎬 ${escapeHtml(review.headline)}</span>
          <span class="text-xs text-muted">${review.momentCount || 0} momentos</span>
        </div>
        <p class="text-sm text-muted mb-3">${escapeHtml(review.teaser)}</p>
        ${(review.chapters || []).map(ch => `
          <div class="mb-3">
            <div class="text-xs text-muted mb-1">${escapeHtml(ch.title)}</div>
            <div class="text-sm" style="line-height:1.5;white-space:pre-line">${escapeHtml(ch.body)}</div>
          </div>
        `).join('')}
        <div class="text-xs text-muted">Apresentado em parceria com ${escapeHtml(PODCAST_CONFIG.SHOW_NAME)}</div>
      </div>`;
  }
}
