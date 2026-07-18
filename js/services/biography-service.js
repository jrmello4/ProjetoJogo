// Biografia viva — prosa gerada só a partir do que a carreira realmente
// viveu. Sem flavor text genérico: se não houve rival, zebra ou título,
// a frase correspondente simplesmente não existe.
//
// Usada no perfil do lutador, Hall da Fama e (via parágrafos) no podcast.
// Nunca inventa nome de adversário, promoção ou número.

import { escapeHtml } from '../utils/helpers.js';

const RIVALRY_TYPE_PHRASE = {
  grudge: 'uma rixa pessoal',
  robbery: 'uma decisão que o mundo ainda discute',
  competitive: 'um duelo de ranking',
  personal: 'uma animosidade que nasceu fora do octógono',
};

export class BiographyService {
  /**
   * @param {object} fighter
   * @param {object} [ctx]
   * @param {Array}  [ctx.topMoments]   careerLog topByMagnitude
   * @param {{ rivalry, opponentName }|null} [ctx.rivalryInfo]
   * @returns {{ headline: string, paragraphs: string[], legacyLine: string }}
   */
  static compose(fighter, ctx = {}) {
    if (!fighter) {
      return { headline: '', paragraphs: [], legacyLine: '' };
    }

    const topMoments = ctx.topMoments || [];
    const rivalryInfo = ctx.rivalryInfo || null;
    const rec = fighter.record || { wins: 0, losses: 0, draws: 0 };
    const total = fighter.totalFights || (rec.wins + rec.losses + rec.draws) || 0;
    const titles = fighter.titlesWon || 0;
    const pop = fighter.popularity || 0;
    const chrono = [...(fighter.fights || [])].reverse();
    const first = chrono[0] || null;
    const finishes = (fighter.fights || []).filter(f => f.method && !String(f.method).startsWith('Decision'));
    const finishRate = total > 0 ? Math.round((finishes.length / Math.min(total, fighter.fights?.length || 1)) * 100) : 0;

    const headline = this._headline(fighter, titles, pop);
    const paragraphs = [];

    // Origem
    const originBits = [];
    if (fighter.nationality?.name) originBits.push(`nascido em ${fighter.nationality.name}`);
    if (fighter.age) originBits.push(`${fighter.age} anos`);
    if (first) {
      originBits.push(
        total > (fighter.fights?.length || 0)
          ? `com ${total} lutas no currículo (registro detalhado parcial)`
          : first.won === true
            ? `estreou vencendo ${first.opponent}`
            : first.won === false
              ? `estreou caindo para ${first.opponent}`
              : `estreou empatando com ${first.opponent}`
      );
    } else if (total === 0) {
      originBits.push('ainda sem luta profissional registrada');
    }
    if (originBits.length) {
      paragraphs.push(`${fighter.name}, ${originBits.join(', ')}.`);
    }

    // Cartel e estilo de vitória
    if (total > 0) {
      const styleBit = finishRate >= 60
        ? `Finaliza com frequência (${finishRate}% das lutas no registro recente não vão para a decisão)`
        : finishRate <= 25 && total >= 5
          ? 'Costuma decidir no placar — um lutador de volume e controle'
          : null;
      const cartel = `Cartel ${rec.wins}-${rec.losses}-${rec.draws}`;
      paragraphs.push(styleBit ? `${cartel}. ${styleBit}.` : `${cartel}.`);
    }

    // Título
    if (titles > 0) {
      paragraphs.push(
        titles === 1
          ? 'Conquistou o ouro uma vez — e o alvo nas costas nunca saiu de lá.'
          : `Ergueu o cinturão ${titles} vezes. Cada defesa reescreveu a divisão.`
      );
    }

    // Rival
    if (rivalryInfo?.opponentName && rivalryInfo.rivalry) {
      const r = rivalryInfo.rivalry;
      const kind = RIVALRY_TYPE_PHRASE[r.type] || 'uma rivalidade';
      const heat = r.intensity >= 7
        ? 'que ainda divide a torcida'
        : r.intensity >= 4
          ? 'que a imprensa não larga'
          : 'que já esfriou, mas nunca sumiu dos bastidores';
      paragraphs.push(
        `O nome de ${rivalryInfo.opponentName} aparece sempre que se fala em ${fighter.name}: ${kind} ${heat}.`
      );
    }

    // Momentos do career log (máx. 2 frases)
    const momentLines = topMoments
      .slice(0, 3)
      .map(m => this._momentLine(m))
      .filter(Boolean);
    if (momentLines.length) {
      paragraphs.push(momentLines.join(' '));
    }

    // Popularidade / legado curto
    let legacyLine = '';
    if (fighter.status === 'retired') {
      if (titles >= 3 || (rec.wins >= 20 && pop >= 80)) {
        legacyLine = 'Nome que o Hall da Fama não consegue apagar.';
      } else if (titles > 0 || rec.wins >= 15) {
        legacyLine = 'Uma carreira que a divisão ainda cita nos bastidores.';
      } else if (total >= 5) {
        legacyLine = 'Nem toda história vira documentário. A dele, pelo menos, foi real.';
      } else {
        legacyLine = 'Uma passagem curta pelo octógono — e ainda assim, uma passagem.';
      }
    } else if (pop >= 75) {
      legacyLine = 'A plateia já sabe o nome antes do locutor gritar.';
    } else if (pop >= 45) {
      legacyLine = 'Está no radar. Falta o momento que ninguém esquece.';
    } else if (total >= 3) {
      legacyLine = 'Ainda construindo o capítulo que os outros vão contar por ele.';
    }

    if (legacyLine) paragraphs.push(legacyLine);

    return { headline, paragraphs, legacyLine };
  }

  static _headline(fighter, titles, pop) {
    if (fighter.status === 'retired' && titles > 0) return `A era de ${fighter.name}`;
    if (titles > 0) return `O campeão ${fighter.name}`;
    if (pop >= 70) return `${fighter.name}: o nome da vez`;
    if ((fighter.record?.wins || 0) >= 10) return `${fighter.name} e a subida`;
    return `Quem é ${fighter.name}?`;
  }

  static _momentLine(entry) {
    const d = entry?.data || {};
    switch (entry.type) {
      case 'title_won':
        return d.defense
          ? `Defendeu o ouro${d.promo ? ` no ${d.promo}` : ''}.`
          : `Tomou o cinturão${d.promo ? ` do ${d.promo}` : ''}.`;
      case 'upset':
        return d.opponentName
          ? `A zebra sobre ${d.opponentName} ainda ecoa nas arquibancadas.`
          : 'Uma zebra que o ranking não previu.';
      case 'finish':
        return d.opponentName
          ? `Finalizou ${d.opponentName}${d.method ? ` por ${d.method}` : ''}.`
          : null;
      case 'rivalry_born':
        return d.opponentName
          ? `Nasceu a rivalidade com ${d.opponentName}.`
          : 'Nasceu uma rivalidade que mudou o tom da carreira.';
      case 'rival_arc':
        return d.rivalName
          ? (d.won
            ? `${d.rivalName} venceu sem ele no card — a sombra cresceu.`
            : `${d.rivalName} caiu; a porta se entreabriu.`)
          : null;
      case 'provocation':
        return d.targetName
          ? `Provocou ${d.targetName} nas redes e o mundo respondeu.`
          : 'Uma provocação nas redes virou manchete.';
      case 'viral':
        return 'Um post explodiu — e a persona pública nunca mais foi a mesma.';
      case 'permanent_scar':
        return d.bodyPart
          ? `Carrega uma sequela no(a) ${d.bodyPart}.`
          : 'Carrega uma sequela que o ringue cobrou.';
      case 'streak':
        return typeof d.count === 'number'
          ? `Empilhou ${d.count} vitórias seguidas.`
          : null;
      case 'dna_discovered':
        return d.traitLabel
          ? `Descobriu em si o traço "${d.traitLabel}".`
          : null;
      case 'weapon_revealed':
        return 'Mostrou uma arma que ninguém estava esperando.';
      case 'figured_out':
        return 'O livro sobre o seu jogo foi aberto — e o mundo leu.';
      case 'reinvention':
        return 'Reinventou-se depois de ser decifrado.';
      case 'crowd_night':
        return d.chant
          ? `Uma noite em que a torcida gritou "${d.chant}".`
          : 'Uma noite em que a arena não esqueceu o nome.';
      case 'year_review':
        return d.teaser || (d.yearNumber ? `Fechou o ano ${d.yearNumber} com história pra contar.` : null);
      case 'super_fight_win':
        return d.opponentName
          ? `Venceu a superfight contra ${d.opponentName}.`
          : 'Venceu uma superfight interpromocional.';
      default:
        return null;
    }
  }

  /** HTML seguro (texto escapado) para cards. */
  static renderCard(bio) {
    if (!bio || !bio.paragraphs?.length) return '';
    return `
      <div class="card mb-4" data-reveal style="border-top-color:var(--gold)">
        <div class="card-header">
          <span class="card-title">📖 ${escapeHtml(bio.headline || 'Biografia')}</span>
        </div>
        <div class="bio-prose" style="display:flex;flex-direction:column;gap:0.65rem">
          ${bio.paragraphs.map(p => `<p class="text-sm" style="line-height:1.55;margin:0">${escapeHtml(p)}</p>`).join('')}
        </div>
      </div>`;
  }
}
