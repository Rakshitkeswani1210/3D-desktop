/**
 * desk-textures.js — every surface in the desktop scene, drawn in code.
 *
 * Same rule as theme/textures.js, whose canvasTexture/hex/rng this reuses: no
 * binary assets, so every mark on every surface is a number you can change.
 *
 * The one thing here that is doing more work than it looks is the desk: with
 * shadow mapping off there is nothing to ground the three objects on it, so the
 * contact shadows are PAINTED into the wood, from the same spec numbers that
 * position the objects. Move the tower in desk-spec.js and its shadow moves
 * with it.
 */

import * as THREE from 'three';
import { canvasTexture, hex, rng } from './textures.js';
import { COLORS } from './desk-palette.js';
import { DESK, MONITOR, TOWER, KEYBOARD, PICTURE } from './desk-spec.js';

/* ────────────────────────────── the desk ──────────────────────────────── */

/**
 * Satin oak, a lamp pool, and the contact shadows.
 *
 * Mapped over the whole desk top, so canvas x runs left-to-right across
 * DESK.width and canvas y runs BACK-to-FRONT across DESK.depth (a plane rotated
 * flat puts its v axis along -Z, and CanvasTexture flips v, which cancels out).
 */
export function woodTexture() {
  return canvasTexture(2048, 1024, (ctx, w, h) => {
    const mm = { x: (v) => ((v + DESK.width / 2) / DESK.width) * w,
                 z: (v) => ((v + DESK.depth / 2) / DESK.depth) * h,
                 sx: (v) => (v / DESK.width) * w,
                 sz: (v) => (v / DESK.depth) * h };

    ctx.fillStyle = hex(COLORS.wood);
    ctx.fillRect(0, 0, w, h);

    const rand = rng(41);

    // Planks running left to right, i.e. seams parallel to the front edge.
    const planks = 5;
    for (let i = 0; i < planks; i++) {
      const y0 = (i / planks) * h;
      const ph = h / planks;
      // Each plank a slightly different board.
      ctx.fillStyle = `rgba(${rand() < 0.5 ? '255,236,208' : '40,22,10'},${0.02 + rand() * 0.045})`;
      ctx.fillRect(0, y0, w, ph);
      // The seam itself: a dark line with a light chamfer under it.
      ctx.fillStyle = 'rgba(20,10,4,0.5)';
      ctx.fillRect(0, y0, w, 2.5);
      ctx.fillStyle = 'rgba(255,224,180,0.06)';
      ctx.fillRect(0, y0 + 2.5, w, 2);
    }

    // Grain. Long, low-amplitude waves along the plank, never straight lines.
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 620; i++) {
      const y = rand() * h;
      const amp = 1.5 + rand() * 7;
      const period = 300 + rand() * 900;
      const phase = rand() * Math.PI * 2;
      ctx.strokeStyle = rand() < 0.62
        ? `rgba(46,26,12,${0.05 + rand() * 0.16})`
        : `rgba(214,168,116,${0.03 + rand() * 0.09})`;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const yy = y + Math.sin((x / period) * Math.PI * 2 + phase) * amp;
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // A few knots, to break the regularity.
    for (let i = 0; i < 5; i++) {
      const kx = rand() * w;
      const ky = rand() * h;
      const kr = 14 + rand() * 26;
      const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
      g.addColorStop(0, 'rgba(38,20,8,0.55)');
      g.addColorStop(0.55, 'rgba(60,34,14,0.22)');
      g.addColorStop(1, 'rgba(60,34,14,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(kx, ky, kr, kr * 0.55, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // The lamp's pool: warm, off to the left and toward the back.
    const pool = ctx.createRadialGradient(
      w * 0.24, h * 0.3, 0,
      w * 0.24, h * 0.3, w * 0.62
    );
    pool.addColorStop(0.0, 'rgba(255,214,158,0.34)');
    pool.addColorStop(0.45, 'rgba(255,198,140,0.13)');
    pool.addColorStop(1.0, 'rgba(255,198,140,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, w, h);

    // Falloff toward the front edge and the far corners, so the desk does not
    // read as an evenly lit plane running off to infinity.
    const fade = ctx.createLinearGradient(0, h * 0.35, 0, h);
    fade.addColorStop(0, 'rgba(4,4,8,0)');
    fade.addColorStop(1, 'rgba(4,4,8,0.55)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);

    /**
     * Contact shadows.
     *
     * With no shadow map, this is the only thing telling you these objects are
     * ON the desk rather than hovering a centimetre above it. Two layers each:
     * a wide soft ambient occlusion, and a tight near-black core right at the
     * footprint edge — the tight one is what actually sells the contact.
     */
    const contact = (cx, cz, halfW, halfD, spread) => {
      const w2 = mm.sx(halfW);
      const d2 = mm.sz(halfD);
      const draw = (grow, alpha) => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0.0, `rgba(2,2,4,${alpha})`);
        g.addColorStop(0.55, `rgba(2,2,4,${alpha * 0.6})`);
        g.addColorStop(1.0, 'rgba(2,2,4,0)');
        ctx.save();
        ctx.translate(mm.x(cx), mm.z(cz));
        // The lamp is up and to the left, so shadows fall right and forward.
        ctx.translate(mm.sx(grow * 5), mm.sz(grow * 4));
        ctx.scale(w2 * grow, d2 * grow);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      draw(spread, 0.30);
      draw(1.06, 0.72);
    };

    // The monitor's shadow goes under its FOOT, which sits well back of the
    // glass — see MONITOR.standZ.
    contact(MONITOR.x, MONITOR.z + MONITOR.standZ, MONITOR.standWidth / 2, MONITOR.standDepth / 2, 2.1);
    contact(TOWER.x, TOWER.z, TOWER.width / 2, TOWER.depth / 2, 1.7);
    contact(KEYBOARD.x, KEYBOARD.z, KEYBOARD.width / 2, KEYBOARD.depth / 2, 1.5);
  });
}

/** The wall: a flat wash with the lamp falling across it. */
export function wallTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = hex(COLORS.wall);
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createRadialGradient(w * 0.24, h * 0.66, 0, w * 0.24, h * 0.66, w * 0.92);
    g.addColorStop(0.0, 'rgba(255,206,150,0.62)');
    g.addColorStop(0.35, 'rgba(255,198,142,0.30)');
    g.addColorStop(0.7, 'rgba(255,190,136,0.09)');
    g.addColorStop(1.0, 'rgba(255,196,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Bottom of the wall is in shadow behind the desk.
    const floor = ctx.createLinearGradient(0, h * 0.62, 0, h);
    floor.addColorStop(0, 'rgba(0,0,0,0)');
    floor.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, w, h);

    // Emulsion tooth, so the wall is not a flat gradient.
    const rand = rng(77);
    ctx.globalAlpha = 0.035;
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
    ctx.globalAlpha = 1;
  });
}

/* ────────────────────────── the tower's front ─────────────────────────── */

/**
 * An optical drive bay front: the dark face, the tray seam, an eject button and
 * an activity LED. Drawn as one decal rather than modelled, because at this
 * scale the geometry would be four meshes to say what a gradient already says.
 */
export function bayTexture(label) {
  return canvasTexture(512, 142, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    // The bay opening is darker at the top, where the shell overhangs it.
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#0a0b0c');
    g.addColorStop(0.12, '#1e2023');
    g.addColorStop(0.5, '#26282c');
    g.addColorStop(0.92, '#17181b');
    g.addColorStop(1.0, '#050506');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // The tray seam, low and off-centre the way a real one sits.
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(w * 0.04, h * 0.60, w * 0.92, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(w * 0.04, h * 0.60 + 4, w * 0.92, 2);

    // Eject button.
    ctx.fillStyle = '#3a3d42';
    ctx.fillRect(w * 0.855, h * 0.30, w * 0.075, h * 0.20);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(w * 0.855, h * 0.30, w * 0.075, 3);

    // Activity LED, dark — it only lights when something is reading.
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath();
    ctx.arc(w * 0.80, h * 0.40, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(190,196,204,0.55)';
    ctx.font = '600 20px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(label, w * 0.06, h * 0.36);
  });
}

/** The floppy / media slot: a shallow letterbox with a lit chamfer. */
export function mediaSlotTexture() {
  return canvasTexture(512, 64, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.00, '#2e3136');
    g.addColorStop(0.16, '#08090a');
    g.addColorStop(0.55, '#000000');
    g.addColorStop(0.86, '#0b0c0e');
    g.addColorStop(1.00, '#33363b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/**
 * The recessed panel the power button sits in.
 *
 * There is no CSG, so the panel is not actually sunk into the bezel — the
 * recess is painted: a dark wall along the top where a real one would shade,
 * a bright one along the bottom where it would catch the lamp. Same trick the
 * iPod's click wheel uses, for the same reason.
 */
export function frontPanelTexture() {
  return canvasTexture(512, 320, (ctx, w, h) => {
    ctx.fillStyle = hex(COLORS.silver);
    ctx.fillRect(0, 0, w, h);

    const shade = ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0.00, 'rgba(0,0,0,0.42)');
    shade.addColorStop(0.22, 'rgba(0,0,0,0.06)');
    shade.addColorStop(0.70, 'rgba(255,255,255,0.02)');
    shade.addColorStop(1.00, 'rgba(255,255,255,0.20)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);

    // A hairline all the way round, where the moulding meets the bezel.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);

    ctx.fillStyle = 'rgba(70,74,80,0.75)';
    ctx.font = '600 17px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DIMENSION', w / 2, h * 0.84);
  });
}

/** The power button cap: a domed circle with the standard power mark. */
export function powerCapTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const c = w / 2;

    const g = ctx.createRadialGradient(c, c * 0.7, c * 0.05, c, c, c);
    g.addColorStop(0.0, '#e6e8ea');
    g.addColorStop(0.62, '#c9cccf');
    g.addColorStop(0.92, '#a7abb1');
    g.addColorStop(1.0, '#7e8288');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();

    // The IEC power mark: a broken ring with a bar through the gap.
    ctx.strokeStyle = 'rgba(58,62,68,0.85)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(c, c, c * 0.34, -Math.PI * 0.36, Math.PI * 1.36);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c, c - c * 0.46);
    ctx.lineTo(c, c - c * 0.10);
    ctx.stroke();
  });
}

/** A vent: horizontal louvres, each with its own shadow. */
export function ventTexture(rows = 7) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = hex(COLORS.silver);
    ctx.fillRect(0, 0, w, h);
    const pitch = h / rows;
    for (let i = 0; i < rows; i++) {
      const y = i * pitch + pitch * 0.22;
      const bh = pitch * 0.5;
      const g = ctx.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0.0, '#000000');
      g.addColorStop(0.6, '#0d0e10');
      g.addColorStop(1.0, '#4a4e54');
      ctx.fillStyle = g;
      ctx.fillRect(w * 0.03, y, w * 0.94, bh);
    }
  });
}

/** The oval badge on the lower bezel. Generic product text, no trademarks. */
export function badgeTexture(text = 'DIMENSION') {
  return canvasTexture(512, 200, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#f2f4f6');
    g.addColorStop(0.5, '#c3c7cc');
    g.addColorStop(1.0, '#8f949b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.46, h * 0.40, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#3d4148';
    ctx.font = '600 44px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + 2);
  });
}

/* ─────────────────────────────── the CRT ──────────────────────────────── */

/**
 * The picture.
 *
 * Exposes the same handle as the iPod's screen — `redraw(fn)` with a plain 2D
 * context — so the UI that gets designed later plugs straight in with no change
 * to the model. Until then it draws its own two states.
 */
export function crtTexture() {
  return canvasTexture(PICTURE.width, PICTURE.height, (ctx, w, h) => drawOff(ctx, w, h), {
    colorSpace: THREE.SRGBColorSpace,
  });
}

/**
 * A dead tube.
 *
 * Distinctly green-grey, not black. The faceplate is tinted glass over grey
 * phosphor, and in any lit room it reads as a dark bottle-green slab — which
 * is why a switched-off CRT looks like an object and a black rectangle looks
 * like a hole cut in the bezel. Compare any photograph of one.
 */
export function drawOff(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, '#232c29');
  g.addColorStop(0.45, '#1a2220');
  g.addColorStop(1.0, '#141a19');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // The room's soft reflection sliding down the curve of the glass.
  const sheen = ctx.createLinearGradient(0, 0, w * 0.5, h);
  sheen.addColorStop(0.0, 'rgba(198,214,208,0.16)');
  sheen.addColorStop(0.35, 'rgba(178,196,192,0.05)');
  sheen.addColorStop(1.0, 'rgba(160,180,176,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Waking up, `k` from 0 to 1.
 *
 * A CRT does not fade up. It strikes a single bright line across the middle of
 * the tube, which then opens vertically into a full raster and blooms. Getting
 * that sequence right is most of why this reads as a tube switching on rather
 * than a div changing colour.
 */
export function drawBoot(ctx, w, h, k) {
  drawOff(ctx, w, h);

  // Phase 1 (0.00-0.22): the line strikes and brightens.
  // Phase 2 (0.22-0.62): it opens vertically into the full raster.
  // Phase 3 (0.62-1.00): the raster settles to an even white.
  const strike = Math.min(1, k / 0.22);
  const open = Math.max(0, Math.min(1, (k - 0.22) / 0.40));
  const settle = Math.max(0, Math.min(1, (k - 0.62) / 0.38));

  // The vertical extent of the raster, easing open.
  const ease = open * open * (3 - 2 * open);
  const half = (2 + ease * (h / 2 - 2)) * (strike > 0 ? 1 : 0);
  const top = h / 2 - half;
  const height = half * 2;

  if (half <= 0) return;

  // A collapsing raster is BRIGHTER than an open one — the same beam energy
  // over less area. This overshoot is the flash everyone remembers.
  const gain = strike * (1 + (1 - ease) * 1.9);

  const g = ctx.createLinearGradient(0, top, 0, top + height);
  g.addColorStop(0.0, `rgba(255,255,255,${Math.min(1, gain * 0.5)})`);
  g.addColorStop(0.5, `rgba(255,255,255,${Math.min(1, gain)})`);
  g.addColorStop(1.0, `rgba(255,255,255,${Math.min(1, gain * 0.5)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, height);

  // The white it settles into, faded in under the flash.
  if (settle > 0) {
    ctx.fillStyle = `rgba(246,247,250,${settle})`;
    ctx.fillRect(0, top, w, height);
  }

  // Glow spilling above and below the raster while it is still opening.
  if (ease < 1) {
    const spill = ctx.createLinearGradient(0, top - 60, 0, top);
    spill.addColorStop(0, 'rgba(200,225,255,0)');
    spill.addColorStop(1, `rgba(200,225,255,${0.35 * strike * (1 - ease)})`);
    ctx.fillStyle = spill;
    ctx.fillRect(0, top - 60, w, 60);
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.fillRect(0, top - 60, w, 60);
    ctx.restore();
  }

  if (settle > 0.4) crtGrille(ctx, w, h, (settle - 0.4) / 0.6);
}

/** A lit, blank raster — where the UI will be drawn later. */
export function drawOn(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, w * 0.78);
  g.addColorStop(0.0, '#ffffff');
  g.addColorStop(0.6, '#f4f6fa');
  g.addColorStop(1.0, '#dfe4ee');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  crtGrille(ctx, w, h, 1);
}

/**
 * Scanlines and corner falloff.
 *
 * Without these a lit CRT is a white rectangle, which is indistinguishable from
 * a hole in the bezel. The scanline pitch is deliberately coarse — at the
 * texture's real size on screen a 1px pitch aliases into a moiré.
 */
function crtGrille(ctx, w, h, amount) {
  ctx.save();
  ctx.globalAlpha = 0.055 * amount;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
  ctx.restore();

  const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, `rgba(10,14,26,${0.17 * amount})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/* ────────────────────────── the monitor cabinet ───────────────────────── */

/**
 * Twenty years of beige.
 *
 * Painted rather than tinted, because the interesting thing about aged ABS is
 * that it is NOT one colour. UV yellowing is directional — the top and the
 * side that faced the window go first — and it pools around mould lines and
 * vents where the surface is rougher. A single flat beige reads as new
 * plastic; this reads as an object that has sat somewhere for two decades.
 *
 * Mapped by world UVs (see canvasTexture's `offset`), so canvas x/y line up
 * with the bezel's own width and height.
 */
export function cabinetTexture(width, height) {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = hex(COLORS.beige);
    ctx.fillRect(0, 0, w, h);

    const rand = rng(613);

    // The overall gradient: worst at the top, where the light fell on it.
    const uv = ctx.createLinearGradient(0, 0, w * 0.25, h);
    uv.addColorStop(0.0, 'rgba(196,168,96,0.34)');
    uv.addColorStop(0.45, 'rgba(202,178,112,0.13)');
    uv.addColorStop(1.0, 'rgba(214,196,150,0.02)');
    ctx.fillStyle = uv;
    ctx.fillRect(0, 0, w, h);

    // Blotches. Large, soft and irregular — yellowing pools, it does not band.
    for (let i = 0; i < 26; i++) {
      const bx = rand() * w;
      const by = rand() * h * 0.85;
      const br = 60 + rand() * 240;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      const a = 0.05 + rand() * 0.13;
      g.addColorStop(0, `rgba(190,160,84,${a})`);
      g.addColorStop(0.6, `rgba(198,172,104,${a * 0.4})`);
      g.addColorStop(1, 'rgba(198,172,104,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(bx, by, br, br * (0.5 + rand() * 0.7), rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scuffs: short, shallow, mostly along the top edge and the front corners,
    // which is where a monitor gets knocked.
    for (let i = 0; i < 70; i++) {
      const sx = rand() * w;
      const sy = rand() < 0.55 ? rand() * h * 0.22 : rand() * h;
      const len = 8 + rand() * 70;
      const ang = (rand() - 0.5) * 0.5;
      ctx.strokeStyle = rand() < 0.6
        ? `rgba(255,252,244,${0.06 + rand() * 0.16})`
        : `rgba(122,110,84,${0.05 + rand() * 0.12})`;
      ctx.lineWidth = 0.8 + rand() * 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      ctx.stroke();
    }

    // Grime settling into the lower corners.
    for (const cx of [0, w]) {
      const g = ctx.createRadialGradient(cx, h, 0, cx, h, w * 0.3);
      g.addColorStop(0, 'rgba(96,88,68,0.20)');
      g.addColorStop(1, 'rgba(96,88,68,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // The moulding's fine texture. Real ABS was grained so it did not show
    // fingerprints; without it the cabinet reads as painted metal.
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 22000; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#ffffff' : '#5a5344';
      ctx.fillRect(rand() * w, rand() * h, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }, {
    // World UVs run -width/2..+width/2 in scene units, so map that span onto
    // the whole canvas.
    repeat: [1 / width, 1 / height],
    offset: [0.5, 0.5],
    wrap: THREE.ClampToEdgeWrapping,
  });
}

/** Side louvres, with dust settled on the sills. */
export function louvreTexture(rows = 9) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const rand = rng(29);
    const pitch = h / rows;
    for (let i = 0; i < rows; i++) {
      const y = i * pitch + pitch * 0.18;
      const bh = pitch * 0.46;
      // The slot: black at the top where the louvre overhangs, lifting to a
      // lit sill at the bottom.
      const g = ctx.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0.0, 'rgba(0,0,0,0.92)');
      g.addColorStop(0.55, 'rgba(6,6,8,0.85)');
      g.addColorStop(1.0, 'rgba(150,142,120,0.55)');
      ctx.fillStyle = g;
      // Rounded ends, the way a moulded slot actually is.
      const x0 = w * 0.06;
      const x1 = w * 0.94;
      ctx.beginPath();
      ctx.roundRect(x0, y, x1 - x0, bh, bh / 2);
      ctx.fill();

      // Dust on the sill.
      ctx.fillStyle = `rgba(188,178,152,${0.10 + rand() * 0.10})`;
      ctx.fillRect(x0, y + bh, x1 - x0, 1.5);
    }
  });
}

/* ─────────────────────────── the tower's back ─────────────────────────── */

/**
 * The back panel: PSU, I/O shield, expansion slots.
 *
 * This exists because the camera can now be unlocked and walked round the
 * back. Until it could, the rear of the tower was a slab nobody would ever
 * see; the moment it could, that slab became the least convincing surface in
 * either scene. It is one decal and one plane, and it is the difference
 * between a model of a computer and a photograph of one.
 *
 * Everything here is drawn from the ATX layout, which is why it reads even at
 * a glance: PSU top-left with its fan and kettle lead, the I/O shield in a
 * band under it, then the expansion slots running down the right.
 */
export function towerBackTexture() {
  return canvasTexture(512, 1120, (ctx, w, h) => {
    const rand = rng(311);

    // Galvanised steel, not painted plastic — the back of a case is bare metal.
    ctx.fillStyle = '#3a3e46';
    ctx.fillRect(0, 0, w, h);
    const sheen = ctx.createLinearGradient(0, 0, w, h * 0.4);
    sheen.addColorStop(0, 'rgba(255,255,255,0.10)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);

    // Spangle: the crystalline pattern of hot-dip galvanising.
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#ffffff' : '#161920';
      const r = 2 + rand() * 7;
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /** A dark opening with a lit lower lip — the same trick as every port. */
    const cut = (x, y, cw, ch, r = 3) => {
      ctx.fillStyle = '#08090b';
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, r);
      ctx.fill();
      ctx.fillStyle = 'rgba(190,196,206,0.35)';
      ctx.fillRect(x, y + ch, cw, 1.6);
    };

    /* ── the PSU, top ─────────────────────────────────────────────── */
    const psuH = 230;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(14, 18, w - 28, psuH);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 18, w - 28, psuH);

    // Fan grille: concentric rings of punched holes.
    const fx = w * 0.62;
    const fy = 18 + psuH * 0.48;
    ctx.fillStyle = '#0a0b0d';
    ctx.beginPath();
    ctx.arc(fx, fy, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4b505a';
    for (let ring = 1; ring <= 5; ring++) {
      const rr = ring * 15;
      const n = ring * 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.4;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // The hub the blades hang off.
    ctx.fillStyle = '#23262c';
    ctx.beginPath();
    ctx.arc(fx, fy, 13, 0, Math.PI * 2);
    ctx.fill();

    // Kettle socket and the red voltage selector nobody was allowed to touch.
    cut(46, 52, 76, 56, 5);
    ctx.fillStyle = '#8d2523';
    ctx.fillRect(52, 132, 58, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '600 17px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('115', 58, 146);

    /* ── the I/O shield ───────────────────────────────────────────── */
    const ioY = 270;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(24, ioY, w - 48, 196);

    // PS/2 pair — the purple and green that told you which was which.
    const ps2 = (y, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(74, y, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#08090b';
      ctx.beginPath();
      ctx.arc(74, y, 13, 0, Math.PI * 2);
      ctx.fill();
    };
    ps2(ioY + 36, '#6f4b9c');
    ps2(ioY + 84, '#4f9c52');

    cut(126, ioY + 18, 96, 38, 4);   // serial
    cut(126, ioY + 68, 96, 38, 4);   // VGA
    cut(250, ioY + 20, 128, 34, 4);  // parallel

    // USB pair.
    ctx.fillStyle = '#08090b';
    ctx.fillRect(250, ioY + 72, 54, 26);
    ctx.fillRect(312, ioY + 72, 54, 26);
    ctx.fillStyle = '#d8dce4';
    ctx.fillRect(254, ioY + 82, 46, 8);
    ctx.fillRect(316, ioY + 82, 46, 8);

    // Audio jacks: line out, line in, mic.
    ['#4f9c52', '#4a7fc1', '#c2607f'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(410 + (i % 2) * 0, ioY + 34 + i * 46, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#06070a';
      ctx.beginPath();
      ctx.arc(410, ioY + 34 + i * 46, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    /* ── expansion slots ──────────────────────────────────────────── */
    const slotY = 500;
    for (let i = 0; i < 6; i++) {
      const y = slotY + i * 92;
      // A blanking plate, except the second slot which has a card in it.
      const filled = i === 1;
      ctx.fillStyle = filled ? '#2b2e35' : '#41454e';
      ctx.fillRect(60, y, w - 120, 68);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(60, y + 68, w - 120, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(60, y, w - 120, 2);

      if (filled) cut(96, y + 16, 120, 36, 4); // the card's own port

      // The screw that held it.
      ctx.fillStyle = '#575c66';
      ctx.beginPath();
      ctx.arc(w - 44, y + 34, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#22252b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(w - 50, y + 34);
      ctx.lineTo(w - 38, y + 34);
      ctx.stroke();
    }

    /* ── the compliance sticker, half peeling ─────────────────────── */
    ctx.fillStyle = '#cfcabb';
    ctx.fillRect(40, h - 118, 168, 78);
    ctx.fillStyle = 'rgba(60,58,52,0.8)';
    ctx.font = '600 15px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText('MODEL DM-4600', 50, h - 96);
    ctx.font = '400 12px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText('100-240V ~ 50/60Hz', 50, h - 76);
    ctx.fillText('MADE IN MALAYSIA', 50, h - 58);
  });
}

/** Vents around the CRT's neck, where the tube dumped its heat. */
export function monitorBackTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    const rows = 11;
    const pitch = (h * 0.86) / rows;
    const slotH = pitch * 0.44;
    // The neck comes through the middle, so those rows are split into two
    // short slots either side of it rather than one long one.
    const neckRows = 2.2;
    const mid = (rows - 1) / 2;

    const slot = (x, y, sw) => {
      const g = ctx.createLinearGradient(0, y, 0, y + slotH);
      g.addColorStop(0.0, 'rgba(0,0,0,0.88)');
      g.addColorStop(0.65, 'rgba(10,10,12,0.78)');
      g.addColorStop(1.0, 'rgba(156,148,126,0.42)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, y, sw, slotH, slotH / 2);
      ctx.fill();
    };

    for (let i = 0; i < rows; i++) {
      const y = h * 0.07 + i * pitch;
      if (Math.abs(i - mid) < neckRows) {
        const sw = w * 0.22;
        slot(w * 0.08, y, sw);
        slot(w * 0.70, y, sw);
      } else {
        slot(w * 0.08, y, w * 0.84);
      }
    }
  });
}
