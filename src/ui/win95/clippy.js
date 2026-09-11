/**
 * clippy.js — the assistant, and everything he does on his own.
 *
 * The desktop used to nudge people with a Windows 95 tooltip: correct for the
 * era, and completely ignorable. An assistant is not ignorable. Office 97 put
 * a bent paperclip with eyebrows on top of everything you were doing, and it
 * became the most remembered piece of interface Microsoft ever shipped, which
 * is exactly the property guidance on this desktop needs.
 *
 * He is drawn, not pasted. Every other surface in this project is painted at
 * runtime and the Office Assistant art is Microsoft's, so this is a paperclip
 * with a face built out of arcs and two ellipses: the same joke, drawn here.
 *
 * The geometry is a real gem clip, three turns and four legs, because the
 * shape is the whole gag and a wire bent any other way stops reading as a
 * paperclip and starts reading as a squiggle.
 *
 * He also owns his own time. Blinks, the pause between lines and which line
 * comes next all live in here, and tick() reports whether any of it changed
 * the picture, so the shell still repaints only when something moved.
 */

import { C, FONT, text, wrapText } from './chrome.js';

/* ── the character ──────────────────────────────────────────────────────
   The box he is drawn in. Every number in the drawing below is a unit of
   this box, never a screen pixel, so `scale` in the settings is the only
   thing that decides how big he lands on the 800x600 raster. */
const W = 80;
const H = 120;

/** The clip's centre line in the box. He is a little right of the middle,
    because the face hangs off his left leg and needs the room. */
const CX = 42;

/**
 * Everything about him the tweak panel can move, in raster pixels.
 *
 * Press L on the desktop stage to edit these live, then Copy settings to
 * paste the whole object back over this one. Same arrangement as the note:
 * the panel edits this object and the drawing reads it, so there is never a
 * second copy of a number to fall out of step.
 */
export const CLIPPY_SETTINGS = {
  scale: 0.59,     // uniform, pinned by his bottom right corner
  right: 31,       // in from the right edge of the screen
  bottom: 18,      // up from the top of the taskbar
  wire: 8,         // how thick the paperclip is

  /* The clip itself. Every one of these is a design unit of the box above,
     and the four legs, three radii and both turns are derived from them, so
     no combination of sliders can bend the wire into something that is not a
     paperclip. See geometry() for what is worked out from what. */
  clipW: 46,       // outer leg to outer leg
  clipH: 110,      // hook apex to the bottom of the outer U
  innerU: 0.76,    // how far down the inner U bottoms out, as a fraction
  mouth: 34,       // the open gap under the hook
  tail: 49,        // how far the free right leg rises

  /* The face. The eyes hang off the left leg and the brows off the eyes, so
     widening the clip moves the whole face with it. */
  eye: 14,         // eyeball radius
  eyeX: 1,         // the pair, left or right along the clip
  eyeDrop: 30,     // and down from the hook apex
  eyeGap: 30,      // centre to centre
  eyeTilt: 3,      // how much lower the right one sits
  brow: 15,        // how high the eyebrows arch over the eyes
  browWeight: 5.6, // and how heavy they are

  // Cozette first, a 6x13 bitmap face, because a balloon full of pixels on a
  // CRT is the right kind of wrong. It has to be installed on the machine
  // doing the looking: nothing here is loaded with @font-face, the same deal
  // W95FA has always had, and the rest of the stack is the fallback.
  font: `"Cozette", ${FONT}`,
  size: 13,        // Cozette's own size; anything else is a resample
  width: 184,      // the balloon wraps at this
  pad: 8,
  line: 13,        // baseline to baseline
  sayX: -24,       // where the balloon sits, tail still on his head
  sayY: 4,

  dwell: 13.5,     // seconds a line stays up
};

/* ── the voice ──────────────────────────────────────────────────────────
   Lines with an `app` are about something that has not been opened yet and
   are offered in the order below, two phrasings each so a second look is
   never the same sentence. The rest is what he says once the tour is done
   and he has nothing left to sell. */

const ORDER = ['photos', 'documents', 'music', 'browser'];

/**
 * What he says when you click him.
 *
 * An assistant you can poke is an assistant, and one you cannot is a picture.
 * He is the only thing on this desktop that answers back, so the answer is
 * the one a paperclip with eyebrows would give.
 */
const POKES = [
  'Ugh. Do not poke the assistant.',
  'That is not a button. I am a colleague.',
  'I felt that.',
  'Please. I am load bearing.',
  'Do that again and I will suggest a letter template.',
  'Rude. I have been standing here for you.',
];

/** How long the face lasts before he goes back to being helpful. */
const POKE_TIME = 3.2;

/* The recoil. He jerks back, shudders it off over about three quarters of a
   second, holds the face, then eases out of it at the end. Only the moving
   parts cost repaints: once the shudder has died the pose is held for free. */
const POKE_SNAP = 0.12;    // into the face this fast
const POKE_SETTLE = 0.5;   // shudder dead by here
const POKE_RELEASE = 0.35; // and easing back out over the last of it

/* And the rate it is worth repainting a 800x600 texture at while that runs.
   The shudder moves him about two screen pixels at the size he ships at, so
   a frame every 25ms is well past what anybody can see, and on a 120Hz
   display it is a third of the repaints that drawing every frame would cost. */
const POKE_FPS = 40;

const LINES = [
  { app: 'photos', say: "It looks like you're new here. Click My Photos and see where I've been." },
  { app: 'photos', say: 'My Photos is every place I actually went. Click the folder.' },
  { app: 'documents', say: "Click My Documents. That's the work I've shipped, not the work I talk about." },
  { app: 'documents', say: 'Want to see what I build? My Documents. One click.' },
  { app: 'music', say: 'Click My Music. Three songs, on repeat, and I am not sorry about any of them.' },
  { app: 'music', say: 'Put something on while you look around. My Music is right there.' },
  { app: 'browser', say: 'Click Internet Explorer. It still works, which is more than it managed in 1996.' },
  { app: 'browser', say: 'Internet Explorer is open for business. Nobody tell it what happened.' },

  { say: 'Everything on this desktop opens. Even the Recycle Bin. Especially the Recycle Bin.' },
  { say: 'Windows drag by the title bar. That part never stopped feeling good.' },
  { say: 'My Computer holds the whole machine, the way it always claimed to.' },
  { say: 'The note in Notepad is real. I have read it more times than anyone.' },
  { say: 'I am a paperclip. This is the entire job and I am thrilled about it.' },
  { say: 'Take your time. The clock in the corner is the only thing in a hurry.' },
];

/** Blink timing: a gap of this plus a bit, then a fast close and open. */
const BLINK_GAP = 2.6;
const BLINK_SPREAD = 4.5;
const BLINK_TIME = 0.17;

/**
 * One assistant, with his own clock.
 *
 * The shell owns nothing about him but where he is drawn: it tells him what
 * has been opened, ticks him, and repaints when he says the picture changed.
 */
export function createClippy() {
  const visited = new Set();
  let line = null;
  let dwell = 0;
  let blinkIn = BLINK_GAP;
  let blink = 0;          // 0 open, 1 shut
  let brows = 0;          // seconds of raised eyebrows left, for a new line
  let poked = 0;          // seconds of being appalled left
  let pokeLine = null;
  let pokeFrame = -1;     // the last recoil frame actually painted

  function pick() {
    const next = ORDER.find((app) => !visited.has(app));
    const about = LINES.filter((l) => (next ? l.app === next : !l.app));
    // An app with nothing written about it would leave him silent forever,
    // so a pool that comes back empty falls through to the general chatter.
    const pool = about.length ? about : LINES.filter((l) => !l.app);
    const fresh = pool.filter((l) => l !== line);
    const from = fresh.length ? fresh : pool;
    return from[Math.floor(Math.random() * from.length)];
  }

  /**
   * His face right now.
   *
   * One number, `k`, carries the whole performance: it runs up as he pulls
   * the face, sits at 1 while he holds it, and runs back down as he lets it
   * go, and every feature is just the normal value mixed toward the appalled
   * one by that much. The shudder is a decaying sine on top, which is what
   * makes it read as a recoil rather than as a new drawing being swapped in.
   */
  function expression() {
    const rest = {
      lean: 0, shake: 0, blinkL: blink, blinkR: blink,
      browL: 1, browR: 1, lookX: -0.2, lookY: 0.08,
    };
    if (poked <= 0) return rest;

    const t = POKE_TIME - poked;
    const k = Math.min(1, t / POKE_SNAP, poked / POKE_RELEASE);
    // Negative amplitude so the first quarter cycle goes AWAY from the hand.
    // A ring that opens by tipping toward the thing that touched you reads as
    // a nod, which is the opposite of the point.
    const ring = -Math.exp(-t * 9) * Math.sin(t * 26);

    return {
      lean: -0.055 * k + ring * 0.09,
      shake: ring * 6,
      blinkL: mix(0, 0.55, k),
      blinkR: mix(0, 0.16, k),
      browL: mix(1, 0.15, k),
      browR: mix(1, 1.5, k),
      lookX: mix(-0.2, -0.66, k),
      lookY: mix(0.08, -0.34, k),
    };
  }

  /** A new line, and the raised eyebrows that go with saying one. */
  function speak() {
    line = pick();
    dwell = 0;
    brows = 0.45;
  }

  speak();

  return {
    /** The shell opened something, so stop selling it. */
    saw(app) {
      if (visited.has(app)) return false;
      visited.add(app);
      // He reacts rather than finishing his sentence: being talked over is
      // what an assistant is for.
      if (line?.app === app) { speak(); return true; }
      return false;
    },

    /** Somebody clicked him. Pull a face about it. */
    poke() {
      const fresh = POKES.filter((l) => l !== pokeLine);
      pokeLine = fresh[Math.floor(Math.random() * fresh.length)];
      poked = POKE_TIME;
      pokeFrame = -1;
      blink = 0;          // no blinking over the squint
      return true;
    },

    /** Back to a machine nobody has touched yet. */
    reset() {
      visited.clear();
      blink = 0;
      blinkIn = BLINK_GAP;
      poked = 0;
      pokeLine = null;
      speak();
    },

    /**
     * Advance his clock. `awake` is false while the camera is flying or the
     * machine is off, and he holds still rather than blinking at nobody.
     *
     * @returns true when the picture changed and the shell should repaint.
     */
    tick(dt, awake = true) {
      if (!awake || !dt) return false;

      // Being appalled runs at frame rate while there is something to see and
      // then stops: the shudder and both ends of the face are worth repaints,
      // the two seconds of holding it in between are not.
      if (poked > 0) {
        poked -= dt;
        if (poked <= 0) {
          poked = 0;
          speak();
          return true;
        }
        const t = POKE_TIME - poked;
        if (t >= POKE_SETTLE && poked >= POKE_RELEASE) return false;
        const f = Math.round(t * POKE_FPS);
        if (f === pokeFrame) return false;
        pokeFrame = f;
        return true;
      }

      let moved = false;

      if (brows > 0) {
        brows -= dt;
        if (brows <= 0) { brows = 0; moved = true; }
      }

      dwell += dt;
      if (dwell >= CLIPPY_SETTINGS.dwell) { speak(); moved = true; }

      if (blink > 0) {
        // Quantised, because a blink is four repaints of an 800x600 texture
        // and nobody can see the frames in between.
        const was = Math.round(blink * 4);
        blink -= dt / (BLINK_TIME / 2);
        if (blink <= 0) { blink = 0; blinkIn = BLINK_GAP + Math.random() * BLINK_SPREAD; }
        if (Math.round(blink * 4) !== was) moved = true;
      } else {
        blinkIn -= dt;
        if (blinkIn <= 0) { blink = 1; moved = true; }
      }

      return moved;
    },

    /**
     * Draw him standing in the bottom right corner, above `bottom`, which is
     * the top of the taskbar rather than the bottom of the screen.
     */
    draw(ctx, w, bottom) {
      const s = CLIPPY_SETTINGS.scale;
      const x = w - CLIPPY_SETTINGS.right - W * s;
      const y = bottom - CLIPPY_SETTINGS.bottom - H * s;

      // He has no mouth, so disgust comes out of the parts he does have: one
      // eye squeezed most of the way shut, that brow flat on it and the other
      // one near the ceiling, both pupils cut away to the far side, and the
      // whole clip flinching back off the thing that touched him.
      const face = expression();

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      drawPad(ctx);
      drawClip(ctx, face, brows > 0);
      ctx.restore();

      // The balloon is drawn outside that scale on purpose: 11px text run
      // through a 1.4x transform is 11px text with soft edges, and this is a
      // raster where every other glyph lands on the pixel grid. It has its own
      // size in the settings instead.
      const g = geometry();
      const say = poked > 0 ? pokeLine : line?.say;
      if (say) drawBalloon(ctx, x + g.hookX * s, y + (g.top + 12) * s, w - 10, say);

      // Where he is, so the shell can make him clickable. His own box rather
      // than the balloon's: the balloon is words, and words are not him.
      return { x, y, w: W * s, h: H * s };
    },
  };
}

/**
 * The legal pad he stands on.
 *
 * A paperclip alone is a paperclip. The yellow ruled sheet under it, blue
 * lines and a red margin, is half of the character, and it costs four fills.
 */
function drawPad(ctx) {
  const g = geometry();
  const k = CLIPPY_SETTINGS.clipW / 48;     // the sheet grows with the clip
  const px = (v) => CX + (v - CX) * k;
  const top = g.outerY + g.outerR - 18;

  // A shallow parallelogram, near edge to the left: the sheet lies on the
  // desktop rather than standing against it.
  ctx.beginPath();
  ctx.moveTo(px(2), top + 8);
  ctx.lineTo(px(64), top);
  ctx.lineTo(px(82), top + 20);
  ctx.lineTo(px(16), top + 30);
  ctx.closePath();
  ctx.fillStyle = '#f2f0bd';
  ctx.fill();
  ctx.strokeStyle = '#b6b483';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  ctx.clip();
  ctx.strokeStyle = '#b9c4dd';
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(px(2), top + 8 + t * 22);
    ctx.lineTo(px(82), top + t * 20);
    ctx.stroke();
  }
  ctx.strokeStyle = '#d89a9a';
  ctx.beginPath();
  ctx.moveTo(px(15), top + 7);
  ctx.lineTo(px(24), top + 31);
  ctx.stroke();
  ctx.restore();
}

/** Linear mix, for running a feature from its resting value to another. */
const mix = (a, b, k) => a + (b - a) * k;

/**
 * Where the clip is, worked out from the settings.
 *
 * A gem clip is not four independent legs: the top turn spans two thirds of
 * the width and the inner U spans one third, so both radii fall out of the
 * width alone. Deriving them is what lets the panel widen him without the
 * turns going out of proportion, and what stops a slider from producing the
 * hairpin this drawing used to be.
 *
 * The free ends are clamped rather than trusted, so a leg can never be asked
 * to rise past the turn it comes out of and double back on itself.
 */
function geometry() {
  const S = CLIPPY_SETTINGS;
  const step = S.clipW / 3;             // one leg to the next
  const x1 = CX - S.clipW / 2;          // outer left
  const x2 = x1 + step;                 // inner left, the free end
  const x3 = x1 + step * 2;             // inner right
  const x4 = x1 + step * 3;             // outer right, the other free end

  const bottom = H - 8;                 // his feet stay put as the rest moves
  const top = bottom - S.clipH;

  const hookR = step;                   // the wide turn, x1 across to x3
  const hookY = top + hookR;
  const outerR = S.clipW / 2;           // the bottom U, x1 across to x4
  const outerY = bottom - outerR;
  const innerR = step / 2;              // the small U, x2 across to x3
  const innerY = Math.min(
    top + S.innerU * S.clipH - innerR,
    outerY - innerR * 1.2,              // never below the U it sits inside
  );

  return {
    x1, x2, x3, x4, top, hookR, hookY, outerR, outerY, innerR, innerY,
    // Both Us are centred on the clip's centre line; only the hook is not.
    hookX: x1 + hookR,
    mouthY: Math.min(hookY + S.mouth, innerY - 2),
    tailY: Math.min(top + S.tail, outerY - 2),
  };
}

/** The wire, then the eyes, then the eyebrows, which is also the depth order. */
function drawClip(ctx, face, raised) {
  const S = CLIPPY_SETTINGS;
  const g = geometry();

  // Leaning and shuddering happen about his feet, and take the clip only: the
  // sheet of paper is lying on the desktop and has no opinion about any of
  // this.
  ctx.save();
  if (face.lean || face.shake) {
    const pivot = g.outerY + g.outerR;
    ctx.translate(CX + face.shake, pivot);
    ctx.rotate(face.lean);
    ctx.translate(-CX, -pivot);
  }
  // One gradient across the whole clip rather than one per leg. At this size
  // the difference is invisible and it costs four stops instead of sixteen.
  const wire = ctx.createLinearGradient(g.x1 - 2, 0, g.x4 + 4, 0);
  wire.addColorStop(0, '#5a5a84');
  wire.addColorStop(0.3, '#d2d2e6');
  wire.addColorStop(0.62, '#9292b8');
  wire.addColorStop(1, '#4f4f78');

  ctx.strokeStyle = wire;
  ctx.lineWidth = S.wire;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  /*
   * One piece of wire, four legs, three turns, all of it from geometry().
   *
   * The order the bends come in is the whole shape, and getting it wrong is
   * what makes a drawing read as a bent pin instead of a paperclip. A gem
   * clip's top turn is WIDE: it leaves the outer left leg, arcs right across
   * most of the clip, and comes down as the inner right leg, passing over the
   * inner left leg on the way. That long open hook above the eyes is the
   * thing everybody recognises. A small turn joining the two left legs is a
   * hairpin, which is what this used to be.
   */
  ctx.beginPath();
  ctx.moveTo(g.x2, g.mouthY);                    // free end, tucked in the hook
  ctx.lineTo(g.x2, g.innerY);
  ctx.arc(CX, g.innerY, g.innerR, Math.PI, 0, true);         // the inner U
  ctx.lineTo(g.x3, g.hookY);
  ctx.arc(g.hookX, g.hookY, g.hookR, 0, Math.PI, true);      // the wide hook
  ctx.lineTo(g.x1, g.outerY);
  ctx.arc(CX, g.outerY, g.outerR, Math.PI, 0, true);         // the outer U
  ctx.lineTo(g.x4, g.tailY);                     // and up to the other free end
  ctx.stroke();

  // Both eyes sit on the wire rather than beside it, which is the detail that
  // turns a paperclip into a face: the left one straddles the top turn, the
  // right one caps the inner arm.
  const ex = g.x1 + S.eyeX;
  const ey = g.top + S.eyeDrop;
  eye(ctx, ex, ey, S.eye, face.blinkL, face);
  eye(ctx, ex + S.eyeGap, ey + S.eyeTilt, S.eye, face.blinkR, face);

  // Eyebrows, heavy at the inner end and tapering out. They lift for a moment
  // whenever he starts a new line, which is the difference between a drawing
  // of a paperclip and something that just said a thing to you.
  const lift = (raised ? 3 : 0) + S.brow;
  ctx.strokeStyle = C.black;
  brow(ctx, ex, ey, S.eye, lift * face.browL);
  brow(ctx, ex + S.eyeGap, ey + S.eyeTilt, S.eye, lift * face.browR);

  ctx.restore();
}

/**
 * An eyeball, shut by `blink` from 0 to 1.
 *
 * The lid is a clip rather than a fill: there is teal desktop and purple wire
 * behind him, so anything that closes an eye by painting over it paints the
 * wrong colour over the wire.
 */
function eye(ctx, cx, cy, r, blink = 0, face = { lookX: -0.2, lookY: 0.08 }) {
  const lid = cy - r + blink * 2 * r;

  if (blink < 0.96) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - r - 1, lid, r * 2 + 2, cy + r - lid + 1);
    ctx.clip();

    const ball = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, 1, cx, cy, r);
    ball.addColorStop(0, '#ffffff');
    ball.addColorStop(0.7, '#f0f0f6');
    ball.addColorStop(1, '#b8b8cc');
    ctx.fillStyle = ball;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.96, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6e6e8a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pupils a little left of centre, so he is looking at the desktop rather
    // than straight out of the tube. Further over when he is looking away
    // from something he would rather not have been touched by.
    ctx.fillStyle = C.black;
    ctx.beginPath();
    ctx.ellipse(cx + r * face.lookX, cy + r * face.lookY, r * 0.5, r * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (blink > 0.03) {
    ctx.strokeStyle = '#4a4a68';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r + 2, lid - 1);
    ctx.quadraticCurveTo(cx, lid + 3, cx + r - 2, lid - 1);
    ctx.stroke();
  }
}

/**
 * One brow, arched over the eye at `ex, ey` by `lift`.
 *
 * Drawn twice so it tapers: a fat curve, then a thin one carrying on from
 * where it ended. A brow of one weight reads as a dash, and the taper is most
 * of what makes him look interested rather than merely awake.
 */
function brow(ctx, ex, ey, r, lift) {
  const x1 = ex - r * 1.1;
  const y1 = ey - lift * 0.58;
  const cx = ex - r * 0.15;
  const cy = ey - lift * 1.58;
  const x2 = ex + r * 0.96;
  const y2 = ey - lift;
  const w = CLIPPY_SETTINGS.browWeight;

  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2 - (x2 - cx) * 0.45, y2 - (y2 - cy) * 0.45);
  ctx.stroke();
  ctx.lineWidth = w * 0.52;
  ctx.beginPath();
  ctx.moveTo(x2 - (x2 - cx) * 0.5, y2 - (y2 - cy) * 0.5);
  ctx.quadraticCurveTo(x2 - (x2 - cx) * 0.2, y2 - (y2 - cy) * 0.2, x2, y2);
  ctx.stroke();
}

/* ── the balloon ─────────────────────────────────────────────────────── */

/**
 * What he says, above his head.
 *
 * Pale yellow with a hairline black border and rounded corners, which is what
 * both the era's tooltip and the Assistant's own balloon were: the one visual
 * this desktop can borrow without anything appearing on screen that Windows
 * 95 would not have drawn.
 */
function drawBalloon(ctx, tipX, tipY, rightEdge, message) {
  const { font, size, pad, line: LINE_H } = CLIPPY_SETTINGS;
  ctx.font = `${size}px ${font}`;
  const lines = wrapText(ctx, message, CLIPPY_SETTINGS.width - pad * 2, { size, font });
  const w = Math.min(
    CLIPPY_SETTINGS.width,
    Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width))) + pad * 2,
  );
  const h = lines.length * LINE_H + pad * 2 - 2;
  const x = Math.round(rightEdge - w + CLIPPY_SETTINGS.sayX);
  const y = Math.round(tipY - 12 - h + CLIPPY_SETTINGS.sayY);

  ctx.fillStyle = '#ffffe1';
  ctx.strokeStyle = C.black;
  ctx.lineWidth = 1;

  ctx.beginPath();
  roundedRectPath(ctx, x + 0.5, y + 0.5, w, h, 4);
  ctx.fill();
  ctx.stroke();

  // The tail, dropped from the bottom edge onto his head.
  ctx.beginPath();
  ctx.moveTo(tipX - 6.5, y + h - 1);
  ctx.lineTo(tipX + 3.5, tipY);
  ctx.lineTo(tipX + 7.5, y + h - 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Paint over the border segment the tail covers, so the two read as one
  // shape rather than as a triangle stuck on a box.
  ctx.fillStyle = '#ffffe1';
  ctx.fillRect(tipX - 5.5, y + h - 1, 12, 2);

  let ty = y + pad;
  for (const l of lines) {
    text(ctx, l, x + pad, ty, { size, font, accelerators: false });
    ty += LINE_H;
  }
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
