import { READINESS_CONFIG } from '../config/game-config.js';
import { clamp } from '../utils/helpers.js';

// ===== Prontidão (item 4) =====
// O score que transforma as telas em consequência. Calculado na noite da
// luta a partir do que o jogador fez na janela do booking: camp, plano de
// jogo, scouting, fadiga, moral e pesagem. O adversário de IA tem o dele
// (profissional sempre faz camp). O GAP entre os dois multiplica a
// performance por round na simulação.
//
// Funções puras/estáticas de propósito: quem busca dados (nível de
// scouting, booking) é o WorldService — aqui só entra número, sai número,
// e a UI consegue mostrar exatamente a mesma conta que a luta vai usar.
export class ReadinessService {
  // Prontidão do jogador + breakdown legível pra UI.
  // `scoutingLevel`: 0-3 (ScoutingService.knowledgeOf do adversário).
  static playerReadiness(fighter, booking, scoutingLevel = 0) {
    const cfg = READINESS_CONFIG;
    const parts = [];

    const camp = Math.min(cfg.CAMP_CAP, Math.round(fighter.campReadinessPoints || 0));
    parts.push({ key: 'camp', label: 'Camp de treinamento', value: camp, max: cfg.CAMP_CAP });

    const plan = booking?.planConfirmed ? cfg.PLAN_CONFIRMED : 0;
    parts.push({ key: 'plan', label: 'Plano de jogo', value: plan, max: cfg.PLAN_CONFIRMED });

    const scout = cfg.SCOUTING[clamp(scoutingLevel, 0, 3)] || 0;
    parts.push({ key: 'scouting', label: 'Scouting do adversário', value: scout, max: cfg.SCOUTING[3] });

    const fatigue = -Math.round((fighter.fatigue / 100) * cfg.FATIGUE_MAX_PENALTY);
    parts.push({ key: 'fatigue', label: 'Fadiga', value: fatigue, max: 0 });

    const morale = Math.round(((fighter.morale - 50) / 50) * cfg.MORALE_SPAN);
    parts.push({ key: 'morale', label: 'Moral', value: morale, max: cfg.MORALE_SPAN });

    let weighIn = 0;
    if (booking?.weighIn?.completed) {
      weighIn = cfg.WEIGH_IN[booking.weighIn.outcome] ?? 0;
    }
    parts.push({ key: 'weighIn', label: 'Pesagem', value: weighIn, max: cfg.WEIGH_IN.success });

    const total = clamp(
      Math.round(cfg.BASE + camp + plan + scout + fatigue + morale + weighIn),
      0, 100
    );
    return { total, base: cfg.BASE, parts };
  }

  // Prontidão do adversário de IA. Baseline por tier + jitter com seed
  // estável (mesma luta = mesmo número — sem re-rolar recarregando a tela).
  static aiReadiness(promoTier, isTitleFight, seedString) {
    const cfg = READINESS_CONFIG;
    const base = cfg.AI_BASELINE[promoTier] ?? cfg.AI_BASELINE[3];
    const seed = [...String(seedString || '')].reduce((s, c) => s + c.charCodeAt(0), 0);
    const jitter = (seed % (cfg.AI_JITTER * 2 + 1)) - cfg.AI_JITTER;
    const title = isTitleFight ? cfg.AI_TITLE_BONUS : 0;
    return clamp(base + jitter + title, cfg.AI_MIN, cfg.AI_MAX);
  }

  // Gap → multiplicador de performance por round do lutador do jogador.
  static gapFactor(playerTotal, aiTotal) {
    const cfg = READINESS_CONFIG;
    const raw = (playerTotal - aiTotal) * cfg.GAP_SCALE;
    return 1 + clamp(raw, -cfg.GAP_CAP, cfg.GAP_CAP);
  }

  // Rótulo qualitativo — usado quando o scouting não revela o número exato.
  static label(total) {
    if (total >= 75) return 'Excelente';
    if (total >= 60) return 'Boa';
    if (total >= 45) return 'Mediana';
    if (total >= 30) return 'Fraca';
    return 'Péssima';
  }
}
