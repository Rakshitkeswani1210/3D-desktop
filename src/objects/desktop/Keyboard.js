/**
 * Keyboard.js — a 104-key board, as one instanced draw.
 *
 * The keycaps are an InstancedMesh rather than 104 meshes. That is not a
 * micro-optimisation: 104 separate objects would be more draw calls than the
 * rest of both scenes put together, for the least important thing on the desk.
 *
 * The cost of instancing is that every cap shares one geometry and one
 * material, so the legends are gone. That is a deliberate trade — at the
 * distance this board is ever seen, a legend is well under a pixel, and buying
 * them back would mean per-instance UV offsets and a patched shader for
 * something nobody can read.
 *
 * The layout below is written in KEY UNITS (1u = 19.05 mm, the real pitch), so
 * it reads like a keyboard layout rather than a list of millimetres. A negative
 * width is a gap, which is how the function-row and nav-cluster spacing is
 * expressed without a second concept.
 */

import * as THREE from 'three';
import { KEYBOARD, u } from '../../theme/desk-spec.js';
import { materials, ledMaterial } from '../../theme/desk-palette.js';
import { roundedBox, taperGeometry } from '../../lib/shapes.js';

export const meta = {
  label: 'Keyboard',
  camera: { position: [u(60), u(320), u(430)], target: [0, 0, 0] },
};

/** The main block, front row last. `-n` means a gap of n units. */
const MAIN_ROWS = [
  [1, -1, 1, 1, 1, 1, -0.5, 1, 1, 1, 1, -0.5, 1, 1, 1, 1, -0.5, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
];

/** Nav cluster and arrows: [rowIndex, columnOffset, width] from x = 15.5u. */
const NAV = [
  [1, 0, 1], [1, 1, 1], [1, 2, 1],
  [2, 0, 1], [2, 1, 1], [2, 2, 1],
  [4, 1, 1],
  [5, 0, 1], [5, 1, 1], [5, 2, 1],
];

/** Numpad, from x = 19.5u. The tall keys are handled by the depth column. */
const PAD = [
  [1, 0, 1, 1], [1, 1, 1, 1], [1, 2, 1, 1], [1, 3, 1, 1],
  [2, 0, 1, 1], [2, 1, 1, 1], [2, 2, 1, 1], [2, 3, 1, 2],
  [3, 0, 1, 1], [3, 1, 1, 1], [3, 2, 1, 1],
  [4, 0, 1, 1], [4, 1, 1, 1], [4, 2, 1, 1], [4, 3, 1, 2],
  [5, 0, 2, 1], [5, 2, 1, 1],
];

export function create() {
  const group = new THREE.Group();
  group.name = 'keyboard';

  const { width, depth, frontHeight, backHeight, unit, keyGap, keyHeight } = KEYBOARD;

  /* ── the deck ──────────────────────────────────────────────────────── */

  // Built as a flat-topped box, then sheared into a wedge: every top vertex is
  // scaled down toward the front, which rakes the whole deck without needing a
  // second geometry or a rotation that would tip the keys off it.
  const deckGeo = roundedBox(u(width), u(depth), u(backHeight), u(KEYBOARD.radius), u(2));
  deckGeo.rotateX(-Math.PI / 2);
  deckGeo.translate(0, u(backHeight / 2), 0);

  const pos = deckGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) * rakeAt(pos.getZ(i)) / u(backHeight));
  }
  pos.needsUpdate = true;
  deckGeo.computeVertexNormals();

  const deck = new THREE.Mesh(deckGeo, materials.graphite);
  deck.name = 'deck';
  group.add(deck);

  /** Height of the deck's top surface at a given z, in scene units. */
  function rakeAt(z) {
    const t = Math.min(1, Math.max(0, (z + u(depth) / 2) / u(depth)));
    return u(backHeight) + (u(frontHeight) - u(backHeight)) * t;
  }

  /* ── the keys ──────────────────────────────────────────────────────── */

  // Deliberately coarse. This geometry is instanced 104 times, and at the
  // default segment counts the keyboard alone costs more triangles than
  // everything else on the desk put together — for corners under a millimetre.
  const capGeo = roundedBox(
    u(unit - keyGap), u(unit - keyGap), u(keyHeight), u(KEYBOARD.keyRadius), u(0.5),
    { curveSegments: 2, bevelSegments: 1 }
  );
  capGeo.rotateX(-Math.PI / 2);
  capGeo.translate(0, u(keyHeight / 2), 0);
  // Keycaps are not boxes: the top is smaller than the base. That taper is
  // where all of a keyboard's highlights come from at this distance.
  taperGeometry(capGeo, {
    axis: 'y', from: 0, to: u(keyHeight), scaleFrom: 1, scaleTo: 0.82,
  });

  const keys = layout();
  const caps = new THREE.InstancedMesh(capGeo, materials.keycap, keys.length);
  caps.name = 'keycaps';

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();

  keys.forEach((k, i) => {
    // A 2u-tall key (numpad + and Enter) spans two rows, so its centre sits
    // half a row further forward than the row it is indexed by.
    const z = u(
      -depth / 2 + 16 + k.row * unit + (k.row >= 1 ? 8 : 0) + (unit * k.d) / 2
    );
    p.set(u(k.x), rakeAt(z), z);
    // Wide keys are scaled, not remodelled — the cap profile is the same shape
    // whether it is 1u or 6.25u wide.
    s.set(
      (u(k.w * unit - keyGap)) / (u(unit - keyGap)),
      1,
      (u(k.d * unit - keyGap)) / (u(unit - keyGap))
    );
    m.compose(p, q, s);
    caps.setMatrixAt(i, m);
  });
  caps.instanceMatrix.needsUpdate = true;
  group.add(caps);

  /* ── the indicator lights ──────────────────────────────────────────── */

  const ledMat = ledMaterial(0x51ff8a);
  const ledGeo = new THREE.SphereGeometry(u(2.2), 12, 8);
  ledGeo.scale(1, 0.5, 1);
  const lights = new THREE.InstancedMesh(ledGeo, ledMat, 3);
  lights.name = 'indicators';
  for (let i = 0; i < 3; i++) {
    const z = u(-depth / 2 + 8);
    m.compose(p.set(u(width / 2 - 58 + i * 16), rakeAt(z) + u(0.4), z), q, s.set(1, 1, 1));
    lights.setMatrixAt(i, m);
  }
  lights.instanceMatrix.needsUpdate = true;
  group.add(lights);

  group.userData.keyboard = {
    /** Num/Caps/Scroll come up with the machine. */
    setLamp(v) {
      ledMat.emissiveIntensity = v * 1.8;
    },
  };
  group.userData.keyboard.setLamp(0);

  return group;
}

/**
 * Flatten the three blocks into one list of {row, x, w, d} in key units,
 * with x already converted to millimetres from the board's centre.
 *
 * The block is CENTRED on the deck rather than started at a fixed margin. Key
 * pitch and deck width are two independent numbers in the spec, and a fixed
 * left margin quietly makes them disagree — raise the pitch and the numpad
 * walks off the right-hand edge while the left margin stays put. Measuring the
 * block and centring it means any pair of values lands correctly, and the
 * margin becomes a consequence rather than a third number to keep in sync.
 */
function layout() {
  const { unit, width } = KEYBOARD;

  // How wide the whole block is, in key units — measured from the layout data
  // rather than written down, so adding a key cannot invalidate it.
  const span = Math.max(
    ...MAIN_ROWS.map((row) => row.reduce((a, e) => a + Math.abs(e), 0)),
    ...NAV.map(([, col, w]) => 15.5 + col + w),
    ...PAD.map(([, col, w]) => 19.5 + col + w)
  );

  const left = -(span * unit) / 2;
  const keys = [];
  const push = (row, xUnits, w, d = 1) =>
    keys.push({ row, x: left + (xUnits + w / 2) * unit, w, d });

  MAIN_ROWS.forEach((row, r) => {
    let x = 0;
    for (const entry of row) {
      if (entry < 0) {
        x += -entry;
        continue;
      }
      push(r, x, entry);
      x += entry;
    }
  });

  for (const [row, col, w] of NAV) push(row, 15.5 + col, w);
  for (const [row, col, w, d] of PAD) push(row, 19.5 + col, w, d);

  return keys;
}
