export function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function hash(s) {
  return [...s].reduce((n, c) => ((n << 5) - n + c.charCodeAt(0)) | 0, 0) >>> 0;
}
