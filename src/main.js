/**
 * main.js — the router. Assembles nothing and models nothing.
 *
 * One scene: a 2000s desktop PC photographed on a wood desk, whose power
 * button boots Windows 95 on the CRT. Everything it actually is lives in
 * stages/desktop.js.
 *
 * The stage machinery is kept even though there is only one stage. It is a few
 * lines — a factory map, a lazy build, a cache — and it is what made adding a
 * second scene, and later removing it, a local change rather than a rewrite.
 */

import { createEngine } from './core/engine.js';
import { createDesktopStage } from './stages/desktop.js';

const engine = createEngine({ canvas: document.getElementById('scene') });

/** id -> factory. The build happens on first show, not here. */
const FACTORIES = {
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
  // a second stage puts a button in the same corner.
  document.querySelectorAll('.stage-hud').forEach((el) => {
    el.hidden = el.id !== stage.hud;
  });
}

show('desktop');
engine.start();

// Handy from the console when tuning.
window.app = { engine, stages: built, show, get current() { return built.get(currentId); } };
