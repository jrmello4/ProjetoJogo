import { describe, it, expect } from 'vitest';
import { CareerLogService } from '../js/services/career-log-service.js';
import { BiographyService } from '../js/services/biography-service.js';
import { PodcastService } from '../js/services/podcast-service.js';
import { NARRATIVE_EVENTS } from '../js/config/game-config.js';
import { makeFighter } from './fixtures.js';

describe('CareerLogService.fillEventTemplate', () => {
  it('substitui placeholders de rival_victory com nomes reais', () => {
    const template = NARRATIVE_EVENTS.rival_victory[0];
    const filled = CareerLogService.fillEventTemplate(template, {
      rivalName: 'João Silva',
      opponentName: 'Carlos Lima',
      method: 'KO',
    });
    expect(filled.prompt).toContain('João Silva');
    expect(filled.prompt).toContain('Carlos Lima');
    expect(filled.prompt).not.toContain('{rivalName}');
  });

  it('preenche rival_loss', () => {
    const filled = CareerLogService.fillEventTemplate(NARRATIVE_EVENTS.rival_loss[0], {
      rivalName: 'Rival X',
      opponentName: 'Zebra Y',
    });
    expect(filled.prompt).toMatch(/Rival X/);
    expect(filled.prompt).toMatch(/Zebra Y/);
  });
});

describe('CareerLogService.selectNarrativeEvent', () => {
  const svc = new CareerLogService({ get: async () => null, put: async () => {} });

  it('inclui moral_dilemma quando há parceiros de treino', () => {
    const fighter = makeFighter({
      fights: [{ won: true, opponent: 'A', method: 'Decision', round: 3, date: '2020-01-01' }],
      winStreak: 0,
      sparredWith: { 'f-partner': 3 },
    });
    // Força pool só com moral: sem streak/loss/title
    fighter.ranking = 99;
    fighter.titlesWon = 0;
    fighter.cash = 50000;
    fighter.injury = null;
    fighter.injuryCount = 0;
    fighter.popularity = 10;

    // Rola várias vezes — com partners deve às vezes devolver moral_dilemma
    let hit = false;
    for (let i = 0; i < 40; i++) {
      const ev = svc.selectNarrativeEvent(fighter, { hasTrainingPartners: true });
      if (ev && ev.prompt.includes('parceiro de treino')) hit = true;
    }
    expect(hit).toBe(true);
  });

  it('pode puxar rival_victory genérico com hasActiveRival', () => {
    const fighter = makeFighter({
      fights: [],
      winStreak: 0,
      ranking: 99,
      titlesWon: 0,
      cash: 50000,
      injury: null,
      injuryCount: 0,
      popularity: 10,
    });
    let hit = false;
    for (let i = 0; i < 30; i++) {
      const ev = svc.selectNarrativeEvent(fighter, { hasActiveRival: true });
      if (ev && /rival|compara/i.test(ev.prompt)) hit = true;
    }
    expect(hit).toBe(true);
  });
});

describe('BiographyService', () => {
  it('compõe prosa a partir de cartel, título e rival sem inventar nomes', () => {
    const fighter = makeFighter({
      name: 'Ana Costa',
      record: { wins: 12, losses: 2, draws: 0 },
      totalFights: 14,
      titlesWon: 1,
      popularity: 80,
      status: 'roster',
      fights: [
        { opponent: 'Bia Rocha', won: true, method: 'KO', round: 1, date: '2024-01-01', opponentId: 'b' },
        { opponent: 'Lia Nunes', won: true, method: 'Decision', round: 3, date: '2023-06-01', opponentId: 'c' },
      ],
    });
    const bio = BiographyService.compose(fighter, {
      topMoments: [
        { type: 'title_won', magnitude: 90, data: { promo: 'UFCBR', defense: false } },
        { type: 'upset', magnitude: 70, data: { opponentName: 'Campeã Antiga', gap: 12 } },
      ],
      rivalryInfo: {
        opponentName: 'Bia Rocha',
        rivalry: { type: 'grudge', intensity: 8 },
      },
    });
    expect(bio.headline).toMatch(/Ana Costa|campeão/i);
    expect(bio.paragraphs.some(p => p.includes('Ana Costa'))).toBe(true);
    expect(bio.paragraphs.some(p => p.includes('Bia Rocha'))).toBe(true);
    expect(bio.paragraphs.join(' ')).toMatch(/cinturão|ouro/i);
    // Nunca inventa adversário que não foi passado
    expect(bio.paragraphs.join(' ')).not.toMatch(/Desconhecido Fictício/);
  });

  it('renderCard escapa HTML', () => {
    const html = BiographyService.renderCard({
      headline: '<script>',
      paragraphs: ['texto <b>x</b>'],
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('PodcastService.composeEpisode', () => {
  it('monta episódio com momentos reais e teaser memorável', () => {
    const fighter = makeFighter({
      name: 'Pedro Vale',
      record: { wins: 8, losses: 1, draws: 0 },
      totalFights: 9,
      overallRating: 72,
      popularity: 55,
      fights: [{ opponent: 'Zé', won: true, method: 'Submission', round: 2, date: '2025-01-01' }],
    });
    const svc = new PodcastService(null, null, null);
    const episode = svc.composeEpisode(
      fighter,
      [
        { type: 'finish', magnitude: 60, data: { opponentName: 'Zé', method: 'Submission' } },
        { type: 'rival_arc', magnitude: 50, data: { rivalName: 'Max', won: true, opponentName: 'Outro' } },
      ],
      [{ summary: 'Max vencendo Outro' }],
      12
    );
    expect(episode.showName).toBeTruthy();
    expect(episode.segments.length).toBeGreaterThanOrEqual(2);
    expect(episode.teaser).toMatch(/Pedro Vale/);
    expect(episode.segments.map(s => s.text).join(' ')).toMatch(/Zé|Max|Submission/i);
  });
});
