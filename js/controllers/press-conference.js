import { clamp } from '../utils/helpers.js';

const SCENARIOS = [
  {
    question: 'O que você espera desta luta?',
    options: [
      { text: 'Vou dominar desde o primeiro round.', effects: { hype: 5, morale: 3, popularity: 2 } },
      { text: 'Respeito meu oponente, mas confio na minha preparação.', effects: { hype: 2, morale: 5, popularity: 4 } },
      { text: 'Não conheço esse cara.', effects: { hype: 8, morale: -3, popularity: -2 } },
    ],
  },
  {
    question: 'Como você se sente sobre o oponente?',
    options: [
      { text: 'Ele é um guerreiro digno de respeito.', effects: { hype: 1, morale: 4, popularity: 5 } },
      { text: 'Vou mostrar quem manda no octógono.', effects: { hype: 6, morale: 2, popularity: 1 } },
      { text: 'Ele não está no meu nível.', effects: { hype: 7, morale: -2, popularity: -3 } },
    ],
  },
  {
    question: 'Qual é seu objetivo nesta organização?',
    options: [
      { text: 'Tornar-me o melhor do mundo.', effects: { hype: 4, morale: 5, popularity: 3 } },
      { text: 'Cada luta é uma nova oportunidade.', effects: { hype: 2, morale: 6, popularity: 4 } },
      { text: 'Só me importo com o dinheiro.', effects: { hype: 5, morale: -1, popularity: -4 } },
    ],
  },
  {
    question: 'O que você diria aos fãs?',
    options: [
      { text: 'Obrigado pelo apoio, vocês são incríveis!', effects: { hype: 2, morale: 3, popularity: 6 } },
      { text: 'Vou dar o melhor de mim no ringue.', effects: { hype: 3, morale: 4, popularity: 3 } },
      { text: 'Não me importem, deixem-me treinar.', effects: { hype: 4, morale: 1, popularity: -2 } },
    ],
  },
];

export class PressConference {
  static getScenarios() {
    return SCENARIOS;
  }

  static applyEffects(fighter, effects) {
    // DNA: emotionallyUnstable amplifica efeitos
    const multiplier = fighter.dna.emotionallyUnstable ? 1.5 : 1.0;

    fighter.morale = clamp(fighter.morale + Math.round(effects.morale * multiplier), 0, 100);
    fighter.popularity = clamp(fighter.popularity + Math.round(effects.popularity * multiplier), 0, 100);

    return effects;
  }

  static getTotalHype(effects) {
    return effects.hype || 0;
  }
}