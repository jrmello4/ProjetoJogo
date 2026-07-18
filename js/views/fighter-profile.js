import { formatCurrency, formatDate, getWeightClassShort, getWeightClassLabel, getNationalityFlag, getAdjacentWeightClasses, e } from '../utils/helpers.js';
import { FIGHTING_STYLES, MOVES, PERKS } from '../config/game-config.js';
import { BiographyService } from '../services/biography-service.js';
import { CrowdService } from '../services/crowd-service.js';
import { PortraitService } from '../services/portrait-service.js';
import { VisualIdentityService } from '../services/visual-identity-service.js';

export class FighterProfileView {
  // Linha do tempo de momentos — texto cru no label; e() só na saída.
  static _renderMomentsTimeline(moments) {
    if (!moments?.length) return '';
    const label = (m) => {
      const d = m.data || {};
      switch (m.type) {
        case 'title_won': return d.defense ? 'Defesa de cinturão' : 'Conquista de título';
        case 'finish': return `Finalização${d.opponentName ? ` · ${d.opponentName}` : ''}`;
        case 'upset': return `Zebra${d.opponentName ? ` · ${d.opponentName}` : ''}`;
        case 'rivalry_born': return `Rivalidade${d.opponentName ? ` · ${d.opponentName}` : ''}`;
        case 'rival_arc': return d.won ? `Rival subiu · ${d.rivalName || ''}` : `Rival caiu · ${d.rivalName || ''}`;
        case 'crowd_night': return `Noite da torcida · ${d.chant || ''}`;
        case 'provocation': return d.targetName ? `Provocou ${d.targetName}` : 'Provocação';
        case 'viral': return 'Post viral';
        case 'year_review': return `Retrospectiva ano ${d.yearNumber || ''}`;
        case 'dna_discovered': return d.traitLabel || 'Traço revelado';
        default: return String(m.type || 'Momento').replace(/_/g, ' ');
      }
    };
    return `
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">🎞️ Momentos marcantes</span>
        </div>
        <div class="timeline">
          ${moments.slice(0, 10).map(m => `
            <div class="timeline-item">
              <div class="timeline-date">sem ${m.atAbsWeek ?? '—'} · mag ${m.magnitude ?? 0}</div>
              <div class="timeline-content">
                <span class="text-sm font-bold">${e(label(m))}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  // G3: gráfico de carreira — OVR do atleta em cada luta (fighterRating é
  // gravado pela simulação). Lutas antigas de saves anteriores não têm o
  // campo; o gráfico usa só as que têm e some se houver menos de 2.
  static _careerGraph(displayHistory) {
    // fights é "mais recente primeiro" — inverter para ordem cronológica
    const points = [...displayHistory].reverse().filter(f => typeof f.fighterRating === 'number');
    if (points.length < 2) return '';

    const W = 600, H = 110, PAD = 14;
    const ratings = points.map(p => p.fighterRating);
    const min = Math.min(...ratings) - 3;
    const max = Math.max(...ratings) + 3;
    const x = (i) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
    const y = (r) => H - PAD - ((r - min) / (max - min)) * (H - PAD * 2);

    const polyline = points.map((p, i) => `${x(i).toFixed(1)},${y(p.fighterRating).toFixed(1)}`).join(' ');
    const dots = points.map((p, i) => p.won
      ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.fighterRating).toFixed(1)}" r="4" fill="var(--red)"/>`
      : `<circle cx="${x(i).toFixed(1)}" cy="${y(p.fighterRating).toFixed(1)}" r="4" fill="none" stroke="var(--text-muted)" stroke-width="1.5"/>`
    ).join('');

    const first = ratings[0];
    const last = ratings[ratings.length - 1];
    const delta = last - first;

    return `
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">Evolução na Carreira</span>
          <span class="text-sm ${delta >= 0 ? 'text-success' : 'text-danger'}">OVR ${first} → ${last} (${delta >= 0 ? '+' : ''}${delta})</span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" aria-label="OVR ao longo das lutas" style="display:block">
          <polyline points="${polyline}" fill="none" stroke="var(--red)" stroke-width="2" stroke-linejoin="round" opacity="0.85"/>
          ${dots}
        </svg>
        <div class="flex" style="justify-content:space-between">
          <span class="text-xs text-muted">1ª luta registrada</span>
          <span class="text-xs text-muted">● vitória &nbsp;○ derrota</span>
          <span class="text-xs text-muted">última</span>
        </div>
      </div>
    `;
  }

  // ctx opcional: { topMoments, rivalryInfo, forceBio }
  static render(fighter, fightHistory = [], isPlayer = false, ctx = {}) {
    if (!fighter) return '<div class="empty-state"><p>Lutador não encontrado.</p></div>';
    const displayHistory = fightHistory.length > 0 ? fightHistory : (fighter.fights || []);

    const bio = (isPlayer || ctx.forceBio)
      ? BiographyService.compose(fighter, {
          topMoments: ctx.topMoments || [],
          rivalryInfo: ctx.rivalryInfo || null,
        })
      : null;
    const bioHtml = bio ? BiographyService.renderCard(bio) : '';
    const persona = CrowdService.resolvePersona(fighter);
    const personaHtml = isPlayer ? `
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">${CrowdService.personaIcon(persona)} Persona pública</span>
          <span class="badge badge-info">${e(CrowdService.personaLabel(persona))}</span>
        </div>
        <div class="grid grid-cols-3 gap-3 text-center">
          <div>
            <div class="text-xs text-muted">Heat</div>
            <div class="font-bold">${fighter.narrativeHeat || 0}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Hype narrativo</div>
            <div class="font-bold">${fighter.narrativeHype || 0}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Popularidade</div>
            <div class="font-bold">${fighter.popularity || 0}</div>
          </div>
        </div>
        <p class="text-xs text-muted mt-2">Heat alto = vilão que vende. Popularidade alta + pouco heat = herói da torcida.</p>
      </div>` : '';
    const momentsHtml = this._renderMomentsTimeline(ctx.topMoments || ctx.recentMoments || []);

    const attrBars = (attrs, label, colorClass) => {
      return `
        <div class="attr-item">
          <div class="attr-label">
            <span>${label}</span>
            <span class="attr-value">${attrs}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${colorClass}" style="width:${attrs}%"></div>
          </div>
        </div>
      `;
    };

    const historyHtml = displayHistory.length > 0
      ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title">Histórico de Lutas</span>
          </div>
          <div class="timeline">
            ${displayHistory.slice(0, 20).map(f => `
              <div class="timeline-item">
                <div class="timeline-date">${formatDate(f.date)}</div>
                <div class="timeline-content">
                  <span class="badge ${f.won === true ? 'badge-success' : f.won === null ? 'badge-warning' : 'badge-danger'}">${e(f.result)}</span>
                  <span class="text-sm"> vs ${e(f.opponent)} — ${e(f.method)} (R${f.round})</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : `
        <div class="card">
          <div class="empty-state">
            <p>Nenhuma luta registrada.</p>
          </div>
        </div>
      `;

    const contractHtml = fighter.promotionContract?.status === 'active'
      ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title">Contrato · ${e(fighter.promotionContract.promotionName)}</span>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <div class="text-xs text-muted">Bolsa/Luta</div>
              <div class="text-sm font-bold">${formatCurrency(fighter.promotionContract.basePurse)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Lutas Restantes</div>
              <div class="text-sm font-bold">${fighter.promotionContract.fightsRemaining}/${fighter.promotionContract.fightsTotal}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Bônus Vitória</div>
              <div class="text-sm font-bold">${formatCurrency(fighter.promotionContract.winBonus)}</div>
            </div>
          </div>
        </div>
      `
      : fighter.promotionContract?.status === 'expired'
        ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title">Contrato</span>
          </div>
          <div class="text-sm text-warning">📋 Contrato com ${e(fighter.promotionContract.promotionName)} expirado — aguardando renovação.</div>
        </div>
      `
        : '';

    // Antes não existia jeito nenhum de encerrar a carreira por vontade
    // própria — só o prompt automático de fim de carreira (idade/janela de
    // aposentadoria), que podia nunca chegar. Sem isso, uma carreira travada
    // (ou simplesmente que o jogador queira encerrar) não tinha saída.
    const retireBtn = isPlayer && fighter.status !== 'retired'
      ? `<button class="btn btn-sm btn-danger fighter-retire" data-id="${fighter.id}" style="margin-left:0.5rem;vertical-align:middle">Aposentar-se</button>`
      : '';

    return `
      <div class="page-header" style="display:flex;gap:1.25rem;align-items:flex-start">
        <span class="portrait-frame">${PortraitService.renderFighter(fighter, { size: 84, context: fighter.status === 'retired' ? 'ceremony' : 'default' })}</span>
        <div style="flex:1;min-width:0">
          <h2>
            ${getNationalityFlag(fighter.nationality?.code || '')} ${e(fighter.name)}
            <button class="btn-icon fighter-rename" data-id="${fighter.id}" title="Renomear lutador" aria-label="Renomear lutador">✏️</button>
            ${isPlayer ? `<button class="btn-icon fighter-edit-appearance" data-id="${fighter.id}" title="Editar aparência" aria-label="Editar aparência">🎨</button>` : ''}
            ${retireBtn}
          </h2>
          <p>${e(fighter.nationality?.name || 'Desconhecido')} · ${fighter.age} anos · ${e(FIGHTING_STYLES[fighter.style]?.label || fighter.fightingStyle || 'Freestyle')}</p>
          ${(() => {
            const id = VisualIdentityService.describeIdentity(fighter);
            return `<p class="text-xs text-muted" style="margin-top:0.25rem">${e(id.archetypeLabel)} · ${e(id.stageLabel)} · ${e(id.rarityLabel)}${fighter.visualAutoEvolve ? ' · auto-evolui' : ''}</p>`;
          })()}
          ${isPlayer ? `<div class="flex gap-2 mt-2 flex-wrap">
            <button type="button" class="btn btn-sm btn-secondary fighter-imagine-export" data-id="${fighter.id}">🖼 Exportar concept art</button>
          </div>` : ''}
        </div>
      </div>

      ${(() => {
        const unlocks = VisualIdentityService.listUnlockStatus(fighter);
        const owned = unlocks.filter(u => u.unlocked);
        if (!owned.length && !isPlayer) return '';
        return `
          <div class="card mb-4" data-reveal>
            <div class="card-header"><span class="card-title">🎨 Identidade visual</span></div>
            <div class="text-xs text-muted mb-2">Desbloqueios por conquista (não monétização). Contextos: rua · octógono · coletiva · cerimônia.</div>
            <div class="flex flex-col gap-1">
              ${unlocks.map(u => `
                <div class="flex items-center justify-between gap-2" style="padding:0.35rem 0;border-bottom:1px solid var(--border)">
                  <div>
                    <span class="${u.unlocked ? '' : 'text-muted'}">${u.unlocked ? '✓' : '🔒'} ${e(u.label)}</span>
                    <div class="text-xs text-muted">${e(u.desc)} · ${e(u.rarity)}</div>
                  </div>
                  ${isPlayer && u.unlocked ? `<button type="button" class="btn btn-sm btn-secondary fighter-equip-unlock" data-id="${fighter.id}" data-unlock="${u.id}">Equipar</button>` : ''}
                </div>
              `).join('')}
            </div>
          </div>`;
      })()}

      ${bioHtml}
      ${personaHtml}
      ${momentsHtml}

      <div class="grid grid-cols-4 mb-4">
        <div class="card">
          <div class="card-title">Recorde</div>
          <div class="stat-value">${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}</div>
          <div class="stat-label">${fighter.totalFights || 0} lutas · ${(fighter.winRate || 0).toFixed(1)}% win rate</div>
        </div>
        <div class="card">
          <div class="card-title">OVR</div>
          <div class="stat-value">${fighter.overallRating}</div>
          <div class="stat-label">Overall Rating</div>
        </div>
        <div class="card">
          <div class="card-title">Divisão</div>
          <div class="stat-value" style="font-size:1.25rem">${getWeightClassShort(fighter.weightClass)}</div>
          <div class="stat-label">${getWeightClassLabel(fighter.weightClass)}</div>
        </div>
        <div class="card">
          <div class="card-title">Status</div>
          <div class="stat-value" style="font-size:1.25rem">
            <span class="badge ${isPlayer ? 'badge-success' : fighter.status === 'roster' ? 'badge-info' : 'badge-warning'}">${isPlayer ? 'Você' : fighter.status === 'roster' ? 'No circuito' : 'Agente Livre'}</span>
          </div>
          <div class="stat-label">Fadiga: ${fighter.fatigue}% · Moral: ${fighter.morale}%</div>
        </div>
      </div>

      <div class="grid grid-cols-2 mb-4">
        <div class="card">
          <div class="card-header">
            <span class="card-title">🥊 Em Pé</span>
          </div>
          <div class="attr-grid">
            ${fighter.attributes.boxing !== undefined ? attrBars(fighter.attributes.boxing, 'Boxing', fighter.attributes.boxing >= 70 ? 'high' : fighter.attributes.boxing >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.kickboxing !== undefined ? attrBars(fighter.attributes.kickboxing, 'Kickboxing', fighter.attributes.kickboxing >= 70 ? 'high' : fighter.attributes.kickboxing >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.muayThai !== undefined ? attrBars(fighter.attributes.muayThai, 'Muay Thai', fighter.attributes.muayThai >= 70 ? 'high' : fighter.attributes.muayThai >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.power !== undefined ? attrBars(fighter.attributes.power, 'Power', fighter.attributes.power >= 70 ? 'high' : fighter.attributes.power >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.footwork !== undefined ? attrBars(fighter.attributes.footwork, 'Footwork', fighter.attributes.footwork >= 70 ? 'high' : fighter.attributes.footwork >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.headMovement !== undefined ? attrBars(fighter.attributes.headMovement, 'Head Movement', fighter.attributes.headMovement >= 70 ? 'high' : fighter.attributes.headMovement >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.clinch !== undefined ? attrBars(fighter.attributes.clinch, 'Clinch', fighter.attributes.clinch >= 70 ? 'high' : fighter.attributes.clinch >= 40 ? 'medium' : 'low') : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">🤼 Chão</span>
          </div>
          <div class="attr-grid">
            ${fighter.attributes.wrestling !== undefined ? attrBars(fighter.attributes.wrestling, 'Wrestling', fighter.attributes.wrestling >= 70 ? 'high' : fighter.attributes.wrestling >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.bjj !== undefined ? attrBars(fighter.attributes.bjj, 'BJJ', fighter.attributes.bjj >= 70 ? 'high' : fighter.attributes.bjj >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.takedowns !== undefined ? attrBars(fighter.attributes.takedowns, 'Takedowns', fighter.attributes.takedowns >= 70 ? 'high' : fighter.attributes.takedowns >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.takedownDefense !== undefined ? attrBars(fighter.attributes.takedownDefense, 'TD Defense', fighter.attributes.takedownDefense >= 70 ? 'high' : fighter.attributes.takedownDefense >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.groundControl !== undefined ? attrBars(fighter.attributes.groundControl, 'Ground Control', fighter.attributes.groundControl >= 70 ? 'high' : fighter.attributes.groundControl >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.submissionOffense !== undefined ? attrBars(fighter.attributes.submissionOffense, 'Sub Offense', fighter.attributes.submissionOffense >= 70 ? 'high' : fighter.attributes.submissionOffense >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.submissionDefense !== undefined ? attrBars(fighter.attributes.submissionDefense, 'Sub Defense', fighter.attributes.submissionDefense >= 70 ? 'high' : fighter.attributes.submissionDefense >= 40 ? 'medium' : 'low') : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">💪 Físico</span>
          </div>
          <div class="attr-grid">
            ${attrBars(fighter.attributes.cardio ?? 0, 'Cardio', (fighter.attributes.cardio ?? 0) >= 70 ? 'high' : (fighter.attributes.cardio ?? 0) >= 40 ? 'medium' : 'low')}
            ${attrBars(fighter.attributes.chin ?? 0, 'Chin', (fighter.attributes.chin ?? 0) >= 70 ? 'high' : (fighter.attributes.chin ?? 0) >= 40 ? 'medium' : 'low')}
            ${fighter.attributes.strength !== undefined ? attrBars(fighter.attributes.strength, 'Strength', fighter.attributes.strength >= 70 ? 'high' : fighter.attributes.strength >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.speed !== undefined ? attrBars(fighter.attributes.speed, 'Speed', fighter.attributes.speed >= 70 ? 'high' : fighter.attributes.speed >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.durability !== undefined ? attrBars(fighter.attributes.durability, 'Durability', fighter.attributes.durability >= 70 ? 'high' : fighter.attributes.durability >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.recovery !== undefined ? attrBars(fighter.attributes.recovery, 'Recovery', fighter.attributes.recovery >= 70 ? 'high' : fighter.attributes.recovery >= 40 ? 'medium' : 'low') : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">🧠 Mental</span>
          </div>
          <div class="attr-grid">
            ${attrBars(fighter.attributes.fightIQ ?? 0, 'Fight IQ', (fighter.attributes.fightIQ ?? 0) >= 70 ? 'high' : (fighter.attributes.fightIQ ?? 0) >= 40 ? 'medium' : 'low')}
            ${fighter.attributes.composure !== undefined ? attrBars(fighter.attributes.composure, 'Composure', fighter.attributes.composure >= 70 ? 'high' : fighter.attributes.composure >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.aggression !== undefined ? attrBars(fighter.attributes.aggression, 'Aggression', fighter.attributes.aggression >= 70 ? 'high' : fighter.attributes.aggression >= 40 ? 'medium' : 'low') : ''}
            ${fighter.attributes.adaptability !== undefined ? attrBars(fighter.attributes.adaptability, 'Adaptability', fighter.attributes.adaptability >= 70 ? 'high' : fighter.attributes.adaptability >= 40 ? 'medium' : 'low') : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Estatísticas</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="text-xs text-muted">Técnica</div>
              <div class="text-sm font-bold">${Math.round(fighter.techniqueScore || 0)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Striking</div>
              <div class="text-sm font-bold">${Math.round(fighter.strikingScore || 0)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Grappling</div>
              <div class="text-sm font-bold">${Math.round(fighter.grapplingScore || 0)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Média Atributos</div>
              <div class="text-sm font-bold">${Math.round(fighter.averageSkill || 0)}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Taxa de Vitória</div>
              <div class="text-sm font-bold">${(fighter.winRate || 0).toFixed(1)}%</div>
            </div>
            <div>
              <div class="text-xs text-muted">Estilo</div>
              <div class="text-sm font-bold">${FIGHTING_STYLES[fighter.style]?.label || fighter.fightingStyle}</div>
            </div>
          </div>

          <div class="mt-4">
            <div class="card-title mb-2">Fadiga</div>
            <div class="progress-bar" style="height:10px">
              <div class="progress-fill ${fighter.fatigue >= 60 ? 'low' : fighter.fatigue >= 30 ? 'medium' : 'high'}" style="width:${fighter.fatigue}%"></div>
            </div>
            <div class="text-xs text-muted mt-2">${fighter.fatigue}%</div>
          </div>

          <div class="mt-4">
            <div class="card-title mb-2">Moral</div>
            <div class="progress-bar" style="height:10px">
              <div class="progress-fill ${fighter.morale >= 70 ? 'high' : fighter.morale >= 40 ? 'medium' : 'low'}" style="width:${fighter.morale}%"></div>
            </div>
            <div class="text-xs text-muted mt-2">${fighter.morale}%</div>
          </div>

          <div class="mt-4">
            <div class="card-title mb-2">Lealdade</div>
            <div class="progress-bar" style="height:10px">
              <div class="progress-fill ${fighter.loyalty >= 70 ? 'high' : fighter.loyalty >= 40 ? 'medium' : 'low'}" style="width:${fighter.loyalty}%"></div>
            </div>
            <div class="text-xs text-muted mt-2">${fighter.loyalty ?? 0}%</div>
          </div>

          ${fighter.expectation ? `
          <div class="mt-4">
            <div class="card-title mb-2">Expectativa</div>
            <div class="text-sm">
              <span class="badge ${fighter.expectation.urgency >= 3 ? 'badge-danger' : fighter.expectation.urgency >= 2 ? 'badge-warning' : 'badge-info'}">
                ${fighter.expectation.kind === 'title_shot' ? 'Quer chance de título' : fighter.expectation.kind === 'move_up_tier' ? 'Quer subir de tier' : fighter.expectation.kind === 'more_fights' ? 'Quer lutar mais' : 'Quer melhor pagamento'}
                ${fighter.expectation.urgency >= 2 ? ' · Urgente!' : ''}
              </span>
            </div>
            ${fighter.expectation.urgency >= 3 ? `
              <div class="text-danger text-xs mt-1">⚠️ Perde moral/lealdade semanalmente. Alvo fácil de rivais.</div>
            ` : ''}
          </div>
          ` : ''}
        </div>
      </div>

      ${contractHtml}

      <!-- DNA Traits — §B.1: pro próprio jogador, só o que já foi descoberto -->
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">DNA Oculto</span>
        </div>
        ${(() => {
          const allTraits = fighter.dnaTraits || [];
          const visible = isPlayer ? allTraits.filter(t => t && fighter.isDiscovered(t.key)) : allTraits;
          const hiddenCount = isPlayer ? allTraits.length - visible.length : 0;
          return `
            <div class="flex gap-2 flex-wrap">
              ${visible.length > 0
                ? visible.map(t => `<span class="badge badge-info">${e(t.label)}</span>`).join('')
                : '<span class="text-xs text-muted">Nenhum trait especial descoberto ainda</span>'
              }
            </div>
            ${hiddenCount > 0 ? `<div class="text-xs text-muted mt-2">Ainda existe algo por descobrir sobre você — só a carreira revela.</div>` : ''}
            ${isPlayer ? `
              <div class="grid grid-cols-3 gap-3 mt-3" style="border-top:1px solid var(--border);padding-top:0.75rem">
                <div>
                  <div class="text-xs text-muted">Potencial</div>
                  <div class="text-sm font-bold">${fighter.isDiscovered('potential') ? (fighter.hidden?.potential || '???') : '???'}</div>
                </div>
                <div>
                  <div class="text-xs text-muted">Disciplina</div>
                  <div class="text-sm font-bold">${fighter.isDiscovered('discipline') ? (fighter.hidden?.discipline || '???') : '???'}</div>
                </div>
                <div>
                  <div class="text-xs text-muted">Determinação</div>
                  <div class="text-sm font-bold">${fighter.isDiscovered('determination') ? (fighter.hidden?.determination || '???') : '???'}</div>
                </div>
              </div>
            ` : ''}
          `;
        })()}
      </div>

      <!-- Sequelas permanentes (§B.2) -->
      ${(fighter.permanentScars || []).length > 0 ? `
        <div class="card mt-4">
          <div class="card-header">
            <span class="card-title">Danos Permanentes</span>
          </div>
          ${fighter.permanentScars.map(s => `
            <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
              <span class="text-sm">🩹 ${s.bodyPart.charAt(0).toUpperCase() + s.bodyPart.slice(1)}</span>
              <span class="text-xs text-muted">${Object.entries(s.attributeCeilings).map(([k, v]) => `${k} ${v}`).join(' · ')}</span>
            </div>
          `).join('')}
          <div class="text-xs text-muted mt-2">Reduz o teto de evolução dos atributos acima pro resto da carreira.</div>
        </div>
      ` : ''}

      <!-- P10.1: Sequelas mecânicas de lesões -->
      ${(fighter.sequelae || []).length > 0 ? `
        <div class="card mt-4">
          <div class="card-header">
            <span class="card-title">Sequelas de Combate</span>
          </div>
          ${fighter.sequelae.map(s => `
            <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
              <span class="text-sm">⚠️ ${e(s.description)}</span>
              <span class="text-xs text-danger font-bold">${s.attr} -${s.reduction}</span>
            </div>
          `).join('')}
          <div class="text-xs text-muted mt-2">Reduções permanentes em atributos causadas por lesões graves em combate.</div>
        </div>
      ` : ''}

      <!-- Popularidade -->
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">Popularidade</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="progress-bar flex-1" style="height:12px">
            <div class="progress-fill ${fighter.popularity >= 70 ? 'high' : fighter.popularity >= 40 ? 'medium' : 'low'}" style="width:${fighter.popularity}%"></div>
          </div>
          <span class="text-sm font-bold">${fighter.popularity}</span>
          <span class="badge ${fighter.popularity >= 80 ? 'badge-success' : fighter.popularity >= 60 ? 'badge-info' : 'badge-warning'}">${fighter.popularityTier}</span>
        </div>
      </div>

      <!-- Estilo de Luta e Moveset -->
      ${(() => {
        const styleDef = FIGHTING_STYLES[fighter.style] || FIGHTING_STYLES.freestyle;
        const poolMoves = styleDef.poolMoves || [];
        const equippedSet = new Set(fighter.moveset);
        const maxMoves = typeof fighter.getMaxMoves === 'function' ? fighter.getMaxMoves() : 6;
        return `
        <div class="card mt-4">
          <div class="card-header">
            <span class="card-title">Estilo de Luta: ${e(styleDef.label)}</span>
            ${isPlayer ? '<button class="btn btn-sm btn-secondary style-switch-btn" data-fighter-id="' + fighter.id + '" title="Trocar de estilo (custa $500 e trava 4 semanas)">🔄 Trocar</button>' : ''}
          </div>
          <div class="text-sm text-muted mb-2">${e(styleDef.desc)}</div>
          ${styleDef.bonusAttrs.length > 0 ? `
            <div class="flex gap-2 flex-wrap mb-3">
              ${styleDef.bonusAttrs.map(a => `<span class="badge badge-info">${a}</span>`).join(' ')}
            </div>
          ` : ''}
          <div class="mt-3">
            <div class="card-title mb-2">Moveset (${fighter.moveset.length}/${maxMoves})</div>
            <div class="grid grid-col" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.5rem">
              ${fighter.moveset.map(moveId => {
                const move = MOVES[moveId];
                const prof = typeof fighter.getMoveProficiency === 'function' ? fighter.getMoveProficiency(moveId) : 0;
                return `
                  <div class="flex items-center gap-2" style="padding:0.25rem 0;border-bottom:1px solid var(--border)">
                    <span class="text-sm" style="flex:1">${e(move?.name || moveId)}</span>
                    <div class="progress-bar flex-1" style="height:6px;max-width:80px">
                      <div class="progress-fill ${prof >= 70 ? 'high' : prof >= 40 ? 'medium' : 'low'}" style="width:${prof}%"></div>
                    </div>
                    <span class="text-xs text-muted" style="min-width:2.5rem;text-align:right">${Math.round(prof)}%</span>
                    ${isPlayer && fighter.moveset.length > 1 ? `<button class="btn btn-sm btn-remove-move" data-move-id="${moveId}" style="font-size:0.6rem;padding:1px 6px;color:var(--danger);background:none;border:1px solid var(--danger);border-radius:3px;cursor:pointer">✕</button>` : ''}
                  </div>`;
              }).join('')}
            </div>
          </div>
          ${isPlayer && fighter.moveset.length < maxMoves ? `
            <div class="mt-3">
              <div class="text-xs font-bold text-secondary mb-1">Adicionar golpe (${maxMoves - fighter.moveset.length} slot${maxMoves - fighter.moveset.length > 1 ? 's' : ''} disponíve${maxMoves - fighter.moveset.length > 1 ? 'is' : 'l'})</div>
              <div class="flex gap-1 flex-wrap">
                ${poolMoves.filter(m => !equippedSet.has(m)).map(moveId => {
                  const move = MOVES[moveId];
                  return `<button class="btn btn-sm btn-add-move" data-move-id="${e(moveId)}" style="font-size:0.65rem;padding:2px 6px;background:var(--mat-high);border:1px solid var(--border);border-radius:var(--radius);cursor:pointer">+ ${e(move?.name || moveId)}</button>`;
                }).join('')}
              </div>
            </div>
          ` : ''}
        </div>`;
      })()}

      <!-- Perks Teia -->
      ${(() => {
        return `
        <div class="card mt-4">
          <div class="card-header">
            <span class="card-title">Perks (${fighter.perkPoints} ponto${fighter.perkPoints !== 1 ? 's' : ''} restante${fighter.perkPoints !== 1 ? 's' : ''})</span>
          </div>
          <div class="grid grid-col" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.75rem">
            ${Object.entries(PERKS).map(([id, perk]) => {
              const owned = typeof fighter.hasPerk === 'function' && fighter.hasPerk(id);
              const canLearn = typeof fighter.canLearnPerk === 'function' && fighter.canLearnPerk(id);
              const classes = ['perk-node'];
              if (owned) classes.push('owned');
              else if (canLearn && fighter.perkPoints > 0) classes.push('available');
              else classes.push('locked');
              return `
                <div class="${classes.join(' ')}" data-perk-id="${id}" style="padding:0.5rem;border:1px solid var(--border);border-radius:6px;background:${owned ? 'var(--bg-highlight)' : 'var(--bg-card)'}">
                  <div class="flex items-center justify-between">
                    <strong class="text-sm">${e(perk.name)}</strong>
                    ${owned ? '<span class="badge badge-success" style="font-size:0.6rem">Ativo</span>' : ''}
                  </div>
                  <div class="text-xs text-muted mt-1">${e(perk.desc)}</div>
                  ${!owned && canLearn && fighter.perkPoints > 0
                    ? `<button class="btn btn-sm btn-success btn-learn-perk mt-2" style="font-size:0.7rem;padding:2px 8px">Aprender</button>`
                    : ''}
                  ${!owned && !canLearn ? `
                    <div class="text-xs text-muted mt-1" style="opacity:0.6">
                      Requer: ${[
                        ...Object.entries(perk.requirements.attrs || {}).map(([k, v]) => `${k} ${v}`),
                        ...(perk.requirements.style ? [`estilo: ${FIGHTING_STYLES[perk.requirements.style]?.label || perk.requirements.style}`] : []),
                        ...(perk.requirements.level ? [`nível ${perk.requirements.level}`] : []),
                        ...(perk.requirements.perks?.length ? [`perks: ${perk.requirements.perks.map(p => PERKS[p]?.name || p).join(', ')}`] : []),
                      ].join(', ')}
                    </div>
                  ` : ''}
                </div>`;
            }).join('')}
          </div>
        </div>`;
      })()}

      <!-- Épico E1: Corte de Peso e Mudança de Divisão -->
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">Divisão de Peso</span>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-xs text-muted">Divisão Atual</div>
            <div class="text-sm font-bold">${getWeightClassLabel(fighter.weightClass)}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Facilidade de Corte</div>
            <div class="text-sm font-bold">${fighter.weightCut?.ease ?? 0}%</div>
            <div class="progress-bar mt-1" style="height:6px">
              <div class="progress-fill ${(fighter.weightCut?.ease ?? 0) >= 60 ? 'high' : (fighter.weightCut?.ease ?? 0) >= 40 ? 'medium' : 'low'}" style="width:${fighter.weightCut?.ease ?? 0}%"></div>
            </div>
          </div>
        </div>
        ${isPlayer ? (() => {
          const adj = getAdjacentWeightClasses(fighter.weightClass);
          const options = [];
          if (adj.up) options.push({ dir: 'up', label: `Subir para ${getWeightClassShort(adj.up)} (menos peso)` });
          if (adj.down) options.push({ dir: 'down', label: `Descer para ${getWeightClassShort(adj.down)} (mais peso)` });

          // P4.3: verifica lockout de mudança de peso
          if (fighter.weightMoveLockedUntilAbsWeek) {
            return `
              <div class="mt-3">
                <div class="text-xs text-muted">Mudança de peso travada por mais algumas semanas (lockout ativo).</div>
              </div>
            `;
          }
          if ((fighter.loyalty || 0) < 40) {
            return `
              <div class="mt-3">
                <div class="text-xs text-muted">Sua lealdade (${fighter.loyalty ?? 0}%) é muito baixa para mudar de peso.</div>
              </div>
            `;
          }
          if ((fighter.popularity || 0) < 60) {
            return `
              <div class="mt-3">
                <div class="text-xs text-muted">Você precisa de pelo menos 60 de popularidade para mudar de peso.</div>
              </div>
            `;
          }
          return options.length > 0 ? `
            <div class="mt-3">
              <div class="text-xs text-muted mb-2">Mudar de divisão (travado por 8 semanas após a mudança):</div>
              <div class="flex gap-2 flex-wrap">
                ${options.map(opt => `
                  <button class="btn btn-sm btn-secondary change-weight-class" data-dir="${opt.dir}" data-fighter="${fighter.id}">
                    ${e(opt.label)}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : '';
        })() : ''}
      </div>

      <!-- G3: Gráfico de carreira (OVR ao longo das lutas) -->
      ${displayHistory.length > 0 ? `
      <div class="card mt-4">
        <div class="card-header">
          <span class="card-title">📈 Carreira — OVR nas últimas lutas</span>
        </div>
        <div style="padding:0.5rem 0">
          ${displayHistory.slice(0, 15).reverse().map((f, i, arr) => {
            const ovr = f.fighterRating;
            if (!ovr) return '';
            const pct = Math.round((ovr / 100) * 100);
            const barColor = f.won === true ? 'high' : f.won === null ? 'medium' : 'low';
            const prev = arr[i - 1];
            const delta = prev?.fighterRating ? (ovr - prev.fighterRating) : null;
            const deltaLabel = delta !== null ? (delta > 0 ? `<span class="text-success">+${delta}</span>` : delta < 0 ? `<span class="text-danger">${delta}</span>` : '') : '';
            return `
              <div class="flex items-center gap-2 mb-1" style="font-size:0.75rem">
                <span class="badge ${f.won === true ? 'badge-success' : f.won === null ? 'badge-warning' : 'badge-danger'}" style="min-width:1.5rem;font-size:0.55rem">${e(f.result)}</span>
                <span style="width:5.5rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(f.opponent)}</span>
                <div class="progress-bar flex-1" style="height:8px;max-width:120px">
                  <div class="progress-fill ${barColor}" style="width:${pct}%"></div>
                </div>
                <span class="font-bold" style="min-width:2rem;text-align:right">${ovr}</span>
                ${deltaLabel ? `<span style="min-width:2rem">${deltaLabel}</span>` : ''}
              </div>`;
          }).filter(Boolean).join('')}
        </div>
      </div>` : ''}

      ${FighterProfileView._careerGraph(displayHistory)}

      <div class="mt-4">
        ${historyHtml}
      </div>

      <div class="flex gap-2 mt-4">
        <button class="btn btn-secondary fighter-back">Voltar</button>
      </div>
    `;
  }

  static bindEvents(fighter, { onPerkLearned, onMovesetChange, onStyleSwitch } = {}) {
    if (!fighter) return;

    document.querySelectorAll('.btn-learn-perk').forEach(btn => {
      btn.addEventListener('click', () => {
        const node = btn.closest('.perk-node');
        if (!node) return;
        const perkId = node.dataset.perkId;
        if (typeof fighter.learnPerk === 'function' && fighter.learnPerk(perkId)) {
          if (onPerkLearned) onPerkLearned();
        }
      });
    });

    document.querySelectorAll('.btn-remove-move').forEach(btn => {
      btn.addEventListener('click', async () => {
        const moveId = btn.dataset.moveId;
        if (!Array.isArray(fighter.moveset)) return;
        const idx = fighter.moveset.indexOf(moveId);
        if (idx === -1) return;
        fighter.moveset.splice(idx, 1);
        if (onMovesetChange) onMovesetChange();
      });
    });

    document.querySelectorAll('.btn-add-move').forEach(btn => {
      btn.addEventListener('click', async () => {
        const moveId = btn.dataset.moveId;
        if (!Array.isArray(fighter.moveset)) return;
        if (fighter.moveset.length >= (typeof fighter.getMaxMoves === 'function' ? fighter.getMaxMoves() : 6)) return;
        fighter.moveset.push(moveId);
        if (onMovesetChange) onMovesetChange();
      });
    });

    document.querySelectorAll('.style-switch-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (onStyleSwitch) onStyleSwitch();
      });
    });
  }
}
