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
 * The inspector uses the desk's own room lighting, so a part looks here the way
 * it looks in the scene. It used to carry a second studio rig for the iPod and
 * swap between them; with one scene left, there is nothing to swap.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { createEngine } from './core/engine.js';
import { createRoomEnvironment, createRoomLighting } from './core/room-env.js';
import { createRoomBackdrop } from './theme/room.js';
import { FRAMING } from './theme/desk-spec.js';
import { COMPONENTS, ids, byStage, load } from './registry.js';
import { disposeTree } from './lib/dispose.js';
import { SHARED_MATERIALS } from './theme/shared-materials.js';

const engine = createEngine({ canvas: document.getElementById('scene') });
const { renderer, onFrame } = engine;

const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(32, 1, 3, 1600);

/**
 * The world every part is inspected in: the desk's room environment and its
 * lighting, so a part reads here the way it reads in the scene.
 */
createRoomEnvironment(renderer, scene);
const WORLD = {
  lights: Object.values(createRoomLighting(scene)),
  backdrop: createRoomBackdrop(),
  near: 0.5,
  groundY: 0,
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
const stage = { scene, camera, backdrop: WORLD.backdrop };
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

  grid.position.y = WORLD.groundY;
  camera.near = WORLD.near;

  const mod = await load(id, fresh);
  const part = mod.create();
  turntable.add(part);
  turntable.rotation.y = 0;

  // Frame it using the component's own meta, falling back to the whole device.
  const cam = mod.meta?.camera ?? { position: FRAMING.position, target: FRAMING.target };
  camera.position.set(...cam.position);
  controls.target.set(...cam.target);

  // Orbit limits from the part's own standoff, so a keycap and a whole desk
  // both get a sensible range without either being hardcoded.
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
