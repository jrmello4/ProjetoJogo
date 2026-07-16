import { Fighter } from '../js/models/fighter.js';

export function makeFighter(overrides = {}) {
  return new Fighter({
    id: overrides.id || 'f-' + Math.random().toString(36).slice(2),
    name: overrides.name || 'Test Fighter',
    age: overrides.age ?? 27,
    nationality: 'BR',
    weightClass: 'lightweight',
    fightingStyle: 'balanced',
    record: { wins: 0, losses: 0, draws: 0 },
    attributes: overrides.attributes || {},
    hidden: { evolution: 50, discipline: 50, potential: 60, ...(overrides.hidden || {}) },
    status: 'active',
    organizationId: null,
    createdAt: '2026-01-01',
    ...overrides,
  });
}
