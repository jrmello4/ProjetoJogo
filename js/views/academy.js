import { formatCurrency } from '../utils/helpers.js';
import { COACH_CONFIG, SCOUT_CONFIG } from '../config/game-config.js';

// Estrutura da academia: instalações, treinadores auxiliares e olheiro.
// Onde o caixa acumulado vira poder de treino de verdade.
export class AcademyView {
  static render(gym) {
    const facility = gym.facility;
    const next = gym.nextFacility;

    const facilityHtml = `
      <div class="section-label" data-reveal>Instalações</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">Nível ${gym.level} · ${facility.name}</span>
          ${!next ? '<span class="badge badge-success">Nível Máximo</span>' : ''}
        </div>
        <div class="grid grid-cols-3 gap-4 mb-3">
          <div>
            <div class="text-xs text-muted">Vagas na Equipe</div>
            <div class="text-lg font-bold">${facility.maxTeamSize}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Bônus de Treino</div>
            <div class="text-lg font-bold text-success">+${Math.round(facility.trainingBonus * 100)}%</div>
          </div>
          <div>
            <div class="text-xs text-muted">Vagas de Treinador</div>
            <div class="text-lg font-bold">${gym.hiredCoachCount}/${facility.coachSlots}</div>
          </div>
        </div>
        ${next ? `
          <div class="cost-row" style="border-top:1px solid var(--border);padding-top:0.75rem;margin-top:0.25rem">
            <div>
              <div class="text-sm font-bold">Próximo nível: ${next.name}</div>
              <div class="text-xs text-muted">${next.maxTeamSize} vagas · +${Math.round(next.trainingBonus * 100)}% treino · ${next.coachSlots} treinadores · recuperação +${next.recoveryBonus}</div>
            </div>
            <button class="btn btn-sm btn-primary facility-upgrade" ${gym.cash < next.upgradeCost ? 'disabled' : ''}>
              Upgrade — ${formatCurrency(next.upgradeCost)}
            </button>
          </div>
        ` : ''}
      </div>
    `;

    const coachCards = Object.entries(COACH_CONFIG).map(([cat, cfg]) => {
      const hired = gym.hasCoach(cat);
      const slotsFull = !hired && gym.hiredCoachCount >= facility.coachSlots;
      return `
        <div class="card stat-card stat-card--span-4" data-reveal>
          <div class="card-header">
            <span class="card-title">${cfg.icon} ${cfg.label}</span>
            ${hired ? '<span class="badge badge-success">Contratado</span>' : ''}
          </div>
          <div class="text-sm mb-1">+${Math.round(cfg.gainBonus * 100)}% de ganho no foco ${cat === 'striking' ? 'Striking' : cat === 'grappling' ? 'Grappling' : 'Cardio'}${cfg.recoveryBonus ? ` · +${cfg.recoveryBonus} recuperação` : ''}</div>
          <div class="text-xs text-muted mb-3">${formatCurrency(cfg.weeklyCost)}/semana</div>
          ${hired
            ? `<button class="btn btn-sm btn-danger coach-fire" data-category="${cat}">Dispensar</button>`
            : `<button class="btn btn-sm btn-success coach-hire" data-category="${cat}" ${slotsFull ? 'disabled' : ''}>${slotsFull ? 'Sem vagas' : 'Contratar'}</button>`
          }
        </div>
      `;
    }).join('');

    const coachesHtml = `
      <div class="section-label" data-reveal>Comissão Técnica</div>
      <div class="bento-grid mb-4" data-reveal-stagger>
        ${coachCards}
      </div>
      <div class="text-xs text-muted mb-4">O bônus do treinador se soma ao de qualquer lutador cujo foco semanal (em Minha Equipe) bata com a categoria dele.</div>
    `;

    const scoutActive = gym.scoutLevel > 0;
    const scoutHtml = `
      <div class="section-label" data-reveal>Olheiro</div>
      <div class="card mb-4" data-reveal>
        <div class="card-header">
          <span class="card-title">🔍 Olheiro de Talentos</span>
          ${scoutActive ? '<span class="badge badge-success">Ativo</span>' : ''}
        </div>
        <div class="text-sm mb-2">Revela o potencial oculto dos agentes livres na tela de Recrutamento — a diferença entre contratar um veterano estagnado e um prospecto pronto para explodir.</div>
        ${scoutActive
          ? '<div class="text-xs text-muted">Custo de manutenção: ' + formatCurrency(SCOUT_CONFIG.weeklyCost) + '/semana</div>'
          : `<button class="btn btn-sm btn-success scout-hire" ${gym.cash < SCOUT_CONFIG.unlockCost ? 'disabled' : ''}>Contratar — ${formatCurrency(SCOUT_CONFIG.unlockCost)} + ${formatCurrency(SCOUT_CONFIG.weeklyCost)}/sem</button>`
        }
      </div>
    `;

    return `
      <div class="page-header">
        <h2>Academia</h2>
        <p>Invista o caixa em estrutura, comissão técnica e inteligência de mercado</p>
      </div>

      ${facilityHtml}
      ${coachesHtml}
      ${scoutHtml}
    `;
  }
}
