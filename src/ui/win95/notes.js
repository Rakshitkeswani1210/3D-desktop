/**
 * notes.js — Notepad, with one note already open in it.
 *
 * The plainest window on the desktop and deliberately so: a title bar, four
 * menus, and a white field full of fixed-width text. Windows 95's Notepad had
 * no toolbar, no status bar and no formatting of any kind, and reproducing
 * that restraint is most of what makes it recognisable.
 *
 * Word Wrap is ON here. It shipped OFF, which meant a paragraph ran off the
 * right edge until you found Edit > Word Wrap — authentic, and useless for a
 * note somebody is meant to read.
 */

import { C, FS, FONT, FONT_MONO, panel, text, wrapText } from './chrome.js';
import { icon } from './icons.js';

export const WINDOW = { w: 604, h: 372 };

/** The note's own name, which is also the window's. */
export const TITLE = 'Welcome to My Computer';

/**
 * Paragraphs, verbatim. An empty string is a blank line, exactly as it would
 * sit in a .txt file.
 */
export const NOTE = [
  "Hey, I'm Rakshit. Welcome to my computer.",
  '',
  'It started with a beige box. My parents brought one home one day, and I '
  + 'remember pressing that giant button on the side, hearing it whirr, '
  + 'watching the screen come alive. I disappeared into it for hours. Pinball. '
  + 'Paint, mostly drawing things nobody asked for. Then a second box showed '
  + 'up, the Modem, and it screeched like it was in pain every time it '
  + 'connected. But it worked. And suddenly the world was right there. '
  + 'Internet Explorer was how I saw all of it. All of it held together by '
  + 'Windows 95. Start menu, teal desktop, that little startup chime.',
  '',
  "So this is my lil corner. Photos from places I've been. Work I've shipped. "
  + "And the 3 songs I've played so many times I should probably be embarrassed.",
  '',
  'Happy exploring. Nice to meet you.',
];

const TITLE_H = 18;
const MENU_H = 18;
const PAD = 6;
const SIZE = 12;
const LINE_H = 15;

export function drawNotes(ctx, win, hit, hover, active = true) {
  const { x, y, w, h } = win;

  hit.add(x, y, w, h, 'notes:window', { type: 'focus', win });
  panel(ctx, x, y, w, h, 'raised', C.face);

  /* title bar */
  ctx.fillStyle = active ? C.titlebar : C.titlebarOff;
  ctx.fillRect(x + 3, y + 3, w - 6, TITLE_H);
  hit.add(x + 3, y + 3, w - 6, TITLE_H, 'notes:titlebar', { type: 'drag', win });
  const glyph = icon('notepad-pen', 16);
  if (glyph) ctx.drawImage(glyph, x + 5, y + 4, 16, 16);
  text(ctx, `${TITLE} - Notepad`, x + 24, y + 7, { color: C.white, bold: true });

  const closeX = x + w - 3 - 18;
  panel(ctx, closeX, y + 4, 16, 16, hover === 'notes:close' ? 'sunken' : 'raised', C.face);
  ctx.fillStyle = C.black;
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(closeX + 4 + i, y + 8 + i, 1, 1);
    ctx.fillRect(closeX + 4 + i, y + 14 - i, 1, 1);
  }
  hit.add(closeX, y + 4, 16, 16, 'notes:close', { type: 'close', app: 'notes' });

  /* menu bar — Notepad's four, in Notepad's order */
  let mx = x + 8;
  const my = y + 3 + TITLE_H + 1;
  ctx.font = `${FS}px ${FONT}`;
  for (const label of ['&File', '&Edit', '&Search', '&Help']) {
    text(ctx, label, mx, my + 4);
    mx += ctx.measureText(label.replace('&', '')).width + 24;
  }

  /* the page */
  const cx = x + 6;
  const cy = my + MENU_H;
  const cw = w - 12;
  const ch = h - (cy - y) - 9;
  panel(ctx, cx, cy, cw, ch, 'field', C.white);

  ctx.save();
  ctx.beginPath();
  ctx.rect(cx + 2, cy + 2, cw - 4, ch - 4);
  ctx.clip();

  const maxW = cw - PAD * 2 - 4;
  let ly = cy + PAD;
  for (const para of NOTE) {
    if (!para) { ly += LINE_H; continue; }
    for (const line of wrapText(ctx, para, maxW, { size: SIZE, font: FONT_MONO })) {
      text(ctx, line, cx + PAD, ly, { size: SIZE, font: FONT_MONO });
      ly += LINE_H;
    }
  }

  // The caret, parked at the end of the text. Notepad always had one, and its
  // absence is the kind of thing you notice without noticing.
  ctx.fillStyle = C.black;
  ctx.fillRect(cx + PAD, ly, 1, SIZE);

  ctx.restore();
}
