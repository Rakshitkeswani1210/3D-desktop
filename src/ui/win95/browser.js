/**
 * browser.js — the Internet Explorer window.
 *
 * The chrome is drawn here on the canvas. The PAGE is not: the live site is a
 * real iframe warped onto the content area by web-frame.js, because an <iframe>
 * cannot become a WebGL texture and no amount of canvas work will rasterise
 * somebody else's website.
 *
 * So what drawPage() renders is the FALLBACK — the site's real title, blurb and
 * links, set the way a 1996 browser would have set them. It is painted every
 * frame underneath the overlay and is what remains visible if the page fails to
 * load, if the site ever starts refusing to be framed, or wherever the overlay
 * has to hide itself. Its links work, and open the genuine URL in a new tab.
 *
 * Pages live in PAGES, keyed by the address you would type. Adding another is
 * a data change, not a code change — which is what makes "more pages later"
 * cheap. contentRect() is the single definition of where the page sits, shared
 * with the overlay so the two cannot drift.
 */

import {
  C, FS, FONT, FONT_SERIF, panel, text, wrapText, divider,
} from './chrome.js';
import { icon } from './icons.js';

/**
 * Bigger than the music player, because the window IS the viewport: whatever
 * is left after the chrome is the CSS viewport the real site lays itself out
 * for, and a modern page given 540x270 reflows into something sparse and odd.
 * At this size the content area is ~704x368, which is close to what a maximised
 * browser on an 800x600 screen actually offered.
 */
export const WINDOW = { w: 720, h: 500 };

export const HOME = 'www.rakshit.design';

/**
 * How far the live page is zoomed out inside the window.
 *
 * At 1.0 the site gets a ~704x368 viewport, which is small enough that a modern
 * responsive layout collapses to its narrow design. At 0.5 it lays out for
 * ~1400x735 — a wide desktop — and is then drawn at half size, which fits a
 * lot more of the page on the tube at the cost of smaller text.
 */
export const PAGE_ZOOM = 0.5;

/**
 * The portfolio, as IE would have shown it.
 *
 * The title, blurb and links are the real ones off rakshit.design — read from
 * the live site rather than invented — set in the serif every browser of the
 * era defaulted to.
 */
export const PAGES = {
  'www.rakshit.design': {
    title: "Rakshit's Portfolio",
    heading: "Rakshit's Portfolio",
    url: 'https://www.rakshit.design',
    body: [
      "Hi, I'm Rakshit. You've landed in my little portfolio universe! "
      + 'Here you’ll find artifacts from my 5 year adventure as a product '
      + 'designer in fintech.',
    ],
    links: [
      { label: 'Resume', url: 'https://drive.google.com/file/d/1aeEdeRKcV7cHMfIzTLBhJoj-dXm' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/rakshit-keswani/' },
      { label: 'Twitter', url: 'https://x.com/RakshitKeswani4' },
      { label: 'Medium', url: 'https://medium.com/@rakshit_keswani' },
    ],
    footer: 'Click any link to open it in a real browser.',
  },
};

const TITLE_H = 18;
const MENU_H = 18;
const TOOL_H = 38;
const ADDR_H = 22;
const STATUS_H = 18;

const MENUS = ['&File', '&Edit', '&View', '&Go', 'F&avorites', '&Help'];

/**
 * Where the page goes, in raster pixels.
 *
 * Exported because the live-page overlay has to land on exactly this rectangle,
 * and two copies of this arithmetic would drift apart the first time the
 * toolbar changed height.
 */
export function contentRect(win) {
  const { x, y, w, h } = win;
  const ay = y + 3 + TITLE_H + 1 + MENU_H + TOOL_H;
  const cy = ay + ADDR_H + 2;
  return {
    x: x + 8,
    y: cy + 2,
    w: w - 16,
    h: h - (cy - y) - STATUS_H - 12,
  };
}

/* ── toolbar glyphs, plotted so they stay hard at this size ─────────────── */

function triangle(ctx, cx, cy, dir, H = 6) {
  for (let r = -H; r <= H; r++) {
    const w = Math.round((H - Math.abs(r)) * 0.9);
    ctx.fillRect(dir > 0 ? cx : cx - w, cy + r, w, 1);
  }
}

function glyph(ctx, cx, cy, kind, enabled) {
  ctx.fillStyle = enabled ? '#1c1c8c' : C.disabled;

  if (kind === 'back') { triangle(ctx, cx - 5, cy, -1); ctx.fillRect(cx - 4, cy - 2, 8, 5); }
  else if (kind === 'forward') { triangle(ctx, cx + 5, cy, 1); ctx.fillRect(cx - 4, cy - 2, 8, 5); }
  else if (kind === 'stop') {
    // A red octagon: a square with the corners cut back two pixels a row.
    ctx.fillStyle = enabled ? '#c81414' : C.disabled;
    for (let r = -7; r <= 7; r++) {
      const cut = Math.max(0, Math.abs(r) - 3);
      ctx.fillRect(cx - 7 + cut, cy + r, 15 - cut * 2, 1);
    }
    ctx.fillStyle = C.white;
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(cx + i, cy + i, 2, 2);
      ctx.fillRect(cx + i, cy - i, 2, 2);
    }
  } else if (kind === 'refresh') {
    // Two arrows chasing each other round a gap — the era's reload mark.
    ctx.fillStyle = enabled ? '#1c7a1c' : C.disabled;
    for (let a = -50; a <= 190; a += 4) {
      const rad = (a * Math.PI) / 180;
      ctx.fillRect(Math.round(cx + Math.cos(rad) * 6) - 1, Math.round(cy - Math.sin(rad) * 6) - 1, 2, 2);
    }
    triangle(ctx, cx + 4, cy + 6, 1, 4);
  } else if (kind === 'home') {
    ctx.fillStyle = enabled ? '#1c1c8c' : C.disabled;
    for (let r = 0; r < 6; r++) ctx.fillRect(cx - r, cy - 7 + r, r * 2 + 1, 1);  // roof
    ctx.fillRect(cx - 5, cy - 1, 11, 8);                                          // walls
    ctx.fillStyle = enabled ? '#e8d8a0' : C.face;
    ctx.fillRect(cx - 2, cy + 2, 4, 5);                                           // door
  }
}

/**
 * Draw the window.
 *
 * @param win     live window record — mutated by the drag handler
 * @param b       browser state: {url, history, index, status}
 * @param hit     collector
 * @param hover   id under the pointer
 * @param active  is this the front window
 */
export function drawBrowser(ctx, win, b, hit, hover, active = true) {
  const { x, y, w, h } = win;

  hit.add(x, y, w, h, 'ie:window', { type: 'focus', win });
  panel(ctx, x, y, w, h, 'raised', C.face);

  const page = PAGES[b.url] || null;

  /* title bar */
  ctx.fillStyle = active ? C.titlebar : C.titlebarOff;
  ctx.fillRect(x + 3, y + 3, w - 6, TITLE_H);
  hit.add(x + 3, y + 3, w - 6, TITLE_H, 'ie:titlebar', { type: 'drag', win });

  const ie = icon('internet-explorer', 16);
  if (ie) ctx.drawImage(ie, x + 5, y + 4, 16, 16);
  const heading = page ? `${page.title} - Microsoft Internet Explorer` : 'Microsoft Internet Explorer';
  text(ctx, heading, x + 24, y + 7, { color: C.white, bold: true });

  const closeX = x + w - 3 - 18;
  panel(ctx, closeX, y + 4, 16, 16, hover === 'ie:close' ? 'sunken' : 'raised', C.face);
  ctx.fillStyle = C.black;
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(closeX + 4 + i, y + 8 + i, 1, 1);
    ctx.fillRect(closeX + 4 + i, y + 14 - i, 1, 1);
  }
  hit.add(closeX, y + 4, 16, 16, 'ie:close', { type: 'close', app: 'browser' });

  /* menu bar */
  let mx = x + 8;
  const my = y + 3 + TITLE_H + 1;
  ctx.font = `${FS}px ${FONT}`;
  for (const label of MENUS) {
    const wLabel = ctx.measureText(label.replace('&', '')).width;
    text(ctx, label, mx, my + 4);
    mx += wLabel + 16;
  }

  /* toolbar */
  const ty = my + MENU_H;
  const tools = [
    { id: 'back', label: 'Back', on: b.index > 0 },
    { id: 'forward', label: 'Forward', on: b.index < b.history.length - 1 },
    { id: 'stop', label: 'Stop', on: false },
    { id: 'refresh', label: 'Refresh', on: true },
    { id: 'home', label: 'Home', on: true },
  ];
  tools.forEach((tool, i) => {
    const bx = x + 6 + i * 48;
    const id = `ie:${tool.id}`;
    const pressed = tool.on && hover === id;
    if (pressed) panel(ctx, bx, ty + 2, 46, TOOL_H - 6, 'sunken', C.face);
    const d = pressed ? 1 : 0;
    glyph(ctx, bx + 23 + d, ty + 13 + d, tool.id, tool.on);
    text(ctx, tool.label, bx + 23 + d, ty + 22 + d, {
      align: 'center', size: 10, color: tool.on ? C.black : C.disabled,
    });
    if (tool.on) hit.add(bx, ty + 2, 46, TOOL_H - 6, id, { type: 'ie', cmd: tool.id });
  });

  /* address bar */
  const ay = ty + TOOL_H;
  text(ctx, 'Address', x + 8, ay + 6);
  const fieldX = x + 56;
  const fieldW = w - 56 - 6 - 3;
  panel(ctx, fieldX, ay + 2, fieldW, ADDR_H - 4, 'field', C.white);
  const fav = icon('internet-explorer', 16);
  if (fav) ctx.drawImage(fav, fieldX + 3, ay + 3, 16, 16);
  text(ctx, `http://${b.url}/`, fieldX + 23, ay + 8);
  hit.add(fieldX, ay + 2, fieldW, ADDR_H - 4, 'ie:address', { type: 'link', url: page?.url });

  /* the page */
  const inner = contentRect(win);
  panel(ctx, inner.x - 2, inner.y - 2, inner.w + 4, inner.h + 4, 'field', C.white);
  // Drawn even when the live overlay is about to cover it: if the site fails
  // to load, or is blocked, this is what remains on the tube.
  if (page) drawPage(ctx, page, inner.x, inner.y, inner.w, inner.h, hit, hover);

  /* status bar */
  const sy = y + h - 3 - STATUS_H;
  const zoneW = 120;
  panel(ctx, x + 3, sy, w - 6 - zoneW - 2, STATUS_H, 'well', C.face);
  const hovered = hover && hover.startsWith('ie:link:');
  text(ctx, hovered ? b.status || 'Done' : 'Done', x + 9, sy + 4);
  panel(ctx, x + w - 3 - zoneW, sy, zoneW, STATUS_H, 'well', C.face);
  text(ctx, 'Internet zone', x + w - 9 - zoneW + 6, sy + 4);
}

/** The document itself, in the serif every browser of the era defaulted to. */
function drawPage(ctx, page, x, y, w, h, hit, hover) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const pad = 18;
  const maxW = w - pad * 2;
  let cy = y + pad;

  text(ctx, page.heading, x + pad, cy, { size: 22, bold: true, font: FONT_SERIF });
  cy += 30;

  ctx.fillStyle = C.shadow;
  ctx.fillRect(x + pad, cy, maxW, 1);
  ctx.fillStyle = C.hilight;
  ctx.fillRect(x + pad, cy + 1, maxW, 1);
  cy += 14;

  for (const para of page.body) {
    for (const line of wrapText(ctx, para, maxW, { size: 15, font: FONT_SERIF })) {
      text(ctx, line, x + pad, cy, { size: 15, font: FONT_SERIF });
      cy += 21;
    }
    cy += 8;
  }

  cy += 6;
  page.links.forEach((link, i) => {
    const id = `ie:link:${i}`;
    const isHover = hover === id;
    // The web's original link colour, and the reason blue-and-underlined still
    // means "link" thirty years later.
    const colour = isHover ? '#cc0000' : '#0000ee';
    ctx.font = `15px ${FONT_SERIF}`;
    const lw = ctx.measureText(link.label).width;
    text(ctx, link.label, x + pad + 14, cy, {
      size: 15, font: FONT_SERIF, color: colour, underline: true,
    });
    // A bullet, because a 1996 page would have used one.
    ctx.fillStyle = C.black;
    ctx.fillRect(x + pad + 4, cy + 7, 4, 4);
    hit.add(x + pad + 14, cy, lw, 20, id, { type: 'link', url: link.url, label: link.label });
    cy += 24;
  });

  if (page.footer) {
    cy += 6;
    text(ctx, page.footer, x + pad, cy, {
      size: 13, font: FONT_SERIF, italic: true, color: C.shadow,
    });
  }

  ctx.restore();
}
