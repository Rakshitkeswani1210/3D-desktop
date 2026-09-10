/**
 * room-env.js — the desk scene's reflection map.
 *
 * A separate module from core/environment.js rather than a parameter on it.
 * That file is tuned to a hair for the iPod's polished stainless back — two
 * opposed keys so the metal never goes dead as you orbit, strip softboxes
 * narrow enough to reflect as distinct highlights — and none of that applies
 * here. Nothing in the desk scene is a mirror, the camera never orbits, and
 * what this map has to do is much simpler: put a warm lamp on one side of every
 * matte plastic surface and a cool fill on the other, so a bezel has a readable
 * gradient across it instead of one flat value.
 *
 * The one surface that genuinely reflects is the CRT's cover glass, and it is
 * the reason the lamp here is a defined shape rather than a wash: a dead tube
 * shows you the room, and a shapeless room makes the screen look like a hole.
 */

import * as THREE from 'three';
import { canvasTexture } from '../theme/textures.js';
import { ROOM } from '../theme/desk-palette.js';

/** A soft elliptical source. Wraps at the equirect seam, as in environment.js. */
function blob(ctx, x, y, rx, ry, color, alpha, w) {
  const paint = (cx) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${color}, ${alpha})`);
    g.addColorStop(0.5, `rgba(${color}, ${alpha * 0.45})`);
    g.addColorStop(1, `rgba(${color}, 0)`);
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  paint(x);
  if (x + rx > w) paint(x - w);
  if (x - rx < 0) paint(x + w);
}

const rgb = (hexColor) => {
  const c = new THREE.Color(hexColor).multiplyScalar(255);
  return `${c.r | 0},${c.g | 0},${c.b | 0}`;
};

/**
 * Build the room environment and attach it to a scene.
 * @returns {() => void} dispose
 */
export function createRoomEnvironment(renderer, scene) {
  const { texture } = canvasTexture(1024, 512, (ctx, w, h) => {
    // three samples equirect with u = atan2(dir.z, dir.x)/2PI + 0.5, so u=0.75
    // is +Z (behind the camera, which sits on +Z) and u=0.25 is -Z (the wall).
    // Canvas y=0 is straight up.

    // Ceiling to floor. Dark throughout — this is a dim room.
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#2b2a30');
    g.addColorStop(0.34, '#191922');
    g.addColorStop(0.52, '#0b0c11');
    g.addColorStop(1.0, '#0a0a0d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // The lamp. Behind and to the LEFT of the camera, which puts it at u a
    // little past 0.75 — the same place desk-textures.js paints its pool.
    blob(ctx, w * 0.82, h * 0.22, w * 0.17, h * 0.30, rgb(ROOM.lamp), 0.95, w);
    blob(ctx, w * 0.82, h * 0.19, w * 0.055, h * 0.10, '255,255,255', 1.0, w);

    // A cold window opposite, so the shadow side of every bezel still has a
    // value rather than going to flat black.
    blob(ctx, w * 0.30, h * 0.30, w * 0.15, h * 0.28, rgb(ROOM.window), 0.42, w);

    // The desk itself bounces a warm band back up under everything.
    const bounce = ctx.createLinearGradient(0, h * 0.52, 0, h * 0.74);
    bounce.addColorStop(0.0, 'rgba(196,142,88,0)');
    bounce.addColorStop(0.4, 'rgba(196,142,88,0.20)');
    bounce.addColorStop(1.0, 'rgba(196,142,88,0)');
    ctx.fillStyle = bounce;
    ctx.fillRect(0, h * 0.52, w, h * 0.22);

    // The horizon where wall meets ceiling. The one hard edge in the map, and
    // what gives the CRT's dead glass a line to reflect instead of a smear.
    const horizon = ctx.createLinearGradient(0, h * 0.44, 0, h * 0.50);
    horizon.addColorStop(0, 'rgba(255,255,255,0)');
    horizon.addColorStop(0.5, 'rgba(226,214,196,0.22)');
    horizon.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, h * 0.44, w, h * 0.06);
  }, { colorSpace: THREE.SRGBColorSpace });

  texture.mapping = THREE.EquirectangularReflectionMapping;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(texture);

  scene.environment = envRT.texture;

  texture.dispose();
  pmrem.dispose();

  return function dispose() {
    scene.environment = null;
    envRT.dispose();
  };
}

/**
 * The lights.
 *
 * Half the rig of lighting.js, because half of it was there to travel
 * highlights across a mirror as it turned. Nothing here turns.
 */
export function createRoomLighting(scene) {
  const hemi = new THREE.HemisphereLight(0x8fa4c8, 0x201810, 0.55);

  // The lamp: high, left, warm, and strong enough to be the obvious source.
  const lamp = new THREE.DirectionalLight(0xffd2a0, 2.3);
  lamp.position.set(-9, 11, 5);

  // Cool fill from the right, opening the shadow side without flattening it.
  const fill = new THREE.DirectionalLight(0x9dbdf0, 0.55);
  fill.position.set(10, 3, 6);

  // A rim from behind, so the tower's dark shell separates from the dark wall.
  // Without this the graphite silhouette merges into the background entirely.
  const rim = new THREE.DirectionalLight(0xc9d8f5, 1.1);
  rim.position.set(4, 7, -9);

  scene.add(hemi, lamp, fill, rim);
  return { hemi, lamp, fill, rim };
}
