import { STATE } from './state.js';
import { unique } from './utils.js';
import { initMap, showGalaxy, initStars } from './map.js';
import { buildFiltersUI, renderDetailsEmpty, selectSystem } from './ui.js';
import { initFilters, resortAndRenderResults } from './filters.js';

async function loadComponents() {
  const [filtersHTML, mapHTML] = await Promise.all([
    fetch('components/filters.html').then(res => res.text()),
    fetch('components/map.html').then(res => res.text())
  ]);
  document.getElementById('filters').innerHTML = filtersHTML;
  document.getElementById('mapWrap').innerHTML = mapHTML;
}

function normalizeName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function buildResourceRateIndex(entries) {
  const index = new Map();
  if (!Array.isArray(entries)) return index;

  entries.forEach(item => {
    const planetKey = normalizeName(item && item.planet);
    if (!planetKey || !Array.isArray(item.resources)) return;

    const rates = {};
    item.resources.forEach(resource => {
      if (!resource || typeof resource.name !== 'string') return;
      const value = Number(resource.avg_per_hour);
      if (!Number.isFinite(value)) return;
      rates[resource.name] = Math.round(value * 10) / 10;
    });

    if (Object.keys(rates).length > 0) {
      index.set(planetKey, rates);
    }
  });

  return index;
}

function attachResourceRates(data, rateIndex) {
  if (!data || !Array.isArray(data.galaxies)) return;

  data.galaxies.forEach(g => (g.systems || []).forEach(s => {
    (s.planets || []).forEach(p => {
      const key = normalizeName(p.name || p.id);
      if (!key) return;
      const rates = rateIndex.get(key);
      if (rates) {
        p.resourceGeneration = rates;
      }
    });
  }));
}

function onDataLoaded(data) {
  STATE.data = data;
  STATE.galaxyIndex.clear();
  STATE.systemIndex.clear();
  let sysCount = 0, plCount = 0, stCount = 0, abCount = 0;
  const galaxyOptions = [];

  data.galaxies.forEach(g => {
    STATE.galaxyIndex.set(g.id, g);
    galaxyOptions.push({ id: g.id, name: g.name || g.id });
    (g.systems || []).forEach(s => {
      sysCount++;
      plCount += (s.planets || []).length;
      stCount += (s.stations || []).length;
      abCount += (s.asteroidBelts || []).length;
      STATE.systemIndex.set(s.id, { galaxyId: g.id, system: s });
    });
  });

  STATE.dict.galaxies = galaxyOptions;
  d3.select('#galCount').text(data.galaxies.length);
  d3.select('#sysCount').text(sysCount);
  d3.select('#plCount').text(plCount);
  d3.select('#stCount').text(stCount);
  d3.select('#abCount').text(abCount);

  const terrains = [], res = [], stTypes = [], races = [];
  data.galaxies.forEach(g => (g.systems || []).forEach(s => {
    (s.planets || []).forEach(p => {
      if (p.category === 'inhabitable') {
        if (p.terrain) terrains.push(String(p.terrain));
        (p.resources || []).forEach(r => res.push(String(r)));
      }
      if (p.race) races.push(String(p.race));
    });
    (s.stations || []).forEach(t => {
      if (t.type) stTypes.push(String(t.type));
    });
  }));
  STATE.dict.terrains = unique(terrains).sort((a, b) => a.localeCompare(b));
  STATE.dict.res = unique(res).sort((a, b) => a.localeCompare(b));
  STATE.dict.stTypes = unique(stTypes).sort((a, b) => a.localeCompare(b));
  STATE.dict.races = unique(races).sort((a, b) => a.localeCompare(b));

  buildFiltersUI();

  const sel = d3.select('#galaxySelect');
  sel.selectAll('option').data(data.galaxies).join('option')
    .attr('value', d => d.id).text(d => d.name || d.id);
  sel.on('change', () => {
    const newGalaxyId = sel.property('value');
    // The showGalaxy function is now smart enough to redraw the correct state.
    // No complex logic is needed here anymore. Just call it.
    showGalaxy(newGalaxyId);
    updateHash({ galaxy: newGalaxyId, system: '' });
    // Re-sort and re-render search results if they exist
    if (STATE.lastSearchResults) {
      resortAndRenderResults();
    }
  });

  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const gFromHash = params.get('galaxy');
  const sFromHash = params.get('system');
  const defaultGalaxy = gFromHash && STATE.galaxyIndex.has(gFromHash) ? gFromHash : data.galaxies[0].id;
  sel.property('value', defaultGalaxy);

  showGalaxy(defaultGalaxy, () => {
    if (sFromHash && STATE.systemIndex.has(sFromHash)) {
      selectSystem(sFromHash, []);
    } else {
      renderDetailsEmpty();
    }
  });
}

async function loadData() {
  try {
    const [dataResponse, ratesResponse] = await Promise.all([
      fetch('data.json', { cache: 'no-store' }),
      fetch('planet_resource_generation_rates.json', { cache: 'no-store' })
    ]);

    if (!dataResponse.ok) throw new Error(`HTTP ${dataResponse.status}: ${dataResponse.statusText}`);
    if (!ratesResponse.ok) throw new Error(`HTTP ${ratesResponse.status}: ${ratesResponse.statusText}`);

    const [data, rateEntries] = await Promise.all([
      dataResponse.json(),
      ratesResponse.json()
    ]);

    if (!data || !Array.isArray(data.galaxies)) throw new Error('Неверный формат данных: отсутствует массив galaxies');
    const rateIndex = buildResourceRateIndex(rateEntries);
    attachResourceRates(data, rateIndex);
    onDataLoaded(data);
  } catch (err) {
    console.error('Ошибка загрузки данных карты:', err);
    document.getElementById('content').innerHTML = `<div class="card" style="margin:20px; padding:20px; color:var(--err);">Не удалось загрузить данные карты. Пожалуйста, обновите страницу. <br><br><span class="muted small">${err.message}</span></div>`;
  }
}

export function updateHash({ galaxy, system }) {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (galaxy !== undefined) params.set('galaxy', galaxy);
  if (system !== undefined) {
    if (system) params.set('system', system);
    else params.delete('system');
  }
  location.hash = params.toString();
}

async function main() {
  await loadComponents();
  initMap();
  initStars();
  initFilters();
  try {
    await loadData();
  } catch(err) {
    document.body.innerHTML = '<pre style="color:#fff; padding:20px;">Ошибка инициализации: ' + err.message + '</pre>';
  }
}

main();
