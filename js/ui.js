import { STATE } from './state.js';
import { showGalaxy, highlightSystem } from './map.js';
import { updateHash } from './app.js';
import { fmtInt, unique } from './utils.js';
import * as i18n from './localization.js';

export function selectSystem(systemId, highlightPlanetIds) {
  const ref = STATE.systemIndex.get(systemId);
  if (!ref) return;
  const targetGalaxyId = ref.galaxyId;

  if (targetGalaxyId !== STATE.currentGalaxyId) {
    d3.select('#galaxySelect').property('value', targetGalaxyId);
    showGalaxy(targetGalaxyId, () => {
      highlightSystem(systemId);
      renderSystemDetails(ref.system, highlightPlanetIds || []);
    });
  } else {
    highlightSystem(systemId);
    renderSystemDetails(ref.system, highlightPlanetIds || []);
  }
  updateHash({ system: systemId });
}

export function renderDetailsEmpty() {
  const wrap = d3.select('#details');
  wrap.html('');
  const note = document.createElement('div');
  note.className = 'muted small';
  note.textContent = 'Раскройте один из блоков фильтров, чтобы начать поиск.';
  wrap.node().appendChild(note);
}

function getPlanetName(s, id) {
  const p = (s.planets || []).find(pp => pp.id === id);
  return p ? (p.name || p.id) : id;
}

export function renderSystemDetails(s, highlightPlanetIds) {
  const wrap = d3.select('#details');
  wrap.html('');

  const head = document.createElement('div');
  head.className = 'card';
  head.innerHTML = `<div class="sysTitle">${s.name || s.id}</div>
                    <div class="sysSub">Цвет: ${s.color || '—'} • Тип: ${s.type || '—'}</div>`;
  wrap.node().appendChild(head);

  const blkInfo = document.createElement('div');
  blkInfo.className = 'blk';
  blkInfo.innerHTML = `<div class="hdrline"><h3>Система</h3></div>`;
  const kv = document.createElement('div');
  kv.className = 'kv';
  [
    ['Координаты X', s.x], ['Координаты Y', s.y], ['Координаты Z', s.z],
    ['Размер', s.size], ['Планеты', (s.planets || []).length],
    ['Станции', (s.stations || []).length], ['Пояса', (s.asteroidBelts || []).length]
  ].forEach(([k, v]) => {
    const kEl = document.createElement('div');
    kEl.className = 'k';
    kEl.textContent = k;
    const vEl = document.createElement('div');
    vEl.className = 'v';
    vEl.textContent = (v ?? '—');
    kv.appendChild(kEl);
    kv.appendChild(vEl);
  });
  blkInfo.appendChild(kv);
  wrap.node().appendChild(blkInfo);

  const highlightSet = new Set(highlightPlanetIds || []);

  if (s.planets && s.planets.length > 0) {
    const blkPl = document.createElement('div');
    blkPl.className = 'blk';
    blkPl.innerHTML = `<div class="hdrline"><h3>Планеты</h3></div>`;
    const plGrid = document.createElement('div');
    plGrid.className = 'grid';
    plGrid.style.gap = '8px';
    (s.planets || []).forEach(p => {
      const card = document.createElement('div');
      card.className = 'planetCard';
      if (highlightSet.has(p.id)) card.classList.add('match');
      const hdr = document.createElement('div');
      hdr.className = 'hdr';
      const left = document.createElement('div');
      left.className = 'name';
      left.textContent = p.name || p.id || 'Планета';
      const right = document.createElement('div');
      right.className = 'small muted';
      right.textContent = (p.category === 'habitable' ? 'Обитаема' : (p.category === 'inhabitable' ? 'Необитаема' : (p.category || '')));
      hdr.appendChild(left);
      hdr.appendChild(right);
      card.appendChild(hdr);
      const kvp = document.createElement('div');
      kvp.className = 'kv';
      if (p.category === 'habitable') {
        [
          ['Уровень', Number.isFinite(p.level) ? p.level : '—'],
          ['Раса', i18n.translate(i18n.races, p.race) || '—'],
          ['Экономика', i18n.translate(i18n.economics, p.economics) || '—'],
          ['Политика', i18n.translate(i18n.politics, p.politics) || '—'],
          ['Население', (p.population != null ? fmtInt(p.population) : '—')]
        ].forEach(([k, v]) => {
          const kEl = document.createElement('div');
          kEl.className = 'k';
          kEl.textContent = k;
          const vEl = document.createElement('div');
          vEl.className = 'v';
          vEl.textContent = v;
          kvp.appendChild(kEl);
          kvp.appendChild(vEl);
        });
        card.appendChild(kvp);
      } else {
        [
          ['Рельеф', i18n.translate(i18n.terrains, p.terrain) || '—'],
          ['Горы', p.hills || '—'],
          ['Океаны', p.oceans || '—'],
          ['Равнины', p.plains || '—']
        ].forEach(([k, v]) => {
          const kEl = document.createElement('div');
          kEl.className = 'k';
          kEl.textContent = k;
          const vEl = document.createElement('div');
          vEl.className = 'v';
          vEl.textContent = v;
          kvp.appendChild(kEl);
          kvp.appendChild(vEl);
        });
        card.appendChild(kvp);
      }
      if (p.resources && p.resources.length) {
        const tags = document.createElement('div');
        tags.className = 'tagRow';
        tags.style.marginTop = '6px';
        p.resources.forEach(r => {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = i18n.translate(i18n.resources, r);
          tags.appendChild(chip);
        });
        card.appendChild(tags);
      }
      plGrid.appendChild(card);
    });
    blkPl.appendChild(plGrid);
    wrap.node().appendChild(blkPl);
  }

  if (s.stations && s.stations.length > 0) {
    const blkSt = document.createElement('div');
    blkSt.className = 'blk';
    blkSt.innerHTML = `<div class="hdrline"><h3>Станции</h3></div>`;
    const stGrid = document.createElement('div');
    stGrid.className = 'grid';
    stGrid.style.gap = '8px';
    (s.stations || []).forEach(t => {
      const card = document.createElement('div');
      card.className = 'stationCard';
      const hdr = document.createElement('div');
      hdr.className = 'hdr';
      const line = document.createElement('div');
      line.className = 'name small';
      const parts = [];
      parts.push(i18n.translate(i18n.stationTypes, t.type) || 'тип?');
      parts.push('—');
      parts.push(t.name || t.id || 'Станция');
      if (Number.isFinite(t.level)) parts.push(`— ур. ${t.level}`);
      if (t.race) parts.push(`— ${i18n.translate(i18n.races, t.race)}`);
      line.textContent = parts.join(' ');
      hdr.appendChild(line);
      card.appendChild(hdr);
      stGrid.appendChild(card);
    });
    blkSt.appendChild(stGrid);
    wrap.node().appendChild(blkSt);
  }

  if (s.asteroidBelts && s.asteroidBelts.length > 0) {
    const blkAb = document.createElement('div');
    blkAb.className = 'blk';
    blkAb.innerHTML = `<div class="hdrline"><h3>Астероидные пояса</h3></div>`;
    const abGrid = document.createElement('div');
    abGrid.className = 'grid';
    abGrid.style.gap = '8px';
    (s.asteroidBelts || []).forEach(b => {
      const card = document.createElement('div');
      card.className = 'beltCard';
      const hdr = document.createElement('div');
      hdr.className = 'hdr';
      const left = document.createElement('div');
      left.className = 'name small';
      left.textContent = `Пояс${Number.isFinite(b.count) ? ` • полей: ${b.count}` : ''}${b.distance ? ` • дистанция: ${b.distance}` : ''}`;
      hdr.appendChild(left);
      card.appendChild(hdr);
      if (b.resources && b.resources.length) {
        const tags = document.createElement('div');
        tags.className = 'tagRow';
        b.resources.forEach(r => {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = i18n.translate(i18n.resources, r);
          tags.appendChild(chip);
        });
        card.appendChild(tags);
      }
      abGrid.appendChild(card);
    });
    blkAb.appendChild(abGrid);
    wrap.node().appendChild(blkAb);
  }

  if (highlightPlanetIds && highlightPlanetIds.length) {
    const first = document.querySelector('.planetCard.match');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

export function renderSummaryList(entries) {
  const wrap = d3.select('#details');
  wrap.html('');
  const title = document.createElement('div');
  title.className = 'small muted';
  title.textContent = `Найдено систем: ${entries.length}`;
  wrap.node().appendChild(title);

  entries.forEach(({ system: s, reasons, highlightPlanetIds }) => {
    const card = document.createElement('div');
    card.className = 'card result';
    card.onclick = () => selectSystem(s.id, highlightPlanetIds || []);
    const title = document.createElement('div');
    title.className = 'sysTitle';
    title.textContent = s.name || s.id;
    card.appendChild(title);
    const sub = document.createElement('div');
    sub.className = 'sysSub';
    sub.textContent = `Планет: ${(s.planets || []).length} • Станций: ${(s.stations || []).length} • Поясов: ${(s.asteroidBelts || []).length}`;
    card.appendChild(sub);
    if (reasons && reasons.length) {
      const why = document.createElement('div');
      why.className = 'small muted';
      why.textContent = reasons.join(' • ');
      card.appendChild(why);
    }
    if (highlightPlanetIds && highlightPlanetIds.length) {
      const chips = document.createElement('div');
      chips.className = 'chipsRow';
      const names = highlightPlanetIds.slice(0, 4).map(pid => getPlanetName(s, pid));
      names.forEach(n => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = n;
        chips.appendChild(chip);
      });
      if (highlightPlanetIds.length > 4) {
        const more = document.createElement('span');
        more.className = 'chip';
        more.textContent = `… и ещё ${highlightPlanetIds.length - 4}`;
        chips.appendChild(more);
      }
      card.appendChild(chips);
    }
    wrap.node().appendChild(card);
  });
}

export function buildFiltersUI() {
  d3.select('#galaxyFilter').selectAll('option.extra')
    .data(STATE.dict.galaxies).join(
      enter => enter.append('option').attr('class', 'extra').attr('value', d => d.id).text(d => d.name)
    );
  d3.select('#stType').selectAll('option.extra')
    .data(STATE.dict.stTypes).join(
      enter => enter.append('option').attr('class', 'extra').attr('value', d => d).text(d => i18n.translate(i18n.stationTypes, d))
    );

  const terrainBox = d3.select('#terrainBox');
  terrainBox.selectAll('label.terrain').data(STATE.dict.terrains).join('label')
    .attr('class', 'terrain chip')
    .html(d => `<input type="checkbox" value="${d}"> ${i18n.translate(i18n.terrains, d)}`);

  const resBox = d3.select('#resBox');
  resBox.selectAll('label.res').data(STATE.dict.res).join('label')
    .attr('class', 'res chip')
    .html(d => `<input type="checkbox" value="${d}"> ${i18n.translate(i18n.resources, d)}`);

  const raceBox = d3.select('#raceBox');
  raceBox.selectAll('label.race').data(STATE.dict.races).join('label')
    .attr('class', 'race chip')
    .html(d => `<input type="checkbox" value="${d}"> ${i18n.translate(i18n.races, d)}`);
}
