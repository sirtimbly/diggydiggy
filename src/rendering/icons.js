export const icons = {
  redo: '<path d="m16 4 5 5-5 5M21 9H11a7 7 0 0 0-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.8-2.5 1.8-2.5 3.5M12 17h.01"/>',
  move: '<path d="M12 3v18M3 12h18m-6-6-3-3-3 3m6 12-3 3-3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z"/>',
  down: '<path d="M12 3v18m-5-5 5 5 5-5"/>',
  pick: '<path d="m5 20 9-12m-6-5c5-1 10 2 12 8l-5-3-5-1-4-2z"/>',
  link: '<path d="M7 4v6a4 4 0 0 0 4 4h6m-4-4 4 4-4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/>',
  rock: '<path d="m5 4 12-1 5 9-5 9H6l-4-9zM5 4l7 8 5-9M2 12h10l5 9m-5-9 10 0"/>',
};
export function escapeHTML(v) {
  return String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
