export class SidebarState {
  /**
   * @param {object} fighter - Player fighter
   * @param {Array} bookings - Accepted offers
   * @param {Array} pendingOffers - Pending fight offers
   * @returns {{ sections: Array<{id: string, label: string, contextual: boolean, items: Array<{view: string, label: string, icon: string}> }> }}
   */
  static compute(fighter, bookings, pendingOffers) {
    const hasUpcomingFight = bookings?.some(b =>
      b.fighterId === fighter?.id && b.status === 'accepted' && !b.completed
    );

    const sections = [
      // DASHBOARD — always first, always visible
      {
        id: 'dashboard-section',
        label: null,
        contextual: false,
        items: [
          { view: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        ],
      },
      // CARREIRA — always visible
      {
        id: 'career-section',
        label: 'Carreira',
        contextual: false,
        items: [
          { view: 'overview', label: 'Visão Geral', icon: 'fight' },
          { view: 'events', label: 'Mundo', icon: 'world' },
          { view: 'management', label: 'Gestão', icon: 'management' },
        ],
      },
    ];

    // PRÓXIMA LUTA — only when a fight is booked (contextual)
    if (hasUpcomingFight) {
      sections.push({
        id: 'next-fight-section',
        label: 'PRÓXIMA LUTA',
        contextual: true,
        items: [
          { view: 'training', label: 'Camp', icon: 'training' },
          { view: 'opponent', label: 'Estudo da Luta', icon: 'scout' },    // scouting + tape combined
          { view: 'fight-plan', label: 'Plano de Luta', icon: 'plan' },  // game plan + bait
          { view: 'fight', label: 'Combate', icon: 'fight' },           // only when fight day
        ],
      });
    }

    // HISTÓRIA — always visible
    sections.push({
      id: 'history-section',
      label: 'História',
      contextual: false,
      items: [
        { view: 'rivalries', label: 'Rivalidades', icon: 'rivalries' },
        { view: 'timeline', label: 'Linha do Tempo', icon: 'timeline' },
        { view: 'hall-of-fame', label: 'Legado', icon: 'legacy' },
      ],
    });

    return { sections, hasUpcomingFight };
  }
}
