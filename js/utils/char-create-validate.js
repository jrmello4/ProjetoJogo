// Validação pura do wizard de criação de personagem (PR 1).
// Sem DOM — Next / Start e unit tests compartilham o mesmo gate.
import { ARCHETYPES, ORIGINS, DIFFICULTIES, CHALLENGE_MODES } from '../config/game-config.js';
import { sanitizePlayerName } from './helpers.js';

/**
 * @param {object} draft
 * @param {number|'all'} step - 1..4 or 'all' (Start)
 * @param {{ academies?: {id:string}[], managers?: {id:string}[], hasCompletedCareer?: boolean }} ctx
 * @returns {{ ok: true } | { ok: false, message: string, field?: string }}
 */
export function validateCharCreateStep(draft, step, ctx = {}) {
  const all = step === 'all';
  const n = all ? 0 : step;

  if (all || n === 1 || n === 4) {
    const name = sanitizePlayerName(draft?.name, { fallback: '' });
    if (!name) {
      return { ok: false, message: 'Digite um nome para o lutador.', field: 'name' };
    }
    if (draft.weightClass === 'Heavyweight' && !ctx.hasCompletedCareer) {
      return {
        ok: false,
        message: 'Peso Pesado desbloqueia ao completar uma carreira.',
        field: 'weightClass',
      };
    }
  }

  if (all || n === 2 || n === 4) {
    if (!draft?.archetype || !ARCHETYPES[draft.archetype]) {
      return { ok: false, message: 'Escolha um arquétipo.', field: 'archetype' };
    }
    if (!draft?.origin || !ORIGINS[draft.origin]) {
      return { ok: false, message: 'Escolha uma origem esportiva.', field: 'origin' };
    }
  }

  if (all || n === 3 || n === 4) {
    const academies = ctx.academies || [];
    const managers = ctx.managers || [];
    if (!draft?.academyId || !academies.some(a => a.id === draft.academyId)) {
      return { ok: false, message: 'Escolha uma academia.', field: 'academyId' };
    }
    if (!draft?.managerId || !managers.some(m => m.id === draft.managerId)) {
      return { ok: false, message: 'Escolha um empresário.', field: 'managerId' };
    }
  }

  if (all || n === 4) {
    if (!DIFFICULTIES.some(d => d.id === draft?.difficultyId)) {
      return { ok: false, message: 'Escolha uma reserva financeira.', field: 'difficultyId' };
    }
    if (draft.challengeMode) {
      if (!ctx.hasCompletedCareer) {
        return {
          ok: false,
          message: 'Modos desafio desbloqueiam ao completar uma carreira.',
          field: 'challengeMode',
        };
      }
      if (!CHALLENGE_MODES[draft.challengeMode]) {
        return { ok: false, message: 'Modo desafio inválido.', field: 'challengeMode' };
      }
    }
  }

  return { ok: true };
}
