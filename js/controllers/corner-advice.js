import { CORNER_INSTRUCTIONS } from '../config/game-config.js';

// §C.2 — sinergia técnico-atleta: o que o córner sugere entre rounds, antes
// de qualquer clique do jogador. Puro (sem DB, sem side effects em Fighter) —
// mesmo padrão de PressConference/TrainingCamp: a regra de negócio vive aqui,
// a orquestração (fetch de Academy, exibição, resolução da Promise) fica em
// app.js.
export class CornerAdvice {
  // A personalidade do headCoach decide o VIÉS da leitura (spec §C.2):
  // `aggressive` e `cautious` têm um padrão fixo — é quem eles SÃO, não uma
  // leitura da luta. `analytical` de fato lê o cartão parcial ao vivo, com a
  // MESMA informação que um córner real teria entre rounds: `cardA`/`cardB`
  // (10-point must acumulado), não a performance bruta — igual ao comentário
  // já existente em simulation.js sobre por que cardA/cardB existem.
  //
  // `info` é o objeto recebido por cornerHooks.onRoundEnd (round, cardA,
  // cardB, totalScoreA, totalScoreB, roundResult...).
  static suggest(personality, info) {
    if (personality === 'aggressive') return 'aggressive';
    if (personality === 'cautious') return 'defensive';

    // analytical
    const cardA = info?.cardA ?? info?.totalScoreA ?? 0;
    const cardB = info?.cardB ?? info?.totalScoreB ?? 0;
    const diff = cardA - cardB;
    if (diff < 0) return 'defensive';   // atrás no cartão — segurar o dano, não arriscar mais
    if (diff >= 3) return 'aggressive'; // folga confortável (mais que uma margem de round limpo) — fechar a luta
    return 'balanced';
  }

  // Sinergia baixa = comunicação ruim = leitura "genérica ou errada" (spec
  // §C.2). Com chance ~ (100 - coachSynergy) / 150, a sugestão REAL é trocada
  // por outra chave aleatória de CORNER_INSTRUCTIONS.
  //
  // Por que /150 e não /100: em coachSynergy=0 isso dá ~67% de chance de
  // embaralhar — ainda deixa ~1/3 dos casos em que o técnico acerta por
  // puro acaso/instinto profissional, em vez de "sempre erra" (0% de chance
  // de acerto soaria como o técnico sendo incompetente, não só pouco
  // confiável — a fraseologia do spec é "genérica ou errada", não "sempre
  // errada"). Em coachSynergy=100 a chance é 0 — sinergia máxima é leitura
  // sempre correta. Linear entre os dois extremos.
  static applySynergyNoise(suggestedKey, coachSynergy) {
    const synergy = Math.max(0, Math.min(100, coachSynergy ?? 40));
    const scrambleChance = (100 - synergy) / 150;

    if (Math.random() >= scrambleChance) {
      return { key: suggestedKey, scrambled: false };
    }

    const alternatives = Object.keys(CORNER_INSTRUCTIONS).filter(k => k !== suggestedKey);
    const key = alternatives[Math.floor(Math.random() * alternatives.length)] || suggestedKey;
    return { key, scrambled: true };
  }

  // O que app.js chama de fato antes de montar os botões de escolha —
  // combina os dois passos acima.
  static getSuggestion(personality, coachSynergy, info) {
    const real = this.suggest(personality, info);
    return this.applySynergyNoise(real, coachSynergy);
  }
}
