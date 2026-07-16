// Live Fight Hub — experiência dramática de luta ao vivo.
// Usa GSAP para animações (screen shake, fade, scale, stagger)
// e ThreeFaceOff para o palco 3D entre os rounds.
export class LiveFightHubView {
  static render(fighterA, fighterB, result) {
    const rounds = result.rounds || [];
    const isWin = !result.isDraw && result.winnerId === fighterA.id;
    const isKo = result.method?.startsWith('KO') || result.method?.startsWith('TKO');
    const isSub = result.method === 'Submission';

    return `
      <div class="page-header" style="text-align:center;border:none">
        <div id="hubFaceOff" style="width:100%;height:200px;border-radius:12px;overflow:hidden;margin-bottom:1rem"></div>
        <h2 id="hubFightTitle" style="opacity:0">⚔️ ${fighterA.name} vs ${fighterB.name}</h2>
        <p id="hubFightSubtitle" class="text-muted" style="opacity:0">${result.method || 'Decisão'} · ${result.round ? `R${result.round}` : rounds.length > 0 ? `${rounds.length} rounds` : ''}</p>
      </div>

      <div id="liveHubStatus" class="card" style="text-align:center;padding:0.75rem;margin-bottom:1rem;opacity:0">
        <span class="live-dot" style="display:inline-block;width:8px;height:8px;background:var(--red);border-radius:50%;animation:livePulse 1s infinite;margin-right:0.5rem"></span>
        <span id="liveStatusText">Luta começando...</span>
        <button id="skipLiveHubBtn" class="btn btn-sm btn-secondary" style="float:right">⏩ Pular</button>
      </div>

      <!-- Resultado final (oculto até o fim) -->
      <div id="liveHubSummary" class="card" style="display:none;text-align:center;padding:1.5rem;background:linear-gradient(135deg,var(--bg),#1a1a2e)">
        <div id="hubResultIcon" style="font-size:3rem;opacity:0">${result.isDraw ? '🤝' : isWin ? '🏆' : '😔'}</div>
        <h2 id="hubResultText" class="${result.isDraw ? '' : isWin ? 'text-success' : 'text-danger'}" style="margin:0.5rem 0;opacity:0">
          ${result.isDraw ? 'EMPATE!' : isWin ? `${fighterA.name} VENCEU!` : `${fighterB.name} VENCEU!`}
        </h2>
        <p id="hubResultMethod" class="text-muted" style="opacity:0">
          ${result.method}${result.round ? ` no R${result.round}` : ''}
          ${isKo ? ' 💥' : isSub ? ' 🔒' : ''}
        </p>
        ${result.scorecards ? `
          <p id="hubScorecards" class="text-sm text-muted" style="font-family:var(--font-mono);margin-top:0.25rem;opacity:0">
            Cartões: ${result.scorecards.map(j => `${j.a}–${j.b}`).join(' · ')}
          </p>
        ` : ''}

        <div id="hubPurseDisplay" style="display:flex;gap:1.5rem;justify-content:center;margin:1rem 0;flex-wrap:wrap;opacity:0">
          <div>
            <div class="text-xs text-muted">Bolsa</div>
            <div class="text-sm font-bold" style="color:var(--success)">$${(result._purse || 0).toLocaleString()}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Líquido</div>
            <div class="text-sm font-bold" style="color:var(--gold)">$${(result._netPurse || 0).toLocaleString()}</div>
          </div>
          ${result._hypeBonus > 0 ? `
          <div>
            <div class="text-xs text-muted">Bônus de Hype</div>
            <div class="text-sm font-bold" style="color:var(--gold)">+$${result._hypeBonus.toLocaleString()}</div>
          </div>` : ''}
          <div>
            <div class="text-xs text-muted">Recorde</div>
            <div class="text-sm font-bold">${fighterA.record.wins}-${fighterA.record.losses}-${fighterA.record.draws}</div>
          </div>
          <div>
            <div class="text-xs text-muted">Popularidade</div>
            <div class="text-sm font-bold">${fighterA.popularity}</div>
          </div>
        </div>

        ${!isWin && !result.isDraw && isKo ? `
          <div id="hubDamageWarning" class="text-xs" style="color:var(--red-ink);margin-bottom:0.75rem;opacity:0">
            ⚠️ Dano acumulado: resistência e durabilidade do lutador foram afetadas.
          </div>
        ` : ''}

        <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;opacity:0" id="hubActions">
          <button class="btn btn-secondary" id="hubBackBtn">Voltar ao Dashboard</button>
          <button class="btn btn-primary" id="shareFightBtn">📤 Compartilhar</button>
        </div>
      </div>

      <!-- Rounds -->
      <div id="liveHubRounds">
        ${rounds.map((r, ri) => `
          <div class="live-round" data-round="${ri}" style="display:none;margin-bottom:1rem">
            <div class="card" style="border-left:3px solid ${r.finished ? 'var(--red)' : 'var(--border)'}">
              <div class="card-header" style="padding:0.5rem 0.75rem">
                <span class="card-title">
                  <span class="live-round-badge" style="display:inline-block;background:${r.finished ? 'var(--red)' : 'var(--border)'};color:var(--bg);padding:0 6px;border-radius:3px;font-size:0.65rem;font-weight:700;margin-right:0.5rem">
                    ${r.finished ? 'FIM' : `R${r.round}`}
                  </span>
                  ${r.finished ? 'Luta Encerrada!' : `Round ${r.round}`}
                </span>
                <span class="text-sm text-muted" style="font-family:var(--font-mono)">${r.scoreA}–${r.scoreB}</span>
              </div>
              <div class="live-round-beats" style="padding:0.5rem 0.75rem">
                ${r.roundLog && r.roundLog.length > 0
                  ? r.roundLog.map(b => LiveFightHubView._beatHtml(b, fighterA, fighterB)).join('')
                  : '<div class="text-xs text-muted" style="padding:0.25rem 0">Round técnico, poucas ações de destaque.</div>'
                }
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  static _beatHtml(beat, fighterA, fighterB) {
    const isA = beat.fighterId === fighterA.id;
    const icon = beat.type === 'finish' ? '🔥' : beat.type === 'knockdown' ? '💥' : beat.type === 'sub_attempt' ? '🔄' : '👇';
    const isSignificant = beat.type === 'finish' || beat.type === 'knockdown';
    return `
      <div class="live-beat" data-beat-type="${beat.type}" style="display:none;padding:0.35rem 0;${isSignificant ? 'font-weight:700' : ''}">
        <span style="margin-right:0.5rem">${icon}</span>
        <span class="${isA ? '' : 'text-danger'}">${beat.detail}</span>
      </div>
    `;
  }
}
