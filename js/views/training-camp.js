import { formatCurrency, getWeightClassShort } from '../utils/helpers.js';
import { GYM_CONFIG, CAMP_CONFIG } from '../config/game-config.js';
import { TrainingCamp } from '../controllers/training-camp.js';

// Épico D: Acampamento de verdade.
// Mostra os atletas com luta marcada e permite configurar intensidade,
// foco e sparring partner. Sem luta, a view explica o motivo.
export class TrainingCampView {
  static render(team, bookings, now, gym) {
    const fightersWithFights = team
      .filter(f => f.gymId === GYM_CONFIG.ID)
      .map(f => {
        const booking = bookings.find(b => b.fighterId === f.id);
        return { fighter: f, booking };
      });

    const hasFights = fightersWithFights.some(f => f.booking);

    return `
      <div class="page-header">
        <h2>Acampamento de Treinamento</h2>
        <p>Configure a preparação semanal dos seus atletas para a próxima luta</p>
      </div>

      ${!hasFights ? `
        <div class="card mb-4" style="border-color:var(--warning)">
          <div class="card-body" style="padding:1.5rem;text-align:center">
            <div style="font-size:2rem;margin-bottom:0.5rem">🥊</div>
            <p class="font-bold">Nenhum atleta com luta marcada</p>
            <p class="text-sm text-muted">O acampamento só está disponível para atletas com luta confirmada.
            Vá até <strong>Ofertas</strong> para aceitar uma luta, e depois volte aqui para montar o camp.</p>
          </div>
        </div>
      ` : ''}

      <div class="grid gap-4" data-reveal-stagger>
        ${fightersWithFights.map(({ fighter, booking }) =>
          this._renderFighterCampCard(fighter, booking, team, now, gym)
        ).join('')}
      </div>

      <div class="card mt-4">
        <div class="card-body" style="padding:1rem">
          <p class="text-xs text-muted">
            <strong>Como funciona:</strong> Configure o camp para cada atleta uma vez. A cada semana,
            o treino é executado automaticamente até a luta. Sparring partner do arquétipo certo
            dá bônus de aprendizado. Treino intenso acelera ganhos mas aumenta risco de lesão —
            e uma lesão no camp pode cancelar a luta.
          </p>
        </div>
      </div>
    `;
  }

  static _renderFighterCampCard(fighter, booking, team, now, gym) {
    const hasFight = !!booking;
    const cfg = fighter.campConfig || {};
    const weeksUntilFight = booking ? Math.max(0, booking.eventAbsWeek - now) : 0;

    // Sparring partners disponíveis (outros membros da equipe, mesma ou próxima divisão)
    const sparringOptions = team.filter(f =>
      f.id !== fighter.id &&
      f.gymId === GYM_CONFIG.ID &&
      f.status !== 'injured' &&
      f.status !== 'retired'
    );

    const injured = fighter.status === 'injured';
    const suspended = fighter.availableFromAbsWeek > now;

    return `
      <div class="card camp-card" data-fighter-id="${fighter.id}" style="${!hasFight ? 'opacity:0.6' : ''}">
        <div class="card-header">
          <span class="card-title">
            ${fighter.name}
            <span class="badge badge-info" style="font-size:0.6rem;margin-left:0.5rem">${getWeightClassShort(fighter.weightClass)}</span>
            ${injured ? '<span class="badge badge-danger" style="font-size:0.6rem;margin-left:0.25rem">LESIONADO</span>' : ''}
          </span>
          <span class="text-xs text-muted">OVR ${fighter.overallRating} · ${fighter.record.wins}-${fighter.record.losses}-${fighter.record.draws}</span>
        </div>

        ${!hasFight ? `
          <div class="card-body" style="padding:1rem">
            <p class="text-sm text-muted">Sem luta marcada. Aceite uma oferta na aba Ofertas para habilitar o camp.</p>
          </div>
        ` : injured ? `
          <div class="card-body" style="padding:1rem">
            <p class="text-sm" style="color:var(--accent)">🏥 Lesionado · disponível em ${Math.max(0, (fighter.injury?.untilAbsWeek || now) - now)} semanas</p>
          </div>
        ` : suspended ? `
          <div class="card-body" style="padding:1rem">
            <p class="text-sm" style="color:var(--warning)">⏳ Suspensão médica · disponível em ${fighter.availableFromAbsWeek - now} semanas</p>
          </div>
        ` : `
          <div class="card-body" style="padding:1rem">
            <div class="flex items-center justify-between mb-3">
              <span class="badge ${weeksUntilFight <= 2 ? 'badge-danger' : weeksUntilFight <= 6 ? 'badge-warning' : 'badge-info'}">
                Luta em ${weeksUntilFight} sem${weeksUntilFight === 1 ? '' : 's'} vs ${booking.opponentName}
              </span>
              <span class="text-sm text-muted">Bolsa: ${formatCurrency(booking.purse)}</span>
            </div>

            <div class="grid grid-cols-3 gap-3 mb-3">
              <div class="form-group">
                <label class="text-xs font-bold text-secondary">Intensidade</label>
                <select class="form-select camp-intensity" data-fighter="${fighter.id}">
                  <option value="">— Sem camp —</option>
                  <option value="light" ${cfg.intensity === 'light' ? 'selected' : ''}>Leve ($${CAMP_CONFIG.WEEKLY_COST.light}/sem)</option>
                  <option value="moderate" ${cfg.intensity === 'moderate' ? 'selected' : ''}>Moderada ($${CAMP_CONFIG.WEEKLY_COST.moderate}/sem)</option>
                  <option value="intense" ${cfg.intensity === 'intense' ? 'selected' : ''}>Intensa ($${CAMP_CONFIG.WEEKLY_COST.intense}/sem)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="text-xs font-bold text-secondary">Foco</label>
                <select class="form-select camp-spec" data-fighter="${fighter.id}">
                  <option value="striking" ${cfg.spec === 'striking' || !cfg.spec ? 'selected' : ''}>Striking</option>
                  <option value="grappling" ${cfg.spec === 'grappling' ? 'selected' : ''}>Grappling</option>
                  <option value="cardio" ${cfg.spec === 'cardio' ? 'selected' : ''}>Cardio</option>
                  <option value="chin" ${cfg.spec === 'chin' ? 'selected' : ''}>Resistência</option>
                </select>
              </div>

              <div class="form-group">
                <label class="text-xs font-bold text-secondary">Sparring Partner</label>
                <select class="form-select camp-sparring" data-fighter="${fighter.id}">
                  <option value="">— Nenhum —</option>
                  ${sparringOptions.map(p => {
                    const archetype = TrainingCamp._getArchetype(p);
                    const archetypeIcon = archetype === 'striker' ? '🥊' : archetype === 'grappler' ? '🤼' : '⚖️';
                    return `
                      <option value="${p.id}" ${cfg.sparringPartnerId === p.id ? 'selected' : ''}>
                        ${p.name} (${getWeightClassShort(p.weightClass)} · ${archetypeIcon}${archetype})
                      </option>
                    `;
                  }).join('')}
                </select>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div class="text-xs text-muted">
                ${cfg.intensity ? `<span>⚠ Lesão: ${Math.round(CAMP_CONFIG.INJURY_CHANCE[cfg.intensity] * 100)}% · Overtraining: ${Math.round(CAMP_CONFIG.OVERTRAINING_CHANCE[cfg.intensity] * 100)}%</span>` : ''}
              </div>
              <div class="flex gap-2">
                ${cfg.intensity ? `<button class="btn btn-sm btn-secondary camp-cancel" data-fighter="${fighter.id}">Cancelar Camp</button>` : ''}
                <button class="btn btn-sm btn-primary camp-save" data-fighter="${fighter.id}">${cfg.intensity ? 'Atualizar Camp' : 'Iniciar Camp'}</button>
              </div>
            </div>
          </div>
        `}

        ${cfg.intensity && hasFight && !injured && !suspended ? `
          <div class="card-footer" style="padding:0.5rem 1rem;background:var(--surface-raised,#0f1115);border-top:1px solid var(--border,#2a2a2a)">
            <div class="flex items-center gap-3">
              <span class="text-xs text-muted">Camp ativo:</span>
              <span class="text-xs">${cfg.intensity === 'light' ? '🔵 Leve' : cfg.intensity === 'moderate' ? '🟡 Moderado' : '🔴 Intenso'}</span>
              <span class="text-xs text-muted">· ${cfg.sparringPartnerId ? '🤼 Com sparring' : 'Sem sparring'}</span>
              <span class="text-xs text-muted">· Custo semanal: ${formatCurrency(CAMP_CONFIG.WEEKLY_COST[cfg.intensity])}</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  static renderCampResult(fighter, result) {
    const gainRows = Object.entries(result.gains || {})
      .filter(([, v]) => v > 0)
      .map(([attr, val]) => `
        <tr>
          <td>${attr}</td>
          <td class="text-success">+${val}</td>
        </tr>
      `).join('');

    let statusHtml = '';
    if (result.injured) {
      statusHtml += `<div class="text-danger font-bold mt-2">⚠️ Lesão no treino! ${result.canceledFight ? 'A luta foi cancelada.' : `Fora por ${result.injuryWeeks} semanas.`}</div>`;
    }
    if (result.overtrained) {
      statusHtml += `<div class="text-warning font-bold mt-2">⚠️ Overtraining! Moral e energia reduzidos.</div>`;
    }
    if (result.sparringBonus > 0) {
      statusHtml += `<div class="text-success font-bold mt-2">✅ Sparring partner: +${Math.round(result.sparringBonus * 100)}% ganho!</div>`;
    }

    return `
      <div class="card mb-2" style="padding:1rem">
        <div class="flex items-center justify-between mb-2">
          <span class="font-bold">${fighter.name}</span>
          <span class="text-xs text-muted">Semana de camp concluída</span>
        </div>
        ${statusHtml}
        ${gainRows ? `
          <table class="mt-2" style="width:100%;font-size:0.85rem">
            <thead>
              <tr><th style="text-align:left">Atributo</th><th style="text-align:left">Ganho</th></tr>
            </thead>
            <tbody>${gainRows}</tbody>
          </table>
        ` : '<p class="text-xs text-muted mt-2">Nenhum ganho significativo esta semana.</p>'}
      </div>
    `;
  }
}
