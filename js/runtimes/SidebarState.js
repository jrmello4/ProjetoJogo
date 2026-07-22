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
          { view: 'overview', label: 'Visão Geral', icon: 'hall' },
          { view: 'events', label: 'Mundo', icon: 'events' },
          { view: 'management', label: 'Gestão', icon: 'market' },
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
          { view: 'opponent', label: 'Estudo da Luta', icon: 'events' },    // scouting + tape combined
          { view: 'offers', label: 'Plano de Luta', icon: 'events' },       // game plan + bait
          { view: 'fight', label: 'Combate', icon: 'dashboard' },           // only when fight day
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
        { view: 'timeline', label: 'Linha do Tempo', icon: 'hall' },
        { view: 'hall-of-fame', label: 'Legado', icon: 'hall' },
      ],
    });

    return { sections, hasUpcomingFight };
  }
}
