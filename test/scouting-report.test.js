import { describe, it, expect } from 'vitest';
import { deriveScoutingReads } from '../js/services/scouting-report.js';

describe('deriveScoutingReads', () => {
  it('nível 0: nada conhecido, tudo desconhecido, sem ameaças/oportunidades', () => {
    const r = deriveScoutingReads({ level: 0, tendencies: null });
    expect(r.coveragePct).toBe(0);
    expect(r.confidence).toBe('—');
    expect(r.threats).toHaveLength(0);
    expect(r.opportunities).toHaveLength(0);
    expect(r.unknown.join(' ')).toContain('tudo');
  });

  it('nível 1 striker + cardio fraco: ameaça de trocação, oportunidade de ritmo, confiança "Indício"', () => {
    const r = deriveScoutingReads({ level: 1, tendencies: { archetype: 'striker', cardio: 'lowCardio', iq: 'midIq', chin: 50 } });
    expect(r.confidence).toBe('Indício');
    expect(r.threats.some(t => t.includes('Trocação'))).toBe(true);
    expect(r.opportunities.some(o => o.includes('Cansa'))).toBe(true);
    expect(r.unknown).toContain('poder');
  });

  it('nível 2: revela poder/sangue-frio; só faltam números exatos e DNA', () => {
    const r = deriveScoutingReads({ level: 2, tendencies: { archetype: 'mixed', cardio: 'midCardio', iq: 'midIq', chin: 50, power: 'powerful', composure: 'nervous' } });
    expect(r.confidence).toBe('Provável');
    expect(r.threats.some(t => t.includes('Poder de nocaute'))).toBe(true);
    expect(r.opportunities.some(o => o.includes('Vacila'))).toBe(true);
    expect(r.unknown).toEqual(['números exatos', 'DNA oculto']);
  });

  it('nível 3: 100% conhecido, nada desconhecido, confirmado', () => {
    const r = deriveScoutingReads({ level: 3, tendencies: { archetype: 'grappler', cardio: 'highCardio', iq: 'highIq', chin: 70 } });
    expect(r.coveragePct).toBe(100);
    expect(r.unknown).toHaveLength(0);
    expect(r.confidence).toBe('Confirmado');
  });

  it('queixo alto vira ameaça; queixo baixo vira oportunidade', () => {
    const iron = deriveScoutingReads({ level: 2, tendencies: { archetype: 'mixed', cardio: 'midCardio', iq: 'midIq', chin: 80 } });
    expect(iron.threats.some(t => t.includes('Queixo de ferro'))).toBe(true);
    const glass = deriveScoutingReads({ level: 2, tendencies: { archetype: 'mixed', cardio: 'midCardio', iq: 'midIq', chin: 30 } });
    expect(glass.opportunities.some(o => o.includes('Queixo frágil'))).toBe(true);
  });

  it('dossiê nulo não quebra', () => {
    expect(() => deriveScoutingReads(null)).not.toThrow();
    expect(deriveScoutingReads(null).coveragePct).toBe(0);
  });
});
