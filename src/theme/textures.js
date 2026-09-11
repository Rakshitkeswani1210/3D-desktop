/**
 * textures.js — the canvas-to-texture plumbing.
 *
 * No binary assets to manage, everything is editable by changing a number, and
 * the wheel labels stay razor sharp because we control the filtering.
 *
 * Note the filtering choice differs from a pixel-art project: this is a product
 * render, so the default is LinearFilter with mipmaps and anisotropy, not
 * NearestFilter.
 */

import * as THREE from 'three';

/**
 * Make a canvas, hand it to a draw function, and return a texture.
 *
 * Returns { texture, canvas, ctx, redraw } — redraw() re-runs the draw function
 * and flags the texture, which is how the finish toggle repaints the wheel
 * labels without rebuilding any geometry.
 */
export function canvasTexture(w, h, draw, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = opts.anisotropy ?? 8;
  // Forget this and every painted colour washes out.
  tex.colorSpace = opts.colorSpace ?? THREE.SRGBColorSpace;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = opts.wrap ?? THREE.RepeatWrapping;
    tex.repeat.set(...opts.repeat);
  }
  // ExtrudeGeometry hands out WORLD-space UVs — the vertex's raw x and y —
  // rather than 0..1. A repeat of 1/size with an offset of 0.5 is what maps a
  // centred extrusion's front face onto the whole texture.
  if (opts.offset) tex.offset.set(...opts.offset);

  function redraw(fn = draw) {
    ctx.clearRect(0, 0, w, h);
    fn(ctx, w, h);
    tex.needsUpdate = true;
  }
  redraw();

  return { texture: tex, canvas, ctx, redraw };
}

/** #rrggbb string from a hex number, for canvas fills. */
export const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Deterministic noise. A seeded LCG rather than Math.random() so the device
 * looks identical on every reload and screenshots stay comparable.
 */
export function rng(seed = 7) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

/** Draw text with manual letter tracking — works without relying on ctx.letterSpacing. */
function tracked(ctx, text, cx, cy, spacing) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x, cy);
    x += widths[i] + spacing;
  }
}

/* ───────────────────────── transport glyphs ─────────────────────────
 * Drawn as paths rather than font glyphs: the ⏮ / ⏭ / ▶❙❙ characters are not
 * reliably present in system fonts, and paths stay crisp at any texture size.
 */

function triangle(ctx, x, y, s, dir) {
  ctx.beginPath();
  ctx.moveTo(x + dir * s * 0.5, y);
  ctx.lineTo(x - dir * s * 0.5, y - s * 0.58);
  ctx.lineTo(x - dir * s * 0.5, y + s * 0.58);
  ctx.closePath();
  ctx.fill();
}

function bar(ctx, x, y, w, h) {
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
}

/** |◀◀  — skip back */
function glyphPrev(ctx, x, y, s) {
  bar(ctx, x - s * 1.02, y, s * 0.2, s * 1.16);
  triangle(ctx, x - s * 0.36, y, s, -1);
  triangle(ctx, x + s * 0.52, y, s, -1);
}

/** ▶▶| — skip forward */
function glyphNext(ctx, x, y, s) {
  bar(ctx, x + s * 1.02, y, s * 0.2, s * 1.16);
  triangle(ctx, x + s * 0.36, y, s, 1);
  triangle(ctx, x - s * 0.52, y, s, 1);
}

/** ▶ ❙❙ — play / pause */
function glyphPlayPause(ctx, x, y, s) {
  triangle(ctx, x - s * 0.62, y, s, 1);
  bar(ctx, x + s * 0.44, y, s * 0.2, s * 1.16);
  bar(ctx, x + s * 0.84, y, s * 0.2, s * 1.16);
}

/**
 * The click wheel face: the disc colour, a soft radial sheen, and the four
 * printed labels.
 *
 * Mapping: RingGeometry and CircleGeometry both project UVs over the bounding
 * square of the outer radius, so this square canvas lands centred with the
 * outer edge of the wheel at the canvas edge. Canvas top = wheel top, because
 * CanvasTexture flips Y by default.
 *
 * @param {object} colors a FINISHES entry
 * @param {number} labelRadius label ring radius as a fraction of the outer radius
 */
