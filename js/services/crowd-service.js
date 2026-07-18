// Torcida viva — reage a persona (face/heel), heat, popularidade, rivalidade
// e resultado da luta. Gera texto memorável + modificadores leves de
// popularidade/moral. Nunca inventa adversário: só usa o que a luta deu.

import { escapeHtml } from '../utils/helpers.js';

export const PERSONA = {
  FACE: 'face',     // herói da torcida
  HEEL: 'heel',     // vilão que vende ingresso
  NEUTRAL: 'neutral',
};

const CROWD_CONFIG = {
  HEAT_HEEL_THRESHOLD: 8,
  POP_FACE_THRESHOLD: 55,
  HEAT_DECAY_PER_WEEK: 1,
  HYPE_DECAY_PER_WEEK: 1,
  // Modificadores de popularidade pós-luta (somados ao ganho base da simulação)
  FINISH_HEEL_POP: 2,
  FINISH_FACE_POP: 1,
  DECISION_FACE_POP: 1,
  LOSS_HEEL_POP: 1, // heel "sobrevive" a derrota melhor (drama)
  LOSS_FACE_POP: -1,
  RIVALRY_INTENSITY_CROWD: 4, // a partir daqui a arena "parte ao meio"
};

export class CrowdService {
  /**
   * Persona pública derivada de heat/hype/popularidade/provocações.
   * heel = heat alto; face = popular e sem heat; senão neutro.
   */
  static resolvePersona(fighter) {
    const heat = fighter.narrativeHeat || 0;
    const pop = fighter.popularity || 0;
    if (heat >= CROWD_CONFIG.HEAT_HEEL_THRESHOLD) return PERSONA.HEEL;
    if (pop >= CROWD_CONFIG.POP_FACE_THRESHOLD && heat <= 3) return PERSONA.FACE;
    if (heat >= 4) return PERSONA.HEEL;
    if (pop >= 40) return PERSONA.FACE;
    return PERSONA.NEUTRAL;
  }

  static personaLabel(persona) {
    return {
      [PERSONA.FACE]: 'Herói da torcida',
      [PERSONA.HEEL]: 'Vilão do circuito',
      [PERSONA.NEUTRAL]: 'Figura neutra',
    }[persona] || 'Figura neutra';
  }

  static personaIcon(persona) {
    return {
      [PERSONA.FACE]: '🙌',
      [PERSONA.HEEL]: '😈',
      [PERSONA.NEUTRAL]: '😐',
    }[persona] || '😐';
  }

  /** Decay semanal de heat/hype — sem isso a persona trava pra sempre. */
  static applyWeeklyDecay(fighter) {
    if ((fighter.narrativeHeat || 0) > 0) {
      fighter.narrativeHeat = Math.max(0, fighter.narrativeHeat - CROWD_CONFIG.HEAT_DECAY_PER_WEEK);
    }
    if ((fighter.narrativeHype || 0) > 0) {
      fighter.narrativeHype = Math.max(0, fighter.narrativeHype - CROWD_CONFIG.HYPE_DECAY_PER_WEEK);
    }
    fighter.publicPersona = this.resolvePersona(fighter);
    return fighter.publicPersona;
  }

  /**
   * Reação da arena após a luta do jogador.
   * @returns {{ energy: number, chant: string, popDelta: number, moraleDelta: number, persona: string, lines: string[] }}
   */
  static reactToFight({ fighter, opponentName, won, isDraw, method, rivalryIntensity = 0, isTitleFight = false }) {
    const persona = this.resolvePersona(fighter);
    const heat = fighter.narrativeHeat || 0;
    const pop = fighter.popularity || 0;
    const isFinish = method && !String(method).startsWith('Decision');

    let energy = 30 + Math.floor(pop / 3) + heat * 2;
    if (rivalryIntensity >= CROWD_CONFIG.RIVALRY_INTENSITY_CROWD) energy += 20;
    if (isTitleFight) energy += 15;
    if (isFinish) energy += 12;
    if (won) energy += 10;
    else if (isDraw) energy += 5;
    else energy -= 5;
    energy = Math.max(5, Math.min(100, energy));

    let popDelta = 0;
    let moraleDelta = 0;
    const lines = [];

    if (won && isFinish) {
      if (persona === PERSONA.HEEL) {
        popDelta += CROWD_CONFIG.FINISH_HEEL_POP;
        moraleDelta += 2;
        lines.push(`A arena vaiou ${fighter.name} — e ele sorriu. Isso vende.`);
        lines.push(`"${opponentName} não aguentou o vilão." — grito da torcida adversária, ironia pura.`);
      } else if (persona === PERSONA.FACE) {
        popDelta += CROWD_CONFIG.FINISH_FACE_POP;
        moraleDelta += 3;
        lines.push(`A casa explode. "${fighter.name}! ${fighter.name}!" ecoa no ginásio.`);
      } else {
        popDelta += 1;
        lines.push(`A torcida se levanta — finalização limpa contra ${opponentName}.`);
      }
    } else if (won) {
      if (persona === PERSONA.FACE) {
        popDelta += CROWD_CONFIG.DECISION_FACE_POP;
        lines.push(`Vitória no placar. Os fãs gritam o nome — querem o próximo desafio.`);
      } else if (persona === PERSONA.HEEL) {
        lines.push(`Vitória no placar e vaias. ${fighter.name} aponta pro dedo médio da plateia.`);
        popDelta += 1;
      } else {
        lines.push(`Aplausos educados. Ainda falta o momento que vira grito de guerra.`);
      }
    } else if (isDraw) {
      lines.push(`Empate. A torcida divide: metade assobia, metade pede revanche com ${opponentName}.`);
      moraleDelta += persona === PERSONA.HEEL ? 1 : -1;
    } else {
      // derrota
      if (persona === PERSONA.HEEL) {
        popDelta += CROWD_CONFIG.LOSS_HEEL_POP;
        lines.push(`Derrota. A plateia comemora... e isso só alimenta o personagem.`);
      } else if (persona === PERSONA.FACE) {
        popDelta += CROWD_CONFIG.LOSS_FACE_POP;
        moraleDelta -= 1;
        lines.push(`Silêncio pesado. Alguém grita "você ainda é nosso!" — e a moral tenta se segurar.`);
      } else {
        lines.push(`A torcida se esvazia em silêncio. ${opponentName} leva a noite.`);
      }
    }

    if (rivalryIntensity >= CROWD_CONFIG.RIVALRY_INTENSITY_CROWD) {
      lines.push(`Rivalidade no ar: a arena parte ao meio entre ${fighter.name} e ${opponentName}.`);
      energy = Math.min(100, energy + 5);
    }

    if (isTitleFight) {
      lines.push(won
        ? 'Cinturão na mão — o coro muda de tom: agora é hino de campeão.'
        : 'O ouro mudou de lado. A torcida grava o momento na memória coletiva.');
    }

    const chant = this._pickChant(persona, won, isDraw, fighter.name);

    return {
      energy,
      chant,
      popDelta,
      moraleDelta,
      persona,
      personaLabel: this.personaLabel(persona),
      lines: lines.slice(0, 3),
    };
  }

  static _pickChant(persona, won, isDraw, name) {
    if (isDraw) return 'Revanche! Revanche!';
    if (won) {
      if (persona === PERSONA.HEEL) return `Fora, ${name}!`; // vaias = combustível
      if (persona === PERSONA.FACE) return `${name}! ${name}!`;
      return 'Essa foi sua!';
    }
    if (persona === PERSONA.FACE) return 'Cabeça erguida!';
    if (persona === PERSONA.HEEL) return 'Mereceu!';
    return 'Próxima...';
  }

  /**
   * Cartas da torcida — 0-2 mensagens curtas baseadas no resultado + persona.
   * Histórias que o jogador lembra: não são stats.
   */
  static generateFanMail({ fighter, opponentName, won, isDraw, method, rivalryIntensity = 0 }) {
    const persona = this.resolvePersona(fighter);
    const mails = [];
    const first = (fighter.name || 'Campeão').split(/\s+/)[0];

    if (won && method && !String(method).startsWith('Decision')) {
      mails.push({
        from: persona === PERSONA.HEEL ? 'Anônimo da arquibancada' : `Fã de ${first}`,
        text: persona === PERSONA.HEEL
          ? `Eu te vaio toda semana e mesmo assim comprei o PPV. Finalizar ${opponentName} assim... continue sendo odiável.`
          : `${first}, aquela finalização em ${opponentName} eu vou contar pro meu filho. Obrigado por existir.`,
      });
    } else if (won) {
      mails.push({
        from: 'Assinante do card',
        text: `Vitória é vitória. Quero ver você subir de nível — e logo. Força, ${first}.`,
      });
    } else if (!isDraw && !won) {
      mails.push({
        from: persona === PERSONA.FACE ? 'Torcida organizada' : 'Crítico de plantão',
        text: persona === PERSONA.FACE
          ? `Perder dói. Mas a gente continua aqui. Levanta, ${first}.`
          : `Depois dessa, ou você muda ou a divisão te engole. Sem filtro.`,
      });
    }

    if (rivalryIntensity >= 5) {
      mails.push({
        from: 'Conta fã da rivalidade',
        text: `Você vs ${opponentName} é o único motivo de eu ainda assistir essa divisão. Marca a revanche. Por favor.`,
      });
    }

    // Limita 2 — qualidade > quantidade
    return mails.slice(0, 2);
  }

  /** Bloco HTML compacto pro dashboard / pós-luta. */
  static renderReactionCard(reaction, fanMail = []) {
    if (!reaction) return '';
    const energyColor = reaction.energy >= 70 ? 'var(--danger)' : reaction.energy >= 45 ? 'var(--gold)' : 'var(--text-muted)';
    return `
      <div class="card mb-4" data-reveal style="border-top-color:${energyColor}">
        <div class="card-header">
          <span class="card-title">🏟️ A Torcida</span>
          <span class="text-xs text-muted">${escapeHtml(CrowdService.personaIcon(reaction.persona))} ${escapeHtml(reaction.personaLabel)} · energia ${reaction.energy}%</span>
        </div>
        <div class="text-sm font-bold mb-2" style="letter-spacing:0.04em">"${escapeHtml(reaction.chant)}"</div>
        <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:0.75rem">
          <div style="width:${reaction.energy}%;height:100%;background:${energyColor}"></div>
        </div>
        ${(reaction.lines || []).map(l => `<p class="text-sm" style="margin:0 0 0.4rem 0;line-height:1.45">${escapeHtml(l)}</p>`).join('')}
        ${fanMail.length ? `
          <div class="mt-3" style="border-top:1px solid var(--border);padding-top:0.75rem">
            <div class="text-xs text-muted mb-2">✉️ Cartas da torcida</div>
            ${fanMail.map(m => `
              <div class="text-sm mb-2" style="padding:0.5rem;background:var(--surface-2, rgba(255,255,255,0.03));border-radius:6px">
                <div class="text-xs text-muted">${escapeHtml(m.from)}</div>
                <div style="line-height:1.45">${escapeHtml(m.text)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>`;
  }
}
