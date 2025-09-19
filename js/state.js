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
    galaxies: [],
    resourceRates: []
  },
  ratio: { h: 33, o: 33, p: 34 },
  labelSize: 12,
  currentRoute: null,
  lastSearchResults: null,
  isPickingForRoute: null, // null, 'start', or 'end'
  activeResourceRateFilter: null
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
