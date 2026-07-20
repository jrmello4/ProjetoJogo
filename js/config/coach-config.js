// js/config/coach-config.js
export const COACH_SKILLS = {
  motivational: {
    name: 'Motivacional',
    description: 'Recupera 1 uso de carta especial',
    effect: { type: 'restoreSpecialUses', value: 1 },
  },
  strategist: {
    name: 'Estrategista',
    description: 'Revela posição do oponente no próximo round',
    effect: { type: 'revealPosition' },
  },
  finisher: {
    name: 'Finalizador',
    description: '+20% chance de finalização',
    effect: { type: 'finishChanceBonus', value: 0.20 },
  },
};
