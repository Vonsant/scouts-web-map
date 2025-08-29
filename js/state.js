export const STATE = {
  isDesktop: false,
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
