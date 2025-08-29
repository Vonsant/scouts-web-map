import { STATE } from './state.js';
import { textIncludes, normVector, cosineSim } from './utils.js';
import { renderDetailsEmpty, renderSummaryList } from './ui.js';
import { clearHighlight } from './map.js';
import { updateHash } from './app.js';

function getFilters() {
  const useGalaxy = document.getElementById('useGalaxy').checked;
  const useSystem = document.getElementById('useSystem').checked;
  const usePlanets = document.getElementById('usePlanets').checked;
  const useStations = document.getElementById('useStations').checked;
  const useInhabitable = document.getElementById('useInhabitable').checked;

  const galaxyId = document.getElementById('galaxyFilter').value;

  const sysName = document.getElementById('sysName').value.trim();
  const hasBelt = document.getElementById('hasBelt').checked;

  const plName = document.getElementById('plName').value.trim();
  const plLvlMin = parseInt(document.getElementById('plLvlMin').value || '');
  const plLvlMax = parseInt(document.getElementById('plLvlMax').value || '');

  const stType = document.getElementById('stType').value;
  const stName = document.getElementById('stName').value.trim();
  const stLvlMin = parseInt(document.getElementById('stLvlMin').value || '');
  const stLvlMax = parseInt(document.getElementById('stLvlMax').value || '');

  const terrainChecked = Array.from(document.querySelectorAll('#terrainBox input[type="checkbox"]:checked')).map(el => el.value);
  const resChecked = Array.from(document.querySelectorAll('#resBox input[type="checkbox"]:checked')).map(el => el.value.toLowerCase());

  const ratioSim = parseInt(document.getElementById('ratioSim').value, 10);
  const ratio = STATE.ratio;

  return { useGalaxy, useSystem, usePlanets, useStations, useInhabitable, galaxyId, sysName, hasBelt, plName, plLvlMin, plLvlMax, stType, stName, stLvlMin, stLvlMax, terrainChecked, resChecked, ratioSim, ratio };
}

function planetHasAllResources(p, want) {
  const have = (p.resources || []).map(r => String(r).toLowerCase());
  return want.every(w => have.includes(w));
}

function planetHasAnyTerrain(p, terrains) {
  if (!terrains.length) return true;
  return terrains.includes(String(p.terrain || ''));
}

function approxMatchHOP_byRatio(p, ratioPct, thresholdPct) {
  if (thresholdPct <= 0) return true;
  if (p.category !== 'inhabitable') return false;
  const ph = parseFloat(p.hills || 0),
        po = parseFloat(p.oceans || 0),
        pp = parseFloat(p.plains || 0);
  const v = normVector(ph, po, pp),
        t = normVector(ratioPct.h, ratioPct.o, ratioPct.p);
  const sim = cosineSim(v, t);
  const pct = Math.round(sim * 100);
  return pct >= thresholdPct;
}

export function runSearch() {
  const f = getFilters();
  const anyUse = f.useGalaxy || f.useSystem || f.usePlanets || f.useStations || f.useInhabitable;
  const entries = [];
  if (!anyUse) {
    renderDetailsEmpty();
    return;
  }

  STATE.data.galaxies.forEach(g => (g.systems || []).forEach(s => {
    let ok = true;
    const reasons = [];
    const matchedPlanetIds = new Set();

    if (f.useGalaxy && f.galaxyId) {
      if (g.id !== f.galaxyId) ok = false;
      else reasons.push(`Галактика: ${(g.name || g.id)}`);
    }

    if (ok && f.useSystem) {
      if (f.sysName) {
        if (!textIncludes(s.name, f.sysName)) ok = false;
        else reasons.push(`Система: "${f.sysName}"`);
      }
      if (ok && f.hasBelt) {
        if (!((s.asteroidBelts || []).length > 0)) ok = false;
        else reasons.push('Есть астероидный пояс');
      }
    }

    if (ok && f.usePlanets) {
      if (f.plName) {
        const ps = (s.planets || []).filter(p => textIncludes(p.name, f.plName));
        if (!ps.length) ok = false;
        else {
          reasons.push(`Планета: "${f.plName}"`);
          ps.forEach(p => matchedPlanetIds.add(p.id));
        }
      }
      if (ok && (!isNaN(f.plLvlMin) || !isNaN(f.plLvlMax))) {
        const ps = (s.planets || []).filter(p => {
          const lvl = Number.isFinite(p.level) ? p.level : null;
          if (lvl == null) return false;
          if (!isNaN(f.plLvlMin) && lvl < f.plLvlMin) return false;
          if (!isNaN(f.plLvlMax) && lvl > f.plLvlMax) return false;
          return true;
        });
        if (!ps.length) ok = false;
        else {
          const rangeText = `Уровень планеты ${!isNaN(f.plLvlMin) ? '≥ ' + f.plLvlMin : ''}${(!isNaN(f.plLvlMin) && !isNaN(f.plLvlMax)) ? ' и ' : ''}${!isNaN(f.plLvlMax) ? '≤ ' + f.plLvlMax : ''}`.trim();
          reasons.push(rangeText);
          ps.forEach(p => matchedPlanetIds.add(p.id));
        }
      }
    }

    if (ok && f.useStations) {
      if (f.stType) {
        const hit = (s.stations || []).some(t => t.type === f.stType);
        if (!hit) ok = false;
        else reasons.push(`Тип станции: ${f.stType}`);
      }
      if (ok && f.stName) {
        const hit = (s.stations || []).some(t => textIncludes(t.name, f.stName));
        if (!hit) ok = false;
        else reasons.push(`Станция: "${f.stName}"`);
      }
      if (ok && (!isNaN(f.stLvlMin) || !isNaN(f.stLvlMax))) {
        const hit = (s.stations || []).some(t => {
          const lvl = Number.isFinite(t.level) ? t.level : null;
          if (lvl == null) return false;
          if (!isNaN(f.stLvlMin) && lvl < f.stLvlMin) return false;
          if (!isNaN(f.stLvlMax) && lvl > f.stLvlMax) return false;
          return true;
        });
        if (!hit) ok = false;
        else reasons.push(`Уровень станции ${!isNaN(f.stLvlMin) ? '≥ ' + f.stLvlMin : ''}${(!isNaN(f.stLvlMin) && !isNaN(f.stLvlMax)) ? ' и ' : ''}${!isNaN(f.stLvlMax) ? '≤ ' + f.stLvlMax : ''}`.trim());
      }
    }

    if (ok && f.useInhabitable) {
      if (f.terrainChecked && f.terrainChecked.length > 0) {
        const ps = (s.planets || []).filter(p => p.category === 'inhabitable' && planetHasAnyTerrain(p, f.terrainChecked));
        if (!ps.length) ok = false;
        else {
          reasons.push(`Рельеф: ${f.terrainChecked.join(', ')}`);
          ps.forEach(p => matchedPlanetIds.add(p.id));
        }
      }
      if (ok && (f.resChecked || []).length > 0) {
        const ps = (s.planets || []).filter(p => p.category === 'inhabitable' && planetHasAllResources(p, f.resChecked));
        if (!ps.length) ok = false;
        else {
          reasons.push(`Ресурсы (на одной планете): ${f.resChecked.join(', ')}`);
          ps.forEach(p => matchedPlanetIds.add(p.id));
        }
      }
      if (ok && f.ratioSim > 0) {
        const ps = (s.planets || []).filter(p => approxMatchHOP_byRatio(p, f.ratio, f.ratioSim));
        if (!ps.length) ok = false;
        else {
          reasons.push(`Соотношение H:O:P ≈ ${f.ratio.h}:${f.ratio.o}:${f.ratio.p} (≥${f.ratioSim}%)`);
          ps.forEach(p => matchedPlanetIds.add(p.id));
        }
      }
    }

    if (ok) entries.push({ galaxyId: g.id, system: s, reasons, highlightPlanetIds: Array.from(matchedPlanetIds) });
  }));

  entries.sort((a, b) => (a.system.name || '').localeCompare(b.system.name || ''));
  renderSummaryList(entries);
}

export function clearSearch() {
  ['useGalaxy', 'useSystem', 'usePlanets', 'useStations', 'useInhabitable'].forEach(id => document.getElementById(id).checked = false);
  document.getElementById('galaxyFilter').value = '';
  ['sysName', 'plName', 'plLvlMin', 'plLvlMax', 'stName', 'stLvlMin', 'stLvlMax'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('hasBelt').checked = false;
  document.getElementById('stType').value = '';
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

export function initFilters() {
    document.getElementById('runSearch').addEventListener('click', runSearch);
    document.getElementById('clearSearch').addEventListener('click', clearSearch);

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
        outH.textContent = H;
        outO.textContent = O;
        outP.textContent = P;
        STATE.ratio = { h: H, o: O, p: P };
    }
    a.addEventListener('input', updateDouble);
    b.addEventListener('input', updateDouble);
    sim.addEventListener('input', () => simVal.textContent = sim.value);
    updateDouble();
}
