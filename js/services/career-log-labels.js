// Rótulo humano de uma entrada do career log — { icon, text }. Uma fonte só
// para o feed do dashboard (Fase 2) e qualquer outra tela que precise
// resumir "o que aconteceu". PURO: recebe a entry, devolve rótulo; não lê DB
// nem DOM. Tipos vêm de CareerLogService (ver comentário lá).
export function careerLogEntryLabel(entry) {
  const d = (entry && entry.data) || {};
  switch (entry && entry.type) {
    case 'fight_completed': {
      const outcome = d.won === true ? 'Vitória' : d.won === false ? 'Derrota' : 'Empate';
      const icon = d.won === true ? '🥊' : d.won === false ? '📉' : '🤝';
      const parts = [outcome];
      if (d.opponentName) parts.push(d.opponentName);
      if (d.method) parts.push(d.method);
      return { icon, text: parts.join(' · ') };
    }
    case 'title_won': return { icon: '🏆', text: `Cinturão conquistado${d.weightClass ? ` · ${d.weightClass}` : ''}` };
    case 'finish': return { icon: '💥', text: `Finalização${d.opponentName ? ` sobre ${d.opponentName}` : ''}` };
    case 'upset': return { icon: '😱', text: d.text || 'Zebra na carreira' };
    case 'streak': return { icon: '🔥', text: d.text || 'Sequência de vitórias' };
    case 'rivalry_born': return { icon: '⚔️', text: `Rivalidade com ${d.opponentName || 'um adversário'}` };
    case 'rival_arc': return { icon: '⚔️', text: d.text || 'Novo capítulo de rivalidade' };
    case 'dna_discovered': return { icon: '🧬', text: d.traitLabel || 'Traço revelado' };
    case 'permanent_scar': return { icon: '🩹', text: d.text || 'Cicatriz permanente' };
    case 'academy_switch': return { icon: '🏋️', text: `Trocou de academia${d.academyName ? ` · ${d.academyName}` : ''}` };
    case 'manager_switch': return { icon: '🤝', text: 'Trocou de empresário' };
    case 'provocation': return { icon: '🗣️', text: d.text || 'Provocação pública' };
    case 'viral': return { icon: '📱', text: d.text || 'Post viral' };
    case 'rematch': return { icon: '🔁', text: `Revanche${d.opponentName ? ` vs ${d.opponentName}` : ''}` };
    case 'year_review': return { icon: '📅', text: `Retrospectiva do ano ${d.yearNumber || ''}`.trim() };
    default: return { icon: '•', text: String((entry && entry.type) || 'Momento').replace(/_/g, ' ') };
  }
}
