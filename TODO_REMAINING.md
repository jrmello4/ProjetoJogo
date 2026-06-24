# Pendências - Melhorias MMA Manager

## Status Atual
- [x] DB version bump (v4) - stores gameState e notifications criados
- [x] season-service.js criado
- [x] notification-service.js criado
- [x] save-service.js criado
- [x] matchmaker.js criado
- [x] notifications.js (view) criado
- [x] game-controller.js atualizado (useFight fix, season, notifications)
- [ ] **Falta implementar abaixo**

---

## 1. fighter-controller.js — renewContract()

Adicionar método:
```js
async renewContract(fighterId, newContractData) {
  const fighter = await this.getFighter(fighterId);
  if (!fighter) return null;
  const contract = new Contract(newContractData);
  fighter.contract = contract;
  fighter.applyMoraleChange(5);
  await this.db.put('fighters', fighter);
  return new Fighter(fighter);
}
```

---

## 2. roster.js — Contrato expirando + botão renovar

Na coluna "Contrato", quando `fightsRemaining <= 1`, adicionar badge warning:
```js
<td class="text-xs">
  ${f.contract ? `<span class="${f.contract.fightsRemaining <= 1 ? 'text-danger font-bold' : ''}">${f.contract.fightsRemaining} lutas</span>` : '—'}
</td>
```

Na coluna "Ações", mostrar botão renovar quando contrato está acabando:
```js
<td>
  ${f.contract && f.contract.fightsRemaining <= 1 ? `
    <button class="btn btn-sm btn-warning roster-renew" data-id="${f.id}" style="margin-right:0.25rem">Renovar</button>
  ` : ''}
  <button class="btn btn-sm btn-danger roster-fire" data-id="${f.id}">Demitir</button>
</td>
```

---

## 3. dashboard.js — Semana/Ano + Avançar Semana + Save/Load

No header do dashboard, adicionar semana/ano:
```js
<div class="page-header">
  <h2>Dashboard</h2>
  <p>${organization.name} — ${weekLabel}</p>
</div>
```

Adicionar botão "Avançar Semana" e seção "Dados do Jogo":
```js
<div class="flex gap-2 mb-4">
  <button class="btn btn-primary advance-week-btn">Avançar Semana</button>
</div>
...
<div class="card mt-4">
  <div class="card-header"><span class="card-title">Dados do Jogo</span></div>
  <div class="flex gap-2">
    <button class="btn btn-sm btn-secondary export-save">Exportar Save</button>
    <button class="btn btn-sm btn-secondary import-save-btn">Importar Save</button>
    <button class="btn btn-sm btn-danger reset-game-btn">Resetar Jogo</button>
  </div>
</div>
```

---

## 4. events.js — Bloqueio semanal + Auto-Matchmaker

No modal de criação, verificar se já houve evento esta semana. Se sim, mostrar aviso e desabilitar botão.

Adicionar botão "Gerar Card Automático" antes dos selects:
```js
<button class="btn btn-sm btn-success auto-match" id="autoMatchBtn">⚡ Gerar Card Automático</button>
```

Adicionar select para escolher divisão ou "Mix":
```js
<select class="form-select" id="matchWeightClass">
  <option value="">Mix (todas divisões)</option>
  ${WEIGHT_CLASSES.map(wc => `<option value="${wc}">${wc}</option>`).join('')}
</select>
```

---

## 5. app.js — Roteamento e wiring

### Imports adicionais:
```js
import { SeasonService } from './services/season-service.js';
import { NotificationService } from './services/notification-service.js';
import { SaveService } from './services/save-service.js';
import { Matchmaker } from './services/matchmaker.js';
import { NotificationsView } from './views/notifications.js';
```

### No constructor:
```js
this.seasonService = null;
this.notifService = null;
this.saveService = null;
```

### No init():
```js
this.seasonService = new SeasonService(this.game.db);
this.notifService = new NotificationService(this.game.db);
this.saveService = new SaveService(this.game.db);
```

### No navigateTo switch:
```js
case 'notifications':
  await this.renderNotifications();
  break;
case 'press-conference':
  await this.renderPressConference();
  break;
```

### Métodos novos:
```js
async renderNotifications() {
  const notifs = await this.notifService.getAll();
  const unread = await this.notifService.getUnread();
  LayoutView.render(NotificationsView.render(notifs, unread.length));
  this._bindNotificationEvents();
}

async renderPressConference() {
  const roster = await this.game.fighterCtrl.getRoster('org-001');
  const upcoming = await this.game.eventCtrl.getUpcomingEvents();
  // Se tem evento agendado, usar a main event
  // Se não, deixar escolher
  LayoutView.render(PressConferenceView.render(upcoming, roster));
  this._bindPressConferenceEvents();
}

async advanceWeek() {
  const newState = await this.seasonService.advanceWeek();
  await this.seasonService.applyWeeklyRecovery(this.game.fighterCtrl);
  await this.notifService.add('week-advance', 'Semana Avançada', `Agora é Semana ${newState.week}, Ano ${newState.year}.`);
  await this.renderDashboard();
}

async resetGame() {
  if (!confirm('Tem certeza? Todos os dados serão perdidos!')) return;
  await this.saveService.resetGame();
  location.reload();
}

async exportSave() {
  const json = await this.saveService.exportSave();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mma-manager-save-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async importSave(file) {
  const text = await file.text();
  await this.saveService.importSave(text);
  location.reload();
}
```

### Bind events:
```js
_bindNotificationEvents() {
  document.querySelectorAll('.notif-mark-read').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      await this.notifService.markRead(id);
      await this.renderNotifications();
    });
  });
  const markAll = document.querySelector('.notif-mark-all');
  if (markAll) {
    markAll.addEventListener('click', async () => {
      await this.notifService.markAllRead();
      await this.renderNotifications();
    });
  }
}

_bindAdvanceWeek() {
  const btn = document.querySelector('.advance-week-btn');
  if (btn) btn.addEventListener('click', () => this.advanceWeek());
}

_bindSaveLoad() {
  const exportBtn = document.querySelector('.export-save');
  if (exportBtn) exportBtn.addEventListener('click', () => this.exportSave());

  const importBtn = document.querySelector('.import-save-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const input = document.getElementById('importFileInput');
      if (input) input.click();
    });
  }

  const resetBtn = document.querySelector('.reset-game-btn');
  if (resetBtn) resetBtn.addEventListener('click', () => this.resetGame());

  const fileInput = document.getElementById('importFileInput');
  if (fileInput) fileInput.addEventListener('change', async (e) => {
    if (e.target.files[0]) {
      await this.importSave(e.target.files[0]);
    }
  });
}

_bindAutoMatch() {
  const btn = document.getElementById('autoMatchBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      const roster = await this.game.fighterCtrl.getRoster('org-001');
      const wc = document.getElementById('matchWeightClass')?.value || null;
      const mainFights = Matchmaker.suggestMainCard(roster, 2);
      const prelimFights = Matchmaker.suggestPrelimCard(roster, 2);
      // Preencher os selects do modal
      // ... lógica de preencher selects
    });
  }
}

_bindRenewButton() {
  document.querySelectorAll('.roster-renew').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const fighter = await this.game.fighterCtrl.getFighter(id);
      if (fighter) {
        document.getElementById('mainContent').innerHTML = MarketView.renderHireModal(fighter);
        // Re-bind modal close
        document.querySelectorAll('[data-close]').forEach(el => {
          el.addEventListener('click', () => {
            document.getElementById(el.dataset.close)?.remove();
          });
        });
        // Bind confirm renew
        const confirmBtn = document.querySelector('.market-confirm-hire');
        if (confirmBtn) {
          confirmBtn.textContent = 'Renovar Contrato';
          confirmBtn.addEventListener('click', async () => {
            const purse = parseInt(document.getElementById('hirePurse').value);
            const duration = parseInt(document.getElementById('hireDuration').value);
            const bonus = parseInt(document.getElementById('hireBonus').value);
            await this.game.fighterCtrl.renewContract(id, {
              pursePerFight: purse,
              duration,
              victoryBonus: bonus,
              fightsRemaining: duration,
            });
            await this.renderRoster();
          });
        }
      }
    });
  });
}
```

### No renderDashboard, renderRoster, renderEvents:
Chamar os binds correspondentes após renderizar.

---

## 6. index.html — Menu items novos

Adicionar no nav-menu:
```html
<li class="nav-item">
  <a class="nav-link" data-view="notifications">
    <span class="nav-icon">🔔</span>
    <span>Notificações</span>
    <span class="notif-badge" id="notifBadge" style="display:none"></span>
  </a>
</li>
<li class="nav-item">
  <a class="nav-link" data-view="press-conference">
    <span class="nav-icon">🎤</span>
    <span>Conferências</span>
  </a>
</li>
```

Adicionar antes do `</body>`:
```html
<input type="file" id="importFileInput" accept=".json" style="display:none">
```

---

## 7. css/main.css — Estilos adicionais

```css
/* Notificação badge no menu */
.notif-badge {
  background: var(--accent);
  color: white;
  border-radius: 50%;
  padding: 0.1rem 0.4rem;
  font-size: 0.65rem;
  font-weight: 700;
  margin-left: auto;
}

/* Notificação não lida */
.notif-unread {
  background: var(--accent-subtle);
  border-left: 3px solid var(--accent);
  margin: 0 -0.75rem;
  padding-left: 0.75rem !important;
}

.notif-read {
  opacity: 0.6;
}

/* Botão warning */
.btn-warning {
  background: var(--warning);
  color: white;
}
.btn-warning:hover {
  background: #b08218;
}
```

---

## 8. event-controller.js — Verificação semanal

Em `getUpcomingEvents()`, já filtra por data. Adicionar verificação de `canCreateEvent()` no frontend ao abrir o modal de criação.

---

## Ordem de Implementação Restante

1. **app.js** — imports, constructor, init, navigateTo cases, métodos novos, bind events (MAIOR MUDANÇA)
2. **index.html** — menu items + input file
3. **dashboard.js** — semana/ano, avançar semana, save/load/reset
4. **events.js** — bloqueio semanal, auto-matchmaker
5. **roster.js** — contrato warning, botão renovar
6. **fighter-controller.js** — renewContract()
7. **css/main.css** — estilos de notificação, botão warning
8. **ROADMAP_FUTURE.md** — atualizar status das features implementadas
