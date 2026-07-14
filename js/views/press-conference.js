export class PressConferenceView {
  static render(scenarios, fighterA, fighterB, event, hasFight = true, alreadyDone = false) {
    if (!hasFight) {
      return `
        <div class="page-header">
          <h2>Conferência de Imprensa</h2>
          <p>${event.name}</p>
        </div>
        <div class="card">
          <div class="empty-state">
            <p>Nenhuma luta marcada — sem coletiva de imprensa por enquanto. Aceite uma oferta na aba Ofertas para gerar hype antes do evento.</p>
          </div>
        </div>
      `;
    }

    // A coletiva é única por luta. Sem esta tela, dava pra reentrar na aba e
    // responder as mesmas perguntas de novo, acumulando pcHype (e o bônus de
    // bolsa que ele vira) sem limite nenhum — dinheiro infinito.
    if (alreadyDone) {
      const hype = fighterA.pcHype || 0;
      return `
        <div class="page-header">
          <h2>Conferência de Imprensa</h2>
          <p>${event.name} — Face-off</p>
        </div>
        <div class="card">
          <div class="empty-state">
            <p>Você já encarou a imprensa por esta luta. O hype está feito — agora é no octógono.</p>
            <p class="text-sm text-muted mt-2">Hype acumulado: <strong>+${hype}</strong></p>
          </div>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <h2>Conferência de Imprensa</h2>
        <p>${event.name} — Face-off</p>
      </div>

      <div class="card mb-4">
        <div class="flex items-center justify-center gap-4 mb-4">
          <div class="text-center">
            <div class="font-bold text-lg">${fighterA.name}</div>
            <div class="text-sm text-muted">${fighterA.record.wins}-${fighterA.record.losses}-${fighterA.record.draws}</div>
          </div>
          <div class="text-danger font-bold text-xl">VS</div>
          <div class="text-center">
            <div class="font-bold text-lg">${fighterB.name}</div>
            <div class="text-sm text-muted">${fighterB.record.wins}-${fighterB.record.losses}-${fighterB.record.draws}</div>
          </div>
        </div>
      </div>

      <div id="pressConferenceQuestions">
        ${scenarios.map((s, i) => `
          <div class="card mb-4 pc-question" data-index="${i}" style="${i > 0 ? 'display:none' : ''}">
            <div class="card-header">
              <span class="card-title">Pergunta ${i + 1} de ${scenarios.length}</span>
            </div>
            <div class="text-lg font-bold mb-3">"${s.question}"</div>
            <div class="flex flex-col gap-2">
              ${s.options.map((opt, j) => `
                <button class="btn btn-secondary pc-answer" data-question="${i}" data-option="${j}" style="text-align:left">
                  "${opt.text}"
                  <span class="text-xs text-muted ml-2">(Hype +${opt.effects.hype})</span>
                </button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div id="pressConferenceSummary" style="display:none"></div>

      <div class="mt-4">
        <button class="btn btn-primary pc-simulate" id="pcSimulateBtn" style="display:none">
          Voltar ao Dashboard
        </button>
      </div>
    `;
  }

  static renderSummary(effects, totalHype, hypeBonus = 0) {
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Resumo da Conferência</span>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-xs text-muted">Hype Total</div>
            <div class="text-lg font-bold text-success">+${totalHype}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Bônus na Bolsa</div>
            <div class="text-lg font-bold" style="color:var(--gold)">+$${hypeBonus.toLocaleString()}</div>
          </div>
        </div>
        <p class="text-xs text-muted mt-2">O hype gerado na coletiva aumenta o valor da bolsa da luta.</p>
      </div>
    `;
  }
}