import { formatCurrency, e } from '../utils/helpers.js';

const PERSONALITY_LABEL = { aggressive: 'Agressivo', cautious: 'Cauteloso', analytical: 'Analítico' };
const MANAGER_STYLE_LABEL = { aggressive: 'Agressivo', conservative: 'Conservador', loyal: 'Leal' };

// Escolha de academia (§E.3): não é mais upgrade de negócio, é decisão de
// carreira — academia grande treina melhor mas custa mais e come sinergia
// ao entrar; academia pequena cresce sinergia mais rápido.
export class AcademyView {
  static render(academies, fighter, managers = []) {
    const cards = academies.map(a => {
      const isCurrent = a.id === fighter.academyId;
      const specialtiesHtml = Object.entries(a.specialties).map(([k, v]) => {
        const label = k === 'striking' ? 'Striking' : k === 'grappling' ? 'Grappling' : 'Cardio';
        return `<span class="badge badge-info" style="font-size:0.65rem">${label} +${Math.round(v * 100)}%</span>`;
      }).join(' ');

      return `
        <div class="card stat-card stat-card--span-4 ${isCurrent ? 'stat-card--champion' : ''}" data-reveal>
          <div class="card-header">
            <span class="card-title">${e(a.name)}</span>
            ${isCurrent ? '<span class="badge badge-success">Sua academia</span>' : ''}
          </div>
          <div class="text-xs text-muted mb-2">${e(a.philosophy)} · Técnico: ${e(a.headCoach.name)} (${PERSONALITY_LABEL[a.headCoach.personality] || a.headCoach.personality})</div>
          <div class="flex items-center gap-1 mb-2" style="flex-wrap:wrap">${specialtiesHtml}</div>
          <div class="grid grid-cols-2 gap-2 mb-3">
            <div>
              <div class="text-xs text-muted">Reputação</div>
              <div class="text-sm font-bold">${a.reputation}</div>
            </div>
            <div>
              <div class="text-xs text-muted">Mensalidade</div>
              <div class="text-sm font-bold">${formatCurrency(a.weeklyFee)}/sem</div>
            </div>
          </div>
          ${isCurrent
            ? ''
            : `<button class="btn btn-sm btn-primary academy-switch" data-academy="${a.id}">Treinar aqui</button>`}
        </div>
      `;
    }).join('');

    const managerCards = managers.map(m => {
      const isCurrent = m.id === fighter.managerId;
      return `
        <div class="card stat-card stat-card--span-4 ${isCurrent ? 'stat-card--champion' : ''}" data-reveal>
          <div class="card-header">
            <span class="card-title">${e(m.name)}</span>
            ${isCurrent ? '<span class="badge badge-success">Seu empresário</span>' : ''}
          </div>
          <div class="text-xs text-muted mb-2">${MANAGER_STYLE_LABEL[m.style] || m.style}</div>
          <div class="grid grid-cols-2 gap-2 mb-3">
            <div>
              <div class="text-xs text-muted">Corte</div>
              <div class="text-sm font-bold">${Math.round(m.cut * 100)}%</div>
            </div>
            <div>
              <div class="text-xs text-muted">Conexões</div>
              <div class="text-sm font-bold">${m.connections}</div>
            </div>
          </div>
          ${isCurrent
            ? ''
            : `<button class="btn btn-sm btn-primary manager-hire" data-manager="${m.id}">${fighter.managerId ? 'Trocar (multa de rescisão)' : 'Contratar'}</button>`}
        </div>
      `;
    }).join('');

    return `
      <div class="page-header">
        <h2>Academia & Empresário</h2>
        <p>Onde você treina muda seu teto de evolução, o custo semanal e a sinergia com o técnico. Quem te representa muda quanto sobra da bolsa e como as negociações correm.</p>
      </div>

      <div class="section-label" data-reveal>Sinergia com o técnico atual</div>
      <div class="card mb-4" data-reveal>
        <div class="progress-bar mb-1"><div class="progress-fill ${fighter.coachSynergy >= 70 ? 'high' : fighter.coachSynergy >= 40 ? 'medium' : 'low'}" style="width:${fighter.coachSynergy}%"></div></div>
        <div class="text-xs text-muted">${fighter.coachSynergy}% — cresce seguindo o conselho do córner e vencendo; cai ignorando e perdendo. Trocar de academia reduz a sinergia acumulada.</div>
      </div>

      <div class="section-label" data-reveal>Academias</div>
      <div class="bento-grid mb-4" data-reveal-stagger>
        ${cards}
      </div>

      <div class="section-label" data-reveal>Empresários</div>
      <div class="bento-grid mb-4" data-reveal-stagger>
        ${managerCards}
      </div>
    `;
  }
}
