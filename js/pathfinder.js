const DISTANCE_CACHE = new Map();
const CONVERSION_COEFFICIENT = 5;

/**
 * Creates a symmetric cache key for distance lookups.
 * @param {object} a
 * @param {object} b
 * @returns {string}
 */
function getDistanceKey(a, b) {
  const idA = a && a.id != null ? a.id : '';
  const idB = b && b.id != null ? b.id : '';
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

/**
 * Clears the memoized distances.
 */
export function resetDistanceCache() {
  DISTANCE_CACHE.clear();
}

class MinPriorityQueue {
  constructor(scoreAccessor) {
    this._heap = [];
    this._scoreAccessor = scoreAccessor;
  }

  get size() {
    return this._heap.length;
  }

  isEmpty() {
    return this._heap.length === 0;
  }

  push(value) {
    this._heap.push(value);
    this._siftUp(this._heap.length - 1);
  }

  pop() {
    if (!this._heap.length) return undefined;
    const top = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length) {
      this._heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  _siftUp(idx) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this._compare(idx, parentIdx)) {
        this._swap(idx, parentIdx);
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  _siftDown(idx) {
    const length = this._heap.length;
    while (true) {
      let smallest = idx;
      const left = idx * 2 + 1;
      const right = idx * 2 + 2;

      if (left < length && this._compare(left, smallest)) {
        smallest = left;
      }
      if (right < length && this._compare(right, smallest)) {
        smallest = right;
      }
      if (smallest !== idx) {
        this._swap(idx, smallest);
        idx = smallest;
      } else {
        break;
      }
    }
  }

  _compare(aIdx, bIdx) {
    return this._scoreAccessor(this._heap[aIdx]) < this._scoreAccessor(this._heap[bIdx]);
  }

  _swap(aIdx, bIdx) {
    [this._heap[aIdx], this._heap[bIdx]] = [this._heap[bIdx], this._heap[aIdx]];
  }
}

/**
 * Calculates the Euclidean distance between two systems.
 * Caches results to avoid re-computation.
 * @param {object} s1 - The first system object.
 * @param {object} s2 - The second system object.
 * @returns {number} The distance in parsecs.
 */
export function calculateDistance(s1, s2) {
  if (!s1 || !s2) return 0;
  const cacheKey = getDistanceKey(s1, s2);
  if (DISTANCE_CACHE.has(cacheKey)) {
    return DISTANCE_CACHE.get(cacheKey);
  }

  const dx = (s1.x || 0) - (s2.x || 0);
  const dy = (s1.y || 0) - (s2.y || 0);
  const dz = (s1.z || 0) - (s2.z || 0);
  const distance = Math.hypot(dx, dy, dz) / CONVERSION_COEFFICIENT;
  const normalizedDistance = Math.max(0, Math.round(distance));

  DISTANCE_CACHE.set(cacheKey, normalizedDistance);
  return normalizedDistance;
}

/**
 * A* pathfinding algorithm implementation.
 * @param {object} startNode - The starting system object.
 * @param {object} endNode - The goal system object.
 * @param {Array<object>} allNodes - An array of all systems in the galaxy.
 * @param {number} maxJump - The maximum jump distance allowed.
 * @returns {{path: Array<object>, distance: number}} The shortest path and its total distance.
 */
export function findPath(startNode, endNode, allNodes, maxJump) {
  if (!startNode || !endNode || !Array.isArray(allNodes) || !allNodes.length) {
    return { path: [], distance: 0 };
  }

  if (startNode === endNode) {
    return { path: [startNode], distance: 0 };
  }

  const jumpLimit = Number.isFinite(maxJump) ? maxJump : Infinity;

  const adjacencyList = new Map();
  for (const node of allNodes) {
    adjacencyList.set(node, []);
  }

  for (let i = 0; i < allNodes.length; i += 1) {
    for (let j = i + 1; j < allNodes.length; j += 1) {
      const node1 = allNodes[i];
      const node2 = allNodes[j];
      const dist = calculateDistance(node1, node2);
      if (dist <= jumpLimit) {
        adjacencyList.get(node1).push(node2);
        adjacencyList.get(node2).push(node1);
      }
    }
  }

  const cameFrom = new Map();
  const gScore = new Map(allNodes.map(node => [node, Infinity]));
  gScore.set(startNode, 0);

  const fScore = new Map(allNodes.map(node => [node, Infinity]));
  fScore.set(startNode, calculateDistance(startNode, endNode));

  const queue = new MinPriorityQueue(node => fScore.get(node));
  const closedSet = new Set();
  queue.push(startNode);

  while (!queue.isEmpty()) {
    const current = queue.pop();
    if (closedSet.has(current)) {
      continue;
    }
    if (current === endNode) {
      const path = [];
      let walker = current;
      while (walker) {
        path.unshift(walker);
        walker = cameFrom.get(walker);
      }
      return { path, distance: gScore.get(endNode) };
    }

    closedSet.add(current);

    const neighbors = adjacencyList.get(current) || [];
    for (const neighbor of neighbors) {
      if (closedSet.has(neighbor)) continue;
      const tentativeGScore = gScore.get(current) + calculateDistance(current, neighbor);
      if (tentativeGScore < gScore.get(neighbor)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeGScore);
        fScore.set(neighbor, tentativeGScore + calculateDistance(neighbor, endNode));
        queue.push(neighbor);
      }
    }
  }

  return { path: [], distance: 0 };
}
