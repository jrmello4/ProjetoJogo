import { ONBOARDING_STEPS } from '../config/game-config.js';

// P7.4 — onboarding guiado. Serviço puro (sem DB): lê o fighter, devolve
// qual dica mostrar. As dicas somem progressivamente (uma por vez) e nunca
// mais voltam depois do último passo ou de um dismiss explícito.
export class OnboardingService {
  static isComplete(fighter) {
    return ONBOARDING_STEPS.every(step => step.done(fighter));
  }

  static shouldShow(fighter) {
    if (!fighter.onboarding || fighter.onboarding.dismissed) return false;
    return !this.isComplete(fighter);
  }

  // Primeiro passo ainda não concluído — null quando tudo já foi feito.
  static activeStep(fighter) {
    return ONBOARDING_STEPS.find(step => !step.done(fighter)) || null;
  }

  static progress(fighter) {
    const done = ONBOARDING_STEPS.filter(step => step.done(fighter)).length;
    return { done, total: ONBOARDING_STEPS.length };
  }

  // Lista completa com o estado de cada passo — alimenta o tracker visual
  // do dashboard (ícones + checkmarks), não só a dica ativa.
  static steps(fighter) {
    return ONBOARDING_STEPS.map(step => ({
      id: step.id,
      label: step.label,
      hint: step.hint,
      done: step.done(fighter),
    }));
  }

  static dismiss(fighter) {
    fighter.onboarding = { ...fighter.onboarding, dismissed: true };
  }

  static markOfferAccepted(fighter) {
    if (fighter.onboarding.offerAccepted) return;
    fighter.onboarding = { ...fighter.onboarding, offerAccepted: true };
  }

  static markCampConfigured(fighter) {
    if (fighter.onboarding.campConfigured) return;
    fighter.onboarding = { ...fighter.onboarding, campConfigured: true };
  }

  static markWeighedIn(fighter) {
    if (fighter.onboarding.weighedIn) return;
    fighter.onboarding = { ...fighter.onboarding, weighedIn: true };
  }
}
