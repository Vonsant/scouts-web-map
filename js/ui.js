import { STATE } from './state.js';
import { showGalaxy, highlightSystem } from './map.js';
import { updateHash } from './app.js';
import { fmtInt } from './utils.js';
import * as i18n from './localization.js';
import { calculateDistance } from './pathfinder.js';

const EMPTY_VALUE = '—';

const createElement = (tag, className, textContent) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined && textContent !== null) {
    el.textContent = textContent;
  }
  return el;
};

const appendKeyValue = (container, label, value) => {
  const kEl = createElement('div', 'k', label);
  const safeValue = (value === undefined || value === null || value === '') ? EMPTY_VALUE : value;
  const vEl = createElement('div', 'v', safeValue);
  container.appendChild(kEl);
  container.appendChild(vEl);
};

const createKeyValueGrid = pairs => {
  const grid = createElement('div', 'kv');
  pairs.forEach(([label, value]) => appendKeyValue(grid, label, value));
  return grid;
};

const createSectionBlock = title => {
  const block = createElement('div', 'blk');
  const header = createElement('div', 'hdrline');
  header.appendChild(createElement('h3', null, title));
  block.appendChild(header);
  return block;
};

const createChipRow = (items, labelResolver) => {
  if (!items || !items.length) return null;
  const row = createElement('div', 'tagRow');
  row.style.marginTop = '6px';
  items.forEach(item => {
    const chip = createElement('span', 'chip', labelResolver ? labelResolver(item) : item);
    row.appendChild(chip);
  });
  return row;
};

const resolveResourceOrder = (() => {
  let order = null;
  return () => {
    if (!order) {
      order = new Map();
      Object.keys(i18n.resources || {}).forEach((key, index) => {
        order.set(key, index);
      });
    }
    return order;
  };
})();

const translateResource = key => i18n.translate(i18n.resources, key) || key;

const buildResourceGenerationBlock = (resourceGeneration, shouldExpand) => {
  if (!resourceGeneration || typeof resourceGeneration !== 'object') return null;

  const entries = Object.entries(resourceGeneration)
    .filter(([, rate]) => typeof rate === 'number' && Number.isFinite(rate) && rate > 0);

  const block = createElement('details', 'planetResourceBlock');
  if (shouldExpand) block.open = true;

  const summary = createElement('summary', 'planetResourceBlock__summary');
  summary.appendChild(createElement('span', 'planetResourceBlock__title', 'Генерация ресурсов (в час)'));
  block.appendChild(summary);

  if (!entries.length) {
    const empty = createElement('div', 'planetResourceBlock__empty muted', 'Нет генерации ресурсов');
    block.appendChild(empty);
    return block;
  }

  const order = resolveResourceOrder();
  entries.sort(([keyA], [keyB]) => {
    const orderA = order.has(keyA) ? order.get(keyA) : Number.POSITIVE_INFINITY;
    const orderB = order.has(keyB) ? order.get(keyB) : Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    return keyA.localeCompare(keyB);
  });

  const grid = createElement('div', 'planetResourceBlock__grid');
  entries.forEach(([key, rate]) => {
    const item = createElement('div', 'planetResourceBlock__item');
    item.appendChild(createElement('span', 'planetResourceBlock__label', translateResource(key)));
    item.appendChild(createElement('span', 'planetResourceBlock__value', rate.toFixed(1)));
    grid.appendChild(item);
  });
  block.appendChild(grid);
  return block;
};

const buildPlanetCard = (planet, highlightSet) => {
  const card = createElement('div', 'planetCard');
  if (highlightSet.has(planet.id)) card.classList.add('match');

  const header = createElement('div', 'hdr');
  header.appendChild(createElement('div', 'name', planet.name || planet.id || 'Планета'));
  const categoryLabel = planet.category === 'habitable'
    ? 'Обитаема'
    : (planet.category === 'inhabitable' ? 'Необитаема' : (planet.category || ''));
  header.appendChild(createElement('div', 'small muted', categoryLabel));
  card.appendChild(header);

  if (planet.category === 'habitable') {
    const grid = createKeyValueGrid([
      ['Уровень', Number.isFinite(planet.level) ? planet.level : EMPTY_VALUE],
      ['Раса', i18n.translate(i18n.races, planet.race) || EMPTY_VALUE],
      ['Экономика', i18n.translate(i18n.economics, planet.economics) || EMPTY_VALUE],
      ['Политика', i18n.translate(i18n.politics, planet.politics) || EMPTY_VALUE],
      ['Население', (planet.population != null ? fmtInt(planet.population) : EMPTY_VALUE)]
    ]);
    card.appendChild(grid);
  } else {
    const grid = createKeyValueGrid([
      ['Рельеф', i18n.translate(i18n.terrains, planet.terrain) || EMPTY_VALUE],
      ['Горы', planet.hills || EMPTY_VALUE],
      ['Океаны', planet.oceans || EMPTY_VALUE],
      ['Равнины', planet.plains || EMPTY_VALUE]
    ]);
    card.appendChild(grid);
  }

  const resourcesRow = createChipRow(planet.resources, translateResource);
  if (resourcesRow) card.appendChild(resourcesRow);

  const resourceBlock = buildResourceGenerationBlock(planet.resourceGeneration, highlightSet.has(planet.id));
  if (resourceBlock) card.appendChild(resourceBlock);

  return card;
};

const buildStationCard = station => {
  const card = createElement('div', 'stationCard');
  const header = createElement('div', 'hdr');
  header.appendChild(createElement('div', 'name', station.name || station.id || 'Станция'));
  header.appendChild(createElement('div', 'small muted', i18n.translate(i18n.stationTypes, station.type) || EMPTY_VALUE));
  card.appendChild(header);

  const grid = createKeyValueGrid([
    ['Уровень', Number.isFinite(station.level) ? station.level : EMPTY_VALUE],
    ['Раса', i18n.translate(i18n.races, station.race) || EMPTY_VALUE]
  ]);
  card.appendChild(grid);
  return card;
};

const buildAsteroidCard = belt => {
  const card = createElement('div', 'beltCard');
  const header = createElement('div', 'hdr');
  header.appendChild(createElement('div', 'name', 'Астероидный пояс'));
  card.appendChild(header);

  const resourcesRow = createChipRow(belt.resources, translateResource);
  if (resourcesRow) card.appendChild(resourcesRow);
  return card;
};

const createResourceRateSummary = meta => {
  if (!meta || !meta.matches || !meta.matches.length) return null;

  const wrap = createElement('div', 'resourceRateSummaryWrap');
  const selectedLabels = (meta.selected || []).map(r => r.label).join(', ');
  wrap.appendChild(createElement('span', 'resourceRateSummary__title muted', `Подходящие планеты (${selectedLabels})`));

  const table = createElement('table', 'resourceRateSummary');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(createElement('th', null, 'Планета'));
  (meta.selected || []).forEach(sel => {
    headRow.appendChild(createElement('th', null, sel.label));
  });
  headRow.appendChild(createElement('th', null, 'Всего'));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  meta.matches.forEach(match => {
    const row = document.createElement('tr');
    row.appendChild(createElement('td', null, match.planetName));
    (meta.selected || []).forEach(sel => {
      const value = match.values[sel.key];
      const valueCell = createElement('td', 'resourceRateSummary__value', (typeof value === 'number' && Number.isFinite(value)) ? value.toFixed(1) : '0.0');
      row.appendChild(valueCell);
    });
    row.appendChild(createElement('td', 'resourceRateSummary__value', match.sum.toFixed(1)));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
};

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

export function renderSystemDetails(s, highlightPlanetIds) {
  const wrap = d3.select('#details');
  const container = wrap.node();
  container.innerHTML = '';

  const highlightSet = new Set(highlightPlanetIds || []);
  const fragment = document.createDocumentFragment();

  const backBtn = createElement('button', 'ghost', '‹ Назад к результатам');
  backBtn.style.marginBottom = '12px';
  backBtn.onclick = () => document.getElementById('runSearch').click();
  fragment.appendChild(backBtn);

  const headerCard = createElement('div', 'card');
  headerCard.appendChild(createElement('div', 'sysTitle', s.name || s.id));
  fragment.appendChild(headerCard);

  const systemBlock = createSectionBlock('Система');
  systemBlock.appendChild(createKeyValueGrid([
    ['Координаты X', s.x ?? EMPTY_VALUE],
    ['Координаты Y', s.y ?? EMPTY_VALUE],
    ['Координаты Z', s.z ?? EMPTY_VALUE],
    ['Размер', s.size ?? EMPTY_VALUE],
    ['Планеты', (s.planets || []).length],
    ['Станции', (s.stations || []).length],
    ['Пояса', (s.asteroidBelts || []).length]
  ]));
  fragment.appendChild(systemBlock);

  if (Array.isArray(s.planets) && s.planets.length) {
    const planetsBlock = createSectionBlock('Планеты');
    const grid = createElement('div', 'grid');
    grid.style.gap = '8px';
    s.planets.forEach(planet => {
      grid.appendChild(buildPlanetCard(planet, highlightSet));
    });
    planetsBlock.appendChild(grid);
    fragment.appendChild(planetsBlock);
  }

  if (Array.isArray(s.stations) && s.stations.length) {
    const stationsBlock = createSectionBlock('Станции');
    const grid = createElement('div', 'grid');
    grid.style.gap = '8px';
    s.stations.forEach(station => {
      grid.appendChild(buildStationCard(station));
    });
    stationsBlock.appendChild(grid);
    fragment.appendChild(stationsBlock);
  }

  if (Array.isArray(s.asteroidBelts) && s.asteroidBelts.length) {
    const beltsBlock = createSectionBlock('Астероидные пояса');
    const grid = createElement('div', 'grid');
    grid.style.gap = '8px';
    s.asteroidBelts.forEach(belt => {
      grid.appendChild(buildAsteroidCard(belt));
    });
    beltsBlock.appendChild(grid);
    fragment.appendChild(beltsBlock);
  }

  container.appendChild(fragment);

  if (highlightSet.size) {
    const first = container.querySelector('.planetCard.match');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

export function renderSummaryList(entries) {
  const wrap = d3.select('#details');
  const container = wrap.node();
  container.innerHTML = '';

  if (!entries.length) {
    renderDetailsEmpty(true);
    return;
  }

  const fragment = document.createDocumentFragment();
  fragment.appendChild(createElement('div', 'small muted', `Найдено систем: ${entries.length}`));

  let lastGalaxyId = null;

  entries.forEach((entry, index) => {
    const { galaxyId, system: systemRef, reasons, highlightPlanetIds, meta } = entry;
    if (galaxyId !== lastGalaxyId) {
      const galaxy = STATE.galaxyIndex.get(galaxyId);
      const galaxyHeader = createElement('h2', 'galaxy-result-header result-card-enter', galaxy ? (galaxy.name || galaxy.id) : 'Неизвестная галактика');
      galaxyHeader.style.animationDelay = `${index * 50}ms`;
      fragment.appendChild(galaxyHeader);
      lastGalaxyId = galaxyId;
    }

    const card = createElement('div', 'card result result-card-enter');
    card.style.animationDelay = `${index * 50}ms`;
    card.onclick = () => selectSystem(systemRef.id, highlightPlanetIds || []);

    card.appendChild(createElement('div', 'sysTitle', systemRef.name || systemRef.id));
    card.appendChild(createElement('div', 'sysSub', `Планет: ${(systemRef.planets || []).length} • Станций: ${(systemRef.stations || []).length} • Поясов: ${(systemRef.asteroidBelts || []).length}`));

    if (reasons && reasons.length) {
      card.appendChild(createElement('div', 'small muted', reasons.join(' • ')));
    }

    const resourceSummary = createResourceRateSummary(meta && meta.resourceRates);
    if (resourceSummary) {
      card.appendChild(resourceSummary);
    }

    if (highlightPlanetIds && highlightPlanetIds.length) {
      const chips = createElement('div', 'chipsRow');
      highlightPlanetIds.map(pid => getPlanetName(systemRef, pid)).forEach(name => {
        chips.appendChild(createElement('span', 'chip', name));
      });
      card.appendChild(chips);
    }

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
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

  const resourceRateBox = d3.select('#resourceRateBox');
  if (!resourceRateBox.empty()) {
    const rateOptions = (STATE.dict.resourceRates || []).slice().sort((a, b) => {
      const labelA = i18n.translate(i18n.resources, a) || a;
      const labelB = i18n.translate(i18n.resources, b) || b;
      return labelA.localeCompare(labelB, 'ru');
    });
    resourceRateBox.selectAll('label.resource-rate').data(rateOptions).join('label')
      .attr('class', 'resource-rate chip')
      .html(d => `<input type="checkbox" value="${d}"> ${i18n.translate(i18n.resources, d) || d}`);
  }

  const raceBox = d3.select('#raceBox');
  raceBox.selectAll('label.race').data(STATE.dict.races).join('label')
    .attr('class', 'race chip')
    .html(d => `<input type="checkbox" value="${d}"> ${i18n.translate(i18n.races, d)}`);

  buildSystemDatalist();
}

export function renderRouteDetails(route) {
  const wrap = d3.select('#details');
  const container = wrap.node();
  container.innerHTML = '';

  if (!route || !Array.isArray(route.path1) || !route.path1.length) {
    renderDetailsEmpty();
    return;
  }

  const fragment = document.createDocumentFragment();

  const title = createElement('h3', null, 'Проложенный маршрут');
  title.style.margin = '0 0 12px 0';
  fragment.appendChild(title);

  const jumpCount = (() => {
    const path1Jumps = Math.max(0, (route.path1 ? route.path1.length : 1) - 1);
    const path2Jumps = Math.max(0, (route.path2 ? route.path2.length : 1) - 1);
    return path1Jumps + path2Jumps + (route.isCrossGalaxy ? 1 : 0);
  })();

  if (route.distance != null || jumpCount > 0) {
    const meta = createElement('div', 'small muted', `Всего прыжков: ${jumpCount} • Дистанция: ${route.distance ?? 0} пк`);
    meta.style.marginBottom = '12px';
    fragment.appendChild(meta);
  }

  let stepIndex = 1;
  let previousSystem = null;

  const appendPath = path => {
    if (!Array.isArray(path) || !path.length) return;
    path.forEach(system => {
      const card = createElement('div', 'card result');
      card.onclick = () => selectSystem(system.id, []);

      const content = createElement('div');
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.gap = '6px';

      const header = createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.gap = '12px';

      const stepLabel = createElement('div', null, `${stepIndex}.`);
      stepLabel.style.fontWeight = 'bold';
      stepLabel.style.color = 'var(--accent)';
      header.appendChild(stepLabel);

      const nameEl = createElement('div', null, system.name || system.id);
      nameEl.style.flex = '1';
      header.appendChild(nameEl);

      content.appendChild(header);

      if (previousSystem && previousSystem !== system) {
        const distance = calculateDistance(previousSystem, system);
        const distanceEl = createElement('div', 'small muted', `Переход: ${distance} пк`);
        content.appendChild(distanceEl);
      }

      card.appendChild(content);
      fragment.appendChild(card);

      previousSystem = system;
      stepIndex += 1;
    });
  };

  appendPath(route.path1);

  if (route.isCrossGalaxy) {
    const separator = createElement('div', null, '--- Межгалактический прыжок ---');
    separator.style.textAlign = 'center';
    separator.style.margin = '10px 0';
    separator.style.color = 'var(--accent-2)';
    fragment.appendChild(separator);
    previousSystem = null;
    appendPath(route.path2);
  } else if (Array.isArray(route.path2) && route.path2.length) {
    appendPath(route.path2);
  }

  container.appendChild(fragment);
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
  const resourceBlk = document.getElementById('filter-block-resource-rates');
  const parentBlk = clickedHeader.parentElement;
  const isRouteHeader = parentBlk === routeBlk;
  const isResourceHeader = parentBlk === resourceBlk;

  if (isRouteHeader || isResourceHeader) {
    const activeBlk = isRouteHeader ? routeBlk : resourceBlk;
    // If a special block is opened, close all others
    if (activeBlk.classList.contains('active')) {
      allBlk.forEach(blk => {
        if (blk !== activeBlk) {
          blk.classList.remove('active');
        }
      });
    }
  } else {
    // If any other filter is opened, close special blocks
    if (parentBlk.classList.contains('active')) {
      routeBlk.classList.remove('active');
      resourceBlk.classList.remove('active');
    }
  }
}
