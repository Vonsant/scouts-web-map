export const STATE = {
  data: null,
  galaxyIndex: new Map(),
  systemIndex: new Map(),
  currentGalaxyId: null,
  lastHighlightId: null,
  dict: {
    terrains: [],
    res: [],
    stTypes: [],
    galaxies: []
  },
  ratio: { h: 33, o: 33, p: 34 },
  labelSize: 12
};

export let VIZ = {
  width: 1200,
  height: 900,
  scaleX: null,
  scaleY: null,
  galaxy: null,
  systems: null,
  delaunay: null,
  voronoi: null
};

export const svg = d3.select('#map');
export const gRoot = svg.append('g').attr('id', 'root');
export const gCells = gRoot.append('g').attr('id', 'cells');
export const gEdges = gRoot.append('g').attr('id', 'edges').attr('class', 'edges');
export const gPoints = gRoot.append('g').attr('id', 'points');
export const gLabels = gRoot.append('g').attr('id', 'labels');
export const tip = d3.select('#tip');
