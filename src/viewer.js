/**
 * viewer.js — the component inspector.
 *
 * Loads exactly ONE component at a time on a turntable. Debugging a 2 mm bevel,
 * a wheel label or a CRT's taper inside the full scene means fighting scale,
 * occlusion and reflections all at once; in isolation you see the geometry.
 *
 * Deep-linkable as viewer.html?part=monitor, and the Reload button re-imports
 * the module with a cache-busting query so an edit shows up without touching
 * the server.
 *
 * With two unrelated scenes in the project, the inspector carries BOTH lighting
 * setups and swaps to whichever the selected part belongs to. A CRT under the
 * iPod's cold studio rig looks like a fault that isn't there — and the near
 * plane has to move with it, since the two scenes disagree about it by a factor
 * of six (see core/engine.js and theme/desk-spec.js).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { createEngine } from './core/engine.js';
import { createEnvironment } from './core/environment.js';
import { createLighting } from './core/lighting.js';
import { createRoomEnvironment, createRoomLighting } from './core/room-env.js';
import { createBackdrop } from './theme/backdrop.js';
import { createRoomBackdrop } from './theme/room.js';
import { applyFinish, finishIds, FINISHES } from './theme/palette.js';
import { FRAMING, u } from './theme/spec.js';
import { COMPONENTS, ids, byStage, load } from './registry.js';
import { disposeTree } from './lib/dispose.js';
import { SHARED_MATERIALS } from './theme/shared-materials.js';

const engine = createEngine({ canvas: document.getElementById('scene') });
const { renderer, onFrame } = engine;

const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(32, 1, 3, 1600);

/**
 * Both worlds, built once and toggled.
 *
 * createEnvironment and createRoomEnvironment each assign scene.environment,
 * so the texture is read back straight after the call and kept. Both PMREM
 * targets stay resident — two 256px cubemaps, and swapping is then a field
 * assignment rather than a rebuild every time you click a part.
 */
createEnvironment(renderer, scene);
const ipodEnv = scene.environment;
createRoomEnvironment(renderer, scene);
const deskEnv = scene.environment;

const WORLDS = {
  iPod: {
    env: ipodEnv,
    lights: Object.values(createLighting(scene)),
    backdrop: createBackdrop(),
    near: 3,
    groundY: -u(60),
  },
  Desktop: {
    env: deskEnv,
    lights: Object.values(createRoomLighting(scene)),
    backdrop: createRoomBackdrop(),
    near: 0.5,
    groundY: 0,
  },
};

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;

const turntable = new THREE.Group();
scene.add(turntable);

/** A grid to read scale against, and a wireframe overlay. */
const grid = new THREE.GridHelper(200, 40, 0x4a5a80, 0x223049);
grid.visible = false;
scene.add(grid);

// One stage, whose backdrop is swapped as parts change. The engine only ever
// knows about this object.
const stage = { scene, camera, backdrop: WORLDS.iPod.backdrop };
engine.setStage(stage);

let currentId = new URLSearchParams(location.search).get('part') || ids()[0];
let spinning = true;
let wireframe = false;

function countMeshes(root) {
  let meshes = 0;
  let tris = 0;
  root.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    meshes++;
    const g = o.geometry;
    const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    tris += n * (o.isInstancedMesh ? o.count : 1);
  });
  return { meshes, tris: Math.round(tris) };
}

function setWireframe(on) {
  turntable.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      if ('wireframe' in m) m.wireframe = on;
    }
  });
}

async function show(id, fresh = false) {
  currentId = id;
  history.replaceState(null, '', `?part=${id}`);

  while (turntable.children.length) {
    const child = turntable.children.pop();
    disposeTree(child, SHARED_MATERIALS);
  }

  // Swap worlds BEFORE building, so anything that samples the environment at
  // construction sees the right one.
  const world = WORLDS[COMPONENTS[id].stage] ?? WORLDS.iPod;
  scene.environment = world.env;
  for (const w of Object.values(WORLDS)) {
    w.lights.forEach((l) => (l.visible = w === world));
  }
  stage.backdrop = world.backdrop;
  grid.position.y = world.groundY;
  camera.near = world.near;

  const mod = await load(id, fresh);
  const part = mod.create();
  turntable.add(part);
  turntable.rotation.y = 0;

  // Frame it using the component's own meta, falling back to the whole device.
  const cam = mod.meta?.camera ?? { position: FRAMING.position, target: FRAMING.target };
  camera.position.set(...cam.position);
  controls.target.set(...cam.target);

  // Orbit limits from the part's own standoff, because the two scenes differ
  // in scale by more than an order of magnitude: a clamp that suits a 6-unit
  // iPod will not let you see a 150-unit desk at all.
  const standoff = camera.position.distanceTo(controls.target);
  controls.minDistance = standoff * 0.22;
  controls.maxDistance = standoff * 4;
  controls.update();
  camera.updateProjectionMatrix();

  // Picks up the new backdrop's size and the new near plane.
  engine.resize();

  setWireframe(wireframe);

  const { meshes, tris } = countMeshes(part);
  document.getElementById('stats').textContent =
    `${meshes} mesh${meshes === 1 ? '' : 'es'} · ${tris.toLocaleString()} tris`;

  document.querySelectorAll('#parts button').forEach((b) => {
    b.classList.toggle('on', b.dataset.id === id);
  });
}

// Sidebar, grouped by scene — with two unrelated subjects in one project, a
// flat list of eleven parts stops telling you what belongs to what.
const list = document.getElementById('parts');
for (const [stageName, group] of byStage()) {
  const h = document.createElement('h2');
  h.textContent = stageName;
  list.appendChild(h);
  for (const id of group) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = id;
    b.textContent = COMPONENTS[id].label;
    b.addEventListener('click', () => show(id));
    list.appendChild(b);
  }
}

document.getElementById('reload').addEventListener('click', () => show(currentId, true));
document.getElementById('spin').addEventListener('click', (e) => {
  spinning = !spinning;
  e.target.classList.toggle('off', !spinning);
});
document.getElementById('wire').addEventListener('click', (e) => {
  wireframe = !wireframe;
  setWireframe(wireframe);
  e.target.classList.toggle('on', wireframe);
});
document.getElementById('grid').addEventListener('click', (e) => {
  grid.visible = !grid.visible;
  e.target.classList.toggle('on', grid.visible);
});

const finishBtn = document.getElementById('finish');
let finishIndex = 0;
const order = finishIds();
finishBtn.textContent = FINISHES[order[0]].label;
finishBtn.addEventListener('click', () => {
  finishIndex = (finishIndex + 1) % order.length;
  finishBtn.textContent = applyFinish(order[finishIndex]).label;
});

onFrame((dt) => {
  if (spinning) turntable.rotation.y += dt * 0.5;
  // Keep press/hover springs alive so the wheel and the power button can both
  // be inspected mid-press.
  const part = turntable.children[0];
  part?.userData?.wheel?.update(dt);
  part?.userData?.power?.update(dt);
  controls.update();
});

await show(currentId);
engine.start();

window.viewer = { engine, scene, camera, turntable, show };
