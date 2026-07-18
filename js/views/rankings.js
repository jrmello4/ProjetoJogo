import { getWeightClassLabel, getWeightClassName, getNationalityFlag, e } from '../utils/helpers.js';
import { TIER_LABELS } from '../config/game-config.js';
import { BiographyService } from '../services/biography-service.js';
import { PortraitService } from '../services/portrait-service.js';

const DIVISION_ORDER = [
  'Heavyweight', 'Light Heavyweight', 'Middleweight', 'Welterweight',
  'Lightweight', 'Featherweight', 'Bantamweight', 'Flyweight', 'Strawweight',
];

const isMine = (fighter, playerFighterId) => fighter?.id === playerFighterId;

export class RankingsView {
  static render(rankings, belts = [], playerFighterId = null) {
    const byDivision = {};
    for (const entry of rankings) {
      if (!entry?.fighter) continue;
      const wc = entry.fighter.weightClass;
      if (!byDivision[wc]) byDivision[wc] = [];
      byDivision[wc].push(entry);
    }

    const divisions = DIVISION_ORDER.filter(wc => byDivision[wc]?.length > 0);

    if (divisions.length === 0 && belts.length === 0) {
      return `
        <div class="page-header">
          <h2>Rankings</h2>
          <p>Classificação oficial por divisão</p>
        </div>
        <div class="empty-state">
          <p>Nenhum lutador ranqueado ainda. Avance a semana — o mundo precisa lutar primeiro.</p>
        </div>
      `;
    }

    return `
      <div class="page-header">
        <h2>Rankings</h2>
        <p>Cinturões em disputa e a classificação por divisão</p>
      </div>

      ${this._renderBelts(belts, playerFighterId)}

      <div class="section-label" data-reveal>Classificação por Divisão</div>
      ${divisions.map(wc => this._renderDivision(wc, byDivision[wc], playerFighterId)).join('')}
    `;
  }

  // Os cinturões do mundo, agrupados por promoção. Cada cinturão tem dono
  // (ou está vago) — não é mais o #1 do ranking fingindo ser campeão.
  static _renderBelts(belts, playerFighterId) {
    if (belts.length === 0) return '';

    const byPromo = {};
    for (const b of belts) {
      (byPromo[b.promotionId] ||= { name: b.promotionName, short: b.promotionShort, tier: b.tier, belts: [] }).belts.push(b);
    }

    const promos = Object.values(byPromo).sort((a, b) => a.tier - b.tier);

    return `
      <div class="section-label" data-reveal>Cinturões</div>
      ${promos.map(p => `
        <div class="card mb-2 belt-board" data-reveal>
          <div class="card-header">
            <span class="card-title"><span class="belt-mark-icon"></span> ${e(p.name)}</span>
            <span class="badge ${p.tier === 1 ? 'badge-danger' : p.tier === 2 ? 'badge-warning' : 'badge-info'}">${TIER_LABELS[p.tier]}</span>
          </div>
          <div class="belt-grid">
            ${p.belts.map(b => this._renderBelt(b, playerFighterId)).join('')}
          </div>
        </div>
      `).join('')}
    `;
  }

  static _renderBelt(b, playerFighterId) {
    // Quem é o próximo da fila. É esta informação que explica por que a
    // chance de título não chega até você.
    const nextInLine = b.topContender
      ? `<div class="belt-contender">Desafiante nº1 · ${e(b.topContender.name)}${isMine(b.topContender, playerFighterId) ? ' (você)' : ''}</div>`
      : '';

    // G2: top 5 desafiantes
    const contendersList = b.contenders && b.contenders.length > 1
      ? `
        <div class="belt-contenders mt-2">
          <div class="text-xs text-muted mb-1">Desafiantes:</div>
          ${b.contenders.slice(0, 5).map((c, i) => `
            <div class="rank-row rank-row-sm" data-fighter-click="${c?.id || ''}">
              <span class="rank-number" style="font-size:0.55rem">#${i + 1}</span>
              <span class="text-xs" style="flex:1">${e(c?.name || '—')}${isMine(c, playerFighterId) ? ' (você)' : ''}</span>
              <span class="text-xs text-muted">${c?.record?.wins ?? 0}-${c?.record?.losses ?? 0} · ${c?.overallRating ?? '?'}</span>
            </div>
          `).join('')}
        </div>
      `
      : '';

    if (!b.champion) {
      return `
        <div class="belt-slot belt-slot--vacant">
          <div class="belt-division">${getWeightClassName(b.weightClass)}</div>
          <div class="belt-champion belt-champion--vacant">Vago</div>
          ${nextInLine}
          ${contendersList}
        </div>
      `;
    }

    const mine = b.isPlayerFighter;
    // Biografia curta do campeão NPC — o mundo tem rostos, não só números
    let blurb = '';
    if (!mine && b.champion) {
      const bio = BiographyService.compose({
        ...b.champion,
        titlesWon: Math.max(1, b.champion.titlesWon || 1),
        status: 'roster',
        fights: b.champion.fights || [],
      }, {});
      const line = (bio.paragraphs || []).find(p => p.includes('Cartel') || p.includes('cinturão') || p.includes('Ergueu'))
        || bio.paragraphs?.[1]
        || bio.legacyLine
        || '';
      if (line) {
        blurb = `<div class="text-xs text-muted mt-1" style="line-height:1.35">${e(line)}</div>`;
      }
    }
    return `
      <div class="belt-slot ${mine ? 'belt-slot--mine' : ''}" data-fighter-click="${b.champion.id}">
        <div class="belt-division">${getWeightClassName(b.weightClass)}</div>
        <div class="belt-champion">${e(b.champion.name)}</div>
        <div class="belt-meta">
          ${b.champion.record?.wins ?? 0}-${b.champion.record?.losses ?? 0}-${b.champion.record?.draws ?? 0}
          ${b.defenses > 0 ? ` · ${b.defenses} defesa${b.defenses === 1 ? '' : 's'}` : ''}
        </div>
        ${blurb}
        ${nextInLine}
        ${contendersList}
        ${mine ? '<span class="badge badge-danger belt-mine-tag">Você</span>' : ''}
      </div>
    `;
  }

  static _renderDivision(wc, entries, playerFighterId) {
    const top = entries.slice(0, 10);

    return `
      <div class="rank-division" data-reveal>
        <div class="rank-division-header">
          <span class="rank-division-title">${getWeightClassLabel(wc)}</span>
          <span class="text-xs text-muted">${entries.length} lutadores ativos</span>
        </div>

        <div class="card" style="padding:0.5rem 0.25rem">
          ${top.map((c, i) => `
            <div class="rank-row ${isMine(c.fighter, playerFighterId) ? 'rank-row--mine' : ''}" data-fighter-click="${c.fighter.id}">
              <span class="rank-number">#${i + 1}</span>
              <span class="portrait-frame rank-portrait">${PortraitService.renderFighter(c.fighter, { size: 28 })}</span>
              <span class="text-sm font-bold" style="flex:1">
                ${c.fighter?.nationality?.code ? getNationalityFlag(c.fighter.nationality.code) + ' ' : ''}${e(c.fighter?.name || '—')}
                ${(c.fighter.titlesWon || 0) > 0 ? '<span class="belt-mark ml-1" title="Já foi campeão"><span class="belt-mark-icon"></span></span>' : ''}
                ${isMine(c.fighter, playerFighterId) ? '<span class="badge badge-danger ml-2" style="font-size:0.6rem">VOCÊ</span>' : ''}
              </span>
              <span class="text-xs text-muted">${c.fighter.record?.wins ?? 0}-${c.fighter.record?.losses ?? 0}-${c.fighter.record?.draws ?? 0}</span>
              <span class="text-xs font-bold" style="width:3.5rem;text-align:right">${c.fighter.overallRating ?? '?'} OVR</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}
