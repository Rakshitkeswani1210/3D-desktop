/**
 * environment.js — the reflection map, painted in code.
 *
 * This module matters more than it looks. The back of the device is polished
 * stainless: metalness 1, roughness 0.075. A metal that smooth reflects almost
 * nothing BUT the environment, so with no env map it renders as a flat black
 * slab no matter how many lights are in the scene. Nearly everything that makes
 * this device read as a physical object comes from here rather than lighting.js.
 *
 * Painted as an equirectangular canvas and run through PMREMGenerator, so no
 * RoomEnvironment addon needs vendoring and the studio can be tinted to match
 * the aurora behind the device.
 */

import * as THREE from 'three';
import { canvasTexture } from '../theme/textures.js';
import { AURORA } from '../theme/palette.js';

/**
 * A soft elliptical light blob — one softbox in the virtual studio.
 *
 * Wraps horizontally: a blob near u=0 or u=1 straddles the seam of the
 * equirectangular map, and drawing it once would slice it in half.
 */
function blob(ctx, x, y, rx, ry, color, alpha, w) {
  const paint = (cx) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${color}, ${alpha})`);
    g.addColorStop(0.45, `rgba(${color}, ${alpha * 0.5})`);
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

/**
 * A tall, narrow strip softbox, faded out top and bottom.
 *
 * The round softboxes are wider than the entire reflection fan of a 32-degree
 * lens, so on a flat face they reflect as an even wash — lit, but shapeless.
 * A strip is narrow enough to reflect as a distinct vertical highlight that
 * travels across the panel as the device turns, which is what gives glossy
 * black and polished steel their form. These earn their keep more than any of
 * the actual lights in lighting.js.
 */
function strip(ctx, w, h, u, halfWidth, color, alpha) {
  const x = w * u;
  const bw = w * halfWidth;
  const grad = ctx.createLinearGradient(x - bw, 0, x + bw, 0);
  grad.addColorStop(0.0, `rgba(${color},0)`);
  grad.addColorStop(0.5, `rgba(${color},1)`);
  grad.addColorStop(1.0, `rgba(${color},0)`);

  const top = h * 0.05;
  const span = h * 0.58;
  const steps = 48;
  ctx.save();
  ctx.fillStyle = grad;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    ctx.globalAlpha = Math.sin(t * Math.PI) * alpha;
    ctx.fillRect(x - bw, top + t * span, bw * 2, span / steps + 1);
  }
  ctx.restore();
}

/**
 * Build the environment and attach it to the scene.
 * @returns {() => void} dispose
 */
export function createEnvironment(renderer, scene) {
  const { texture } = canvasTexture(1024, 512, (ctx, w, h) => {
    // Where things land, and why it matters:
    //
    // three samples an equirect map with u = atan2(dir.z, dir.x)/2PI + 0.5, so
    // u=0.75 is +Z and u=0.25 is -Z; v runs bottom(0) to top(1), and the canvas
    // is flipped, so canvas y=0 is straight up.
    //
    // A flat face reflects whatever lies BEHIND THE CAMERA. Viewed from the
    // front (+Z) that is u~0.75; orbit round to the back and it becomes u~0.25.
    // So the studio needs a key at BOTH, or the polished steel goes dead the
    // moment the device is turned around — which is precisely what a
    // single-key rig looks like on an object you are free to orbit.
    const KEY_FRONT = 0.73;
    const KEY_BACK = 0.23;

    // Sky-to-floor gradient. The dark horizon band is what gives a curved metal
    // back its characteristic pinched waistline.
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#4a5670');
    g.addColorStop(0.30, '#28324a');
    g.addColorStop(0.50, '#0d111b');
    g.addColorStop(0.76, '#0e131d');
    g.addColorStop(1.0, '#191e2a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // A soft band all the way around, just above the horizon: the safety net,
    // so no angle of orbit is ever completely dead.
    const band = ctx.createLinearGradient(0, h * 0.16, 0, h * 0.46);
    band.addColorStop(0.0, 'rgba(210,226,255,0)');
    band.addColorStop(0.45, 'rgba(214,229,255,0.28)');
    band.addColorStop(1.0, 'rgba(210,226,255,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, h * 0.16, w, h * 0.30);

    // Key pair: warm in front, cooler behind, each with its own strip.
    blob(ctx, w * KEY_FRONT, h * 0.27, w * 0.21, h * 0.34, '255,251,242', 0.95, w);
    blob(ctx, w * KEY_FRONT, h * 0.25, w * 0.075, h * 0.13, '255,255,255', 1.0, w);
    strip(ctx, w, h, 0.655, 0.026, '255,253,246', 0.9);

    blob(ctx, w * KEY_BACK, h * 0.29, w * 0.19, h * 0.32, '226,238,255', 0.9, w);
    blob(ctx, w * KEY_BACK, h * 0.27, w * 0.065, h * 0.12, '255,255,255', 1.0, w);
    strip(ctx, w, h, 0.155, 0.022, '236,244,255', 0.85);

    // Aurora bounce, tinted from the same palette as the backdrop so the
    // reflections agree with what is actually behind the device.
    const c2 = new THREE.Color(AURORA.c2).multiplyScalar(255);
    const c3 = new THREE.Color(AURORA.c3).multiplyScalar(255);
    blob(ctx, w * 0.97, h * 0.42, w * 0.13, h * 0.20,
      `${c2.r | 0},${c2.g | 0},${c2.b | 0}`, 0.7, w);
    blob(ctx, w * 0.46, h * 0.55, w * 0.16, h * 0.18,
      `${c3.r | 0},${c3.g | 0},${c3.b | 0}`, 0.5, w);

    // A hard horizon line: reads as a studio wall/floor join, and gives
    // polished metal a crisp linear reflection instead of a soft glow. This is
    // most of what separates "polished" from merely "shiny".
    const horizon = ctx.createLinearGradient(0, h * 0.455, 0, h * 0.5);
    horizon.addColorStop(0, 'rgba(255,255,255,0)');
    horizon.addColorStop(0.5, 'rgba(232,240,255,0.5)');
    horizon.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, h * 0.455, w, h * 0.045);
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
