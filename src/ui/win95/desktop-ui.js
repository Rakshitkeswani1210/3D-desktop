/**
 * desktop-ui.js — the wallpaper, the icons, the taskbar and the Start menu.
 *
 * These are the pieces of the shell that are not applications. shell.js
 * composes them with whatever windows are open; nothing here knows what an
 * application is, and nothing here holds state.
 *
 * Every draw takes a `hit` collector and registers the rectangle of anything
 * clickable as it draws it. That is the whole reason the hit boxes stay honest:
 * a control's geometry is written down once, and the pointer code reads the
 * same numbers the pixels came from.
 *
 * Metrics are authentic 96dpi Windows 95, because the raster genuinely is
 * 800x600: 28px taskbar, 22px buttons, 32px icons on a 75px grid, 11px text.
 */

import { C, FS, FONT, panel, button, text, divider, desktopIcon } from './chrome.js';
import { icon } from './icons.js';

export const TASKBAR_H = 28;
const ICON_GRID = { x: 6, y: 8, cellWidth: 76, rowHeight: 74 };

/**
 * The desktop icons, in shell order.
 *
 * Windows 95 shipped My Computer, Network Neighborhood, Inbox and Recycle Bin
 * and let you add the rest; this is that set with the folders and the one note
 * that make it somebody's machine rather than a fresh install. The Recycle Bin
 * is drawn full on purpose, for the same reason.
 */
export const DESKTOP_ICONS = [
  { id: 'computer', icon: 'computer-system', label: 'My Computer', app: 'computer' },
  { id: 'documents', icon: 'folder-open-documents', label: 'My Documents', app: 'documents' },
  { id: 'music', icon: 'audio-cd', label: 'My Music', app: 'music' },
  { id: 'photos', icon: 'folder-pictures', label: 'My Photos', app: 'photos' },
  { id: 'notes', icon: 'notepad-pen', label: 'Notes', app: 'notes' },
  { id: 'internet', icon: 'internet-explorer', label: 'Internet Explorer', app: 'browser' },
  { id: 'bin', icon: 'recycle-bin-full', label: 'Recycle Bin', app: 'recycle-bin' },
];

/**
 * What My Computer contains: everything else on the desktop.
 *
 * Derived rather than listed, so adding a desktop icon puts it in both places
 * and the two can never disagree. Windows 95's My Computer showed drives and
 * control panels; this machine's contents are its applications, which is the
 * honest equivalent when there are no drives to speak of.
 */
export const COMPUTER_CONTENTS = DESKTOP_ICONS.filter((i) => i.id !== 'computer');

export const START_ITEMS = [
  { id: 'programs', icon: 'folder-programs', label: '&Programs', sub: true },
  { id: 'docs', icon: 'folder-open-documents', label: '&Documents', sub: true },
  { id: 'settings', icon: 'settings-gear', label: '&Settings', sub: true },
  { id: 'find', icon: 'find-file', label: '&Find', sub: true },
  { id: 'help', icon: 'help-book', label: '&Help' },
  { id: 'run', icon: 'document-text', label: '&Run...' },
  { separator: true },
  { id: 'shutdown', icon: 'computer-system', label: 'Sh&ut Down...' },
];

export function drawWallpaper(ctx, w, h) {
  ctx.fillStyle = C.desktop;
  ctx.fillRect(0, 0, w, h);
}

/**
 * The left-hand column, on the 75px grid the shell arranged icons to.
 *
 * Hovering draws the SELECTED state. Windows 95 had no hover feedback on the
 * desktop at all — that arrived with XP — but this desktop is a texture on a
 * curved tube seen at an angle, and without some response to the pointer,
 * aiming at a 32px icon is guesswork. Borrowing the era's own selection visual
 * is the least anachronistic way to answer that.
 */
export function drawIconGrid(ctx, state, hit, hover) {
  const { x: X, y: Y, cellWidth: CELL_W, rowHeight: ROW_H } = ICON_GRID;

  DESKTOP_ICONS.forEach((item, i) => {
    const y = Y + i * ROW_H;
    const id = `icon:${item.id}`;
    desktopIcon(ctx, X, y, CELL_W, icon(item.icon, 32), item.label, {
      selected: hover === id || state.selected === i,
    });
    hit.add(X, y, CELL_W, ROW_H - 6, id, { type: 'icon', index: i, item });
  });
}

export function drawTourHint(ctx, tourId) {
  const index = DESKTOP_ICONS.findIndex((item) => item.id === tourId);
  if (index < 0) return;
  const { x, y, cellWidth, rowHeight } = ICON_GRID;
  tourTip(ctx, x + cellWidth - 6, y + index * rowHeight + 10,
    `Click to open ${DESKTOP_ICONS[index].label}`);
}

/**
 * The nudge toward the next thing worth opening.
 *
 * Three testers all said the same thing: they did not realise the desktop was
 * clickable. This is the answer, and it is a Windows 95 tooltip rather than a
 * modern callout for one reason — the shell had exactly this widget, pale
 * yellow with a hairline border, so guidance can be added without anything
 * appearing on screen that the era would not have drawn.
 */
function tourTip(ctx, x, y, label) {
  ctx.font = `${FS}px ${FONT}`;
  const w = Math.ceil(ctx.measureText(label).width) + 14;
  const h = 20;
  const ax = x + 7;              // leave room for the pointer on the left

  // The pointer: a solid triangle aimed back at the icon.
  ctx.fillStyle = C.black;
  for (let i = 0; i < 7; i++) ctx.fillRect(x + i, y + h / 2 - i, 1, i * 2 + 1);

  ctx.fillStyle = '#ffffe1';     // the tooltip yellow, unchanged since 1995
  ctx.fillRect(ax, y, w, h);
  ctx.strokeStyle = C.black;
  ctx.lineWidth = 1;
  ctx.strokeRect(ax + 0.5, y + 0.5, w - 1, h - 1);

  text(ctx, label, ax + 7, y + 5);
}

export function drawTaskbar(ctx, w, h, state, hit, hover) {
  const y = h - TASKBAR_H;

  ctx.fillStyle = C.face;
  ctx.fillRect(0, y, w, TASKBAR_H);
  // Not a full bevel — just a lit top edge, so it reads as the floor of the
  // screen rather than as a control sitting on it.
  ctx.fillStyle = C.hilight;
  ctx.fillRect(0, y, w, 1);

  const btnY = y + 4;
  const btnH = 22;

  button(ctx, 2, btnY, 54, btnH, '&Start', {
    icon: icon('windows-flag', 16), iconSize: 16, bold: true,
    pressed: state.startOpen || hover === 'start',
  });
  hit.add(2, btnY, 54, btnH, 'start', { type: 'start' });

  // The tray is right-anchored, so it is measured first and the program tabs
  // take whatever is left between it and the Start button.
  const clock = clockLabel(state.time);
  ctx.font = `${FS}px ${FONT}`;
  const trayW = Math.ceil(ctx.measureText(clock).width) + 16;
  const trayX = w - trayW - 2;
  panel(ctx, trayX, btnY, trayW, btnH, 'well', C.face);
  text(ctx, clock, trayX + trayW - 8, btnY + 6, { align: 'right' });

  const tabsX = 60;
  const tabsW = trayX - tabsX - 4;
  const open = state.windows;
  if (!open.length) return;

  const tabW = Math.min(160, Math.floor((tabsW - (open.length - 1) * 3) / open.length));
  open.forEach((win, i) => {
    const x = tabsX + i * (tabW + 3);
    if (x + tabW > trayX - 4) return;
    const id = `task:${win.app}`;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, btnY, tabW, btnH);
    ctx.clip();
    button(ctx, x, btnY, tabW, btnH, win.title, {
      icon: icon(win.icon, 16), iconSize: 16,
      pressed: !win.minimized,
      accelerators: win.app !== 'notes',
    });
    ctx.restore();
    hit.add(x, btnY, tabW, btnH, id, { type: 'task', app: win.app });
  });
}

/**
 * The Start menu.
 *
 * The vertical "Windows 95" banner down the left edge is the detail everyone
 * forgets, and the Figma design system this UI is built from omits it too. It
 * is in the real shell, so it is here.
 */
export function drawStartMenu(ctx, bottomY, hit, hover) {
  const BANNER_W = 21;
  const ROW_H = 32;
  const MENU_W = 168;
  const PAD = 2;

  const bodyH = START_ITEMS.reduce((n, it) => n + (it.separator ? 7 : ROW_H), 0);
  const totalH = bodyH + PAD * 2;
  const totalW = BANNER_W + MENU_W + PAD * 2;
  const x = 2;
  const y = bottomY - totalH;

  // Swallow clicks that land on the menu but not on an item, so a near miss
  // does not fall through and dismiss the thing you were aiming at.
  hit.add(x, y, totalW, totalH, 'startmenu', { type: 'nothing' });

  panel(ctx, x, y, totalW, totalH, 'raised', C.face);

  const bandX = x + PAD;
  const bandY = y + PAD;
  const bandH = totalH - PAD * 2;
  // Light at the top, deep navy at the bottom — which is the way round that
  // matters, because the wordmark sits at the bottom in white and would be
  // illegible over the pale end.
  const grad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  grad.addColorStop(0, '#7676b4');
  grad.addColorStop(0.38, '#2a2a86');
  grad.addColorStop(1, '#010058');
  ctx.fillStyle = grad;
  ctx.fillRect(bandX, bandY, BANNER_W, bandH);

  // Rotating -90 makes +x run up the screen, so the text is laid out from the
  // bottom edge upward and reads bottom-to-top, as the shell drew it.
  ctx.save();
  ctx.translate(bandX + BANNER_W - 4, bandY + bandH - 7);
  ctx.rotate(-Math.PI / 2);
  // Bold for both words, which is closer to the real wordmark and the only
  // thing that survives here: a regular weight at this size draws 1px strokes
  // that antialiasing spreads across two pixels at half intensity.
  const wWidth = text(ctx, 'Windows', 0, 0, { color: C.white, size: 14, bold: true });
  text(ctx, ' 95', wWidth, 0, { color: C.white, size: 14, bold: true });
  ctx.restore();

  let iy = y + PAD;
  const ix = bandX + BANNER_W;
  START_ITEMS.forEach((item) => {
    if (item.separator) {
      divider(ctx, ix + 2, iy + 2, MENU_W - 4);
      iy += 7;
      return;
    }
    const id = `start:${item.id}`;
    if (hover === id) {
      ctx.fillStyle = C.select;
      ctx.fillRect(ix, iy, MENU_W, ROW_H);
    }
    const fg = hover === id ? C.white : C.black;

    const img = icon(item.icon, 32);
    if (img) ctx.drawImage(img, ix + 2, iy, 32, 32);
    text(ctx, item.label, ix + 38, iy + 10, { color: fg });

    if (item.sub) {
      // A solid right-pointing triangle, plotted row by row so it stays hard.
      ctx.fillStyle = fg;
      const ax = ix + MENU_W - 12;
      const ay = iy + ROW_H / 2;
      for (let r = 0; r < 4; r++) ctx.fillRect(ax + r, ay - 4 + r, 1, (4 - r) * 2);
    }
    hit.add(ix, iy, MENU_W, ROW_H, id, { type: 'start-item', item });
    iy += ROW_H;
  });
}

/** "10:32 AM" — the tray's format, which is 12-hour with no seconds. */
function clockLabel(date = new Date()) {
  let h = date.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(date.getMinutes()).padStart(2, '0')} ${ampm}`;
}
