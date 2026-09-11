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

export const WINDOW = { w: 381, h: 278 };

/** The note's own name, which is also the window's. */
export const TITLE = "Rakshit's Computer";

/**
 * Paragraphs, verbatim. An empty string is a blank line, exactly as it would
 * sit in a .txt file.
 */
export const NOTE = [
  "Hey, I'm Rakshit. Welcome to my computer.",
  '',
  'It started with a beige box. I pressed the giant button, the screen came '
  + 'alive, and I disappeared into it for hours. Pinball. Paint. A Modem that '
  + 'screeched every time it connected. All of it held together by Windows 95.',
  '',
  "So I rebuilt it. Open My Photos for places I've been. My Music for the 3 "
  + "songs I play on repeat. My Documents for work I've shipped.",
  '',
  'Double click anything. Have fun.',
];

export const NOTE_SETTINGS = {
  x: 359,
  y: 78,
  ...WINDOW,
  title: TITLE,
  body: NOTE.join('\n'),
};

const TITLE_H = 18;
const MENU_H = 18;
const PAD = 6;
const SIZE = 12;
const LINE_H = 15;

export function layoutNotes(ctx, win) {
  const lines = win.body.split(/\r\n|\r|\n/).flatMap((para) => {
    const wrapped = wrapText(ctx, para, win.w - 12 - PAD * 2 - 4, {
      size: SIZE, font: FONT_MONO, breakWords: true,
    });
    return wrapped.length ? wrapped : [''];
  });
  const pageHeight = win.h - (3 + TITLE_H + 1 + MENU_H) - 9;
  const capacity = Math.max(1, Math.floor((pageHeight - PAD * 2) / LINE_H));
  const scrolling = lines.length + 1 > capacity;
  const visible = scrolling ? Math.max(1, capacity - 1) : capacity;
  const maxScroll = Math.max(0, lines.length + 1 - visible);
  return { lines, scrolling, visible, maxScroll };
}

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
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 24, y + 3, w - 48, TITLE_H);
  ctx.clip();
  text(ctx, `${win.title} - Notepad`, x + 24, y + 7, {
    color: C.white, bold: true, accelerators: false,
  });
  ctx.restore();

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

  const layout = layoutNotes(ctx, win);
  win.scroll = Math.max(0, Math.min(win.scroll ?? 0, layout.maxScroll));
  win.maxScroll = layout.maxScroll;
  const scrollH = layout.scrolling ? LINE_H : 0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(cx + 2, cy + 2, cw - 4, ch - 4 - scrollH);
  ctx.clip();

  let ly = cy + PAD;
  for (const line of layout.lines.slice(win.scroll, win.scroll + layout.visible)) {
    text(ctx, line, cx + PAD, ly, {
      size: SIZE, font: FONT_MONO, accelerators: false,
    });
    ly += LINE_H;
  }

  // The caret, parked at the end of the text. Notepad always had one, and its
  // absence is the kind of thing you notice without noticing.
  ctx.fillStyle = C.black;
  if (win.scroll + layout.visible > layout.lines.length) {
    ctx.fillRect(cx + PAD, ly, 1, SIZE);
  }

  ctx.restore();

  if (layout.scrolling) {
    const sy = cy + ch - LINE_H - 2;
    ctx.fillStyle = C.face;
    ctx.fillRect(cx + 2, sy, cw - 4, LINE_H);
    text(ctx, 'Scroll to read more', cx + PAD, sy + 2);
    for (const [label, delta, bx] of [['Up', -3, cx + cw - 70], ['Down', 3, cx + cw - 36]]) {
      const id = `notes:scroll:${label}`;
      const enabled = delta < 0 ? win.scroll > 0 : win.scroll < layout.maxScroll;
      panel(ctx, bx, sy, 32, LINE_H, hover === id ? 'sunken' : 'raised');
      text(ctx, label, bx + 3, sy + 2, { color: enabled ? C.black : C.shadow });
      if (enabled) hit.add(bx, sy, 32, LINE_H, id, { type: 'note-scroll', win, delta });
    }
  }
}
