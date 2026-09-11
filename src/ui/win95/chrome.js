/**
 * chrome.js — Windows 95 controls, drawn with fillRect.
 *
 * The CRT's picture is an 800x600 canvas, so the stylesheet in
 * .claude/skills/win95-ui cannot apply here. This is the same system ported to
 * 2D context calls, and it is a faithful port: identical palette, identical
 * band order, identical metrics.
 *
 * Two things differ from the stylesheet, both because of the resolution:
 *
 *   - The bevel band is 1px, not 2px. The Figma file is drawn at 2x for modern
 *     displays; 800x600 is the real thing at 96dpi, where every band was one
 *     pixel. Metrics are halved to match — 28px taskbar, 22px buttons, 11px
 *     text — which is not a compromise but the authentic original.
 *
 *   - Nothing here has states. This is a picture of a desktop, not a desktop.
 *     The pressed and focused styles are implemented anyway, because the
 *     taskbar's active tab needs the pressed one and it costs nothing to
 *     expose the rest.
 *
 * The whole system is one grey face lit from the top-left. Get the four bands
 * right and everything else follows.
 */

/* ── palette ─────────────────────────────────────────────────────────────
   Straight from the Figma file's published variables. The four bevel greys
   are hardcoded there rather than tokenised, so they are hardcoded here. */
export const C = {
  face: '#c3c3c3',
  faceLit: '#e3e3e3',
  white: '#ffffff',
  black: '#000000',

  hilight: '#f0f0f0',   // outer top-left — the lit edge
  light: '#b1b1b1',     // inner top-left
  shadow: '#7e7e7e',    // inner bottom-right
  dkshadow: '#262626',  // outer bottom-right

  titlebar: '#02007f',
  titlebarOff: '#8e8e8e',
  select: '#000ea3',
  desktop: '#008282',
  disabled: '#a0a0a0',
};

export const FONT = '"W95FA", "MS Sans Serif", Tahoma, Geneva, Verdana, sans-serif';

/**
 * What a web page rendered in this era looked like.
 *
 * Browsers of the period defaulted to a serif at 12pt and almost nobody
 * overrode it, which is why every page from 1996 has the same voice. Using it
 * for page CONTENT while the chrome stays in the UI font is most of what makes
 * a browser window read as a browser rather than as another dialog.
 */
export const FONT_SERIF = '"Times New Roman", Times, Georgia, serif';

/**
 * Notepad's font.
 *
 * Windows 95 shipped Notepad set in Fixedsys — a fixed-width bitmap face, not a
 * choice anyone made so much as a default nobody changed. It is why every
 * README and every note anybody typed in 1996 looks the way it does, and why a
 * proportional font in a Notepad window reads as wrong without being able to
 * say why.
 */
export const FONT_MONO = '"Fixedsys", "Lucida Console", "Courier New", monospace';
export const FS = 11;

/**
 * The four bevels, as (outer TL, inner TL, inner BR, outer BR).
 *
 * `sunken` and `field` are NOT the same, and swapping them is the classic
 * mistake: sunken's outer top-left is the darkest value and reads as "this
 * button is held down", while field's is one step softer and reads as "this is
 * a hole you look into". Text fields, list boxes and content wells are fields.
 */
const BANDS = {
  raised: [C.hilight, C.light, C.shadow, C.dkshadow],
  sunken: [C.dkshadow, C.shadow, C.light, C.hilight],
  field: [C.shadow, C.dkshadow, C.light, C.hilight],
  well: [C.shadow, null, null, C.hilight],
};

/**
 * Draw a bevel frame. Nothing is filled — see panel() for face + bevel.
 *
 * Band order matters and is the reverse of the CSS: there the outer shadows
 * are listed first because earlier shadows paint on top, so here the inner
 * pair goes down first and the outer pair covers it. Within each pair the
 * bottom-right goes first so the top-left owns the shared corners, which is
 * again what the stylesheet's ordering produces.
 */
export function bevel(ctx, x, y, w, h, kind = 'raised', b = 1) {
  const [oTL, iTL, iBR, oBR] = BANDS[kind] || BANDS.raised;

  if (iBR) {
    ctx.fillStyle = iBR;
    ctx.fillRect(x + b, y + h - 2 * b, w - 2 * b, b);   // inner bottom
    ctx.fillRect(x + w - 2 * b, y + b, b, h - 2 * b);   // inner right
  }
  if (iTL) {
    ctx.fillStyle = iTL;
    ctx.fillRect(x + b, y + b, w - 2 * b, b);           // inner top
    ctx.fillRect(x + b, y + b, b, h - 2 * b);           // inner left
  }
  ctx.fillStyle = oBR;
  ctx.fillRect(x, y + h - b, w, b);                     // outer bottom
  ctx.fillRect(x + w - b, y, b, h);                     // outer right

  ctx.fillStyle = oTL;
  ctx.fillRect(x, y, w, b);                             // outer top
  ctx.fillRect(x, y, b, h);                             // outer left
}

/** Face colour plus a bevel — the shape almost every control actually is. */
export function panel(ctx, x, y, w, h, kind = 'raised', fill = C.face, b = 1) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  bevel(ctx, x, y, w, h, kind, b);
}

/* ── text ───────────────────────────────────────────────────────────────── */

/**
 * Draw a label, honouring Windows' own `&` accelerator marker: "&File" draws
 * "File" with the F underlined.
 *
 * The underline is not decoration. Every menu, button and label in Windows 95
 * marks its keyboard letter this way, and dropping it is the single fastest
 * way to look like a modern imitation of the era rather than the era.
 */
export function text(ctx, str, x, y, {
  color = C.black, size = FS, align = 'left', baseline = 'top', bold = false,
  font = FONT, underline = false, italic = false, accelerators = true,
} = {}) {
  ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${font}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;

  const plain = accelerators ? str.replace(/&(.)/g, '$1') : str;
  let startX = x;
  if (align === 'center') startX = x - ctx.measureText(plain).width / 2;
  else if (align === 'right') startX = x - ctx.measureText(plain).width;

  const hit = accelerators ? str.indexOf('&') : -1;
  if (hit < 0) {
    ctx.fillText(str, startX, y);
    const w = ctx.measureText(str).width;
    if (underline) ctx.fillRect(Math.round(startX), Math.round(y + size * 0.92), Math.round(w), 1);
    return w;
  }

  const before = str.slice(0, hit);
  const key = str[hit + 1];
  const after = str.slice(hit + 2);

  ctx.fillText(before, startX, y);
  const kx = startX + ctx.measureText(before).width;
  ctx.fillText(key, kx, y);
  const kw = ctx.measureText(key).width;
  ctx.fillText(after, kx + kw, y);

  // One pixel, hard, sitting just under the glyph. The offset is 0.92em rather
  // than a round number because textBaseline is 'top': the baseline sits at
  // roughly 0.8em and the descenders reach 1em, so anything at y + size floats
  // clear of the word and reads as a stray dash instead of an underline.
  ctx.fillRect(Math.round(kx), Math.round(y + size * 0.92), Math.round(kw), 1);
  return ctx.measureText(plain).width;
}

/** Text with the embossed grey Windows used for anything unavailable. */
export function disabledText(ctx, str, x, y, opts = {}) {
  text(ctx, str, x + 1, y + 1, { ...opts, color: C.hilight });
  text(ctx, str, x, y, { ...opts, color: C.disabled });
}

/* ── controls ────────────────────────────────────────────────────────────── */

/**
 * A push button.
 *
 * `pressed` both flips the bevel and shifts the label down-right by one pixel.
 * That shift is what sells the click; a button that only inverts its bevel
 * looks like it is stuck rather than held.
 */
export function button(ctx, x, y, w, h, label, {
  pressed = false, icon = null, iconSize = 16, bold = false, focus = false,
  accelerators = true,
} = {}) {
  panel(ctx, x, y, w, h, pressed ? 'sunken' : 'raised', pressed ? C.faceLit : C.face);
  const d = pressed ? 1 : 0;

  let tx = x + 6 + d;
  if (icon) {
    ctx.drawImage(icon, tx, y + Math.round((h - iconSize) / 2) + d, iconSize, iconSize);
    tx += iconSize + 4;
  }
  if (label) {
    text(ctx, label, tx, y + Math.round((h - FS) / 2) + d - 1, { bold, accelerators });
  }
  if (focus) focusRect(ctx, x + 3, y + 3, w - 6, h - 6);
}

/**
 * The dotted focus rectangle.
 *
 * Windows drew this as alternating pixels rather than a dashed line, which is
 * why it reads as a texture rather than as a border. setLineDash would draw a
 * dash of whatever length the platform felt like.
 */
export function focusRect(ctx, x, y, w, h) {
  ctx.fillStyle = C.black;
  for (let i = 0; i < w; i += 2) {
    ctx.fillRect(x + i, y, 1, 1);
    ctx.fillRect(x + i, y + h - 1, 1, 1);
  }
  for (let i = 0; i < h; i += 2) {
    ctx.fillRect(x, y + i, 1, 1);
    ctx.fillRect(x + w - 1, y + i, 1, 1);
  }
}

/** The two-band groove that separates menu sections and toolbar groups. */
export function divider(ctx, x, y, w) {
  ctx.fillStyle = C.shadow;
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = C.hilight;
  ctx.fillRect(x, y + 1, w, 1);
}

/**
 * A window frame: raised face, title bar, and the three title-bar buttons.
 * Returns the content rectangle so the caller can fill it however it likes.
 */
export function windowFrame(ctx, x, y, w, h, title, {
  icon = null, active = true, buttons = true,
} = {}) {
  panel(ctx, x, y, w, h, 'raised', C.face);

  const barX = x + 3;
  const barY = y + 3;
  const barW = w - 6;
  const barH = 18;

  ctx.fillStyle = active ? C.titlebar : C.titlebarOff;
  ctx.fillRect(barX, barY, barW, barH);

  let tx = barX + 3;
  if (icon) {
    ctx.drawImage(icon, tx, barY + 1, 16, 16);
    tx += 19;
  }
  text(ctx, title, tx, barY + 4, { color: C.white, bold: true });

  if (buttons) {
    const bw = 16;
    let bx = barX + barW - bw - 2;
    titleButton(ctx, bx, barY + 1, bw, 'close');
    bx -= bw + 2;
    titleButton(ctx, bx, barY + 1, bw, 'maximize');
    bx -= bw;
    titleButton(ctx, bx, barY + 1, bw, 'minimize');
  }

  return { x: x + 3, y: barY + barH + 1, w: w - 6, h: h - barH - 8 };
}

/** Minimise / maximise / close, drawn as pixel shapes rather than glyphs. */
function titleButton(ctx, x, y, s, glyph) {
  panel(ctx, x, y, s, s, 'raised', C.face);
  ctx.fillStyle = C.black;
  const cx = x + s / 2;

  if (glyph === 'minimize') {
    ctx.fillRect(x + 3, y + s - 5, 6, 2);
  } else if (glyph === 'maximize') {
    ctx.fillRect(x + 3, y + 3, s - 6, s - 6);
    ctx.fillStyle = C.face;
    ctx.fillRect(x + 4, y + 5, s - 8, s - 9);
  } else {
    // A hand-plotted X: two 7px diagonals. Drawing it with lineTo produces a
    // soft grey smear at this size, which is worse than no glyph at all.
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(Math.round(cx - 3.5 + i), y + 4 + i, 1, 1);
      ctx.fillRect(Math.round(cx - 3.5 + i), y + 10 - i, 1, 1);
    }
  }
}

/** A desktop icon: 32px glyph over a centred, possibly two-line label. */
export function desktopIcon(ctx, x, y, cellW, img, label, { selected = false } = {}) {
  const cx = x + cellW / 2;

  if (img) {
    if (selected) {
      // Windows tinted the selection blue THROUGH the icon. Compositing the
      // fill with 'source-atop' inside a clip does that without touching the
      // transparent pixels around the glyph.
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - 16, y, 32, 32);
      ctx.clip();
      ctx.drawImage(img, cx - 16, y, 32, 32);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = C.select;
      ctx.fillRect(cx - 16, y, 32, 32);
      ctx.restore();
    } else {
      ctx.drawImage(img, cx - 16, y, 32, 32);
    }
  }

  // Labels wrap to two lines on the space nearest the middle, which is what
  // the shell did — never mid-word, and never to three lines.
  ctx.font = `${FS}px ${FONT}`;
  const maxW = cellW - 4;
  let lines = [label];
  if (ctx.measureText(label).width > maxW && label.includes(' ')) {
    const words = label.split(' ');
    let best = 1, bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const diff = Math.abs(ctx.measureText(a).width - ctx.measureText(b).width);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }

  const lineH = FS + 3;
  lines.forEach((line, i) => {
    const lw = Math.ceil(ctx.measureText(line).width);
    const ly = y + 34 + i * lineH;
    const lx = Math.round(cx - lw / 2);
    // Unselected labels sit on the wallpaper with no plate behind them; the
    // selected one inverts to the selection blue with a dotted focus ring.
    ctx.fillStyle = selected ? C.select : 'transparent';
    if (selected) ctx.fillRect(lx - 2, ly - 1, lw + 4, lineH);
    text(ctx, line, lx, ly, { color: C.white });
    if (selected) focusRect(ctx, lx - 2, ly - 1, lw + 4, lineH);
  });
}

/**
 * Break `str` into lines that fit `maxWidth`.
 *
 * Greedy and word-based, which is what a browser of this era did too — no
 * hyphenation, no justification, and a word longer than the line simply
 * overhangs rather than being chopped, unless `breakWords` is requested.
 */
export function wrapText(ctx, str, maxWidth, {
  size = FS, font = FONT, bold = false, breakWords = false,
} = {}) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
  const lines = [];
  let line = '';
  for (const word of str.split(/\s+/)) {
    if (breakWords && ctx.measureText(word).width > maxWidth) {
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (line && ctx.measureText(line + char).width > maxWidth) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
      continue;
    }
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
