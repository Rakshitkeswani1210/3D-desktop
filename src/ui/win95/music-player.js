/**
 * music-player.js — the "My Music" window.
 *
 * A track list, a transport and a position bar, in the shape Windows put them
 * in. Everything it draws it also registers with the hit collector, so the
 * clickable regions cannot drift away from the pixels: there is exactly one
 * place each control's rectangle is written down, and both the drawing and the
 * hit test read it from there.
 */

import { C, FS, FONT, panel, text, focusRect } from './chrome.js';
import { icon } from './icons.js';
import { formatTime } from './player.js';

// Resolved against this module rather than against the page, so the same
// playlist works from index.html at the root and from preview.html three
// directories down.
const asset = (file) => new URL(`../../../assets/music/${file}`, import.meta.url).href;

/**
 * Rakshit's three.
 *
 * None of the files carry ID3 tags — they have all been transcoded and the
 * metadata stripped — so the titles and artists here are written down rather
 * than read off the audio. Durations are not listed: the player reads the real
 * one off the element once a track loads, which cannot go stale.
 */
export const PLAYLIST = [
  { title: 'Vienna', artist: 'Billy Joel', src: asset('vienna.mp3') },
  { title: 'Sajni', artist: 'Arijit Singh', src: asset('sajni.mp3') },
  { title: 'Legendary', artist: 'Welshly Arms', src: asset('legendary.mp3') },
];

export const WINDOW = { w: 384, h: 182 };

const ROW_H = 20;
const BTN_W = 30;
const BTN_H = 22;

/** Transport glyphs, plotted row by row so the diagonals stay hard. */
function glyph(ctx, cx, cy, kind) {
  ctx.fillStyle = C.black;
  const tri = (x, dir, H = 5) => {
    for (let r = -H; r <= H; r++) {
      const wRow = H - Math.abs(r);
      ctx.fillRect(dir > 0 ? x : x - wRow, cy + r, wRow, 1);
    }
  };

  if (kind === 'play') tri(cx - 3, 1);
  else if (kind === 'pause') {
    ctx.fillRect(cx - 4, cy - 5, 3, 11);
    ctx.fillRect(cx + 1, cy - 5, 3, 11);
  } else if (kind === 'stop') ctx.fillRect(cx - 4, cy - 4, 9, 9);
  else if (kind === 'next') {
    tri(cx - 5, 1, 4);
    ctx.fillRect(cx + 3, cy - 4, 2, 9);
  } else if (kind === 'prev') {
    tri(cx + 5, -1, 4);
    ctx.fillRect(cx - 5, cy - 4, 2, 9);
  }
}

/**
 * Draw the window.
 *
 * @param win     the live window record — passed by reference, not copied,
 *                because the drag handler mutates its x and y
 * @param p       player snapshot: {index, track, playing, position, duration}
 * @param hit     collector — hit.add(x, y, w, h, id, action)
 * @param hover   id currently under the pointer, or null
 * @param active  is this the front window
 */
export function drawMusicPlayer(ctx, win, p, hit, hover, active = true) {
  const { x, y, w, h } = win;

  // Registered before anything else: the collector resolves last-added-wins,
  // so the window's own body must go down first or it eats every button on it.
  hit.add(x, y, w, h, 'music:window', { type: 'focus', win });

  panel(ctx, x, y, w, h, 'raised', C.face);

  /* title bar */
  const barH = 18;
  ctx.fillStyle = active ? C.titlebar : C.titlebarOff;
  ctx.fillRect(x + 3, y + 3, w - 6, barH);
  // The whole bar drags. Registered before the close button so that button,
  // added later, wins the overlap.
  hit.add(x + 3, y + 3, w - 6, barH, 'music:titlebar', { type: 'drag', win });
  const cd = icon('audio-cd', 16);
  if (cd) ctx.drawImage(cd, x + 5, y + 4, 16, 16);
  text(ctx, 'My Music', x + 24, y + 7, { color: C.white, bold: true });

  const closeX = x + w - 3 - 18;
  const closeHover = hover === 'music:close';
  panel(ctx, closeX, y + 4, 16, 16, closeHover ? 'sunken' : 'raised', C.face);
  ctx.fillStyle = C.black;
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(closeX + 4 + i, y + 8 + i, 1, 1);
    ctx.fillRect(closeX + 4 + i, y + 14 - i, 1, 1);
  }
  hit.add(closeX, y + 4, 16, 16, 'music:close', { type: 'close', app: 'music' });

  /* track list */
  const listX = x + 8;
  const listY = y + 26;
  const listW = w - 16;
  const listH = PLAYLIST.length * ROW_H + 4;
  panel(ctx, listX, listY, listW, listH, 'field', C.white);

  PLAYLIST.forEach((track, i) => {
    const rx = listX + 2;
    const ry = listY + 2 + i * ROW_H;
    const rw = listW - 4;
    const id = `music:track:${i}`;
    const isCurrent = i === p.index;
    const isHover = hover === id;

    if (isCurrent || isHover) {
      ctx.fillStyle = isCurrent ? C.select : '#d8d8f0';
      ctx.fillRect(rx, ry, rw, ROW_H);
    }
    const fg = isCurrent ? C.white : C.black;

    // A speaker pip marks the loaded track, so the list still says which song
    // is up when the window is too narrow to read the status bar.
    if (isCurrent) {
      ctx.fillStyle = fg;
      ctx.fillRect(rx + 5, ry + 8, 2, 4);          // the driver
      for (let r = -4; r <= 4; r++) {              // the cone
        ctx.fillRect(rx + 7, ry + 10 + r, 4 - Math.abs(r), 1);
      }
    }

    text(ctx, `${i + 1}.`, rx + 16, ry + 5, { color: fg });
    text(ctx, track.title, rx + 34, ry + 5, { color: fg });
    text(ctx, track.artist, rx + rw - 8, ry + 5, { color: fg, align: 'right' });

    hit.add(rx, ry, rw, ROW_H, id, { type: 'track', index: i });
  });

  /* now playing + position */
  const infoY = listY + listH + 6;
  const label = p.track
    ? `${p.playing ? 'Playing' : 'Paused'}: ${p.track.title}`
    : 'Stopped';
  text(ctx, label, listX, infoY);
  text(ctx, `${formatTime(p.position)} / ${formatTime(p.duration)}`,
       listX + listW, infoY, { align: 'right' });

  const barY = infoY + 16;
  const barHgt = 12;
  panel(ctx, listX, barY, listW, barHgt, 'field', C.white);
  const frac = p.duration ? Math.min(1, p.position / p.duration) : 0;
  if (frac > 0) {
    ctx.fillStyle = C.select;
    ctx.fillRect(listX + 2, barY + 2, Math.round((listW - 4) * frac), barHgt - 4);
  }
  hit.add(listX, barY, listW, barHgt, 'music:seek', { type: 'seek', x: listX, w: listW });

  /* transport */
  const tY = barY + barHgt + 6;
  const controls = [
    ['prev', 'prev'],
    [p.playing ? 'pause' : 'play', p.playing ? 'pause' : 'play'],
    ['stop', 'stop'],
    ['next', 'next'],
  ];
  controls.forEach(([g, cmd], i) => {
    const bx = listX + i * (BTN_W + 4);
    const id = `music:${cmd}`;
    panel(ctx, bx, tY, BTN_W, BTN_H, hover === id ? 'sunken' : 'raised', C.face);
    const d = hover === id ? 1 : 0;
    glyph(ctx, bx + BTN_W / 2 + d, tY + BTN_H / 2 + d, g);
    hit.add(bx, tY, BTN_W, BTN_H, id, { type: 'transport', cmd });
  });

  /* status bar */
  const sY = y + h - 3 - 18;
  panel(ctx, x + 3, sY, w - 6, 18, 'well', C.face);
  text(ctx, p.track ? `${p.track.title} — ${p.track.artist}` : 'Select a track',
       x + 9, sY + 4);

}
