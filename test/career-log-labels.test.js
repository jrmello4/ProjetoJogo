import { describe, it, expect } from 'vitest';
import { careerLogEntryLabel } from '../js/services/career-log-labels.js';

describe('careerLogEntryLabel', () => {
  it('vitória em luta: ícone de soco e oponente/método no texto', () => {
    const r = careerLogEntryLabel({ type: 'fight_completed', data: { won: true, opponentName: 'Bia', method: 'KO' } });
    expect(r.icon).toBe('🥊');
    expect(r.text).toBe('Vitória · Bia · KO');
  });

  it('derrota em luta: ícone de queda', () => {
    const r = careerLogEntryLabel({ type: 'fight_completed', data: { won: false, opponentName: 'Lia' } });
    expect(r.icon).toBe('📉');
    expect(r.text).toContain('Derrota');
  });

  it('empate em luta', () => {
    const r = careerLogEntryLabel({ type: 'fight_completed', data: { won: null } });
    expect(r.text).toContain('Empate');
  });

  it('cinturão conquistado', () => {
    const r = careerLogEntryLabel({ type: 'title_won', data: { weightClass: 'Leve' } });
    expect(r.icon).toBe('🏆');
    expect(r.text).toContain('Cinturão');
  });

  it('tipo desconhecido cai no fallback humanizado', () => {
    const r = careerLogEntryLabel({ type: 'algo_novo', data: {} });
    expect(r.text).toBe('algo novo');
  });

  it('entrada nula não quebra', () => {
    expect(() => careerLogEntryLabel(null)).not.toThrow();
  });
});
