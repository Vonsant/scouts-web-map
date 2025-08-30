import { STATE, VIZ } from './state.js';
import { selectSystem, buildSystemDatalist } from './ui.js';
import * as i18n from './localization.js';
import { calculateDistance } from './pathfinder.js';

// Module-level variables for SVG elements
let svg, gRoot, gCells, gPoints, gLabels, gRouteLabels, tip, zoom;

export function initMap() {
  // Initialize selections now that the DOM is ready
  svg = d3.select('#map');
  gRoot = svg.append('g').attr('id', 'root');
  gCells = gRoot.append('g').attr('id', 'cells');
  gRoot.append('g').attr('id', 'edges').attr('class', 'edges'); // Still create the group for order, but don't store it
  gPoints = gRoot.append('g').attr('id', 'points');
  gRouteLabels = gRoot.append('g').attr('id', 'route-labels');
  gLabels = gRoot.append('g').attr('id', 'labels');
  tip = d3.select('#tip');

  zoom = d3.zoom().scaleExtent([0.5, 4]).on('zoom', (ev) => {
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
    gPoints.attr('display', e.target.checked ? null : 'none');
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

  const pad = 40;
  const xExtent = d3.extent(systems, d => d.x), yExtent = d3.extent(systems, d => d.y);
  const xScale = d3.scaleLinear().domain(xExtent).range([pad, VIZ.width - pad]);
  const yScale = d3.scaleLinear().domain(yExtent).range([VIZ.height - pad, pad]);
  VIZ.scaleX = xScale;
  VIZ.scaleY = yScale;

  const points = systems.map(s => [xScale(s.x), yScale(s.y)]);
  VIZ.delaunay = d3.Delaunay.from(points);
  VIZ.voronoi = VIZ.delaunay.voronoi([0, 0, VIZ.width, VIZ.height]);

  const colorMap = d3.scaleOrdinal()
    .domain([...new Set(systems.map(s => s.color || 'gray'))])
    .range(['#00d4ff', '#8366ff', '#ff6b9d', '#ffa502', '#00ff88', '#74b9ff', '#a29bfe', '#fd79a8', '#fdcb6e']);

  const cells = gCells.selectAll('path').data(systems, d => d.id);
  cells.join(
    enter => enter.append('path')
      .attr('class', 'cell')
      .attr('id', d => `cell-${d.id}`)
      .attr('d', (_, i) => VIZ.voronoi.renderCell(i))
      .attr('fill', d => colorMap(d.color || 'gray'))
      .attr('opacity', 0)
      .on('mousemove', (event, d) => showTip(event, d))
      .on('mouseleave', hideTip)
      .on('click', (_, d) => selectSystem(d.id, []))
      .call(e => e.transition().duration(600).attr('opacity', .85)),
    update => update
      .attr('d', (_, i) => VIZ.voronoi.renderCell(i))
      .attr('fill', d => colorMap(d.color || 'gray'))
      .attr('opacity', .85),
    exit => exit.remove()
  );

  const pts = gPoints.selectAll('circle').data(systems, d => d.id);
  pts.join(
    enter => enter.append('circle')
      .attr('class', 'point')
      .attr('id', d => `pt-${d.id}`)
      .attr('r', 8)
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('fill', '#ffffff')
      .on('mousemove', (event, d) => showTip(event, d))
      .on('mouseleave', hideTip)
      .on('click', (_, d) => selectSystem(d.id, [])),
    update => update.attr('cx', d => xScale(d.x)).attr('cy', d => yScale(d.y)),
    exit => exit.remove()
  );

  const labels = gLabels.selectAll('text').data(systems, d => d.id);
  labels.join(
    enter => enter.append('text')
      .attr('x', d => xScale(d.x))
      .attr('y', d => yScale(d.y) + 20)
      .attr('text-anchor', 'middle')
      .text(d => d.name || d.id)
      .style('font-size', STATE.labelSize + 'px')
      .attr('opacity', 0)
      .call(e => e.transition().duration(400).attr('opacity', .9)),
    update => update
      .attr('x', d => xScale(d.x))
      .attr('y', d => yScale(d.y) + 20)
      .attr('text-anchor', 'middle')
      .text(d => d.name || d.id)
      .style('font-size', STATE.labelSize + 'px')
      .attr('opacity', .9),
    exit => exit.remove()
  );

  if (typeof callback === 'function') {
      callback();
  } else {
      clearHighlight();
  }
  buildSystemDatalist();
  drawRoute();
}

function showTip(event, s) {
  const planets = s.planets || [];
  const stations = s.stations || [];
  const belts = s.asteroidBelts || [];
  const maxItems = 5;

  let content = `<div style="font-weight: bold; font-size: 18px; color: var(--accent); margin-bottom: 8px;">${s.name || s.id}</div>`;

  const habitablePlanets = planets.filter(p => p.category === 'habitable');
  if (habitablePlanets.length > 0) {
    content += '<h4>Планеты</h4><ul>';
    habitablePlanets.slice(0, maxItems).forEach(p => {
      const race = i18n.translate(i18n.races, p.race);
      const level = p.level || '?';
      content += `<li>${p.name || p.id} - ${race} - ${level} ур.</li>`;
    });
    if (habitablePlanets.length > maxItems) {
      content += `<li>... и еще ${habitablePlanets.length - maxItems}</li>`;
    }
    content += '</ul>';
  }

  const inhabitablePlanets = planets.filter(p => p.category === 'inhabitable');
    if (inhabitablePlanets.length > 0) {
    if (habitablePlanets.length === 0) content += '<h4>Планеты</h4>';
    content += '<ul>';
    inhabitablePlanets.slice(0, maxItems).forEach(p => {
        const terrain = i18n.translate(i18n.terrains, p.terrain);
        const ratios = `г:${p.hills || 0} о:${p.oceans || 0} р:${p.plains || 0}`;
        content += `<li>${terrain} - ${p.name || p.id} - ${ratios}</li>`;
    });
    if (inhabitablePlanets.length > maxItems) {
        content += `<li>... и еще ${inhabitablePlanets.length - maxItems} необитаемых</li>`;
    }
    content += '</ul>';
  }

  if (stations.length > 0) {
    content += '<h4>Станции</h4><ul>';
    stations.slice(0, maxItems).forEach(st => {
      const type = i18n.translate(i18n.stationTypes, st.type);
      const race = i18n.translate(i18n.races, st.race);
      const level = st.level || '?';
      content += `<li>${type} - ${st.name || st.id} - ${race} - ${level} ур.</li>`;
    });
    if (stations.length > maxItems) {
      content += `<li>... и еще ${stations.length - maxItems}</li>`;
    }
    content += '</ul>';
  }

  if (belts.length > 0) {
    content += '<div style="margin-top: 8px; font-style: italic;" class="small muted">Есть астероидный пояс</div>';
  }

  // Manual positioning logic
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

export function drawRoute() {
  clearRoute();
  const route = STATE.currentRoute;
  if (!route || !route.path1) return;

  let pathToDraw = null;

  if (route.isCrossGalaxy) {
    // For cross-galaxy, determine which path to draw based on the current galaxy
    const path1GalaxyId = STATE.systemIndex.get(route.path1[0].id).galaxyId;
    if (STATE.currentGalaxyId === path1GalaxyId) {
      pathToDraw = route.path1;
    } else {
      // It must be the other galaxy's path. Check if path2 exists.
      if (route.path2 && route.path2.length > 0) {
        const path2GalaxyId = STATE.systemIndex.get(route.path2[0].id).galaxyId;
        if(STATE.currentGalaxyId === path2GalaxyId) {
          pathToDraw = route.path2;
        }
      }
    }
  } else {
    // For same-galaxy, just draw path1
    pathToDraw = route.path1;
  }

  if (!pathToDraw || pathToDraw.length < 2) return;

  const edges = d3.select('#edges');
  const labels = d3.select('#route-labels');

  for (let i = 0; i < pathToDraw.length - 1; i++) {
    const p1 = pathToDraw[i];
    const p2 = pathToDraw[i+1];

    const x1 = VIZ.scaleX(p1.x);
    const y1 = VIZ.scaleY(p1.y);
    const x2 = VIZ.scaleX(p2.x);
    const y2 = VIZ.scaleY(p2.y);

    // Draw line for the segment
    edges.append('line')
      .attr('class', 'route-line')
      .attr('x1', x1)
      .attr('y1', y1)
      .attr('x2', x2)
      .attr('y2', y2);

    // Add distance label for the segment
    const dist = calculateDistance(p1, p2);
    labels.append('text')
      .attr('class', 'route-label')
      .attr('x', (x1 + x2) / 2)
      .attr('y', (y1 + y2) / 2 - 10) // Position label above the line
      .text(`${dist} пк`);
  }
}

export function clearRoute() {
  d3.select('#edges').selectAll('.route-line').remove();
  d3.select('#route-labels').selectAll('.route-label').remove();
}
