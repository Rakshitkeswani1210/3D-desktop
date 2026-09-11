/**
 * registry.js — the one list of every component, for the part inspector.
 *
 * viewer.html reads from here, so adding a part means adding exactly one entry
 * below and it shows up in the sidebar. The scene itself composes its parts
 * directly (objects/desktop/Desktop.js), because a scene needs the composed
 * object rather than a list of pieces.
 *
 * `load` is a dynamic import so the viewer can re-import a module with a
 * cache-busting query string and pick up an edit without a server restart.
 */

export const COMPONENTS = {
  /* ── the desktop ─────────────────────────────────────────────────── */
  desktop: { label: 'Desktop', stage: 'Desktop', path: './objects/desktop/Desktop.js' },
  desk: { label: 'Desk', stage: 'Desktop', path: './objects/desktop/Desk.js' },
  monitor: { label: 'Monitor', stage: 'Desktop', path: './objects/desktop/Monitor.js' },
  tower: { label: 'Tower', stage: 'Desktop', path: './objects/desktop/Tower.js' },
  keyboard: { label: 'Keyboard', stage: 'Desktop', path: './objects/desktop/Keyboard.js' },
};

/** Ordered ids, for the viewer sidebar. */
export const ids = () => Object.keys(COMPONENTS);

/** Ids grouped by the scene they belong to, preserving declaration order. */
export function byStage() {
  const groups = new Map();
  for (const [id, entry] of Object.entries(COMPONENTS)) {
    if (!groups.has(entry.stage)) groups.set(entry.stage, []);
    groups.get(entry.stage).push(id);
  }
  return groups;
}

/**
 * Import a component module.
 * @param {string} id
 * @param {boolean} fresh bypass the module cache (the viewer's Reload button)
 */
export function load(id, fresh = false) {
  const entry = COMPONENTS[id];
  if (!entry) throw new Error(`Unknown component: ${id}`);
  const url = new URL(entry.path, import.meta.url).href;
  return import(fresh ? `${url}?v=${Date.now()}` : url);
}
