/**
 * Formats a number with Russian locale thousands separators.
 * @param {number} x The number to format.
 * @returns {string}
 */
export const fmtInt = x => { try { return Number(x).toLocaleString('ru-RU'); } catch(e){ return x; } };

/**
 * Returns an array with unique values from the input array.
 * @param {Array} arr The input array.
 * @returns {Array}
 */
export const unique = arr => Array.from(new Set(arr));

/**
 * Case-insensitive check if a string includes a substring.
 * @param {string} hay The string to search in.
 * @param {string} needle The string to search for.
 * @returns {boolean}
 */
export const textIncludes = (hay, needle) => String(hay||'').toLowerCase().includes(String(needle||'').toLowerCase());

/**
 * Parses a string of tokens separated by semicolons or commas.
 * @param {string} t The string to parse.
 * @returns {string[]}
 */
export const parseTokens = t => (t||'').split(/[;,]/).map(s=>s.trim().toLowerCase()).filter(Boolean);

/**
 * Normalizes a 3D vector.
 * @param {number} a
 * @param {number} b
 * @param {number} c
 * @returns {number[]}
 */
export function normVector(a,b,c){
  const aa=Math.max(0,a||0),bb=Math.max(0,b||0),cc=Math.max(0,c||0);
  const sum=aa+bb+cc;
  if(!sum) return [0,0,0];
  return [aa/sum,bb/sum,cc/sum];
}

/**
 * Calculates the cosine similarity between two 3D vectors.
 * @param {number[]} u
 * @param {number[]} v
 * @returns {number}
 */
export function cosineSim(u,v){
  const dot=u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
  const nu=Math.hypot(u[0],u[1],u[2]);
  const nv=Math.hypot(v[0],v[1],v[2]);
  return(!nu||!nv)?0:dot/(nu*nv);
}
