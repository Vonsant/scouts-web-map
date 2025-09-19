import { STATE } from './state.js';
import { showGalaxy, highlightSystem } from './map.js';
import { updateHash } from './app.js';
import { fmtInt } from './utils.js';
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

export function renderDetailsEmpty(isSearchResult = false) {
  const wrap = d3.select('#details');
  wrap.html('');
  const card = document.createElement('div');
  card.className = 'no-results-card';
  if (isSearchResult) {
    card.innerHTML = `<span class="icon">🤷</span>По вашему запросу ничего не найдено. <br><span class="small" style="color:var(--muted);">Попробуйте смягчить условия поиска.</span>`;
  } else {
    card.innerHTML = `<span class="icon">✨</span><span class="small">Раскройте один из блоков фильтров, чтобы начать поиск, или выберите систему на карте.</span>`;
  }
  wrap.node().appendChild(card);
}

function getPlanetName(s, id) {
  const p = (s.planets || []).find(pp => pp.id === id);
  return p ? (p.name || p.id) : id;
}

function formatResourceCount(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ресурс`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ресурса`;
  return `${count} ресурсов`;
}

export function renderSystemDetails(s, highlightPlanetIds) {
  const wrap = d3.select('#details');
  wrap.html('');

  const backBtn = document.createElement('button');
  backBtn.className = 'ghost';
  backBtn.style.marginBottom = '12px';
  backBtn.textContent = '‹ Назад к результатам';
  backBtn.onclick = () => document.getElementById('runSearch').click();
  wrap.node().appendChild(backBtn);

  // System Header (Color and Type removed)
  const head = document.createElement('div');
  head.className = 'card';
  head.innerHTML = `<div class="sysTitle">${s.name || s.id}</div>`;
  wrap.node().appendChild(head);

  // System Info Block
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
    const kEl = document.createElement('div'); kEl.className = 'k'; kEl.textContent = k;
    const vEl = document.createElement('div'); vEl.className = 'v'; vEl.textContent = (v ?? '—');
    kv.appendChild(kEl); kv.appendChild(vEl);
  });
  blkInfo.appendChild(kv);
  wrap.node().appendChild(blkInfo);

  const highlightSet = new Set(highlightPlanetIds || []);

  // Planets
  if (s.planets && s.planets.length > 0) {
    const blkPl = document.createElement('div');
    blkPl.className = 'blk';
    blkPl.innerHTML = `<div class="hdrline"><h3>Планеты</h3></div>`;
    const plGrid = document.createElement('div');
    plGrid.className = 'grid';
    plGrid.style.gap = '8px';
    s.planets.forEach(p => {
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
        hdr.appendChild(left); hdr.appendChild(right);
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
                const kEl = document.createElement('div'); kEl.className = 'k'; kEl.textContent = k;
                const vEl = document.createElement('div'); vEl.className = 'v'; vEl.textContent = v;
                kvp.appendChild(kEl); kvp.appendChild(vEl);
            });
            card.appendChild(kvp);
        } else {
            [
                ['Рельеф', i18n.translate(i18n.terrains, p.terrain) || '—'],
                ['Горы', p.hills || '—'], ['Океаны', p.oceans || '—'], ['Равнины', p.plains || '—']
            ].forEach(([k, v]) => {
                const kEl = document.createElement('div'); kEl.className = 'k'; kEl.textContent = k;
                const vEl = document.createElement('div'); vEl.className = 'v'; vEl.textContent = v;
                kvp.appendChild(kEl); kvp.appendChild(vEl);
            });
            card.appendChild(kvp);
        }
        if (p.resources && p.resources.length) {
            const tags = document.createElement('div');
            tags.className = 'tagRow';
            tags.style.marginTop = '6px';
            p.resources.forEach(r => {
                const chip = document.createElement('span'); chip.className = 'chip';
                chip.textContent = i18n.translate(i18n.resources, r);
                tags.appendChild(chip);
            });
            card.appendChild(tags);
        }
        if (p.resourceGeneration && Object.keys(p.resourceGeneration).length) {
            const resBlock = document.createElement('details');
            resBlock.className = 'planetResourceBlock';

            const summary = document.createElement('summary');
            summary.className = 'planetResourceBlock__summary';

            const resTitle = document.createElement('span');
            resTitle.className = 'planetResourceBlock__title';
            resTitle.textContent = 'Генерация ресурсов (в час)';
            summary.appendChild(resTitle);

            const preview = document.createElement('span');
            preview.className = 'planetResourceBlock__meta';
            const nonZeroResources = Object.entries(p.resourceGeneration)
                .filter(([, rate]) => typeof rate === 'number' && Number.isFinite(rate) && rate > 0)
                .sort(([, a], [, b]) => b - a);
            if (nonZeroResources.length) {
                preview.textContent = formatResourceCount(nonZeroResources.length);
            } else {
                preview.textContent = 'Нет генерации';
                preview.classList.add('muted');
            }
            summary.appendChild(preview);

            resBlock.appendChild(summary);

            if (highlightSet.has(p.id)) {
                resBlock.open = true;
            }

            const grid = document.createElement('div');
            grid.className = 'planetResourceBlock__grid';

            let keysToRender = Object.keys(i18n.resources || {});
            if (keysToRender.length) {
                const extras = Object.keys(p.resourceGeneration).filter(key => !keysToRender.includes(key)).sort((a, b) => a.localeCompare(b));
                keysToRender = keysToRender.concat(extras);
            } else {
                keysToRender = Object.keys(p.resourceGeneration).sort((a, b) => a.localeCompare(b));
            }

            keysToRender.forEach(key => {
                const item = document.createElement('div');
                item.className = 'planetResourceBlock__item';

                const label = document.createElement('span');
                label.className = 'planetResourceBlock__label';
                label.textContent = i18n.translate(i18n.resources, key);

                const value = document.createElement('span');
                value.className = 'planetResourceBlock__value';
                const rate = p.resourceGeneration[key];
                if (typeof rate === 'number' && Number.isFinite(rate)) {
                    value.textContent = rate.toFixed(1);
                } else {
                    value.textContent = '—';
                    value.classList.add('muted');
                }

                item.appendChild(label);
                item.appendChild(value);
                grid.appendChild(item);
            });

            resBlock.appendChild(grid);
            card.appendChild(resBlock);
        }
        plGrid.appendChild(card);
    });
    blkPl.appendChild(plGrid);
    wrap.node().appendChild(blkPl);
  }

  // Stations (Refactored)
  if (s.stations && s.stations.length > 0) {
    const blkSt = document.createElement('div');
    blkSt.className = 'blk';
    blkSt.innerHTML = `<div class="hdrline"><h3>Станции</h3></div>`;
    const stGrid = document.createElement('div');
    stGrid.className = 'grid';
    stGrid.style.gap = '8px';
    s.stations.forEach(t => {
        const card = document.createElement('div');
        card.className = 'stationCard';
        const hdr = document.createElement('div');
        hdr.className = 'hdr';
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = t.name || t.id || 'Станция';
        const type = document.createElement('div');
        type.className = 'small muted';
        type.textContent = i18n.translate(i18n.stationTypes, t.type);
        hdr.appendChild(name);
        hdr.appendChild(type);
        card.appendChild(hdr);

        const kvp = document.createElement('div');
        kvp.className = 'kv';
        [
            ['Уровень', Number.isFinite(t.level) ? t.level : '—'],
            ['Раса', i18n.translate(i18n.races, t.race) || '—']
        ].forEach(([k, v]) => {
            const kEl = document.createElement('div'); kEl.className = 'k'; kEl.textContent = k;
            const vEl = document.createElement('div'); vEl.className = 'v'; vEl.textContent = v;
            kvp.appendChild(kEl); kvp.appendChild(vEl);
        });
        card.appendChild(kvp);
        stGrid.appendChild(card);
    });
    blkSt.appendChild(stGrid);
    wrap.node().appendChild(blkSt);
  }

  // Asteroid Belts (Refactored)
  if (s.asteroidBelts && s.asteroidBelts.length > 0) {
    const blkAb = document.createElement('div');
    blkAb.className = 'blk';
    blkAb.innerHTML = `<div class="hdrline"><h3>Астероидные пояса</h3></div>`;
    const abGrid = document.createElement('div');
    abGrid.className = 'grid';
    abGrid.style.gap = '8px';
    s.asteroidBelts.forEach(b => {
        const card = document.createElement('div');
        card.className = 'beltCard';
        const hdr = document.createElement('div');
        hdr.className = 'hdr';
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = 'Астероидный пояс';
        hdr.appendChild(name);
        card.appendChild(hdr);

        if (b.resources && b.resources.length) {
            const tags = document.createElement('div');
            tags.className = 'tagRow';
            tags.style.marginTop = '6px';
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

  if (entries.length === 0) {
    renderDetailsEmpty(true); // true indicates this is a "no results" message
    return;
  }

  const title = document.createElement('div');
  title.className = 'small muted';
  title.textContent = `Найдено систем: ${entries.length}`;
  wrap.node().appendChild(title);

  let lastGalaxyId = null;

  entries.forEach(({ galaxyId, system: s, reasons, highlightPlanetIds }, i) => {
    if (galaxyId !== lastGalaxyId) {
      const galaxy = STATE.galaxyIndex.get(galaxyId);
      const galaxyHeader = document.createElement('h2');
      galaxyHeader.className = 'galaxy-result-header result-card-enter';
      galaxyHeader.style.animationDelay = `${i * 50}ms`;
      galaxyHeader.textContent = galaxy ? (galaxy.name || galaxy.id) : 'Неизвестная галактика';
      wrap.node().appendChild(galaxyHeader);
      lastGalaxyId = galaxyId;
    }

    const card = document.createElement('div');
    card.className = 'card result result-card-enter';
    card.style.animationDelay = `${i * 50}ms`;
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
      const names = highlightPlanetIds.map(pid => getPlanetName(s, pid));
      names.forEach(n => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = n;
        chips.appendChild(chip);
      });
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

  buildSystemDatalist();
}

export function renderRouteDetails(route) {
  const wrap = d3.select('#details');
  wrap.html('');

  const title = document.createElement('h3');
  title.textContent = 'Проложенный маршрут';
  title.style.margin = '0 0 12px 0';
  wrap.node().appendChild(title);

  const renderPath = (path, startIdx) => {
    path.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'card result';
      card.onclick = () => selectSystem(s.id, []);

      const content = document.createElement('div');
      content.style.display = 'flex';
      content.style.alignItems = 'center';
      content.style.gap = '12px';

      const stepNum = document.createElement('div');
      stepNum.textContent = `${startIdx + i}.`;
      stepNum.style.fontWeight = 'bold';
      stepNum.style.color = 'var(--accent)';

      const sysName = document.createElement('div');
      sysName.textContent = s.name || s.id;

      content.appendChild(stepNum);
      content.appendChild(sysName);
      card.appendChild(content);
      wrap.node().appendChild(card);
    });
  };

  renderPath(route.path1, 1);

  if (route.isCrossGalaxy) {
    const separator = document.createElement('div');
    separator.style.textAlign = 'center';
    separator.style.margin = '10px 0';
    separator.style.color = 'var(--accent-2)';
    separator.innerHTML = `--- Межгалактический прыжок ---`;
    wrap.node().appendChild(separator);
    renderPath(route.path2, route.path1.length);
  }
}

export function buildSystemDatalist() {
  const allSystemNames = [];
  if (STATE.data && STATE.data.galaxies) {
    STATE.data.galaxies.forEach(galaxy => {
      if (galaxy.systems) {
        galaxy.systems.forEach(system => {
          allSystemNames.push(system.name || system.id);
        });
      }
    });
  }
  allSystemNames.sort((a, b) => a.localeCompare(b));

  const datalist = d3.select('#system-list');
  datalist.selectAll('option').remove();
  datalist.selectAll('option')
    .data(allSystemNames)
    .join('option')
    .attr('value', d => d);
}

export function handleAccordion(clickedHeader) {
  const allBlk = document.querySelectorAll('#filters-inner > .blk');
  const routeBlk = document.getElementById('filter-block-route');
  const isRouteHeader = clickedHeader.parentElement === routeBlk;

  if (isRouteHeader) {
    // If route planner is opened, close all others
    if (routeBlk.classList.contains('active')) {
      allBlk.forEach(blk => {
        if (blk.id !== 'filter-block-route') {
          blk.classList.remove('active');
        }
      });
    }
  } else {
    // If any other filter is opened, close route planner
    if (clickedHeader.parentElement.classList.contains('active')) {
      routeBlk.classList.remove('active');
    }
  }
}
