import { STATE } from './state.js';
import { unique } from './utils.js';
import { initMap, showGalaxy, initStars } from './map.js';
import { buildFiltersUI, renderDetailsEmpty, selectSystem } from './ui.js';
import { initFilters, runSearch, clearRouting } from './filters.js';

async function loadComponents() {
  const [filtersHTML, mapHTML] = await Promise.all([
    fetch('components/filters.html').then(res => res.text()),
    fetch('components/map.html').then(res => res.text())
  ]);
  document.getElementById('filters').innerHTML = filtersHTML;
  document.getElementById('mapWrap').innerHTML = mapHTML;
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

function parseLoadedJson(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.galaxies)) throw new Error('Неверный формат: нет массива galaxies');
  return data;
}

function bindFileInputs() {
  const fileInput = document.getElementById('fileInput');
  const overlayInput = document.getElementById('overlayFileInput');
  const overlay = document.getElementById('loaderOverlay');
  const overlayErr = document.getElementById('overlayErr');

  document.getElementById('loadLocal').addEventListener('click', () => fileInput.click());

  function handleFile(el, fromOverlay = false) {
    const f = el.files && el.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = parseLoadedJson(reader.result);
        onDataLoaded(data);
        if (fromOverlay) {
          overlay.style.display = 'none';
          overlayErr.textContent = '';
        }
      } catch (err) {
        if (fromOverlay) overlayErr.textContent = String(err.message || err);
        else alert(err.message || err);
      }
    };
    reader.readAsText(f, 'utf-8');
  }
  fileInput.addEventListener('change', () => handleFile(fileInput, false));
  overlayInput.addEventListener('change', () => handleFile(overlayInput, true));
}

function showOverlay() {
  document.getElementById('loaderOverlay').style.display = 'flex';
}

async function loadData() {
  bindFileInputs();
  try {
    const isFile = location.protocol === 'file:';
    if (isFile) throw new Error('Local file mode');
    const res = await fetch('data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    onDataLoaded(data);
  } catch (err) {
    showOverlay();
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
