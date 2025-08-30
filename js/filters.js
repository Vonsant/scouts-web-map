import { STATE } from './state.js';
import { textIncludes, normVector, cosineSim } from './utils.js';
import { renderDetailsEmpty, renderSummaryList, handleAccordion, renderRouteDetails } from './ui.js';
import { clearHighlight, highlightMultipleSystems, drawRoute, clearRoute } from './map.js';
import { updateHash } from './app.js';
import * as i18n from './localization.js';
import { findPath } from './pathfinder.js';

const GATE_ANDROMEDA_ID = '67e599a6-b223-4590-8253-96e3ba84c67b';
const GATE_MILKYWAY_ID = '08556753-48e0-4cf5-a13d-d6f77f7347d7';

function getFilters() {
  const useGalaxy = document.getElementById('filter-block-galaxy').classList.contains('active');
  const useRaces = document.getElementById('filter-block-races').classList.contains('active');
  const useSystem = document.getElementById('filter-block-system').classList.contains('active');
  const usePlanets = document.getElementById('filter-block-planets').classList.contains('active');
  const useStations = document.getElementById('filter-block-stations').classList.contains('active');
  const useInhabitable = document.getElementById('filter-block-inhabitable').classList.contains('active');

  const raceChecked = Array.from(document.querySelectorAll('#raceBox input[type="checkbox"]:checked')).map(el => el.value);

  return {
    useGalaxy, useRaces, useSystem, usePlanets, useStations, useInhabitable,
    galaxyId: document.getElementById('galaxyFilter').value,
    sysName: document.getElementById('sysName').value.trim(),
    hasBelt: document.getElementById('hasBelt').checked,
    plName: document.getElementById('plName').value.trim(),
    plLvlMin: parseInt(document.getElementById('plLvlMin').value || ''),
    plLvlMax: parseInt(document.getElementById('plLvlMax').value || ''),
    raceChecked,
    stType: document.getElementById('stType').value,
    stName: document.getElementById('stName').value.trim(),
    stLvlMin: parseInt(document.getElementById('stLvlMin').value || ''),
    stLvlMax: parseInt(document.getElementById('stLvlMax').value || ''),
    terrainChecked: Array.from(document.querySelectorAll('#terrainBox input[type="checkbox"]:checked')).map(el => el.value),
    resChecked: Array.from(document.querySelectorAll('#resBox input[type="checkbox"]:checked')).map(el => el.value.toLowerCase()),
    ratioSim: parseInt(document.getElementById('ratioSim').value, 10),
    ratio: STATE.ratio,
  };
}

// ===== PREDICATE HELPERS =====
const planetHasAllResources = (p, res) => res.every(w => (p.resources || []).map(r => String(r).toLowerCase()).includes(w));
const planetHasAnyTerrain = (p, ter) => ter.includes(String(p.terrain || ''));
const planetHasAnyRace = (p, races) => races.includes(String(p.race || ''));

function isRacePredominant(system, selectedRaces) {
    if (!selectedRaces.length) return true;

    const raceCounts = new Map();
    (system.planets || []).forEach(p => {
        if (p.category === 'habitable' && p.race) {
            raceCounts.set(p.race, (raceCounts.get(p.race) || 0) + 1);
        }
    });

    if (raceCounts.size === 0) return false;

    let maxCount = 0;
    for (const count of raceCounts.values()) {
        if (count > maxCount) {
            maxCount = count;
        }
    }

    for (const race of selectedRaces) {
        if ((raceCounts.get(race) || 0) === maxCount) {
            return true; // At least one of the selected races is predominant or equal
        }
    }

    return false;
}

function approxMatchHOP_byRatio(p, ratioPct, thresholdPct) {
  if (thresholdPct <= 0) return true;
  if (p.category !== 'inhabitable') return false;
  const ph = parseFloat(p.hills || 0), po = parseFloat(p.oceans || 0), pp = parseFloat(p.plains || 0);
  const v = normVector(ph, po, pp), t = normVector(ratioPct.h, ratioPct.o, ratioPct.p);
  const sim = cosineSim(v, t);
  return Math.round(sim * 100) >= thresholdPct;
}

export function runSearch() {
  // A new search clears any previous route state.
  // A new search clears any previous route state.
  STATE.currentRoute = null;
  clearRoute();

  const f = getFilters();
  const anyUse = f.useGalaxy || f.useSystem || f.usePlanets || f.useStations || f.useInhabitable || f.useRaces;
  if (!anyUse) {
    STATE.lastSearchResults = null;
    renderDetailsEmpty();
    return;
  }

  const entries = [];
  STATE.data.galaxies.forEach(g => {
    systems: for (const s of (g.systems || [])) {
      const reasons = [];
      const matchedPlanetIds = new Set();

      // --- Basic Filters (always AND) ---
      if (f.useGalaxy && f.galaxyId && g.id !== f.galaxyId) continue systems;
      if (f.useSystem) {
        if (f.sysName && !textIncludes(s.name, f.sysName)) continue systems;
        if (f.hasBelt && !(s.asteroidBelts || []).length) continue systems;
      }

      // --- Contextual Filters ---
      let passedContextual = false;
      let nonRaceFiltersActive = false;

      if (f.useStations) {
        nonRaceFiltersActive = true;
        let stationPool = s.stations || [];
        if (f.stType) stationPool = stationPool.filter(t => t.type === f.stType);
        if (f.stName) stationPool = stationPool.filter(t => textIncludes(t.name, f.stName));
        if (!isNaN(f.stLvlMin)) stationPool = stationPool.filter(t => Number.isFinite(t.level) && t.level >= f.stLvlMin);
        if (!isNaN(f.stLvlMax)) stationPool = stationPool.filter(t => Number.isFinite(t.level) && t.level <= f.stLvlMax);

        if (f.useRaces && f.raceChecked.length) {
            stationPool = stationPool.filter(t => f.raceChecked.includes(t.race));
        }

        if (stationPool.length > 0) {
            passedContextual = true;
            reasons.push(`Станция (${f.useRaces && f.raceChecked.length ? 'Раса: ' + f.raceChecked.map(r => i18n.translate(i18n.races, r)).join(', ') : 'любая'})`);
        } else {
            continue systems;
        }
      }

      if (f.usePlanets) {
        nonRaceFiltersActive = true;
        let planetPool = (s.planets || []).filter(p => p.category === 'habitable');
        if (f.plName) planetPool = planetPool.filter(p => textIncludes(p.name, f.plName));
        if (!isNaN(f.plLvlMin)) planetPool = planetPool.filter(p => Number.isFinite(p.level) && p.level >= f.plLvlMin);
        if (!isNaN(f.plLvlMax)) planetPool = planetPool.filter(p => Number.isFinite(p.level) && p.level <= f.plLvlMax);

        if (f.useRaces && f.raceChecked.length) {
            planetPool = planetPool.filter(p => f.raceChecked.includes(p.race));
        }

        if (planetPool.length > 0) {
            passedContextual = true;
            planetPool.forEach(p => matchedPlanetIds.add(p.id));
            reasons.push(`Планета (${f.useRaces && f.raceChecked.length ? 'Раса: ' + f.raceChecked.map(r => i18n.translate(i18n.races, r)).join(', ') : 'любая'})`);
        } else {
            continue systems;
        }
      }

      if (f.useInhabitable) {
        nonRaceFiltersActive = true;
        let inhabitablePool = (s.planets || []).filter(p => p.category === 'inhabitable');
        if (f.terrainChecked.length) inhabitablePool = inhabitablePool.filter(p => planetHasAnyTerrain(p, f.terrainChecked));
        if (f.resChecked.length) inhabitablePool = inhabitablePool.filter(p => planetHasAllResources(p, f.resChecked));
        if (f.ratioSim > 0) inhabitablePool = inhabitablePool.filter(p => approxMatchHOP_byRatio(p, f.ratio, f.ratioSim));

        if (inhabitablePool.length > 0) {
            if (f.useRaces && f.raceChecked.length) {
                if (isRacePredominant(s, f.raceChecked)) {
                    passedContextual = true;
                    inhabitablePool.forEach(p => matchedPlanetIds.add(p.id));
                    reasons.push(`Необитаемая планета (доминирующая раса: ${f.raceChecked.map(r => i18n.translate(i18n.races, r)).join(', ')})`);
                } else {
                    continue systems;
                }
            } else {
                passedContextual = true;
                inhabitablePool.forEach(p => matchedPlanetIds.add(p.id));
                reasons.push('Необитаемая планета');
            }
        } else {
            continue systems;
        }
      }

      if (f.useRaces && !nonRaceFiltersActive) {
          if (isRacePredominant(s, f.raceChecked)) {
              passedContextual = true;
              reasons.push(`Доминирующая раса: ${f.raceChecked.map(r => i18n.translate(i18n.races, r)).join(', ')}`);
          } else {
              continue systems;
          }
      }

      if (!nonRaceFiltersActive && !f.useRaces) {
          passedContextual = true;
      }

      if (passedContextual) {
        entries.push({ galaxyId: g.id, system: s, reasons, highlightPlanetIds: Array.from(matchedPlanetIds) });
      }
    }
  });

  // Advanced multi-level sort
  entries.sort((a, b) => {
    const currentGalaxyId = STATE.currentGalaxyId;
    const isAGalaxyCurrent = a.galaxyId === currentGalaxyId;
    const isBGalaxyCurrent = b.galaxyId === currentGalaxyId;

    // 1. Prioritize the current galaxy
    if (isAGalaxyCurrent && !isBGalaxyCurrent) return -1;
    if (!isAGalaxyCurrent && isBGalaxyCurrent) return 1;

    // 2. If priority is same, sort by galaxy name
    const galA = STATE.galaxyIndex.get(a.galaxyId)?.name || a.galaxyId;
    const galB = STATE.galaxyIndex.get(b.galaxyId)?.name || b.galaxyId;
    const galCompare = galA.localeCompare(galB);
    if (galCompare !== 0) return galCompare;

    // 3. If galaxies are the same, sort by system name
    return (a.system.name || a.system.id).localeCompare(b.system.name || b.system.id);
  });

  renderSummaryList(entries);
  STATE.lastSearchResults = entries;

  const systemIds = entries.map(e => e.system.id);
  highlightMultipleSystems(systemIds);
}

function updateFilterActiveStates() {
  const groups = {
    galaxy: [
      { id: 'galaxyFilter', type: 'select' },
    ],
    system: [
      { id: 'sysName', type: 'text' },
      { id: 'hasBelt', type: 'check' },
    ],
    planets: [
      { id: 'plName', type: 'text' },
      { id: 'plLvlMin', type: 'text' },
      { id: 'plLvlMax', type: 'text' },
    ],
    races: [
      { id: 'raceBox', type: 'any_check' },
    ],
    stations: [
      { id: 'stType', type: 'select' },
      { id: 'stName', type: 'text' },
      { id: 'stLvlMin', type: 'text' },
      { id: 'stLvlMax', type: 'text' },
    ],
    inhabitable: [
      { id: 'terrainBox', type: 'any_check' },
      { id: 'resBox', type: 'any_check' },
      { id: 'ratioSim', type: 'range', defaultValue: 0 },
    ],
    route: [
      { id: 'routeStart', type: 'text' },
      { id: 'routeEnd', type: 'text' },
    ]
  };

  for (const [groupName, inputs] of Object.entries(groups)) {
    const block = document.getElementById(`filter-block-${groupName}`);
    if (!block) continue;

    let isActive = false;
    for (const input of inputs) {
      const el = document.getElementById(input.id);
      if (!el) continue;

      switch (input.type) {
        case 'text':
        case 'select':
          if (el.value.trim()) isActive = true;
          break;
        case 'check':
          if (el.checked) isActive = true;
          break;
        case 'any_check':
          if (el.querySelector('input:checked')) isActive = true;
          break;
        case 'range':
          if (Number(el.value) !== (input.defaultValue || 0)) isActive = true;
          break;
      }
      if (isActive) break;
    }
    block.classList.toggle('filter-active', isActive);
  }
}

export function clearSearch() {
  document.querySelectorAll('#filters .blk.active').forEach(el => el.classList.remove('active'));

  document.getElementById('galaxyFilter').value = '';
  ['sysName', 'plName', 'plLvlMin', 'plLvlMax', 'stName', 'stLvlMin', 'stLvlMax'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('hasBelt').checked = false;
  document.getElementById('stType').value = '';
  document.querySelectorAll('#raceBox input[type="checkbox"]').forEach(el => el.checked = false);
  document.querySelectorAll('#terrainBox input[type="checkbox"]').forEach(el => el.checked = false);
  document.querySelectorAll('#resBox input[type="checkbox"]').forEach(el => el.checked = false);
  document.getElementById('splitA').value = 33;
  document.getElementById('splitB').value = 66;
  document.getElementById('ratioSim').value = 0;
  document.getElementById('ratioSimVal').textContent = '0';
  document.getElementById('splitA').dispatchEvent(new Event('input'));
  renderDetailsEmpty();
  clearHighlight();
  updateHash({ system: '' });
  STATE.lastSearchResults = null;
  updateFilterActiveStates(); // Reset dots
}

function runRouting() {
  const startName = document.getElementById('routeStart').value.trim();
  const endName = document.getElementById('routeEnd').value.trim();
  const maxJump = parseFloat(document.getElementById('routeMaxJump').value);
  const resultEl = document.getElementById('routeResult');

  // Clear previous state
  resultEl.textContent = '';
  STATE.currentRoute = null;
  STATE.lastSearchResults = null;
  clearHighlight();

  if (!startName || !endName) {
    resultEl.textContent = 'Выберите стартовую и конечную системы.';
    return;
  }

  const startRef = Array.from(STATE.systemIndex.values()).find(ref => (ref.system.name || ref.system.id) === startName);
  const endRef = Array.from(STATE.systemIndex.values()).find(ref => (ref.system.name || ref.system.id) === endName);

  if (!startRef || !endRef) {
    resultEl.textContent = 'Одна из систем не найдена.';
    return;
  }

  const startSystem = startRef.system;
  const endSystem = endRef.system;
  const startGalaxyId = startRef.galaxyId;
  const endGalaxyId = endRef.galaxyId;

  if (startGalaxyId === endGalaxyId) {
    const galaxy = STATE.galaxyIndex.get(startGalaxyId);
    const { path, distance } = findPath(startSystem, endSystem, galaxy.systems, maxJump);

    if (path.length > 0) {
      STATE.currentRoute = { isCrossGalaxy: false, path1: path, path2: null, distance };
      resultEl.innerHTML = `Маршрут найден! Прыжков: ${path.length - 1}, <br>Дистанция: ${distance} пк.`;
      drawRoute();
      renderRouteDetails(STATE.currentRoute);
    } else {
      resultEl.textContent = 'Маршрут не найден. Попробуйте увеличить дальность прыжка.';
      clearRoute();
      renderDetailsEmpty();
    }
  } else {
    const startGalaxy = STATE.galaxyIndex.get(startGalaxyId);
    const endGalaxy = STATE.galaxyIndex.get(endGalaxyId);

    const gate1Id = startGalaxy.name === 'Андромеда' ? GATE_ANDROMEDA_ID : GATE_MILKYWAY_ID;
    const gate2Id = endGalaxy.name === 'Андромеда' ? GATE_ANDROMEDA_ID : GATE_MILKYWAY_ID;

    const gate1 = startGalaxy.systems.find(s => s.id === gate1Id);
    const gate2 = endGalaxy.systems.find(s => s.id === gate2Id);

    if (!gate1 || !gate2) {
        resultEl.textContent = 'Ошибка: не найдены врата для межгалактического прыжка.';
        return;
    }

    const res1 = findPath(startSystem, gate1, startGalaxy.systems, maxJump);
    const res2 = findPath(gate2, endSystem, endGalaxy.systems, maxJump);

    if (res1.path.length > 0 && res2.path.length > 0) {
      const totalDist = res1.distance + res2.distance;
      const totalJumps = (res1.path.length - 1) + (res2.path.length - 1) + 1;
      STATE.currentRoute = { isCrossGalaxy: true, path1: res1.path, path2: res2.path, distance: totalDist };
      resultEl.innerHTML = `Маршрут найден! Прыжков: ${totalJumps}, <br>Дистанция: ${totalDist} пк.`;
      drawRoute();
      renderRouteDetails(STATE.currentRoute);
    } else {
      resultEl.textContent = 'Не удалось построить полный межгалактический маршрут.';
      clearRoute();
      renderDetailsEmpty();
    }
  }
}

function toggleRoutePickingMode(target = null) {
  const statusEl = document.getElementById('route-picker-status');
  const mapEl = document.getElementById('map');

  // If a target is provided, enter picking mode
  if (target) {
    STATE.isPickingForRoute = target;
    const targetName = target === 'start' ? 'стартовую' : 'конечную';
    statusEl.textContent = `Выберите ${targetName} систему на карте...`;
    mapEl.classList.add('picking-mode');
  } else {
    // If no target, exit picking mode
    STATE.isPickingForRoute = null;
    statusEl.textContent = '';
    mapEl.classList.remove('picking-mode');
  }
}

export function setSystemForRoutePicker(systemName) {
  if (!STATE.isPickingForRoute) return;

  const inputId = STATE.isPickingForRoute === 'start' ? 'routeStart' : 'routeEnd';
  document.getElementById(inputId).value = systemName;

  // Manually trigger input event for reactivity
  document.getElementById(inputId).dispatchEvent(new Event('input'));

  toggleRoutePickingMode(null); // Exit picking mode
}

export function clearRouting() {
    document.getElementById('routeStart').value = '';
    document.getElementById('routeEnd').value = '';
    document.getElementById('routeResult').textContent = '';
    STATE.currentRoute = null;
    clearRoute();
    clearHighlight();
    if (STATE.isPickingForRoute) {
      toggleRoutePickingMode(null);
    }
}

export function initFilters() {
    document.getElementById('pickRouteStart').addEventListener('click', () => toggleRoutePickingMode('start'));
    document.getElementById('pickRouteEnd').addEventListener('click', () => toggleRoutePickingMode('end'));

    document.getElementById('runSearch').addEventListener('click', () => {
      const isRouting = document.getElementById('filter-block-route').classList.contains('active');
      if (isRouting) {
        runRouting();
      } else {
        runSearch();
      }
    });

    document.getElementById('clearSearch').addEventListener('click', () => {
      clearSearch();
      clearRouting();
    });

    document.querySelectorAll('#filters .blk .hdrline').forEach(header => {
      header.addEventListener('click', (e) => {
        header.parentElement.classList.toggle('active');
        handleAccordion(e.currentTarget);
      });
    });

    // Add event listeners to all filter inputs to update status dots
    const filterContainer = document.getElementById('filters-inner');
    filterContainer.addEventListener('input', (e) => {
      // Use event delegation for performance
      if (e.target.matches('input, select')) {
        updateFilterActiveStates();
      }
    });
    filterContainer.addEventListener('change', (e) => {
      // `change` is needed for checkboxes and selects
      if (e.target.matches('input[type="checkbox"], select')) {
        updateFilterActiveStates();
      }
    });


    const maxJumpSlider = document.getElementById('routeMaxJump');
    const maxJumpVal = document.getElementById('routeMaxJumpVal');
    maxJumpSlider.addEventListener('input', () => maxJumpVal.textContent = maxJumpSlider.value);

    const a = document.getElementById('splitA'),
          b = document.getElementById('splitB');
    const fill = document.getElementById('rangeFill');
    const outH = document.getElementById('ratioH'),
          outO = document.getElementById('ratioO'),
          outP = document.getElementById('ratioP');
    const sim = document.getElementById('ratioSim'),
          simVal = document.getElementById('ratioSimVal');

    function updateDouble() {
        if (+a.value > +b.value) {
            const t = a.value;
            a.value = b.value;
            b.value = t;
        }
        const A = +a.value,
              B = +b.value;
        const H = Math.round(A),
              O = Math.round(B - A),
              P = Math.round(100 - B);
        fill.style.left = A + '%';
        fill.style.right = (100 - B) + '%';
        outH.textContent = H + '%';
        outO.textContent = O + '%';
        outP.textContent = P + '%';
        STATE.ratio = { h: H, o: O, p: P };
    }
    a.addEventListener('input', updateDouble);
    b.addEventListener('input', updateDouble);
    sim.addEventListener('input', () => simVal.textContent = sim.value);
    updateDouble();

    // Set initial active states for filters
    updateFilterActiveStates();
}
