/**
 * Body.js — the shell: one extrusion carrying two finishes.
 *
 * The pillowed edge in the reference side view is a bevelled extrusion, not a
 * box with rounded corners. And rather than model the black front and the steel
 * back as two meshes (which always leaves either a visible step or a hairline
 * gap along the rim), this is a SINGLE continuous surface whose triangles are
 * split into two material groups at BODY.seamZ. The seam is a material change,
 * so it is perfectly clean at every angle.
 *
 * Knows how to build itself and nothing else — it has no idea where it sits or
 * what is mounted on it.
 */

import * as THREE from 'three';
import { BODY, BACK_Z, u } from '../theme/spec.js';
import { materials, current } from '../theme/palette.js';
import { backEtchTexture, drawBackEtch } from '../theme/textures.js';
import { roundedRectShape, groupByZ } from '../lib/shapes.js';

export const meta = {
  label: 'Body',
  camera: { position: [u(48), u(28), u(228)], target: [0, 0, 0] },
};

export function create() {
  const group = new THREE.Group();
  group.name = 'body';

  // ── shell ──────────────────────────────────────────────────────────────
  const shape = roundedRectShape(
    u(BODY.width - 2 * BODY.bevelSize),
    u(BODY.height - 2 * BODY.bevelSize),
    u(BODY.cornerRadius - BODY.bevelSize)
  );

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: u(BODY.depth - 2 * BODY.bevelThickness),
    bevelEnabled: true,
    bevelThickness: u(BODY.bevelThickness),
    bevelSize: u(BODY.bevelSize),
    bevelOffset: 0,
    bevelSegments: BODY.bevelSegments,
    curveSegments: BODY.curveSegments,
  });

  // Extrude runs from -bevelThickness to depth+bevelThickness; recentre it so
  // the body straddles z = 0 and the flat front cap lands on FACE.z.
  geo.translate(0, 0, u(-BODY.depth / 2 + BODY.bevelThickness));
  geo.computeVertexNormals();

  // Group 0 = everything behind the seam (steel), group 1 = in front (panel).
  groupByZ(geo, [u(BODY.seamZ)]);

  const shell = new THREE.Mesh(geo, [materials.steel, materials.frontPanel]);
  shell.name = 'shell';
  group.add(shell);

  // ── etched marking on the steel back ───────────────────────────────────
  // A thin plane rather than geometry: the etch is a roughness/colour change,
  // not a depression you could ever see at this scale.
  const etch = backEtchTexture(current());
  const etchMat = new THREE.MeshStandardMaterial({
    map: etch.texture,
    transparent: true,
    metalness: 0.55,
    roughness: 0.62,
    // The plane sits a hair outside the back face; polygonOffset guarantees it
    // wins the depth test regardless of precision at this camera distance.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const etchMesh = new THREE.Mesh(new THREE.PlaneGeometry(u(54), u(54)), etchMat);
  etchMesh.position.set(0, u(2), u(BACK_Z - 0.05));
  etchMesh.rotation.y = Math.PI; // face -Z, out of the back
  etchMesh.name = 'back-etch';
  group.add(etchMesh);

  // Finish changes repaint the existing canvas — the texture and material
  // instances never change, so nothing needs disposing.
  group.userData.setFinish = (colors) => {
    etch.redraw((ctx, w, h) => drawBackEtch(ctx, w, h, colors));
  };

  return group;
}
