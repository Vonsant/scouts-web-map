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
  clearRouting();
  const f = getFilters();
  const anyUse = f.useGalaxy || f.useSystem || f.usePlanets || f.useStations || f.useInhabitable || f.useRaces;
  if (!anyUse) {
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

      // Case 1: Races + Stations
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

      // Case 2: Races + Planets (Generic)
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

      // Case 3: Races + Inhabitable
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

      // Case 4: Only Races is selected
      if (f.useRaces && !nonRaceFiltersActive) {
          if (isRacePredominant(s, f.raceChecked)) {
              passedContextual = true;
              reasons.push(`Доминирующая раса: ${f.raceChecked.map(r => i18n.translate(i18n.races, r)).join(', ')}`);
          } else {
              continue systems;
          }
      }

      if (!nonRaceFiltersActive && !f.useRaces) {
          // Only basic filters were used (galaxy/system)
          passedContextual = true;
      }

      if (passedContextual) {
        entries.push({ galaxyId: g.id, system: s, reasons, highlightPlanetIds: Array.from(matchedPlanetIds) });
      }
    }
  });

  entries.sort((a, b) => (a.system.name || '').localeCompare(b.system.name || ''));
  renderSummaryList(entries);

  const systemIds = entries.map(e => e.system.id);
  highlightMultipleSystems(systemIds);
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
}

function runRouting() {
  const startName = document.getElementById('routeStart').value.trim();
  const endName = document.getElementById('routeEnd').value.trim();
  const maxJump = parseFloat(document.getElementById('routeMaxJump').value);
  const resultEl = document.getElementById('routeResult');
  resultEl.textContent = '';
  STATE.currentRoute = null;

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
    // --- SAME GALAXY ROUTING ---
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
    // --- CROSS GALAXY ROUTING ---
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
      const totalJumps = (res1.path.length - 1) + (res2.path.length - 1) + 1; // +1 for the galaxy jump
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

export function clearRouting() {
    document.getElementById('routeStart').value = '';
    document.getElementById('routeEnd').value = '';
    document.getElementById('routeResult').textContent = '';
    STATE.currentRoute = null;
    clearRoute();
    clearHighlight();
}

export function initFilters() {
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

    // Accordion logic
    document.querySelectorAll('#filters .blk .hdrline').forEach(header => {
      header.addEventListener('click', (e) => {
        header.parentElement.classList.toggle('active');
        handleAccordion(e.currentTarget);
      });
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
}
