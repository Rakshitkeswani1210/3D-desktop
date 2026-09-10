/**
 * textures.js — every texture in the project is drawn in code on a <canvas>.
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
export function wheelTexture(colors, labelRadius) {
  return canvasTexture(1024, 1024, (ctx, w, h) =>
    drawWheelFace(ctx, w, h, colors, labelRadius)
  );
}

/** The wheel face itself, so a finish change is a repaint, not a rebuild. */
export function drawWheelFace(ctx, w, h, colors, labelRadius) {
  {
    const c = w / 2;
    const R = w / 2;

    // Base disc, with a faint sheen that lifts the outer edge. The real wheel
    // is matte plastic, so this stays very subtle.
    const g = ctx.createRadialGradient(c, c * 0.82, R * 0.1, c, c, R);
    const base = new THREE.Color(colors.wheel);
    const lit = base.clone().multiplyScalar(1.11);
    const dim = base.clone().multiplyScalar(0.93);
    g.addColorStop(0.0, `#${lit.getHexString()}`);
    g.addColorStop(0.62, `#${base.getHexString()}`);
    g.addColorStop(1.0, `#${dim.getHexString()}`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Very fine concentric grain, deterministic.
    const rand = rng(19);
    ctx.globalAlpha = 0.035;
    ctx.strokeStyle = '#ffffff';
    for (let i = 0; i < 90; i++) {
      ctx.lineWidth = 0.6 + rand() * 1.2;
      ctx.beginPath();
      ctx.arc(c, c, R * (0.06 + rand() * 0.94), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // The recess, baked in. The wheel is mounted a fraction of a millimetre
    // PROUD of the front face rather than sunk into it (there is no CSG to cut
    // a well with — see MOUNT in theme/spec.js), so the depth you read is
    // painted: a contact shadow tight against the outer edge, plus a darker
    // crescent at the top where a real recess wall would shade the surface and
    // a matching bright one at the bottom where it would catch the key light.
    const ring = ctx.createRadialGradient(c, c, R * 0.86, c, c, R);
    ring.addColorStop(0.0, 'rgba(0,0,0,0)');
    ring.addColorStop(0.72, 'rgba(0,0,0,0.20)');
    ring.addColorStop(1.0, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = ring;
    ctx.fillRect(0, 0, w, h);

    const wall = ctx.createLinearGradient(0, c - R, 0, c + R);
    wall.addColorStop(0.00, 'rgba(0,0,0,0.30)');
    wall.addColorStop(0.35, 'rgba(0,0,0,0)');
    wall.addColorStop(0.72, 'rgba(255,255,255,0)');
    wall.addColorStop(1.00, 'rgba(255,255,255,0.13)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Labels.
    const lr = R * labelRadius;
    ctx.fillStyle = hex(colors.labelInk);
    ctx.textBaseline = 'middle';
    ctx.font = '600 52px "Helvetica Neue", Helvetica, Arial, sans-serif';
    tracked(ctx, 'MENU', c, c - lr, 7);

    const s = 30;
    glyphPrev(ctx, c - lr, c, s);
    glyphNext(ctx, c + lr, c, s);
    glyphPlayPause(ctx, c, c + lr, s);
  }
}

/**
 * The display. Deliberately blank for now — a backlit panel with nothing on it.
 *
 * The returned redraw() takes a draw function, so a UI can be dropped in later
 * with screen.redraw((ctx, w, h) => { ... }) and no change to the model.
 */
export function screenTexture() {
  return canvasTexture(640, 480, blankScreen);
}

export function blankScreen(ctx, w, h) {
  // Backlight: a barely-there vertical wash, brighter at the top, the way an
  // unlit LCD looks when the panel is powered but showing nothing.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, '#0b0e14');
  g.addColorStop(0.45, '#06080c');
  g.addColorStop(1.0, '#030507');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Slight corner bleed, which is what stops it reading as a flat black rect.
  const b = ctx.createRadialGradient(w / 2, h * 0.1, 0, w / 2, h * 0.1, w * 0.8);
  b.addColorStop(0, 'rgba(120,160,220,0.07)');
  b.addColorStop(1, 'rgba(120,160,220,0)');
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, w, h);
}

/**
 * The etched marking on the stainless back — matte text on a mirror.
 *
 * Painted onto a transparent canvas used on a thin plane sitting just outside
 * the back face; the alpha is the etch. Deliberately generic product text: no
 * attempt to reproduce anyone's logo mark.
 */
export function backEtchTexture(colors) {
  return canvasTexture(1024, 1024, (ctx, w, h) => drawBackEtch(ctx, w, h, colors));
}

/** The etched marking, as a draw function so the finish toggle can repaint it. */
export function drawBackEtch(ctx, w, h, colors) {
  {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = hex(colors.etchInk);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.globalAlpha = 0.75;
    ctx.font = '300 74px "Helvetica Neue", Helvetica, Arial, sans-serif';
    tracked(ctx, 'iPod classic', w / 2, h * 0.44, 2);

    ctx.globalAlpha = 0.45;
    ctx.font = '400 30px "Helvetica Neue", Helvetica, Arial, sans-serif';
    tracked(ctx, '160GB', w / 2, h * 0.53, 5);

    ctx.globalAlpha = 0.3;
    ctx.font = '400 19px "Helvetica Neue", Helvetica, Arial, sans-serif';
    tracked(ctx, 'DESIGNED IN CALIFORNIA  ASSEMBLED IN CHINA', w / 2, h * 0.71, 1.5);
    tracked(ctx, 'MODEL No. A1238   EMC 2172', w / 2, h * 0.745, 1.5);
    ctx.globalAlpha = 1;
  }
}

/**
 * A port opening, faked.
 *
 * The shell is a solid extrusion and there is no CSG here, so a cylinder sunk
 * into it would simply be hidden. Instead the openings are flat decals sitting
 * on the surface, and this radial gradient — dark in the middle, lifting toward
 * a bright chamfer at the rim — is what sells them as holes.
 */
export function holeTexture(round = true) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c * 0.88, 0, c, c, c);
    g.addColorStop(0.00, '#000000');
    g.addColorStop(0.55, '#050506');
    g.addColorStop(0.80, '#1b1c1f');
    g.addColorStop(0.93, '#6e7176');
    g.addColorStop(1.00, '#2a2c30');
    ctx.fillStyle = g;
    if (round) {
      ctx.beginPath();
      ctx.arc(c, c, c, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, w, h);
    }
  });
}

/** A long, shallow slot opening — the dock connector cavity. */
export function slotTexture() {
  return canvasTexture(512, 96, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.00, '#3a3c41');
    g.addColorStop(0.14, '#0d0e10');
    g.addColorStop(0.55, '#000000');
    g.addColorStop(0.88, '#0a0b0d');
    g.addColorStop(1.00, '#2c2e32');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
