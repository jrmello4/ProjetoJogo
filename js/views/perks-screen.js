// js/views/perks-screen.js
//
// Standalone meta-progression perks screen — reachable via App#renderPerksScreen
// in app.js the same "opt-in, dev-testing entry point" way CombatAdapter's
// runCardFight is (see app.js's comment above that method). NOT wired into
// renderRetirementCeremony or any other live flow.
//
// Small, self-contained catalog of META-perks (cross-run, bought with
// Legacy Points from js/services/meta-progression-service.js). Unrelated to
// js/config/game-config.js's PERKS (in-run combat skills spent with a
// fighter's own perkPoints) — see task-10 brief for why the naming collides
// but the systems are separate.
export const META_PERKS = [
  { id: 'startingAttrBoost', name: 'Atributo Inicial Reforçado', description: '+5 em um atributo inicial', cost: 50 },
  { id: 'startingRareCard', name: 'Carta Rara Garantida', description: 'Carta rara garantida no início da run', cost: 75 },
  { id: 'academyDiscount', name: 'Desconto na Academia', description: 'Desconto na mensalidade da academia', cost: 100 },
];

// metaProgressionState: { legacyPoints, unlockedPerks } — shape matches
// MetaProgressionService's own fields after load(), see app.js's
// renderPerksScreen.
export function render(metaProgressionState) {
  const legacyPoints = metaProgressionState?.legacyPoints || 0;
  const unlockedPerks = metaProgressionState?.unlockedPerks || [];

  const perksHtml = META_PERKS.map(perk => {
    const unlocked = unlockedPerks.includes(perk.id);
    const affordable = legacyPoints >= perk.cost;
    // Mirrors card-combat-view.js's disable idiom: unaffordable/unavailable
    // options get a 'disabled' class and their click isn't bound.
    const disabled = unlocked || !affordable;

    return `
      <div class="perk-item ${disabled ? 'disabled' : ''} ${unlocked ? 'unlocked' : ''}">
        <div class="perk-name">${perk.name}</div>
        <div class="perk-desc">${perk.description}</div>
        <div class="perk-meta">
          <span class="perk-cost">${perk.cost} pts</span>
          ${unlocked
            ? `<span class="perk-status">Desbloqueado</span>`
            : `<button class="btn perk-unlock-btn" data-perk-id="${perk.id}" data-perk-cost="${perk.cost}" ${affordable ? '' : 'disabled'}>Desbloquear</button>`
          }
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="page-header">
      <h2>Perks de Legado</h2>
      <p class="text-muted text-sm">Bônus permanentes comprados com Legacy Points, ganhos entre carreiras.</p>
    </div>
    <div class="card" style="margin-bottom:1.5rem">
      <div class="card-body">
        <strong>Legacy Points:</strong> ${legacyPoints}
      </div>
    </div>
    <div class="perks-list">
      ${perksHtml}
    </div>
  `;
}
