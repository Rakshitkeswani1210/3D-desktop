/**
 * Screen.js — the display window: black surround, blank panel, cover glass.
 *
 * Deliberately EMPTY for now. What matters is that adding a UI later needs no
 * change to the model at all: the group exposes
 *
 *     group.userData.screen.redraw((ctx, w, h) => { ... })
 *
 * and the canvas is a plain 640x480 2D context at the panel's 4:3 aspect.
 *
 * Construction note: the iPod classic front is one flat plane — the glass is
 * flush, there is no recessed screen well. The surround is a solid extruded
 * block that plugs the window, so there is no angle at which a gap can show.
 */

import * as THREE from 'three';
import { SCREEN, FACE, MOUNT, u } from '../theme/spec.js';
import { materials } from '../theme/palette.js';
import { screenTexture } from '../theme/textures.js';
import { roundedRectShape } from '../lib/shapes.js';

export const meta = {
  label: 'Screen',
  camera: { position: [u(14), u(SCREEN.centerY + 16), u(112)], target: [0, u(SCREEN.centerY), 0] },
};

export function create() {
  const group = new THREE.Group();
  group.name = 'screen';
  group.position.y = u(SCREEN.centerY);

  // ── black surround ─────────────────────────────────────────────────────
  const shape = roundedRectShape(
    u(SCREEN.windowWidth),
    u(SCREEN.windowHeight),
    u(SCREEN.cornerRadius)
  );
  const blockGeo = new THREE.ExtrudeGeometry(shape, {
    depth: u(SCREEN.blockDepth),
    bevelEnabled: false,
    curveSegments: 12,
  });
  blockGeo.translate(0, 0, u(FACE.z + MOUNT.surround - SCREEN.blockDepth));

  const block = new THREE.Mesh(blockGeo, materials.bezel);
  block.name = 'window-surround';
  group.add(block);

  // ── the panel ──────────────────────────────────────────────────────────
  // MeshBasicMaterial, not Standard: an LCD is emissive, so it must not be lit
  // by the scene. toneMapped off keeps the backlight from being crushed by the
  // ACES curve into a flat grey.
  const screen = screenTexture();
  const panelMat = new THREE.MeshBasicMaterial({
    map: screen.texture,
    toneMapped: false,
  });
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(u(SCREEN.activeWidth), u(SCREEN.activeHeight)),
    panelMat
  );
  panel.position.z = u(FACE.z + MOUNT.panel);
  panel.name = 'panel';
  group.add(panel);

  // ── cover glass ────────────────────────────────────────────────────────
  // A hair proud of the front face so it can never z-fight with it, and large
  // enough to overhang the window the way the real cover glass does.
  const glassGeo = new THREE.ShapeGeometry(
    roundedRectShape(
      u(SCREEN.windowWidth + 1.4),
      u(SCREEN.windowHeight + 1.4),
      u(SCREEN.cornerRadius + 0.7)
    ),
    12
  );
  const glass = new THREE.Mesh(glassGeo, materials.glass);
  glass.position.z = u(FACE.z + MOUNT.glass);
  glass.renderOrder = 2;
  glass.name = 'glass';
  group.add(glass);

  /** The hook a UI plugs into later. */
  group.userData.screen = {
    canvas: screen.canvas,
    ctx: screen.ctx,
    texture: screen.texture,
    /** redraw(fn) where fn is (ctx, width, height) => void */
    redraw: screen.redraw,
    width: screen.canvas.width,
    height: screen.canvas.height,
  };

  return group;
}
