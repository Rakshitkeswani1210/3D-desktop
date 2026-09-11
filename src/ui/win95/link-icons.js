/**
 * link-icons.js — five 32x32 icons drawn by hand, in the 1995 idiom.
 *
 * Everywhere else in this UI the rule is: never draw an icon, use the real
 * bitmap. That rule exists because hand-drawn substitutes for icons that DO
 * exist look like imitations. None of these five things existed in 1995, so
 * there is no bitmap to be faithful to and the rule does not apply.
 *
 * What does apply is the era's drawing discipline, and it is the whole reason
 * these sit next to the real shell icons without looking wrong:
 *
 *   - 32x32, every edge on a whole pixel, no antialiasing anywhere.
 *   - A hard 1px near-black outline around the silhouette. Win95 icons were
 *     read against a teal desktop AND a white folder background, and the
 *     outline is what let one artwork survive both.
 *   - Light from the top-left, always: a white or near-white highlight on the
 *     top and left faces, a shadow on the bottom and right. The same rule as
 *     the bevels, because it is the same imaginary lamp.
 *   - Few colours, all flat. No gradients — the era's icons were 16-colour.
 *
 * They are drawn as OBJECTS rather than as logos: a turntable, a card, a
 * chart. That is what the shell's own icons did — a printer, a folder, a
 * globe — and it sidesteps redrawing anybody's trademark in pixel art.
 */

const OUT = '#1a1a1a';   // the silhouette outline
const HI = '#ffffff';
const LO = '#7e7e7e';
const FACE = '#c3c3c3';

/** Rect helper: every icon is built from these and nothing else. */
const r = (ctx, x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };

/**
 * A filled circle on a pixel grid.
 *
 * Computed per row rather than stroked: ctx.arc at this size antialiases the
 * rim into grey mush, and a run-length fill keeps every edge on a whole pixel.
 */
function disc(ctx, cx, cy, rad, fill) {
  ctx.fillStyle = fill;
  for (let dy = -rad; dy <= rad; dy++) {
    const half = Math.floor(Math.sqrt(rad * rad - dy * dy));
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

/** A rectangle with a 1px outline and a top-left highlight. */
function plate(ctx, x, y, w, h, fill, hi = HI, lo = LO) {
  r(ctx, x, y, w, h, OUT);
  r(ctx, x + 1, y + 1, w - 2, h - 2, fill);
  r(ctx, x + 1, y + 1, w - 2, 1, hi);
  r(ctx, x + 1, y + 1, 1, h - 2, hi);
  r(ctx, x + 1, y + h - 2, w - 2, 1, lo);
  r(ctx, x + w - 2, y + 1, 1, h - 2, lo);
}

/* ── 1. Claude iterate — a program window with a spark in it ───────────── */
function claude(ctx) {
  plate(ctx, 2, 4, 28, 24, '#ffffff');
  r(ctx, 3, 5, 26, 6, '#02007f');              // title bar
  r(ctx, 4, 7, 3, 2, '#ffffff');               // a tiny caption block
  r(ctx, 25, 6, 3, 3, FACE);                   // the close box
  r(ctx, 3, 11, 26, 1, OUT);

  // An eight-ray burst: four axes and four diagonals, all stepped outward from
  // the same centre so the arms stay the same length in every direction.
  const cx = 15, cy = 18;
  const O = '#d97757';
  r(ctx, cx, cy - 6, 2, 14, O);                // vertical
  r(ctx, cx - 6, cy, 14, 2, O);                // horizontal
  for (let i = 2; i <= 4; i++) {
    r(ctx, cx - i, cy - i, 2, 2, O);
    r(ctx, cx + i, cy - i, 2, 2, O);
    r(ctx, cx - i, cy + i, 2, 2, O);
    r(ctx, cx + i, cy + i, 2, 2, O);
  }
}

/* ── 2. Turntable — a deck seen from above ─────────────────────────────── */
function turntable(ctx) {
  plate(ctx, 2, 3, 28, 26, FACE);

  disc(ctx, 14, 16, 10, OUT);                  // platter rim
  disc(ctx, 14, 16, 9, '#262626');             // the record
  disc(ctx, 14, 16, 6, '#3a3a3a');             // a groove band, one step lighter
  disc(ctx, 14, 16, 3, '#d97757');             // the label
  r(ctx, 14, 16, 1, 1, OUT);                   // the spindle

  // Tonearm, swung in over the record from the top right corner.
  r(ctx, 25, 5, 4, 4, '#8e8e8e');              // the pivot
  r(ctx, 25, 5, 4, 1, HI);
  for (let i = 0; i < 8; i++) r(ctx, 26 - i, 9 + i, 2, 1, '#5a5a5a');
  r(ctx, 18, 16, 2, 3, OUT);                   // the cartridge

  r(ctx, 4, 25, 5, 2, '#26b50f');              // a power lamp
}

/* ── 3. YC journey — an article, folded corner ─────────────────────────── */
function article(ctx) {
  const x = 6, y = 2, w = 20, h = 28, fold = 7;
  r(ctx, x, y, w, h, OUT);
  r(ctx, x + 1, y + 1, w - 2, h - 2, '#ffffff');

  // The folded corner: a stepped triangle cut out of the top right.
  for (let i = 0; i < fold; i++) {
    r(ctx, x + w - fold + i, y, fold - i, i + 1, '#008282');
    r(ctx, x + w - fold + i, y + i, 1, 1, OUT);
  }
  r(ctx, x + w - fold, y + fold, fold, 1, OUT);
  r(ctx, x + w - fold, y, 1, fold, OUT);
  r(ctx, x + w - fold + 1, y + 1, fold - 2, fold - 2, '#e3e3e3');

  r(ctx, x + 2, y + 3, w - 11, 3, '#ff6600');  // the standfirst
  for (let i = 0; i < 7; i++) {                // body copy
    r(ctx, x + 2, y + 10 + i * 2, w - (i === 6 ? 9 : 4), 1, '#5a5a5a');
  }
}

/* ── 4. Groww — a chart that goes up ───────────────────────────────────── */
function chart(ctx) {
  plate(ctx, 2, 3, 28, 26, '#ffffff');
  r(ctx, 5, 24, 22, 1, OUT);                   // the axis
  r(ctx, 5, 7, 1, 18, OUT);

  const bars = [[8, 6], [13, 10], [18, 14]];
  for (const [bx, bh] of bars) {
    r(ctx, bx, 24 - bh, 4, bh, OUT);
    r(ctx, bx + 1, 25 - bh, 2, bh - 1, '#26b50f');
  }

  // The arrow: a stepped rise with a head, which reads at this size where a
  // drawn line would not.
  for (let i = 0; i < 7; i++) r(ctx, 8 + i * 2, 20 - i * 2, 2, 2, '#02007f');
  r(ctx, 20, 6, 6, 2, '#02007f');
  r(ctx, 24, 6, 2, 6, '#02007f');
}

/* ── 5. Razorpay — a payment card ──────────────────────────────────────── */
function card(ctx) {
  plate(ctx, 2, 7, 28, 18, '#1a4ba0', '#5b8ede', '#0d2a60');
  r(ctx, 3, 11, 26, 4, '#0b1f47');             // the magnetic stripe
  r(ctx, 5, 17, 6, 5, OUT);                    // the chip
  r(ctx, 6, 18, 4, 3, '#e8c25a');
  r(ctx, 6, 19, 4, 1, '#8e6f22');
  for (let i = 0; i < 3; i++) r(ctx, 14 + i * 5, 19, 3, 2, '#9db8e8');  // the digits
}

/* ── 6. Pomodoro timer — the kitchen tomato it is named after ──────────── */
function pomodoro(ctx) {
  disc(ctx, 16, 19, 11, OUT);
  disc(ctx, 16, 19, 10, '#c8281e');
  disc(ctx, 14, 17, 6, '#e8453a');              // the lit shoulder, top-left
  r(ctx, 22, 24, 3, 3, '#8e1a13');              // and the shadow opposite

  // The leaf crown: three points, because two reads as a bow tie and four
  // turns to mush at this size.
  r(ctx, 15, 6, 2, 4, '#1e6b1a');               // the stalk
  for (let i = 0; i < 4; i++) {
    r(ctx, 12 - i, 9 + i, 3, 1, '#26b50f');
    r(ctx, 17 + i, 9 + i, 3, 1, '#26b50f');
  }
  r(ctx, 13, 9, 6, 2, '#1e6b1a');

  // The dial, sunk into the front.
  disc(ctx, 16, 20, 6, OUT);
  disc(ctx, 16, 20, 5, '#f0ece0');
  r(ctx, 16, 16, 1, 5, OUT);                    // the hand, pointing up
  r(ctx, 16, 20, 4, 1, OUT);                    // and one pointing right
  r(ctx, 15, 19, 2, 2, '#5a5a5a');              // the boss
}

/* ── 7. Sketch — a cut gem ─────────────────────────────────────────────── */
function sketch(ctx) {
  // Silhouette first, one pixel proud all round, so the facets can be filled
  // straight over it and still keep a hard edge.
  const crown = (y) => {
    const t = (y - 9) / 5;
    return [Math.round(9 - t * 4), Math.round(23 + t * 4)];
  };
  const pavilion = (y) => {
    const t = (y - 15) / 11;
    return [Math.round(5 + t * 11), Math.round(27 - t * 11)];
  };

  for (let y = 8; y <= 15; y++) {
    const [a, b] = crown(Math.min(14, Math.max(9, y)));
    r(ctx, a - 1, y, b - a + 3, 1, OUT);
  }
  for (let y = 15; y <= 27; y++) {
    const [a, b] = pavilion(Math.min(26, y));
    r(ctx, a - 1, y, b - a + 3, 1, OUT);
  }

  for (let y = 9; y <= 14; y++) {
    const [a, b] = crown(y);
    r(ctx, a, y, b - a + 1, 1, '#ffd44d');
  }
  for (let y = 15; y <= 25; y++) {
    const [a, b] = pavilion(y);
    r(ctx, a, y, b - a + 1, 1, '#fdb300');
    // The pavilion is two facets meeting at the centre line; darkening the
    // right half is what stops the gem reading as a flat triangle.
    const mid = 16;
    if (b > mid) r(ctx, mid + 1, y, b - mid, 1, '#e08800');
  }

  // Crown facets: the table, and the two bevels running down to the girdle.
  r(ctx, 11, 9, 11, 2, '#ffe89a');
  for (let i = 0; i < 5; i++) {
    r(ctx, 11 - i, 11 + i, 1, 1, '#e08800');
    r(ctx, 22 + i, 11 + i, 1, 1, '#e08800');
  }
  r(ctx, 5, 15, 23, 1, '#e08800');               // the girdle
}

/* ── 8 & 9. Adobe XD and InVision — application tiles ──────────────────── */

/**
 * A five-by-seven pixel alphabet, for the only four letters that need drawing.
 *
 * Drawn rather than set in a font because canvas text at 10px antialiases into
 * grey fog, and these have to survive being a third of a 32px icon.
 */
const LETTERS = {
  X: ['x...x', 'x...x', '.x.x.', '..x..', '.x.x.', 'x...x', 'x...x'],
  d: ['....x', '....x', '.xxxx', 'x...x', 'x...x', 'x...x', '.xxxx'],
  I: ['xxxxx', '..x..', '..x..', '..x..', '..x..', '..x..', 'xxxxx'],
  n: ['.....', '.....', 'x.xx.', 'xx..x', 'x...x', 'x...x', 'x...x'],
};

/** Two letters, centred, at double size. */
function letters(ctx, word, ink, cx, cy, scale = 2) {
  ctx.fillStyle = ink;
  const glyphW = 5 * scale;
  const total = word.length * glyphW + (word.length - 1) * scale;
  let x = Math.round(cx - total / 2);
  const y = Math.round(cy - (7 * scale) / 2);
  for (const ch of word) {
    const rows = LETTERS[ch];
    rows.forEach((row, ry) => {
      [...row].forEach((px, rx) => {
        if (px === 'x') ctx.fillRect(x + rx * scale, y + ry * scale, scale, scale);
      });
    });
    x += glyphW + scale;
  }
}

/**
 * The tile both share.
 *
 * A two-letter square is Adobe's convention rather than 1995's, but it is the
 * only thing that reads as "an application" at this size without becoming a
 * pixel-for-pixel trace of somebody's trademark — which is the line this file
 * stays on the right side of.
 */
function appTile(ctx, fill, hi, lo, ink, word) {
  plate(ctx, 3, 3, 26, 26, fill, hi, lo);
  letters(ctx, word, ink, 16, 16);
}

function adobeXd(ctx) {
  appTile(ctx, '#2e0a1e', '#5a2542', '#180410', '#ff61f6', 'Xd');
}

function invision(ctx) {
  appTile(ctx, '#e02d55', '#ff7a9c', '#8f1636', '#ffffff', 'In');
}

/* ── 10. Figma — the five-shape mark ───────────────────────────────────── */
function figma(ctx) {
  // Two columns, three rows, one cell empty at the bottom right. The colours
  // and that arrangement are the whole recognition; at 32px the rounded ends
  // of the real mark are a pixel or two and add nothing.
  const S = 9, x0 = 7, y0 = 3;
  const cell = (cx, cy, fill) => {
    r(ctx, x0 + cx * S, y0 + cy * S, S, S, OUT);
    r(ctx, x0 + cx * S + 1, y0 + cy * S + 1, S - 2, S - 2, fill);
  };
  cell(0, 0, '#f24e1e');
  cell(1, 0, '#ff7262');
  cell(0, 1, '#a259ff');
  cell(0, 2, '#0acf83');
  // The middle-right one is a circle, and leaving it square loses the mark.
  disc(ctx, x0 + S + 4, y0 + S + 4, 5, OUT);
  disc(ctx, x0 + S + 4, y0 + S + 4, 4, '#1abcfe');
}

/* ── 11. GitHub — the cat, at the size a favicon gets ──────────────────── */
function github(ctx) {
  disc(ctx, 16, 16, 14, OUT);
  disc(ctx, 16, 16, 13, '#1b1f23');

  const W = '#ffffff';
  const K = '#1b1f23';

  // Ears before the head, so the head overlaps their base.
  r(ctx, 9, 6, 3, 4, W);
  r(ctx, 20, 6, 3, 4, W);

  disc(ctx, 16, 12, 6, W);                     // head
  r(ctx, 10, 12, 12, 4, W);
  r(ctx, 13, 11, 2, 2, K);                     // eyes
  r(ctx, 17, 11, 2, 2, K);

  // A gap between head and body, then the tail curling away to the left. The
  // gap is what stops the whole thing reading as one blob.
  r(ctx, 11, 18, 10, 7, W);
  for (let i = 0; i < 4; i++) r(ctx, 9 - i, 19 + i, 2, 1, W);
  r(ctx, 5, 22, 2, 2, W);

  r(ctx, 13, 23, 2, 3, K);                     // legs
  r(ctx, 17, 23, 2, 3, K);
}

/* ── 12. OpenAI — the six-fold knot, as a rosette ──────────────────────── */
function openai(ctx) {
  disc(ctx, 16, 16, 14, OUT);
  disc(ctx, 16, 16, 13, '#0d0d0d');

  // Six lobes on a hexagon of side 6, each of radius 3, so neighbours just
  // touch instead of merging. At the first attempt they were radius 4 on the
  // same hexagon and overlapped into a plain donut, which is the one shape
  // this must not be.
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 2;
    disc(ctx, Math.round(16 + Math.cos(a) * 6), Math.round(16 + Math.sin(a) * 6), 3, '#ffffff');
  }
  disc(ctx, 16, 16, 3, '#ffffff');             // join the petals at the centre
  disc(ctx, 16, 16, 2, '#0d0d0d');             // and punch the eye back out
}

/* ── 13. Copilot — a small helpful robot ───────────────────────────────── */
function copilot(ctx) {
  r(ctx, 15, 3, 2, 4, OUT);                    // antenna
  r(ctx, 14, 2, 4, 2, '#26b50f');

  plate(ctx, 5, 7, 22, 18, '#e3e3e3');         // head
  r(ctx, 8, 11, 16, 8, OUT);                   // visor
  r(ctx, 9, 12, 14, 6, '#1a3a6b');
  r(ctx, 11, 14, 3, 3, '#7fd6ff');             // eyes
  r(ctx, 18, 14, 3, 3, '#7fd6ff');
  r(ctx, 3, 12, 3, 6, OUT);                    // ears
  r(ctx, 26, 12, 3, 6, OUT);
  r(ctx, 10, 21, 12, 2, '#8e8e8e');            // mouth grille
}

/**
 * name -> draw(ctx). Exported so the folder can ask for one by id without
 * knowing how any of them are built.
 */
export const DRAW = {
  'link-claude': claude,
  'link-turntable': turntable,
  'link-article': article,
  'link-chart': chart,
  'link-card': card,
  'link-pomodoro': pomodoro,
  'app-sketch': sketch,
  'app-xd': adobeXd,
  'app-invision': invision,
  'app-figma': figma,
  'app-github': github,
  'app-openai': openai,
  'app-copilot': copilot,
};

/** Rendered once each, then reused — drawImage takes a canvas directly. */
const cache = new Map();

export function linkIcon(name) {
  if (cache.has(name)) return cache.get(name);
  const draw = DRAW[name];
  if (!draw) return null;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  cache.set(name, c);
  return c;
}
