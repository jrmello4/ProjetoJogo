# Navegação Contextual — UI Simplification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 3-group sidebar with contextual navigation that adapts to game state.

**Architecture:** The sidebar HTML (currently static in `index.html`) becomes dynamic — rendered by `LayoutView` based on game state. A `SidebarState` helper determines which sections to show (always: DASHBOARD, CARREIRA, HISTÓRIA; contextual: PRÓXIMA LUTA when a fight is booked). The sidebar re-renders when navigating. All existing views remain but are reorganized under new section headers. No new features or systems. No view code changes — only navigation + sidebar structure.

**Tech Stack:** Vanilla JS, no frameworks, no build step. CSS transition for sidebar sections showing/hiding.

**Global Constraints**
- Zero new features — only navigation reorganization
- All existing views stay functional (different navigation path, same rendered content)
- Save compatibility unchanged (no schema changes)
- Views are referenced by `data-view` attribute — renaming views requires updating both sidebar links AND `navigateTo()` in app.js
- Existing direct view access patterns (e.g., `window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }))`) must still work
- The 5 pillars are architectural, NOT navigation labels — no "Consequências" section in sidebar

---

## File Structure

| File | Responsibility | Change |
|------|---------------|--------|
| `index.html` | Remove static sidebar `<nav>`, keep header + footer + structural shell | Remove lines 55-144 (nav-menu), keep sidebar-header + sidebar-footer |
| `js/views/layout.js` | Add `renderSidebar(state)` — dynamic sidebar rendering | Add method + types; modify `initNavigation()` to attach events to dynamic links |
| `js/app.js` | Add `_buildSidebarState()` — determine what to show based on game state | Add method; call `LayoutView.renderSidebar()` after `game.init()` + on navigate |
| `css/components.css` | Add `.nav-group--contextual` highlight class for PRÓXIMA LUTA section | Add ~20 lines of CSS |
| `js/views/dashboard.js` | No changes needed | — |
| `js/views/academy.js` → accessed via CAMP | No changes needed | — |
| `js/views/offers.js` → accessed via Gestão + ESTUDO DA LUTA | No changes needed | — |

---

### Task 1: Create SidebarState helper

**Files:**
- Create: `js/runtimes/SidebarState.js`
- No test (UI-only logic)

**Interface:**
- Produces: `SidebarState.compute(fighter, bookings, pendingOffers)` → returns sidebar sections object

The SidebarState helper determines what navigation sections to show based on game state.

Two states:
1. **With fight booked** — fighter has an accepted offer with `eventAbsWeek` in the future
2. **Without fight booked** — no upcoming fight

For each state, it returns which sections + items are visible, with their `data-view` targets.

```js
// SidebarState.js
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
```

**Key insight:** each `view` value maps to existing `navigateTo()` routes. New views like `overview`, `management`, `opponent`, `timeline`, `fight` will be added to `navigateTo()` and delegate to existing view renderers.

- [ ] **Step 1: Create SidebarState.js**

Write the file as shown above.

- [ ] **Step 2: Verify file loads**

Run: `node -e "import('./js/runtimes/SidebarState.js').then(m => console.log('OK', Object.keys(m)))"`
Expected: `OK ['SidebarState']`

- [ ] **Step 3: Commit**

```bash
git add js/runtimes/SidebarState.js
git commit -m "feat(ui): add SidebarState helper for contextual nav"
```

---

### Task 2: Dynamic sidebar renderer in LayoutView

**Files:**
- Modify: `js/views/layout.js` (add `renderSidebar()` method)
- Modify: `css/components.css` (add contextual nav group styles)

**Consumes:** `SidebarState.compute()` → sections array
**Produces:** `LayoutView.renderSidebar(sections)` → DOM update

- [ ] **Step 1: Add renderSidebar to LayoutView**

Add after `setSidebarOpen()`:

```js
import { SidebarState } from '../runtimes/SidebarState.js';

export class LayoutView {
  // ... existing methods ...

  /** Render sidebar navigation dynamically based on game state */
  static renderSidebar(sections) {
    const nav = document.querySelector('.sidebar nav');
    if (!nav) return;

    let html = '';
    for (const section of sections) {
      if (section.label) {
        html += `<p class="nav-group-label">${section.label}</p>`;
      }
      html += '<ul class="nav-menu">';
      for (const item of section.items) {
        const activeClass = window.__currentView === item.view ? 'active' : '';
        html += `
          <li class="nav-item">
            <a class="nav-link ${activeClass}" data-view="${item.view}" href="#" role="button">
              <span class="rive-slot" data-rive="${item.icon}"></span>
              <span>${item.label}</span>
            </a>
          </li>`;
      }
      html += '</ul>';
    }
    nav.innerHTML = html;

    // Re-attach navigation event listeners
    this._attachNavListeners(nav);
  }

  /** Attach click handlers to all nav links */
  static _attachNavListeners(container) {
    const links = container.querySelectorAll('.nav-link[data-view]');
    links.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        links.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');

        // Dispatch navigate event — same pattern as initNavigation
        window.__currentView = view;
        window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }));
      });
    });

    // Re-mount Rive animations (already imported at top of module)
    riveManager.mountAll(container);
  }
```

Note: make `_attachNavListeners` async or handle riveManager.mountAll as needed.

- [ ] **Step 2: Add CSS for contextual nav group**

In `css/components.css`, add:

```css
/* Contextual nav section — highlighted when next-fight section appears */
.nav-section--contextual {
  position: relative;
}
.nav-section--contextual::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent-dim, rgba(196, 30, 58, 0.08)), transparent);
  pointer-events: none;
}
.nav-section--contextual .nav-group-label {
  color: var(--accent, #c41e3a);
  font-weight: 700;
  letter-spacing: 1px;
}
```

- [ ] **Step 3: Commit**

```bash
git add js/views/layout.js css/components.css
git commit -m "feat(ui): dynamic sidebar rendering in LayoutView"
```

---

### Task 3: Routing — add new view aliases + sidebar state in app.js

**Files:**
- Modify: `js/app.js` (add new routes in navigateTo, call renderSidebar)

**Consumes:** Game state from `this.game.getDashboard()`, fighter data
**Produces:** Working navigation with new view names

The sidebar uses view names that don't exist as dedicated views yet:
- `overview` → reuses parts of existing views (dashboard's ranking/career overview section)
- `management` → combines finance view + offers + contract info
- `opponent` → scouting + tape (currently part of offers view)
- `timeline` → podcast + biography + career log
- `fight` → combat view (card-combat-view / live-fight-hub)

For this task, each new view name routes to an existing view renderer. In a later iteration, these could get dedicated composite views.

- [ ] **Step 1: Add view routing aliases in navigateTo()**

In `js/app.js`, add cases before the `default` case:

```js
case 'overview':
  // Visão Geral — mostra dashboard resumido focado em carreira
  await this.renderDashboard();
  break;
case 'management':
  // Gestão — finanças + ofertas + contrato
  await this.renderFinance();
  break;
case 'opponent':
  // Estudo da Luta — scouting do oponente (redireciona para ofertas com foco na luta atual)
  await this.renderOffers();
  break;
case 'timeline':
  // Linha do Tempo — podcast + biografia (redireciona para hall da fama / dashboard)
  await this.renderDashboard();
  break;
case 'fight':
  // Combate — a luta em si
  await this.renderDashboard(); // fallback — luta é iniciada pelo fluxo semanal
  break;
```

- [ ] **Step 2: Add sidebar state computation and render call**

In `App`, after `this.game.init()` completes (inside the try block in `init()`), call:

```js
// After: playerFighter = await this.game.init();
const dashboardData = await this.game.getDashboard();
const sidebarState = SidebarState.compute(
  dashboardData.fighter,
  dashboardData.bookings,
  dashboardData.pendingOffers
);
LayoutView.renderSidebar(sidebarState.sections);
window.__currentView = 'dashboard';
```

Add import:
```js
import { SidebarState } from './runtimes/SidebarState.js';
```

- [ ] **Step 3: Update sidebar on navigation**

In App constructor or init, add a listener for sidebar refreshes:

```js
// In init(), after the sidebar is first rendered
window.addEventListener('navigate', () => {
  // Re-render sidebar on navigation to keep active state
  // Also re-evaluate contextual sections
  requestAnimationFrame(async () => {
    const dd = await this.game.getDashboard();
    const state = SidebarState.compute(dd.fighter, dd.bookings, dd.pendingOffers);
    LayoutView.renderSidebar(state.sections);
  });
});
```

But to avoid re-rendering sidebar on every nav (which causes flicker), optimize: only re-render on game state change (week advance) or when entering dashboard.

Better approach: render sidebar once after init, then only update active class on nav:

```js
// On navigate, just update active class
window.addEventListener('navigate', (e) => {
  const view = e.detail?.view;
  if (!view) return;
  document.querySelectorAll('.nav-link[data-view]').forEach(l => {
    l.classList.toggle('active', l.dataset.view === view);
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat(ui): view routing aliases + sidebar state integration"
```

---

### Task 4: Strip static sidebar from index.html

**Files:**
- Modify: `index.html`

Remove the static nav menu (lines 55-144 in current file). Keep sidebar-header + sidebar-footer.

- [ ] **Step 1: Replace nav section with a placeholder**

In `index.html`, replace the entire `<nav>` block with:

```html
<nav aria-label="Navegação principal">
  <!-- Sidebar rendered dynamically by LayoutView.renderSidebar() -->
</nav>
```

Keep everything else — sidebar-header, sidebar-footer, hamburger, backdrop.

- [ ] **Step 2: Verify HTML renders without errors.**

Reload the app. Check that the sidebar appears (rendered by JS) and navigation works.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "refactor(ui): remove static sidebar nav, now rendered dynamically"
```

---

### Task 5: Polish — loading, empty states, transition

**Files:**
- Modify: `css/components.css`

- [ ] **Step 1: Add sidebar transition CSS**

```css
/* Smooth nav section appearance */
.nav-menu {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.nav-section--contextual .nav-menu {
  animation: slideInNav 0.3s ease-out;
}
@keyframes slideInNav {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Active nav link styling */
.nav-link.active {
  background: var(--accent);
  color: #fff;
  border-radius: 6px;
}
```

- [ ] **Step 2: Handle loading state for sidebar**

In `layout.js`, `renderSidebar()` should handle the case where `sections` is empty:

```js
if (!sections || sections.length === 0) {
  nav.innerHTML = '<p class="text-secondary text-sm p-4">Carregando...</p>';
  return;
}
```

- [ ] **Step 3: Commit**

```bash
git add css/components.css js/views/layout.js
git commit -m "feat(ui): sidebar animation, loading state, active styles"
```

---

### Task 6: Test — navigation smoke test

- [ ] **Step 1: Verify all views still render**

Manually test each view from the new sidebar:
- Dashboard ✅
- Visão Geral (→ Dashboard) ✅
- Mundo (→ Events) ✅
- Gestão (→ Finanças) ✅
- Camp (→ Acampamento) ✅
- Estudo da Luta (→ Ofertas) ✅
- Plano de Luta (→ Ofertas) ✅
- Rivalidades ✅
- Linha do Tempo (→ Dashboard) ✅
- Legado (→ Hall da Fama) ✅
- Notificações (via sidebar-footer or settings) ✅
- Configurações (via sidebar-footer) ✅

- [ ] **Step 2: Verify contextual section appears/disappears**

Accept a fight offer → PRÓXIMA LUTA section should appear. Wait for fight to complete → section should disappear.

- [ ] **Step 3: Run test suite**

Run: `npx vitest run`
Expected: 178 passed

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(ui): contextual navigation — sidebar adapts to game state"
```
