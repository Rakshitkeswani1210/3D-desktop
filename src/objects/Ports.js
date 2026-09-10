/**
 * Ports.js — headphone jack and hold switch on the top face, dock connector on
 * the bottom. The details you only notice once you orbit the device.
 *
 * There is no CSG in this project, and the shell is a solid extrusion, so a
 * cylinder sunk into it would simply be hidden inside. The openings are instead
 * flat decals lying ON the surface, carrying a radial/linear gradient that does
 * the work a real cavity would (see holeTexture in theme/textures.js). Anything
 * that genuinely stands proud — the hold slider, the dock contacts — is real
 * geometry, because that reads correctly from any angle.
 *
 * Facing: ShapeGeometry and PlaneGeometry face +Z, so rotation.x = -PI/2 turns a
 * decal to face +Y (the top) and +PI/2 to face -Y (the bottom).
 */

import * as THREE from 'three';
import { BODY, PORTS, u } from '../theme/spec.js';
import { materials } from '../theme/palette.js';
import { holeTexture, slotTexture } from '../theme/textures.js';
import { roundedRectShape } from '../lib/shapes.js';

export const meta = {
  label: 'Ports',
  camera: { position: [u(8), u(76), u(96)], target: [0, u(44), 0] },
};

const TOP_Y = BODY.height / 2;
const BOTTOM_Y = -BODY.height / 2;
/** Decals float a hair off the surface so they cannot z-fight with the shell. */
const LIFT = 0.04;

function decalMaterial(map) {
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.55,
    metalness: 0.25,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export function create() {
  const group = new THREE.Group();
  group.name = 'ports';

  // ── headphone jack (top) ───────────────────────────────────────────────
  const jack = new THREE.Mesh(
    new THREE.CircleGeometry(u(PORTS.jack.radius), 48),
    decalMaterial(holeTexture(true).texture)
  );
  jack.position.set(u(PORTS.jack.x), u(TOP_Y + LIFT), 0);
  jack.rotation.x = -Math.PI / 2;
  jack.name = 'headphone-jack';
  group.add(jack);

  // ── hold switch (top) ──────────────────────────────────────────────────
  const holdWell = new THREE.Mesh(
    new THREE.ShapeGeometry(
      roundedRectShape(u(PORTS.hold.width), u(PORTS.hold.height), u(1.0)),
      8
    ),
    decalMaterial(holeTexture(false).texture)
  );
  holdWell.position.set(u(PORTS.hold.x), u(TOP_Y + LIFT), 0);
  holdWell.rotation.x = -Math.PI / 2;
  holdWell.name = 'hold-well';
  group.add(holdWell);

  // The slider is real geometry: it stands proud, so it has to read as a solid
  // from grazing angles. Parked in the unlocked position (away from the lock
  // end), which is why no orange indicator shows.
  const slider = new THREE.Mesh(
    new THREE.BoxGeometry(u(PORTS.hold.sliderWidth), u(0.55), u(2.4)),
    materials.centerButton
  );
  slider.position.set(
    u(PORTS.hold.x + (PORTS.hold.width - PORTS.hold.sliderWidth) / 2 - 0.5),
    u(TOP_Y + 0.2),
    0
  );
  slider.name = 'hold-slider';
  group.add(slider);

  // ── dock connector (bottom) ────────────────────────────────────────────
  const dock = new THREE.Mesh(
    new THREE.PlaneGeometry(u(PORTS.dock.width), u(PORTS.dock.height)),
    decalMaterial(slotTexture().texture)
  );
  dock.position.set(0, u(BOTTOM_Y - LIFT), 0);
  dock.rotation.x = Math.PI / 2;
  dock.name = 'dock-slot';
  group.add(dock);

  // 30 contacts as one InstancedMesh. Individually they would be 30 draw calls
  // for 30 slivers; this is the case instancing exists for.
  const n = PORTS.dock.contacts;
  const pitch = (PORTS.dock.width - 2.6) / (n - 1);
  const contacts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(u(0.42), u(0.14), u(1.5)),
    materials.contact,
    n
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    dummy.position.set(
      u(-(PORTS.dock.width - 2.6) / 2 + i * pitch),
      u(BOTTOM_Y - LIFT - 0.09),
      0
    );
    dummy.updateMatrix();
    contacts.setMatrixAt(i, dummy.matrix);
  }
  contacts.instanceMatrix.needsUpdate = true;
  contacts.name = 'dock-contacts';
  group.add(contacts);

  return group;
}
