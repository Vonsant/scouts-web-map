import { STATE, VIZ } from './state.js';
import { selectSystem } from './ui.js';
import { setSystemForRoutePicker } from './filters.js';
import * as i18n from './localization.js';
import { calculateDistance } from './pathfinder.js';

// Visual constants that drive the look & feel of the galaxy map
const MAP_CONFIG = {
  padding: 48,
  scaleExtent: [0.45, 5],
  labelOffset: 30,
  cellOpacity: 0.85,
  starRadius: 7,
  orbitRadius: 20,
  asteroidOffset: 6,
  planetRadius: 4,
  stationSize: 7,
  routeLabelOffset: 18,
  transitionDuration: 320,
  colorPalette: [
    '#4f46e5', '#0ea5e9', '#22c55e', '#f97316', '#ec4899',
    '#eab308', '#14b8a6', '#8b5cf6', '#f43f5e', '#38bdf8'
  ]
};

const NAMED_COLORS = new Map([
  ['blue', '#3b82f6'],
  ['red', '#ef4444'],
  ['orange', '#fb923c'],
  ['yellow', '#facc15'],
  ['green', '#22c55e'],
  ['teal', '#14b8a6'],
  ['purple', '#a855f7'],
  ['pink', '#ec4899'],
  ['white', '#f8fafc'],
  ['gray', '#64748b']
]);

// Module-level variables for SVG elements
let svg, gRoot, gCells, gSystemObjects, gPoints, gLabels, gRouteLabels, tip, zoom;

function ensureMapDefs() {
  if (!svg) return;
  let defs = svg.select('defs#map-defs');
  if (!defs.empty()) return;

  defs = svg.append('defs').attr('id', 'map-defs');
  const glow = defs.append('filter')
    .attr('id', 'node-glow')
    .attr('x', '-150%')
    .attr('y', '-150%')
    .attr('width', '400%')
    .attr('height', '400%');

  glow.append('feGaussianBlur')
    .attr('stdDeviation', 4)
    .attr('result', 'coloredBlur');

  const feMerge = glow.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
}

function resolveNamedColor(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (NAMED_COLORS.has(normalized)) {
    return NAMED_COLORS.get(normalized);
  }
  if (/^#|rgb|hsl/.test(normalized)) {
    return value;
  }
  return null;
}

function createColorResolver(systems) {
  const assignments = new Map();
  let paletteIndex = 0;

  return (system) => {
    const explicit = resolveNamedColor(system.color);
    if (explicit) return explicit;

    const key = system.control || system.type || 'default';
    if (!assignments.has(key)) {
      const color = MAP_CONFIG.colorPalette[paletteIndex % MAP_CONFIG.colorPalette.length];
      assignments.set(key, color);
      paletteIndex++;
    }
    return assignments.get(key);
  };
}

function adjustLightness(color, delta = 0) {
  const parsed = d3.color(color);
  if (!parsed) return color;
  const hsl = d3.hsl(parsed);
  hsl.l = Math.max(0, Math.min(1, hsl.l + delta));
  return hsl.formatHex();
}

function safeExtent(values, accessor) {
  const extent = d3.extent(values, accessor);
  let [min, max] = extent;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [-1, 1];
  }
  if (min === max) {
    const padding = Math.abs(min) * 0.1 || 1;
    min -= padding;
    max += padding;
  }
  return [min, max];
}

export function initMap() {
  // Initialize selections now that the DOM is ready
  svg = d3.select('#map');
  ensureMapDefs();
  gRoot = svg.append('g').attr('id', 'root');
  gCells = gRoot.append('g').attr('id', 'cells');
  gRoot.append('g').attr('id', 'edges').attr('class', 'edges'); // Still create the group for order, but don't store it
  gSystemObjects = gRoot.append('g').attr('id', 'system-objects');
  gPoints = gRoot.append('g').attr('id', 'points');
  gRouteLabels = gRoot.append('g').attr('id', 'route-labels');
  gLabels = gRoot.append('g').attr('id', 'labels');
  tip = d3.select('#tip');

  zoom = d3.zoom().scaleExtent(MAP_CONFIG.scaleExtent).on('zoom', (ev) => {
    gRoot.attr('transform', ev.transform);
  });
  svg.call(zoom);

  const zi = document.getElementById('zoomIn'),
        zo = document.getElementById('zoomOut'),
        zr = document.getElementById('zoomReset');
  zi.addEventListener('click', () => svg.transition().duration(180).call(zoom.scaleBy, 1.2));
  zo.addEventListener('click', () => svg.transition().duration(180).call(zoom.scaleBy, 1 / 1.2));
  zr.addEventListener('click', () => svg.transition().duration(220).call(zoom.transform, d3.zoomIdentity));

  document.getElementById('toggleLabels').addEventListener('change', e => {
    gLabels.attr('display', e.target.checked ? null : 'none');
  });
  document.getElementById('togglePoints').addEventListener('change', e => {
    const isVisible = e.target.checked;
    gPoints.attr('display', isVisible ? null : 'none');
    gSystemObjects.attr('display', isVisible ? null : 'none');
  });

  const labelSizeSlider = document.getElementById('labelSize');
  labelSizeSlider.addEventListener('input', e => {
    STATE.labelSize = parseInt(e.target.value);
    gLabels.selectAll('text').style('font-size', STATE.labelSize + 'px');
  });
}

export function initStars() {
  const cvs = document.getElementById('stars');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const DPR = window.devicePixelRatio || 1;
  const stars = [];

  function generateStars(w, h) {
    stars.length = 0;
    const count = Math.floor((w * h) / 1800);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.8 + 0.2,
        a: 0.75 * Math.random() + 0.25,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  function draw() {
    if (!cvs.isConnected) return;
    const w = cvs.clientWidth, h = cvs.clientHeight;
    cvs.width = Math.floor(w * DPR);
    cvs.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (stars.length === 0) generateStars(w, h);

    const time = Date.now() * 0.001;
    stars.forEach(star => {
      const twinkle = Math.sin(time + star.twinkle) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(220,235,255,${star.a * twinkle})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    });

    const grd = ctx.createRadialGradient(w * 0.75, h * 0.2, 40, w * 0.7, h * 0.15, 400);
    grd.addColorStop(0, 'rgba(0,212,255,.06)');
    grd.addColorStop(0.5, 'rgba(131,102,255,.04)');
    grd.addColorStop(1, 'rgba(110,173,254,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.fill();

    requestAnimationFrame(draw);
  }

  new ResizeObserver(() => {
    if (cvs.isConnected) generateStars(cvs.clientWidth, cvs.clientHeight);
  }).observe(cvs);

  draw();
}

export function showGalaxy(galaxyId, callback) {
  const galaxy = STATE.galaxyIndex.get(galaxyId); if (!galaxy) return;
  STATE.currentGalaxyId = galaxyId;

  const systems = (galaxy.systems || []).filter(s => Number.isFinite(s.x) && Number.isFinite(s.y));
  VIZ.galaxy = galaxy;
  VIZ.systems = systems;

  if (!systems.length) {
    clearMapLayers();
    if (typeof callback === 'function') {
      callback();
    } else {
      clearHighlight();
    }
    return;
  }

  const xExtent = safeExtent(systems, d => d.x);
  const yExtent = safeExtent(systems, d => d.y);
  const xScale = d3.scaleLinear().domain(xExtent).range([MAP_CONFIG.padding, VIZ.width - MAP_CONFIG.padding]);
  const yScale = d3.scaleLinear().domain(yExtent).range([VIZ.height - MAP_CONFIG.padding, MAP_CONFIG.padding]);
  VIZ.scaleX = xScale;
  VIZ.scaleY = yScale;

  const points = systems.map(s => [xScale(s.x), yScale(s.y)]);
  VIZ.delaunay = d3.Delaunay.from(points);
  VIZ.voronoi = VIZ.delaunay.voronoi([0, 0, VIZ.width, VIZ.height]);

  const getColor = createColorResolver(systems);

  renderCells(systems, getColor);
  renderPoints(systems, xScale, yScale, getColor);
  renderLabels(systems, xScale, yScale);

  if (typeof callback === 'function') {
    callback();
  } else {
    clearHighlight();
  }

  drawSystemObjects(systems, xScale, yScale, getColor);
  drawRoute();
  drawSearchHighlights();
}

function calculateSatellitePositions(count, radius) {
  if (count === 0) return [];
  const positions = [];
  const angleStep = (2 * Math.PI) / count;
  for (let i = 0; i < count; i++) {
    // Start angle slightly offset to avoid first item being directly to the right
    const angle = i * angleStep - (Math.PI / 2);
    positions.push([
      radius * Math.cos(angle),
      radius * Math.sin(angle)
    ]);
  }
  return positions;
}

function renderCells(systems, colorResolver) {
  const cells = gCells.selectAll('path.cell').data(systems, d => d.id);

  cells.join(
    enter => enter.append('path')
      .attr('class', 'cell')
      .attr('id', d => `cell-${d.id}`)
      .attr('d', (_, i) => VIZ.voronoi.renderCell(i))
      .attr('fill', d => adjustLightness(colorResolver(d), -0.12))
      .attr('stroke', d => adjustLightness(colorResolver(d), -0.32))
      .attr('opacity', 0)
      .on('mousemove', showTip)
      .on('mouseleave', hideTip)
      .on('click', onSystemClick)
      .call(sel => sel.transition().duration(MAP_CONFIG.transitionDuration).attr('opacity', MAP_CONFIG.cellOpacity)),
    update => update
      .attr('id', d => `cell-${d.id}`)
      .attr('d', (_, i) => VIZ.voronoi.renderCell(i))
      .attr('fill', d => adjustLightness(colorResolver(d), -0.12))
      .attr('stroke', d => adjustLightness(colorResolver(d), -0.32))
      .attr('opacity', MAP_CONFIG.cellOpacity)
      .on('mousemove', showTip)
      .on('mouseleave', hideTip)
      .on('click', onSystemClick),
    exit => exit.transition().duration(200).attr('opacity', 0).remove()
  );
}

function renderPoints(systems, xScale, yScale, colorResolver) {
  const pts = gPoints.selectAll('circle.point').data(systems, d => d.id);

  pts.join(
    enter => enter.append('circle')
      .attr('class', 'point')
      .attr('id', d => `pt-${d.id}`)
      .attr('r', MAP_CONFIG.starRadius)
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('fill', d => adjustLightness(colorResolver(d), 0.2))
      .attr('stroke', d => adjustLightness(colorResolver(d), -0.35))
      .attr('filter', 'url(#node-glow)')
      .on('mousemove', showTip)
      .on('mouseleave', hideTip)
      .on('click', onSystemClick),
    update => update
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', MAP_CONFIG.starRadius)
      .attr('fill', d => adjustLightness(colorResolver(d), 0.2))
      .attr('stroke', d => adjustLightness(colorResolver(d), -0.35))
      .attr('filter', 'url(#node-glow)')
      .on('mousemove', showTip)
      .on('mouseleave', hideTip)
      .on('click', onSystemClick),
    exit => exit.transition().duration(200).attr('opacity', 0).remove()
  );
}

function renderLabels(systems, xScale, yScale) {
  const labels = gLabels.selectAll('text.system-label').data(systems, d => d.id);

  labels.join(
    enter => enter.append('text')
      .attr('class', 'system-label')
      .attr('text-anchor', 'middle')
      .attr('x', d => xScale(d.x))
      .attr('y', d => yScale(d.y) + MAP_CONFIG.labelOffset)
      .text(d => d.name || d.id)
      .style('font-size', STATE.labelSize + 'px')
      .attr('opacity', 0)
      .call(sel => sel.transition().duration(MAP_CONFIG.transitionDuration).attr('opacity', 0.9)),
    update => update
      .attr('x', d => xScale(d.x))
      .attr('y', d => yScale(d.y) + MAP_CONFIG.labelOffset)
      .text(d => d.name || d.id)
      .style('font-size', STATE.labelSize + 'px')
      .attr('opacity', 0.9),
    exit => exit.transition().duration(200).attr('opacity', 0).remove()
  );
}

function clearMapLayers() {
  gCells.selectAll('path.cell').remove();
  gPoints.selectAll('circle.point').remove();
  gLabels.selectAll('text.system-label').remove();
  gSystemObjects.selectAll('g.system-container').remove();
}

function drawSystemObjects(systems, xScale, yScale, colorResolver) {
  const systemObjects = gSystemObjects.selectAll('g.system-container')
    .data(systems, d => d.id);

  const enterSystemObjects = systemObjects.enter()
    .append('g')
    .attr('class', 'system-container')
    .attr('opacity', 0);

  enterSystemObjects.append('circle').attr('class', 'system-halo');
  enterSystemObjects.append('circle').attr('class', 'satellite-orbit');
  enterSystemObjects.append('circle').attr('class', 'asteroid-belt');
  enterSystemObjects.append('g').attr('class', 'planet-layer');
  enterSystemObjects.append('g').attr('class', 'station-layer');

  // Use .each to handle the rendering of children for both enter and update selections
  enterSystemObjects.merge(systemObjects)
    .attr('transform', d => `translate(${xScale(d.x)}, ${yScale(d.y)})`)
    .each(function(d) {
      const systemGroup = d3.select(this);
      const planets = Array.isArray(d.planets) ? d.planets : [];
      const stations = Array.isArray(d.stations) ? d.stations : [];
      const totalSatellites = planets.length + stations.length;
      const positions = calculateSatellitePositions(totalSatellites, MAP_CONFIG.orbitRadius);

      systemGroup.select('.system-halo')
        .attr('r', MAP_CONFIG.starRadius + 4)
        .attr('stroke', adjustLightness(colorResolver(d), 0.25))
        .attr('opacity', 0.55);

      systemGroup.select('.satellite-orbit')
        .attr('r', MAP_CONFIG.orbitRadius)
        .classed('is-visible', totalSatellites > 0)
        .attr('opacity', totalSatellites > 0 ? 1 : 0);

      const hasBelt = Array.isArray(d.asteroidBelts) && d.asteroidBelts.length > 0;
      systemGroup.select('.asteroid-belt')
        .attr('r', MAP_CONFIG.orbitRadius + MAP_CONFIG.asteroidOffset)
        .classed('is-visible', hasBelt)
        .attr('opacity', hasBelt ? 1 : 0);

      const planetLayer = systemGroup.select('.planet-layer');
      const stationLayer = systemGroup.select('.station-layer');

      const planetData = planets.map((planet, index) => ({
        key: planet.id || `${d.id}-planet-${index}`,
        position: positions[index] || [0, 0],
        planet
      }));

      const stationData = stations.map((station, index) => ({
        key: station.id || `${d.id}-station-${index}`,
        position: positions[planets.length + index] || [0, 0],
        station
      }));

      planetLayer.selectAll('circle.planet-dot')
        .data(planetData, item => item.key)
        .join(
          enter => enter.append('circle')
            .attr('class', item => `planet-dot planet--${item.planet.category || 'unknown'}`)
            .attr('r', MAP_CONFIG.planetRadius)
            .attr('cx', item => item.position[0])
            .attr('cy', item => item.position[1])
            .attr('opacity', 0)
            .call(sel => sel.transition().duration(MAP_CONFIG.transitionDuration).attr('opacity', 1)),
          update => update
            .attr('class', item => `planet-dot planet--${item.planet.category || 'unknown'}`)
            .transition().duration(MAP_CONFIG.transitionDuration)
            .attr('cx', item => item.position[0])
            .attr('cy', item => item.position[1]),
          exit => exit.transition().duration(200).attr('opacity', 0).remove()
        );

      stationLayer.selectAll('rect.station-dot')
        .data(stationData, item => item.key)
        .join(
          enter => enter.append('rect')
            .attr('class', 'station-dot')
            .attr('width', MAP_CONFIG.stationSize)
            .attr('height', MAP_CONFIG.stationSize)
            .attr('rx', MAP_CONFIG.stationSize / 3)
            .attr('ry', MAP_CONFIG.stationSize / 3)
            .attr('x', item => item.position[0] - MAP_CONFIG.stationSize / 2)
            .attr('y', item => item.position[1] - MAP_CONFIG.stationSize / 2)
            .attr('opacity', 0)
            .call(sel => sel.transition().duration(MAP_CONFIG.transitionDuration).attr('opacity', 1)),
          update => update.transition().duration(MAP_CONFIG.transitionDuration)
            .attr('width', MAP_CONFIG.stationSize)
            .attr('height', MAP_CONFIG.stationSize)
            .attr('rx', MAP_CONFIG.stationSize / 3)
            .attr('ry', MAP_CONFIG.stationSize / 3)
            .attr('x', item => item.position[0] - MAP_CONFIG.stationSize / 2)
            .attr('y', item => item.position[1] - MAP_CONFIG.stationSize / 2),
          exit => exit.transition().duration(200).attr('opacity', 0).remove()
        );
    });

  // Handle enter and exit animations
  enterSystemObjects.transition().duration(MAP_CONFIG.transitionDuration + 260).attr('opacity', 1);
  systemObjects.exit().transition().duration(200).attr('opacity', 0).remove();
}

function onSystemClick(_, d) {
  if (STATE.isPickingForRoute) {
    setSystemForRoutePicker(d.name || d.id);
  } else {
    selectSystem(d.id, []);
  }
}

function showTip(event, s) {
  const planets = Array.isArray(s.planets) ? s.planets : [];
  const stations = Array.isArray(s.stations) ? s.stations : [];
  const belts = Array.isArray(s.asteroidBelts) ? s.asteroidBelts : [];
  const maxItems = 5;

  const name = s.name || s.id;
  const metaParts = [];
  if (s.control) metaParts.push(`Контроль: ${s.control}`);
  if (s.type) metaParts.push(`Тип: ${s.type}`);
  if (Number.isFinite(s.size)) metaParts.push(`Размер: ${s.size}`);

  const sections = [];

  const habitable = planets.filter(p => p.category === 'habitable');
  if (habitable.length) {
    const items = habitable.slice(0, maxItems).map(p => {
      const race = i18n.translate(i18n.races, p.race);
      const level = p.level || '?';
      return `<li><span class="tooltip__item-name">${p.name || p.id}</span><span class="tooltip__item-meta">${race} · ${level} ур.</span></li>`;
    }).join('');
    const overflow = habitable.length > maxItems
      ? `<li class="tooltip__more">… и еще ${habitable.length - maxItems}</li>`
      : '';
    sections.push(`<div class="tooltip__section"><h4>Обитаемые планеты</h4><ul>${items}${overflow}</ul></div>`);
  }

  const inhospitable = planets.filter(p => p.category === 'inhabitable');
  if (inhospitable.length) {
    const items = inhospitable.slice(0, maxItems).map(p => {
      const terrain = i18n.translate(i18n.terrains, p.terrain);
      const ratios = [`г:${p.hills || 0}`, `о:${p.oceans || 0}`, `р:${p.plains || 0}`].join(' ');
      return `<li><span class="tooltip__item-name">${p.name || p.id}</span><span class="tooltip__item-meta">${terrain} · ${ratios}</span></li>`;
    }).join('');
    const overflow = inhospitable.length > maxItems
      ? `<li class="tooltip__more">… и еще ${inhospitable.length - maxItems} необитаемых</li>`
      : '';
    sections.push(`<div class="tooltip__section"><h4>Необитаемые планеты</h4><ul>${items}${overflow}</ul></div>`);
  }

  if (stations.length) {
    const items = stations.slice(0, maxItems).map(st => {
      const type = i18n.translate(i18n.stationTypes, st.type);
      const race = i18n.translate(i18n.races, st.race);
      const level = st.level || '?';
      return `<li><span class="tooltip__item-name">${st.name || st.id}</span><span class="tooltip__item-meta">${type} · ${race} · ${level} ур.</span></li>`;
    }).join('');
    const overflow = stations.length > maxItems
      ? `<li class="tooltip__more">… и еще ${stations.length - maxItems}</li>`
      : '';
    sections.push(`<div class="tooltip__section"><h4>Станции</h4><ul>${items}${overflow}</ul></div>`);
  }

  if (belts.length) {
    sections.push('<div class="tooltip__belt muted small">Есть астероидный пояс</div>');
  }

  const metaBlock = metaParts.length
    ? `<div class="tooltip__meta">${metaParts.join(' · ')}</div>`
    : '';

  const content = `
    <div class="tooltip__headline">${name}</div>
    ${metaBlock}
    ${sections.join('')}
  `;

  tip.html(content).style('display', 'block');
}

function hideTip() {
  tip.style('display', 'none');
}

export function clearHighlight() {
  STATE.lastHighlightId = null;
  gCells.selectAll('.highlight').classed('highlight', false);
  gPoints.selectAll('.highlight').classed('highlight', false);
}

export function highlightSystem(systemId) {
  clearHighlight();
  STATE.lastHighlightId = systemId;
  d3.select(`#cell-${systemId}`).classed('highlight', true);
  d3.select(`#pt-${systemId}`).classed('highlight', true);
}

export function highlightMultipleSystems(systemIds) {
    clearHighlight();
    if (!systemIds || !systemIds.length) return;

    systemIds.forEach(id => {
        d3.select(`#cell-${id}`).classed('highlight', true);
        d3.select(`#pt-${id}`).classed('highlight', true);
    });
}

function drawSearchHighlights() {
  if (!STATE.lastSearchResults) return;

  const systemIdsInCurrentGalaxy = STATE.lastSearchResults
    .filter(res => res.galaxyId === STATE.currentGalaxyId)
    .map(res => res.system.id);

  highlightMultipleSystems(systemIdsInCurrentGalaxy);
}

function buildRouteSegments(path) {
  if (!Array.isArray(path) || path.length < 2 || !VIZ.scaleX || !VIZ.scaleY) {
    return [];
  }

  return path.slice(0, -1).map((start, idx) => {
    const end = path[idx + 1];
    const x1 = VIZ.scaleX(start.x);
    const y1 = VIZ.scaleY(start.y);
    const x2 = VIZ.scaleX(end.x);
    const y2 = VIZ.scaleY(end.y);
    return {
      id: `${start.id}-${end.id}`,
      start,
      end,
      x1,
      y1,
      x2,
      y2,
      midX: (x1 + x2) / 2,
      midY: (y1 + y2) / 2,
      distance: calculateDistance(start, end)
    };
  });
}

function updateRouteSegments(segments) {
  const edges = d3.select('#edges');
  const labelsGroup = gRouteLabels;

  const lineSelection = edges.selectAll('line.route-line').data(segments, d => d.id);

  lineSelection.join(
    enter => enter.append('line')
      .attr('class', 'route-line')
      .attr('x1', d => d.x1)
      .attr('y1', d => d.y1)
      .attr('x2', d => d.x2)
      .attr('y2', d => d.y2)
      .attr('opacity', 0)
      .call(sel => sel.transition().duration(MAP_CONFIG.transitionDuration).attr('opacity', 1)),
    update => update.transition().duration(MAP_CONFIG.transitionDuration)
      .attr('x1', d => d.x1)
      .attr('y1', d => d.y1)
      .attr('x2', d => d.x2)
      .attr('y2', d => d.y2)
      .attr('opacity', 1),
    exit => exit.transition().duration(200).attr('opacity', 0).remove()
  );

  const labelSelection = labelsGroup.selectAll('g.route-label').data(segments, d => d.id);

  const labelEnter = labelSelection.enter()
    .append('g')
    .attr('class', 'route-label')
    .attr('opacity', 0);

  labelEnter.append('rect').attr('class', 'route-label__bg').attr('rx', 6).attr('ry', 6);
  labelEnter.append('text').attr('class', 'route-label__text').attr('text-anchor', 'middle').attr('dominant-baseline', 'middle');

  const labelMerge = labelEnter.merge(labelSelection);

  labelMerge.each(function(d) {
    const group = d3.select(this);
    const text = group.select('text').text(`${d.distance} пк`);
    const textWidth = text.node() ? text.node().getComputedTextLength() : 0;
    const width = textWidth + 18;
    const height = 24;
    group.select('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('x', -width / 2)
      .attr('y', -height / 2);
  });

  labelMerge
    .attr('transform', d => `translate(${d.midX}, ${d.midY - MAP_CONFIG.routeLabelOffset})`)
    .transition().duration(MAP_CONFIG.transitionDuration)
    .attr('opacity', 1);

  labelSelection.exit().transition().duration(200).attr('opacity', 0).remove();
}

export function drawRoute() {
  const route = STATE.currentRoute;
  if (!route || !route.path1) {
    updateRouteSegments([]);
    clearHighlight();
    return;
  }

  let pathToDraw = null;

  if (route.isCrossGalaxy) {
    const path1GalaxyId = STATE.systemIndex.get(route.path1[0].id).galaxyId;
    if (STATE.currentGalaxyId === path1GalaxyId) {
      pathToDraw = route.path1;
    } else if (route.path2 && route.path2.length > 0) {
      const path2GalaxyId = STATE.systemIndex.get(route.path2[0].id).galaxyId;
      if (STATE.currentGalaxyId === path2GalaxyId) {
        pathToDraw = route.path2;
      }
    }
  } else {
    // For a single-galaxy route, check it belongs to the current galaxy
    const routeGalaxyId = STATE.systemIndex.get(route.path1[0].id).galaxyId;
    if (STATE.currentGalaxyId === routeGalaxyId) {
      pathToDraw = route.path1;
    }
  }

  if (!pathToDraw || pathToDraw.length < 2) {
    updateRouteSegments([]);
    clearHighlight();
    return;
  }

  const segments = buildRouteSegments(pathToDraw);
  updateRouteSegments(segments);
  highlightMultipleSystems(pathToDraw.map(s => s.id));
}

export function clearRoute() {
  updateRouteSegments([]);
  clearHighlight();
}
