const DISTANCE_CACHE = new Map();
const CONVERSION_COEFFICIENT = 5.107;

/**
 * Calculates the Euclidean distance between two systems.
 * Caches results to avoid re-computation.
 * @param {object} s1 - The first system object.
 * @param {object} s2 - The second system object.
 * @returns {number} The distance in parsecs.
 */
function calculateDistance(s1, s2) {
  const key1 = `${s1.id}-${s2.id}`;
  if (DISTANCE_CACHE.has(key1)) return DISTANCE_CACHE.get(key1);
  const key2 = `${s2.id}-${s1.id}`;
  if (DISTANCE_CACHE.has(key2)) return DISTANCE_CACHE.get(key2);

  const dx = s1.x - s2.x;
  const dy = s1.y - s2.y;
  const dz = s1.z - s2.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) / CONVERSION_COEFFICIENT;

  DISTANCE_CACHE.set(key1, distance);
  return distance;
}

/**
 * A* pathfinding algorithm implementation.
 * @param {object} startNode - The starting system object.
 * @param {object} endNode - The goal system object.
 * @param {Array<object>} allNodes - An array of all systems in the galaxy.
 * @param {number} maxJump - The maximum jump distance allowed.
 * @returns {Array<object>} The shortest path, or an empty array if no path is found.
 */
export function findPath(startNode, endNode, allNodes, maxJump) {
  // Step 1: Build the adjacency list for the graph based on maxJump distance.
  const adjacencyList = new Map();
  for (const node of allNodes) {
    adjacencyList.set(node, []);
  }

  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      const node1 = allNodes[i];
      const node2 = allNodes[j];
      const dist = calculateDistance(node1, node2);
      if (dist <= maxJump) {
        adjacencyList.get(node1).push(node2);
        adjacencyList.get(node2).push(node1);
      }
    }
  }

  // Step 2: Run the A* algorithm using the pre-built adjacency list.
  const openSet = new Set([startNode]);
  const cameFrom = new Map();

  const gScore = new Map(allNodes.map(node => [node, Infinity]));
  gScore.set(startNode, 0);

  const fScore = new Map(allNodes.map(node => [node, Infinity]));
  fScore.set(startNode, calculateDistance(startNode, endNode));

  while (openSet.size > 0) {
    let current = null;
    let lowestFScore = Infinity;
    for (const node of openSet) {
      if (fScore.get(node) < lowestFScore) {
        lowestFScore = fScore.get(node);
        current = node;
      }
    }

    if (current === endNode) {
      const path = [];
      while (current) {
        path.unshift(current);
        current = cameFrom.get(current);
      }
      return path;
    }

    openSet.delete(current);

    const neighbors = adjacencyList.get(current) || [];
    for (const neighbor of neighbors) {
      const tentativeGScore = gScore.get(current) + calculateDistance(current, neighbor);
      if (tentativeGScore < gScore.get(neighbor)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeGScore);
        fScore.set(neighbor, tentativeGScore + calculateDistance(neighbor, endNode));
        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        }
      }
    }
  }

  return []; // No path found
}

/**
 * Calculates the total distance of a path.
 * @param {Array<object>} path - An array of system objects representing the path.
 * @returns {number} The total distance in parsecs.
 */
export function calculatePathDistance(path) {
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += calculateDistance(path[i], path[i+1]);
  }
  return totalDistance;
}
