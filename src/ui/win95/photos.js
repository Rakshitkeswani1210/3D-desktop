/**
 * photos.js — "Rakshit's Memories", as a Windows folder full of pictures.
 *
 * Two windows live here: the folder itself, which lays the photos out in a
 * grid, and a viewer for one photo at a time.
 *
 * A small, deliberate anachronism: Windows 95's Explorer had Large Icons,
 * Small Icons, List and Details, and NO thumbnail view — every JPEG showed the
 * same generic bitmap glyph, and you found a photo by remembering its name.
 * Thumbnails arrived with Windows 98. Nine identical yellow icons would defeat
 * the entire point of a folder of memories, so this borrows 98's thumbnail
 * grid and keeps everything else — the bevels, the caption under each tile,
 * the selection colour — exactly as 95 drew it.
 *
 * The captions are the FILENAMES, untouched. They carry the description of
 * each photo, which is the whole reason they read as memories rather than as
 * DSC_0431.JPG.
 */

import { C, FS, FONT, panel, text, wrapText } from './chrome.js';
import { icon } from './icons.js';

const base = (kind, slug) =>
  new URL(`../../../assets/photos/${kind}/${slug}.jpg`, import.meta.url).href;

/**
 * The folder's contents, in the order they hang on the wall.
 *
 * Two fields, deliberately separate: `slug` is the file on disk and must not
 * change, `label` is the caption and is free to. They started out the same —
 * the captions were the original filenames — but a caption is a thing you
 * rewrite and a filename is a thing other code depends on, so tying them
 * together would mean every reworded caption silently broke an image.
 *
 * This list is the whole folder: a photo is shown because it is named here.
 * "Car crash" is converted and sitting in assets/photos but deliberately not
 * listed, so putting its line back is all it takes to bring it out again.
 */
export const PHOTOS = [
  ['iceland', 'Trip to Iceland'],
  ['royce-peak', 'hiking Royce peak'],
  ['syndey', 'Syndey'],
  ['enchanments-washington', 'Enchanments Washington'],
  ['running-on-greenlake', 'Running on Greenlake'],
  ['tennis', 'I also play tennis'],
  ['lake-tekapo-darkest-place-on-earth', 'Lake Tekapo Darkest Place on Earth'],
  ['alpaca', 'Found Alpacas.'],
].map(([slug, label]) => ({
  slug,
  label,
  thumb: base('thumb', slug),
  view: base('view', slug),
}));

export const WINDOW = { w: 664, h: 486 };
export const VIEWER = { w: 620, h: 470 };

const TITLE_H = 18;
const MENU_H = 18;
const STATUS_H = 18;
const CELL_W = 158;
const CELL_H = 128;
const TILE = 92;          // the square a thumbnail is fitted inside

/* ── image loading ───────────────────────────────────────────────────────
   Thumbnails are fetched when the folder opens; a full-size view only when
   somebody actually asks for that photo. Loading 2.7MB of memories to draw
   nine 92px tiles would be silly. */

const cache = new Map();
let onLoad = () => {};

/** Tell the shell to repaint when an image finishes decoding. */
export function onImageLoad(fn) { onLoad = fn; }

function image(src) {
  if (cache.has(src)) return cache.get(src);
  const img = new Image();
  // Never reject: a missing photo should cost one tile, not the window.
  img.onload = () => { img.__ready = true; onLoad(); };
  img.onerror = () => { img.__failed = true; onLoad(); };
  img.src = src;
  cache.set(src, img);
  return img;
}

export function preloadThumbs() { PHOTOS.forEach((p) => image(p.thumb)); }

/** Largest rect of `img`'s aspect that fits in w x h, centred on (x, y). */
function fit(img, x, y, w, h) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = Math.round(img.naturalWidth * scale);
  const dh = Math.round(img.naturalHeight * scale);
  return { x: Math.round(x + (w - dw) / 2), y: Math.round(y + (h - dh) / 2), w: dw, h: dh };
}

/* ── the folder ──────────────────────────────────────────────────────── */

export function drawPhotos(ctx, win, state, hit, hover, active = true) {
  const { x, y, w, h } = win;

  hit.add(x, y, w, h, 'photos:window', { type: 'focus', win });
  panel(ctx, x, y, w, h, 'raised', C.face);

  /* title bar */
  ctx.fillStyle = active ? C.titlebar : C.titlebarOff;
  ctx.fillRect(x + 3, y + 3, w - 6, TITLE_H);
  hit.add(x + 3, y + 3, w - 6, TITLE_H, 'photos:titlebar', { type: 'drag', win });
  const folder = icon('folder-pictures', 16);
  if (folder) ctx.drawImage(folder, x + 5, y + 4, 16, 16);
  text(ctx, "Rakshit's Memories", x + 24, y + 7, { color: C.white, bold: true });

  const closeX = x + w - 3 - 18;
  panel(ctx, closeX, y + 4, 16, 16, hover === 'photos:close' ? 'sunken' : 'raised', C.face);
  ctx.fillStyle = C.black;
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(closeX + 4 + i, y + 8 + i, 1, 1);
    ctx.fillRect(closeX + 4 + i, y + 14 - i, 1, 1);
  }
  hit.add(closeX, y + 4, 16, 16, 'photos:close', { type: 'close', app: 'photos' });

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
  PHOTOS.forEach((photo, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const px = cx + 6 + col * CELL_W;
    const py = cy + 6 + row * CELL_H - state.scroll;
    drawTile(ctx, photo, px, py, hit, hover, state.selected === photo.slug);
  });

  ctx.restore();

  /* status bar */
  const sy = y + h - 3 - STATUS_H;
  const rightW = 150;
  panel(ctx, x + 3, sy, w - 6 - rightW - 2, STATUS_H, 'well', C.face);
  const sel = PHOTOS.find((p) => p.slug === state.selected);
  text(ctx, sel ? `1 object selected` : `${PHOTOS.length} object(s)`, x + 9, sy + 4);
  panel(ctx, x + w - 3 - rightW, sy, rightW, STATUS_H, 'well', C.face);
  text(ctx, sel ? sel.label : "Rakshit's Memories", x + w - 3 - rightW + 6, sy + 4);
}

function drawTile(ctx, photo, x, y, hit, hover, selected) {
  const id = `photos:open:${photo.slug}`;
  const hot = hover === id;
  const cxm = x + CELL_W / 2;

  // The tile: a sunken frame with the photo fitted inside, which is how 98
  // drew a thumbnail and is close enough to 95's icon well to sit right.
  const fx = Math.round(cxm - TILE / 2);
  panel(ctx, fx, y, TILE, TILE, 'field', '#ffffff');

  const img = image(photo.thumb);
  if (img.__ready) {
    const r = fit(img, fx + 3, y + 3, TILE - 6, TILE - 6);
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    if (selected) {
      // Windows tinted the selection through the icon rather than around it.
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = C.select;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  } else if (img.__failed) {
    text(ctx, '?', cxm, y + TILE / 2 - 6, { align: 'center', color: C.disabled });
  }

  // Caption: two lines maximum, ellipsised, exactly as the shell did it.
  const maxW = CELL_W - 12;
  let lines = wrapText(ctx, photo.label, maxW, { size: FS });
  if (lines.length > 2) {
    lines = lines.slice(0, 2);
    ctx.font = `${FS}px ${FONT}`;
    while (lines[1] && ctx.measureText(`${lines[1]}...`).width > maxW) {
      lines[1] = lines[1].slice(0, -1);
    }
    lines[1] += '...';
  }

  const lineH = FS + 3;
  lines.forEach((line, i) => {
    ctx.font = `${FS}px ${FONT}`;
    const lw = Math.ceil(ctx.measureText(line).width);
    const lx = Math.round(cxm - lw / 2);
    const ly = y + TILE + 4 + i * lineH;
    if (selected || hot) {
      ctx.fillStyle = selected ? C.select : '#d8d8f0';
      ctx.fillRect(lx - 2, ly - 1, lw + 4, lineH);
    }
    text(ctx, line, lx, ly, { color: selected ? C.white : C.black });
  });

  hit.add(x + 6, y, CELL_W - 12, CELL_H - 6, id, { type: 'photo', photo });
}

/* ── the viewer ──────────────────────────────────────────────────────── */

export function drawPhotoViewer(ctx, win, hit, hover, active = true) {
  const { x, y, w, h, photo } = win;

  hit.add(x, y, w, h, 'photoview:window', { type: 'focus', win });
  panel(ctx, x, y, w, h, 'raised', C.face);

  ctx.fillStyle = active ? C.titlebar : C.titlebarOff;
  ctx.fillRect(x + 3, y + 3, w - 6, TITLE_H);
  hit.add(x + 3, y + 3, w - 6, TITLE_H, 'photoview:titlebar', { type: 'drag', win });
  const glyph = icon('document-image', 16);
  if (glyph) ctx.drawImage(glyph, x + 5, y + 4, 16, 16);
  text(ctx, `${photo.label} - Imaging`, x + 24, y + 7, { color: C.white, bold: true });

  const closeX = x + w - 3 - 18;
  panel(ctx, closeX, y + 4, 16, 16, hover === 'photoview:close' ? 'sunken' : 'raised', C.face);
  ctx.fillStyle = C.black;
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(closeX + 4 + i, y + 8 + i, 1, 1);
    ctx.fillRect(closeX + 4 + i, y + 14 - i, 1, 1);
  }
  hit.add(closeX, y + 4, 16, 16, 'photoview:close', { type: 'close', app: 'photo-view' });

  const cx = x + 6;
  const cy = y + 3 + TITLE_H + 3;
  const cw = w - 12;
  const ch = h - (cy - y) - STATUS_H - 10;
  // Grey, not white: an image viewer's mat is what tells you where the photo
  // ends and the application begins.
  panel(ctx, cx, cy, cw, ch, 'field', '#6e6e6e');

  const img = image(photo.view);
  if (img.__ready) {
    const r = fit(img, cx + 3, cy + 3, cw - 6, ch - 6);
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
  } else {
    text(ctx, img.__failed ? 'Cannot open this file.' : 'Opening...',
         cx + cw / 2, cy + ch / 2 - 6, { align: 'center', color: C.white });
  }

  const sy = y + h - 3 - STATUS_H;
  panel(ctx, x + 3, sy, w - 6, STATUS_H, 'well', C.face);
  const size = img.__ready ? `${img.naturalWidth} x ${img.naturalHeight}` : '';
  text(ctx, img.__ready ? `${photo.label}    ${size}` : 'Opening...', x + 9, sy + 4);
}
