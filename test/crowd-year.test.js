import { describe, it, expect, vi } from 'vitest';
import { CrowdService, PERSONA } from '../js/services/crowd-service.js';
import { YearReviewService } from '../js/services/year-review-service.js';
import { makeFighter } from './fixtures.js';

describe('CrowdService', () => {
  it('marca heel com heat alto e face com pop alta e pouco heat', () => {
    const heel = makeFighter({ narrativeHeat: 12, popularity: 40 });
    const face = makeFighter({ narrativeHeat: 1, popularity: 70 });
    expect(CrowdService.resolvePersona(heel)).toBe(PERSONA.HEEL);
    expect(CrowdService.resolvePersona(face)).toBe(PERSONA.FACE);
  });

  it('reage a finalização de heel com linhas e energia alta', () => {
    const fighter = makeFighter({ name: 'Vilão X', narrativeHeat: 15, popularity: 60 });
    const r = CrowdService.reactToFight({
      fighter,
      opponentName: 'Herói Y',
      won: true,
      isDraw: false,
      method: 'KO',
      rivalryIntensity: 7,
      isTitleFight: true,
    });
    expect(r.persona).toBe(PERSONA.HEEL);
    expect(r.energy).toBeGreaterThan(50);
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.chant).toBeTruthy();
    expect(r.lines.join(' ')).toMatch(/Herói Y|Vilão|arena|torcida|vaiou|cinturão/i);
  });

  it('gera fan mail memorável com nome do adversário', () => {
    const fighter = makeFighter({ name: 'Ana Costa', popularity: 70, narrativeHeat: 0 });
    const mail = CrowdService.generateFanMail({
      fighter,
      opponentName: 'Bia Rocha',
      won: true,
      isDraw: false,
      method: 'Submission',
      rivalryIntensity: 6,
    });
    expect(mail.length).toBeGreaterThan(0);
    expect(mail.some(m => m.text.includes('Bia Rocha') || m.text.includes('Ana') || m.text.includes('revanche'))).toBe(true);
  });

  it('decay semanal reduz heat', () => {
    const f = makeFighter({ narrativeHeat: 5, narrativeHype: 4 });
    CrowdService.applyWeeklyDecay(f);
    expect(f.narrativeHeat).toBe(4);
    expect(f.narrativeHype).toBe(3);
  });
});

describe('YearReviewService', () => {
  it('compõe retrospectiva a partir do career log e persiste', async () => {
    const store = {};
    const db = {
      get: async (_s, id) => store[id] || null,
      put: async (_s, doc) => { store[doc.id] = doc; },
    };
    const entries = [
      { fighterId: 'p1', type: 'finish', atAbsWeek: 40, magnitude: 70, data: { opponentName: 'Zé', method: 'KO' } },
      { fighterId: 'p1', type: 'rival_arc', atAbsWeek: 45, magnitude: 50, data: { rivalName: 'Max', won: true } },
      { fighterId: 'other', type: 'finish', atAbsWeek: 40, magnitude: 99, data: { opponentName: 'X' } },
    ];
    const careerLog = {
      all: async () => entries,
      publish: async () => {},
    };
    const notifs = [];
    const notif = { add: async (...a) => notifs.push(a) };
    const svc = new YearReviewService(db, careerLog, notif);
    const fighter = makeFighter({
      id: 'p1',
      name: 'Pedro',
      record: { wins: 6, losses: 1, draws: 0 },
      overallRating: 68,
      popularity: 50,
    });

    const review = await svc.processYearEnd(52, fighter);
    expect(review).toBeTruthy();
    expect(review.yearNumber).toBe(1);
    expect(review.chapters.length).toBeGreaterThanOrEqual(2);
    expect(review.chapters.map(c => c.body).join(' ')).toMatch(/Zé|Max|Pedro/i);
    expect(store.yearReview?.review?.fighterName).toBe('Pedro');
    expect(notifs.length).toBe(1);

    // Só roda no fim de ano
    expect(await svc.processYearEnd(51, fighter)).toBeNull();
  });
});
