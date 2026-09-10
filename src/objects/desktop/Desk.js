/**
 * Desk.js — the surface everything stands on, and the wall behind it.
 *
 * The desk is two pieces on purpose. The slab is a plain box for its edges and
 * underside; the top is a separate plane carrying the wood texture. That split
 * exists because ExtrudeGeometry and BoxGeometry hand out UVs in world units,
 * not 0..1, so a single mapped box would need its repeat rescaled every time
 * the desk changed size. A plane's UVs are 0..1 by definition, and the texture
 * is drawn at the desk's real proportions in desk-textures.js.
 *
 * The top also carries the CONTACT SHADOWS. There is no shadow map in this
 * project, so those painted ellipses are the only thing putting the monitor,
 * tower and keyboard on the desk rather than above it.
 */

import * as THREE from 'three';
import { DESK, MOUNT, u } from '../../theme/desk-spec.js';
import { COLORS, mapped } from '../../theme/desk-palette.js';
import { woodTexture, wallTexture } from '../../theme/desk-textures.js';

export const meta = {
  label: 'Desk',
  camera: { position: [u(0), u(700), u(1100)], target: [0, 0, 0] },
};

export function create() {
  const group = new THREE.Group();
  group.name = 'desk';

  // ── the slab ───────────────────────────────────────────────────────────
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(u(DESK.width), u(DESK.thickness), u(DESK.depth)),
    new THREE.MeshStandardMaterial({
      color: COLORS.wood,
      roughness: 0.5,
      metalness: 0.0,
      envMapIntensity: 0.45,
    })
  );
  slab.position.y = -u(DESK.thickness / 2);
  slab.name = 'desk-slab';
  group.add(slab);

  // ── the top ────────────────────────────────────────────────────────────
  const wood = woodTexture();
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(u(DESK.width), u(DESK.depth)),
    mapped(wood.texture, { roughness: 0.42, envMapIntensity: 0.55 })
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = u(MOUNT.decal);
  top.name = 'desk-top';
  group.add(top);

  // ── the wall ───────────────────────────────────────────────────────────
  // Wide enough that its edges never enter frame; room.js fills anything past
  // it. Lit almost entirely by its own texture rather than by the lights,
  // because a matte wall this far from a directional key is otherwise flat.
  const wall = wallTexture();
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(u(DESK.width * 2.4), u(DESK.wallHeight)),
    mapped(wall.texture, { roughness: 0.96, envMapIntensity: 0.3 })
  );
  back.position.set(0, u(DESK.wallHeight / 2 - DESK.thickness * 4), u(DESK.wallZ));
  back.name = 'wall';
  group.add(back);

  return group;
}
