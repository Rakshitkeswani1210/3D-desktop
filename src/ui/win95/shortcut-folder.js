/**
 * shortcut-folder.js — a folder full of shortcuts, and the two that exist.
 *
 * My Documents and the Recycle Bin are the same window with different contents,
 * so they are one draw function taking a list. The layout is Explorer's Large
 * Icons view: a 32px glyph over a centred caption, on a grid. The icons are
 * drawn rather than borrowed — see link-icons.js for why that is the right call
 * here and nowhere else in this UI.
 *
 * A shortcut cannot open inside this window the way the portfolio does in
 * Internet Explorer: that trick needs a DOM overlay warped onto the tube, and
 * it only works for one window at a time. Several would fight over the same
 * glass. So these hand off to a real browser tab, and the status bar names the
 * destination on hover, which is what the shell did.
 */

import { C, FS, FONT, panel, text, wrapText } from './chrome.js';
import { icon } from './icons.js';
import { linkIcon } from './link-icons.js';

export const DOCS_WINDOW = { w: 472, h: 292 };
export const BIN_WINDOW = { w: 472, h: 244 };
export const COMPUTER_WINDOW = { w: 472, h: 292 };

/** My Documents: things Rakshit has built or shipped. */
export const DOCUMENTS = [
  { id: 'claude-iterate', label: 'Claude iterate', glyph: 'link-claude',
    url: 'https://project-owi5z.vercel.app' },
  { id: 'turntable', label: 'Turntable', glyph: 'link-turntable',
    url: 'https://interactive-turntable-ui.vercel.app' },
  { id: 'yc-journey', label: 'YC journey', glyph: 'link-article',
    url: 'https://ycinfo.framer.website/is-originality-dead' },
  { id: 'groww', label: 'Groww', glyph: 'link-chart',
    url: 'https://groww.in/futures-and-options' },
  { id: 'razorpay', label: 'Razorpay', glyph: 'link-card',
    url: 'https://razorpay.com/payment-gateway/' },
];

/**
 * The Recycle Bin.
 *
 * A folder like any other — Windows 95's was, right down to the Large Icons
 * view. `origin` and `deleted` are what Explorer showed for a binned file, and
 * an item with no url is simply a thing sitting in the trash.
 *
 * The dates are the joke: each is roughly when that tool actually stopped
 * mattering. Sketch is the day Figma left preview; Adobe XD is the day the
 * Adobe-Figma deal collapsed, by which point XD was already in maintenance;
 * InVision is the day its service closed for good.
 */
export const RECYCLE_BIN = [
  { id: 'pomodoro', label: 'Pomodoro timer', glyph: 'link-pomodoro',
    url: 'https://pomodoro-timer-3d.vercel.app' },
  { id: 'sketch', label: 'Sketch', glyph: 'app-sketch',
    origin: 'C:\\Program Files\\Sketch', deleted: '27/09/2016' },
  { id: 'xd', label: 'Adobe XD', glyph: 'app-xd',
    origin: 'C:\\Program Files\\Adobe\\Adobe XD', deleted: '18/12/2023' },
  { id: 'invision', label: 'InVision', glyph: 'app-invision',
    origin: 'C:\\Program Files\\InVision', deleted: '31/12/2024' },
];

const TITLE_H = 18;
const MENU_H = 18;
const STATUS_H = 18;
const CELL_W = 106;
const CELL_H = 78;

export function drawShortcutFolder(ctx, win, items, state, hit, hover, active = true) {
  const { x, y, w, h } = win;
  const ns = win.app;   // hit ids are namespaced per window, not per app type

  hit.add(x, y, w, h, `${ns}:window`, { type: 'focus', win });
  panel(ctx, x, y, w, h, 'raised', C.face);

  /* title bar */
  ctx.fillStyle = active ? C.titlebar : C.titlebarOff;
  ctx.fillRect(x + 3, y + 3, w - 6, TITLE_H);
  hit.add(x + 3, y + 3, w - 6, TITLE_H, `${ns}:titlebar`, { type: 'drag', win });
  const folder = icon(win.icon, 16);
  if (folder) ctx.drawImage(folder, x + 5, y + 4, 16, 16);
  text(ctx, win.title, x + 24, y + 7, { color: C.white, bold: true });

  const closeX = x + w - 3 - 18;
  panel(ctx, closeX, y + 4, 16, 16, hover === `${ns}:close` ? 'sunken' : 'raised', C.face);
  ctx.fillStyle = C.black;
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(closeX + 4 + i, y + 8 + i, 1, 1);
    ctx.fillRect(closeX + 4 + i, y + 14 - i, 1, 1);
  }
  hit.add(closeX, y + 4, 16, 16, `${ns}:close`, { type: 'close', app: ns });

  /* menu bar */
  let mx = x + 8;
  const my = y + 3 + TITLE_H + 1;
  ctx.font = `${FS}px ${FONT}`;
  for (const label of ['&File', '&Edit', '&View', '&Help']) {
    text(ctx, label, mx, my + 4);
    mx += ctx.measureText(label.replace('&', '')).width + 24;
  }

  /* the well */
  const cx = x + 6;
  const cy = my + MENU_H;
  const cw = w - 12;
  const ch = h - (cy - y) - STATUS_H - 10;
  panel(ctx, cx, cy, cw, ch, 'field', C.white);

  ctx.save();
  ctx.beginPath();
  ctx.rect(cx + 2, cy + 2, cw - 4, ch - 4);
  ctx.clip();

  const cols = Math.max(1, Math.floor((cw - 8) / CELL_W));
  items.forEach((link, i) => {
    drawShortcut(
      ctx, link, ns,
      cx + 6 + (i % cols) * CELL_W,
      cy + 8 + Math.floor(i / cols) * CELL_H,
      hit, hover, state.selected === link.id
    );
  });

  ctx.restore();

  /* status bar — the destination, on hover, as Explorer did it */
  const sy = y + h - 3 - STATUS_H;
  const rightW = 96;
  panel(ctx, x + 3, sy, w - 6 - rightW - 2, STATUS_H, 'well', C.face);
  const shown = items.find((l) => hover === `${ns}:open:${l.id}`)
    || items.find((l) => l.id === state.selected);
  // A shortcut names where it goes; a deleted file names where it came from.
  let line = `${items.length} object(s)`;
  if (shown) line = shown.url || (shown.origin ? `Original location: ${shown.origin}` : shown.label);
  text(ctx, line, x + 9, sy + 4);
  panel(ctx, x + w - 3 - rightW, sy, rightW, STATUS_H, 'well', C.face);
  text(ctx, shown && shown.deleted ? shown.deleted : (shown && shown.url ? 'Shortcut' : ''),
       x + w - 3 - rightW + 6, sy + 4);
}

function drawShortcut(ctx, link, ns, x, y, hit, hover, selected) {
  const id = `${ns}:open:${link.id}`;
  const hot = hover === id;
  const cxm = x + CELL_W / 2;

  // Two kinds of item: one drawn for this UI, one of the shell's own bitmaps.
  const glyph = link.glyph ? linkIcon(link.glyph) : icon(link.icon, 32);
  if (glyph) {
    const gx = Math.round(cxm - 16);
    ctx.drawImage(glyph, gx, y, 32, 32);
    if (selected) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = C.select;
      ctx.fillRect(gx, y, 32, 32);
      ctx.restore();
    }
    // The shortcut badge, on links only: a deleted application is the thing
    // itself rather than a pointer to it, and Windows badged only the pointer.
    if (link.url) {
      ctx.fillStyle = C.black;
      ctx.fillRect(gx, y + 22, 10, 10);
      ctx.fillStyle = C.white;
      ctx.fillRect(gx + 1, y + 23, 8, 8);
      ctx.fillStyle = C.black;
      for (let i = 0; i < 5; i++) ctx.fillRect(gx + 2 + i, y + 29 - i, 1, 1);
      ctx.fillRect(gx + 5, y + 25, 3, 1);
      ctx.fillRect(gx + 7, y + 25, 1, 3);
    }
  }

  const lines = wrapText(ctx, link.label, CELL_W - 12, { size: FS }).slice(0, 2);
  const lineH = FS + 3;
  lines.forEach((line, i) => {
    ctx.font = `${FS}px ${FONT}`;
    const lw = Math.ceil(ctx.measureText(line).width);
    const lx = Math.round(cxm - lw / 2);
    const ly = y + 36 + i * lineH;
    if (selected || hot) {
      ctx.fillStyle = selected ? C.select : '#d8d8f0';
      ctx.fillRect(lx - 2, ly - 1, lw + 4, lineH);
    }
    text(ctx, line, lx, ly, { color: selected ? C.white : C.black });
  });

  hit.add(x + 8, y, CELL_W - 16, CELL_H - 8, id, { type: 'shortcut', link, ns });
}
