// Fase 2: Live Fight Hub — playback da luta round a round,
// com beats destacados (knockdown, sub attempt, takedown),
// placar ao vivo e botão pular.
// Reaproveita o mecanismo de revelação temporizada existente.
export class LiveFightHubView {
  static render(fighterA, fighterB, result) {
    const rounds = result.rounds || [];

    return `
      <div class="page-header">
        <h2>⚔️ ${fighterA.name} vs ${fighterB.name}</h2>
        <p class="text-muted">${result.method || 'Decisão'} · ${result.round ? `R${result.round}` : rounds.length > 0 ? `${rounds.length} rounds` : ''}</p>
      </div>

      <div id="liveHubStatus" class="card" style="text-align:center;padding:0.75rem;margin-bottom:1rem">
        <span class="live-dot" style="display:inline-block;width:8px;height:8px;background:var(--red);border-radius:50%;animation:livePulse 1s infinite;margin-right:0.5rem"></span>
        <span id="liveStatusText">Luta começando...</span>
        <button id="skipLiveHubBtn" class="btn btn-sm btn-secondary" style="float:right">Pular</button>
      </div>

      <!-- Results summary (hidden initially) -->
      <div id="liveHubSummary" class="card" style="display:none;text-align:center;padding:1rem;background:linear-gradient(135deg,var(--bg),#1a1a2e)">
        ${result.isDraw ? `
          <div style="font-size:2rem">🤝</div>
          <h2>EMPATE!</h2>
        ` : result.winnerId === fighterA.id ? `
          <div style="font-size:2rem">🏆</div>
          <h2 class="text-success">${fighterA.name} VENCEU!</h2>
        ` : `
          <div style="font-size:2rem">🏆</div>
          <h2 class="text-danger">${fighterB.name} VENCEU!</h2>
        `}
        <p class="text-muted">${result.method}${result.round ? ` no R${result.round}` : ''}</p>
        ${result.scorecards ? `
          <p class="text-sm text-muted" style="font-family:var(--font-mono)">
            Cartões: ${result.scorecards.map(j => `${j.a}–${j.b}`).join(' · ')}
          </p>
        ` : ''}
        <button class="btn btn-secondary mt-2" id="hubBackBtn">Voltar ao Dashboard</button>
      </div>

      <div id="liveHubRounds">
        ${rounds.map((r, ri) => `
          <div class="live-round" data-round="${ri}" style="display:none;margin-bottom:1rem">
            <div class="card">
              <div class="card-header" style="padding:0.5rem 0.75rem">
                <span class="card-title">Round ${r.round}</span>
                <span class="text-sm text-muted">${r.scoreA}–${r.scoreB}</span>
              </div>
              <div class="live-round-beats" style="padding:0.5rem 0.75rem">
                ${r.roundLog && r.roundLog.length > 0
                  ? r.roundLog.map(b => LiveFightHubView._beatHtml(b, fighterA, fighterB)).join('')
                  : '<div class="text-xs text-muted">Round técnico, poucas ações de destaque.</div>'
                }
              </div>
              ${r.finished ? '<div class="text-xs font-bold text-danger" style="padding:0.25rem 0.75rem 0.5rem">Fim da luta!</div>' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  static _beatHtml(beat, fighterA, fighterB) {
    const isA = beat.fighterId === fighterA.id;
    const name = isA ? fighterA.name : fighterB.name;
    const icon = beat.type === 'finish' ? '🔥' : beat.type === 'knockdown' ? '💥' : beat.type === 'sub_attempt' ? '🔄' : '👇';
    const colorClass = beat.type === 'finish' ? 'font-bold' : isA ? '' : 'text-danger';
    return `
      <div class="live-beat flex items-center gap-2" style="display:none;padding:0.25rem 0">
        <span>${icon}</span>
        <span class="${colorClass}">${beat.detail}</span>
      </div>
    `;
  }
}
