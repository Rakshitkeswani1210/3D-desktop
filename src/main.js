/**
 * main.js — the router. Assembles nothing and models nothing.
 *
 * The page holds two unrelated scenes: an iPod you orbit, and a desktop PC
 * photographed on a desk. This file decides which one is on screen, swaps the
 * HUD to match, and wires the keys. Everything either scene actually is lives
 * in stages/.
 *
 * Stages are built LAZILY on first switch and then kept alive, so the second
 * time you press 1 the iPod is exactly where you left it — still spinning,
 * still on the finish you chose — rather than rebuilt from scratch.
 */

import { createEngine } from './core/engine.js';
import { createIpodStage } from './stages/ipod.js';
import { createDesktopStage } from './stages/desktop.js';

const engine = createEngine({ canvas: document.getElementById('scene') });

/** id -> factory. The build happens on first show, not here. */
const FACTORIES = {
  ipod: createIpodStage,
  desktop: createDesktopStage,
};

const built = new Map();
let currentId = null;

function show(id) {
  if (!FACTORIES[id] || id === currentId) return;

  if (!built.has(id)) built.set(id, FACTORIES[id]({ renderer: engine.renderer }));
  const stage = built.get(id);

  engine.setStage(stage);
  currentId = id;

  document.title = stage.title;

  // Each stage owns a HUD panel; only the active one is in the document flow,
  // because a hidden panel that still accepts clicks is a real bug the moment
  // two stages have a button in the same corner.
  document.querySelectorAll('.stage-hud').forEach((el) => {
    el.hidden = el.id !== stage.hud;
  });
  document.querySelectorAll('#switcher button').forEach((b) => {
    b.classList.toggle('on', b.dataset.stage === id);
  });

  history.replaceState(null, '', `?stage=${id}`);
}

/* ─────────────────────────────── keys ─────────────────────────────── */

/**
 * Cmd+1 / Cmd+2, and plain 1 / 2.
 *
 * Both, on purpose. Chrome and Safari reserve Cmd+1..9 on macOS for switching
 * browser tabs and a page usually cannot cancel that, so the Cmd chord works
 * where the browser permits it and the bare digit always does. The switcher in
 * the corner is clickable for the same reason.
 */
const KEYS = { 1: 'ipod', 2: 'desktop' };

window.addEventListener('keydown', (event) => {
  const id = KEYS[event.key];
  if (!id) return;
  // Never steal the digit from a text field, if this page ever grows one.
  if (event.target instanceof HTMLInputElement) return;
  if (event.ctrlKey || event.altKey) return;
  event.preventDefault();
  show(id);
});

document.querySelectorAll('#switcher button').forEach((b) => {
  b.addEventListener('click', () => show(b.dataset.stage));
});

/* ─────────────────────────────── boot ─────────────────────────────── */

// Deep-linkable as index.html?stage=desktop.
const requested = new URLSearchParams(location.search).get('stage');
show(FACTORIES[requested] ? requested : 'ipod');
engine.start();

// Handy from the console when tuning.
window.app = { engine, stages: built, show, get current() { return built.get(currentId); } };
