/**
 * shapes.js — low-level geometry helpers. Knows nothing about the device.
 */

import * as THREE from 'three';

/**
 * A rounded rectangle Shape centred on the origin, in the XY plane.
 * Used for the shell profile, the screen window and the glass.
 */
export function roundedRectShape(w, h, r) {
  const x = w / 2;
  const y = h / 2;
  const rad = Math.min(r, x, y);

  const s = new THREE.Shape();
  s.moveTo(-x + rad, -y);
  s.lineTo(x - rad, -y);
  s.absarc(x - rad, -y + rad, rad, -Math.PI / 2, 0, false);
  s.lineTo(x, y - rad);
  s.absarc(x - rad, y - rad, rad, 0, Math.PI / 2, false);
  s.lineTo(-x + rad, y);
  s.absarc(-x + rad, y - rad, rad, Math.PI / 2, Math.PI, false);
  s.lineTo(-x, -y + rad);
  s.absarc(-x + rad, -y + rad, rad, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * Split a geometry into material groups by the Z of each triangle's centroid.
 *
 * This is what lets one continuous extrusion carry both the black front panel
 * and the polished steel back with a perfectly clean line between them, instead
 * of two separate meshes that would leave a visible seam or a gap.
 *
 * @param {THREE.BufferGeometry} geo
 * @param {number[]} cuts ascending Z cut planes; n cuts produce n+1 groups,
 *        ordered back (most negative Z) to front, matching the material array.
 */
export function groupByZ(geo, cuts) {
  const pos = geo.attributes.position;
  const index = geo.getIndex();
  const triCount = (index ? index.count : pos.count) / 3;

  const vertexAt = (t, k) => (index ? index.getX(t * 3 + k) : t * 3 + k);

  // Bucket every triangle by which slab its centroid falls in.
  const buckets = Array.from({ length: cuts.length + 1 }, () => []);
  for (let t = 0; t < triCount; t++) {
    const z =
      (pos.getZ(vertexAt(t, 0)) +
        pos.getZ(vertexAt(t, 1)) +
        pos.getZ(vertexAt(t, 2))) /
      3;
    let b = 0;
    while (b < cuts.length && z > cuts[b]) b++;
    buckets[b].push(t);
  }

  // Rewrite the index so each bucket is contiguous, then one group per bucket.
  const newIndex = [];
  geo.clearGroups();
  let start = 0;
  buckets.forEach((tris, materialIndex) => {
    for (const t of tris) {
      newIndex.push(vertexAt(t, 0), vertexAt(t, 1), vertexAt(t, 2));
    }
    const count = tris.length * 3;
    if (count > 0) geo.addGroup(start, count, materialIndex);
    start += count;
  });

  geo.setIndex(newIndex);
  return geo;
}

/**
 * A rounded rectangle with a rounded rectangular HOLE through it — a frame.
 *
 * `THREE.Shape` carries a `holes` array and `ExtrudeGeometry` honours it, so a
 * monitor bezel can be a genuine frame with a window through it rather than the
 * plugged-block trick objects/Screen.js uses. That trick exists because the
 * iPod shell is a solid extrusion with nothing to cut a well into it; here the
 * bezel IS the frame, so a real opening is both simpler and cleaner.
 *
 * ExtrudeGeometry normalises hole winding itself, so no reversal is needed.
 */
export function roundedFrameShape(w, h, r, innerW, innerH, innerR, segments = 24, offset = [0, 0]) {
  const shape = roundedRectShape(w, h, r);
  const hole = roundedRectShape(innerW, innerH, innerR);
  const points = hole.getPoints(segments);
  if (offset[0] || offset[1]) {
    for (const pt of points) {
      pt.x += offset[0];
      pt.y += offset[1];
    }
  }
  shape.holes.push(new THREE.Path(points));
  return shape;
}

/**
 * Scale a geometry's cross-section as a function of position along one axis.
 *
 * ExtrudeGeometry cannot taper, and a lathe cannot do a rounded rectangle — so
 * a CRT's back shell (a rounded rect narrowing toward the neck) and a keycap
 * (a square narrowing toward the top) both come from extruding the profile and
 * then squeezing it here.
 *
 * @param {THREE.BufferGeometry} geo mutated in place
 * @param {object} o from/to positions along `axis`, and the scale at each end.
 *        `curve` reshapes the interpolation — the default is linear.
 */
export function taperGeometry(geo, { from, to, scaleFrom = 1, scaleTo = 1, axis = 'z', curve = (t) => t }) {
  const pos = geo.attributes.position;
  const span = to - from || 1;
  const get = { x: 'getX', y: 'getY', z: 'getZ' }[axis];
  // The two axes that get squeezed: everything except the one we measure along.
  const others = ['x', 'y', 'z'].filter((a) => a !== axis);

  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos[get](i) - from) / span));
    const s = scaleFrom + (scaleTo - scaleFrom) * curve(t);
    for (const a of others) {
      const g = { x: 'getX', y: 'getY', z: 'getZ' }[a];
      const st = { x: 'setX', y: 'setY', z: 'setZ' }[a];
      pos[st](i, pos[g](i) * s);
    }
  }

  pos.needsUpdate = true;
  // Normals are wrong the instant vertices move; without this the taper reads
  // as a flat band of shading rather than a surface.
  geo.computeVertexNormals();
  return geo;
}

/**
 * A plane bulged forward along +Z — the CRT's face.
 *
 * A flat plane behind a bezel reads as an LCD no matter how it is shaded. The
 * gentle spherical swell is most of what makes a tube look like a tube, and it
 * is why the picture and the glass share this geometry rather than being flat.
 */
export function bulgedPlane(w, h, bulge, segW = 48, segH = 36) {
  const geo = new THREE.PlaneGeometry(w, h, segW, segH);
  const pos = geo.attributes.position;
  const hw = w / 2;
  const hh = h / 2;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / hw;
    const ny = pos.getY(i) / hh;
    // Falls to zero at the edges, so the picture meets the bezel flush.
    pos.setZ(i, bulge * (1 - nx * nx) * (1 - ny * ny));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * A box with rounded vertical edges: extrude a rounded rect and bevel it.
 *
 * The segment counts are exposed because this builds things at wildly
 * different sizes. A monitor foot wants smooth corners; a 19 mm keycap
 * instanced 104 times does not, and at the default counts that one part costs
 * more triangles than everything else in both scenes together.
 */
export function roundedBox(w, h, d, r, bevel = 0, { curveSegments = 8, bevelSegments = 3 } = {}) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {
    depth: Math.max(0.0001, d - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    curveSegments,
  });
  // Extrude runs 0..depth in Z; centre it so the caller can think in middles.
  geo.translate(0, 0, -d / 2 + bevel);
  return geo;
}
