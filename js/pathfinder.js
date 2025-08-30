const DISTANCE_CACHE = new Map();
const CONVERSION_COEFFICIENT = 5.107;

/**
 * Calculates the Euclidean distance between two systems.
 * @param {object} s1 - The first system object with x, y, z coordinates.
 * @param {object} s2 - The second system object with x, y, z coordinates.
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
 * @returns {Array<object>} The shortest path as an array of system objects, or an empty array if no path is found.
 */
export function findPath(startNode, endNode, allNodes, maxJump) {
  const openSet = new Set([startNode]);
  const cameFrom = new Map();

  const gScore = new Map();
  gScore.set(startNode, 0);

  const fScore = new Map();
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

    const maxCoordDist = maxJump * CONVERSION_COEFFICIENT;

    for (const neighbor of allNodes) {
      if (neighbor === current) continue;

      // Optimization: rough check to prune distant nodes before calculating distance
      if (Math.abs(current.x - neighbor.x) > maxCoordDist) continue;
      if (Math.abs(current.y - neighbor.y) > maxCoordDist) continue;
      if (Math.abs(current.z - neighbor.z) > maxCoordDist) continue;

      const dist = calculateDistance(current, neighbor);
      if (dist > maxJump) continue;

      const tentativeGScore = gScore.get(current) + dist;
      if (tentativeGScore < (gScore.get(neighbor) || Infinity)) {
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

export function calculatePathDistance(path) {
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += calculateDistance(path[i], path[i+1]);
  }
  return totalDistance;
}
