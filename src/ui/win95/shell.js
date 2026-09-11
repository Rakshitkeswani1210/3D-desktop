/**
 * shell.js — the desktop's state, and everything the pointer does to it.
 *
 * This is the only module that knows an application exists. desktop-ui.js
 * draws the furniture, music-player.js draws its own window, and this composes
 * them, owns the window list, and turns a click at a pixel into a thing that
 * happens.
 *
 * Two ideas carry the whole design:
 *
 *   1. HIT REGIONS ARE RECORDED WHILE DRAWING. Every draw pass fills a fresh
 *      list of {rect, id, action}. The pointer tests against the list the last
 *      frame produced, so a control's clickable area is by construction the
 *      area it was painted into — there is no second copy of the layout to
 *      drift out of step.
 *
 *   2. PAINTING IS DEFERRED. Nothing repaints inside an event. Handlers set a
 *      dirty flag and tick() does one repaint per frame, because the pointer
 *      can move many times per frame and each repaint costs a full 800x600
 *      texture upload.
 */

import { load as loadIcons } from './icons.js';
import {
  TASKBAR_H, COMPUTER_CONTENTS,
  drawWallpaper, drawIconGrid, drawTaskbar, drawStartMenu,
} from './desktop-ui.js';
import { createClippy } from './clippy.js';
import { drawMusicPlayer, PLAYLIST, WINDOW as MUSIC_WINDOW } from './music-player.js';
import { drawBrowser, contentRect, PAGES, PAGE_ZOOM, WINDOW as IE_WINDOW, HOME } from './browser.js';
import {
  drawPhotos, drawPhotoViewer, preloadThumbs, onImageLoad,
  WINDOW as PHOTOS_WINDOW, VIEWER as PHOTO_VIEWER,
} from './photos.js';
import { drawNotes, NOTE_SETTINGS } from './notes.js';
import {
  drawShortcutFolder, DOCUMENTS, RECYCLE_BIN, TOOLS,
  DOCS_WINDOW, BIN_WINDOW, COMPUTER_WINDOW,
} from './shortcut-folder.js';
import { createPlayer } from './player.js';

/** Last added wins, which matches "drawn on top". */
function createHitList() {
  let items = [];
  return {
    clear() { items = []; },
    add(x, y, w, h, id, action) { items.push({ x, y, w, h, id, action }); },
    at(px, py) {
      for (let i = items.length - 1; i >= 0; i--) {
        const r = items[i];
        if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return r;
      }
      return null;
    },
  };
}

/**
 * @param opts.width      raster width  (800)
 * @param opts.height     raster height (600)
 * @param opts.overlay    (ctx, w, h) run after the UI — the tube's scanlines
 * @param opts.onShutDown called when Start > Shut Down is chosen
 */
export function createShell({
  width, height, overlay = null, onShutDown = null, onNoteChange = null,
} = {}) {
  const hit = createHitList();

  const state = {
    selected: -1,
    startOpen: false,
    windows: [],
    time: new Date(),
  };

  let hover = null;
  let hoverAction = null; // the action under the pointer, for status-bar text
  let armed = null;       // the region pointerdown landed on
  let drag = null;        // {win, dx, dy} while a title bar is being dragged
  let dirty = true;
  let target = null;      // canvas to paint into, set by attach()

  const player = createPlayer(() => { dirty = true; });
  player.load(PLAYLIST);

  /** Internet Explorer's own state. History is a stack with a cursor, as it was. */
  const browser = { url: HOME, history: [HOME], index: 0, status: '' };

  /** The photo folder's own state. */
  const photos = { selected: null, scroll: 0 };

  /**
   * The assistant.
   *
   * Every tester said they did not know the desktop was clickable, and one
   * asked to be shown "the next thing you want me to open". He is that, and
   * he is on screen from the moment the machine comes up rather than after a
   * delay: guidance that arrives five seconds late has already missed the
   * people who needed it. He keeps his own clock, so all the shell does is
   * tell him what has been opened and repaint when he says he moved.
   */
  const clippy = createClippy();

  /** My Documents' own selection. */
  const documents = { selected: null };

  /** The Recycle Bin's own selection — a separate folder, separate state. */
  const bin = { selected: null };

  /** And My Computer's. */
  const computer = { selected: null };

  /** Folder id -> its selection state, for the one place that needs the map. */
  const FOLDERS = { documents, 'recycle-bin': bin, computer };

  /**
   * What My Computer holds: the machine's own folders, then the tools.
   * Composed once rather than per frame, so the array identity is stable and
   * the `includes` checks elsewhere stay cheap.
   */
  const COMPUTER_ITEMS = [...COMPUTER_CONTENTS, ...TOOLS];

  // Photos decode off disk rather than out of the bundle, so the window paints
  // its tiles empty and fills them in as they arrive.
  onImageLoad(() => { dirty = true; });

  // Icons decode from base64, so this resolves almost immediately — but
  // "almost immediately" is still a frame or two after the first paint.
  loadIcons().then(() => { dirty = true; });

  /* ── windows ─────────────────────────────────────────────────────────── */

  function applyNoteSettings() {
    NOTE_SETTINGS.w = Math.round(Math.max(280, Math.min(width - 16, NOTE_SETTINGS.w)));
    NOTE_SETTINGS.h = Math.round(Math.max(180, Math.min(height - TASKBAR_H - 16, NOTE_SETTINGS.h)));
    NOTE_SETTINGS.x = Math.round(Math.max(0, Math.min(width - NOTE_SETTINGS.w, NOTE_SETTINGS.x)));
    NOTE_SETTINGS.y = Math.round(Math.max(0, Math.min(height - TASKBAR_H - NOTE_SETTINGS.h, NOTE_SETTINGS.y)));
    const win = state.windows.find((w) => w.app === 'notes');
    if (win) {
      Object.assign(win, NOTE_SETTINGS);
      win.scroll = 0;
    }
    dirty = true;
  }

  function openWindow(app, opts = {}) {
    if (clippy.saw(app)) dirty = true;
    const existing = state.windows.find((w) => w.app === app);
    if (existing) {
      // The viewer is reused rather than stacked: asking for a second photo
      // swaps the one on show, which is what a single-document viewer did.
      if (app === 'photo-view' && opts.photo) {
        existing.photo = opts.photo;
        existing.title = opts.photo.label;
      }
      existing.minimized = false;
      raise(existing);
      return;
    }
    const spec = {
      music: { title: 'My Music', icon: 'audio-cd', size: MUSIC_WINDOW },
      browser: { title: 'Internet Explorer', icon: 'internet-explorer', size: IE_WINDOW },
      photos: { title: "Rakshit's Memories", icon: 'folder-pictures', size: PHOTOS_WINDOW },
      notes: { title: NOTE_SETTINGS.title, icon: 'notepad-pen', size: NOTE_SETTINGS },
      documents: { title: 'My Documents', icon: 'folder-open-documents', size: DOCS_WINDOW },
      'recycle-bin': { title: 'Recycle Bin', icon: 'recycle-bin-full', size: BIN_WINDOW },
      computer: { title: 'My Computer', icon: 'computer-system', size: COMPUTER_WINDOW },
      'photo-view': {
        title: opts.photo ? opts.photo.label : 'Imaging',
        icon: 'document-image',
        size: PHOTO_VIEWER,
      },
    }[app];
    if (!spec) return;
    if (app === 'photos') preloadThumbs();

    // Cascade: a second window opening exactly on top of the first looks like
    // nothing happened.
    const step = state.windows.length * 18;
    state.windows.push({
      app,
      title: spec.title,
      icon: spec.icon,
      x: Math.round((width - spec.size.w) / 2) + step,
      y: Math.round((height - TASKBAR_H - spec.size.h) / 2) - 10 + step,
      w: spec.size.w,
      h: spec.size.h,
      minimized: false,
      photo: opts.photo || null,
    });
    if (app === 'notes') applyNoteSettings();
    dirty = true;
  }

  function closeWindow(app) {
    const i = state.windows.findIndex((w) => w.app === app);
    if (i < 0) return;
    state.windows.splice(i, 1);
    if (app === 'music') player.stop();
    dirty = true;
  }

  /**
   * Point IE at a page. Navigating after going Back drops whatever was ahead,
   * which is how every browser's history has always worked.
   */
  function navigate(url) {
    if (browser.url === url) return;
    browser.history.length = browser.index + 1;
    browser.history.push(url);
    browser.index = browser.history.length - 1;
    browser.url = url;
    dirty = true;
  }

  /** Array order is z-order, so raising is a move to the end. */
  function raise(win) {
    const i = state.windows.indexOf(win);
    if (i >= 0 && i !== state.windows.length - 1) {
      state.windows.splice(i, 1);
      state.windows.push(win);
    }
    dirty = true;
  }

  /* ── drawing ─────────────────────────────────────────────────────────── */

  function draw(ctx, w, h) {
    hit.clear();
    ctx.imageSmoothingEnabled = false;

    drawWallpaper(ctx, w, h);
    // The wallpaper itself is a target: clicking it clears the selection and
    // dismisses the Start menu.
    hit.add(0, 0, w, h, 'desktop', { type: 'desktop' });

    drawIconGrid(ctx, state, hit, hover);
    // With the icons, and so behind every window. The real Assistant floated
    // over whatever you were doing and was hated for exactly that: a window is
    // a thing you asked for and a paperclip is not, so anything you open takes
    // the corner off him and he waits behind it. He registers no hit region
    // either way, so a click that lands on him reaches the desktop.
    clippy.draw(ctx, w, h - TASKBAR_H);

    const snap = player.snapshot();
    const top = state.windows[state.windows.length - 1];
    for (const win of state.windows) {
      if (win.minimized) continue;
      // The live record, not a copy: the drag handler writes x and y on it.
      if (win.app === 'music') drawMusicPlayer(ctx, win, snap, hit, hover, win === top);
      else if (win.app === 'browser') drawBrowser(ctx, win, browser, hit, hover, win === top);
      else if (win.app === 'photos') drawPhotos(ctx, win, photos, hit, hover, win === top);
      else if (win.app === 'photo-view') drawPhotoViewer(ctx, win, hit, hover, win === top);
      else if (win.app === 'notes') drawNotes(ctx, win, hit, hover, win === top);
      else if (win.app === 'documents') {
        drawShortcutFolder(ctx, win, DOCUMENTS, documents, hit, hover, win === top);
      } else if (win.app === 'recycle-bin') {
        drawShortcutFolder(ctx, win, RECYCLE_BIN, bin, hit, hover, win === top);
      } else if (win.app === 'computer') {
        drawShortcutFolder(ctx, win, COMPUTER_ITEMS, computer, hit, hover, win === top);
      }
    }

    if (state.startOpen) drawStartMenu(ctx, h - TASKBAR_H, hit, hover);
    drawTaskbar(ctx, w, h, state, hit, hover);

    if (overlay) overlay(ctx, w, h);
  }

  /* ── pointer ─────────────────────────────────────────────────────────── */

  function pointerMove(x, y) {
    if (drag) {
      // Clamp so the title bar can never be pushed somewhere it cannot be
      // grabbed again: Windows let you shove a window mostly off the screen,
      // but never so far that the bar you drag it back by is unreachable.
      const win = drag.win;
      const minVisible = 48;
      win.x = Math.max(minVisible - win.w, Math.min(width - minVisible, x - drag.dx));
      win.y = Math.max(0, Math.min(height - TASKBAR_H - 20, y - drag.dy));
      if (win.app === 'notes') {
        NOTE_SETTINGS.x = win.x;
        NOTE_SETTINGS.y = win.y;
        applyNoteSettings();
        onNoteChange?.();
      }
      dirty = true;
      return true;
    }
    const region = hit.at(x, y);
    const id = region && region.action.type !== 'desktop' && region.action.type !== 'nothing'
      ? region.id : null;
    if (id !== hover) {
      hover = id;
      hoverAction = region ? region.action : null;
      // IE put the target of the link under the pointer in its status bar, and
      // that readout is half of what made the status bar feel like a browser.
      browser.status = hoverAction && hoverAction.type === 'link' && hoverAction.url
        ? hoverAction.url : '';
      dirty = true;
    }
    return !!id;
  }

  /** Pointer left the surface: forget the highlight, but keep any drag alive. */
  function pointerLeave() {
    if (hover !== null) { hover = null; hoverAction = null; browser.status = ''; dirty = true; }
  }

  function scrollNotes(x, y, delta) {
    const win = hit.at(x, y)?.action.win;
    if (!win || win.app !== 'notes') return false;
    win.scroll = Math.max(0, Math.min(win.maxScroll ?? 0, (win.scroll ?? 0) + delta));
    dirty = true;
    return true;
  }

  function pointerDown(x, y) {
    armed = hit.at(x, y);
    if (armed && armed.action.type === 'drag') {
      const win = armed.action.win;
      raise(win);
      drag = { win, dx: x - win.x, dy: y - win.y };
      // Raising reorders the window list, so the hit regions describing the
      // old z-order are stale from here on. Refresh before the next event.
      repaint();
    }
  }

  /**
   * Acting on pointer UP rather than DOWN, and only if it lands on the same
   * region it started on. That is how every real button behaves, and it is
   * what lets someone press, realise they are on the wrong control, and slide
   * off to cancel — which matters a lot when the target is a 20px row on a
   * curved tube.
   */
  function pointerUp(x, y) {
    if (drag) {
      // A drag consumes the click: releasing the title bar must not also
      // count as pressing it.
      drag = null;
      armed = null;
      // The window moved, so every hit region on it is now in the wrong place.
      // Refresh before the next event rather than trusting a frame to land in
      // between — otherwise the next grab at the title bar's NEW position is
      // tested against its OLD one and misses.
      repaint();
      return;
    }
    const region = hit.at(x, y);
    const start = armed;
    armed = null;
    if (!region || !start || region.id !== start.id) return;
    activate(region.action, x, y);
    // Repaint NOW rather than waiting for the next frame. The hit list is
    // built while drawing, so until the repaint happens it still describes the
    // layout from before this click — and a second click arriving in the same
    // frame would be tested against a window that has since opened or closed.
    // A human cannot click twice in 16ms, but a throttled rAF can stretch that
    // frame out indefinitely, and one texture upload per click costs nothing.
    repaint();
  }

  function activate(action, x) {
    switch (action.type) {
      case 'icon':
        state.selected = action.index;
        state.startOpen = false;
        // Single click opens. Windows wanted a double, but a double click on a
        // texture mapped to a curved mesh is a genuinely hard thing to land.
        if (action.item.app) openWindow(action.item.app);
        break;

      case 'start':
        state.startOpen = !state.startOpen;
        break;

      case 'start-item':
        state.startOpen = false;
        if (action.item.id === 'shutdown' && onShutDown) onShutDown();
        break;

      case 'task': {
        const win = state.windows.find((w) => w.app === action.app);
        if (win) {
          if (win.minimized) { win.minimized = false; raise(win); }
          else if (win === state.windows[state.windows.length - 1]) win.minimized = true;
          else raise(win);
        }
        break;
      }

      case 'focus':
        if (action.win) raise(action.win);
        break;

      case 'close':
        closeWindow(action.app);
        break;

      case 'note-scroll':
        action.win.scroll = Math.max(0, Math.min(
          action.win.maxScroll ?? 0, action.win.scroll + action.delta));
        break;

      case 'ie':
        if (action.cmd === 'home') navigate(HOME);
        else if (action.cmd === 'back' && browser.index > 0) {
          browser.url = browser.history[--browser.index];
        } else if (action.cmd === 'forward' && browser.index < browser.history.length - 1) {
          browser.url = browser.history[++browser.index];
        }
        // 'refresh' and 'stop' redraw and nothing more, which for a page that
        // is already a static rendering is honestly all they could do.
        break;

      case 'link':
        // The one place this UI reaches the actual internet. A real page cannot
        // be rasterised into a canvas texture, so following a link hands it to
        // a browser that can. noopener because the new tab has no business
        // holding a reference back to this one.
        if (action.url) window.open(action.url, '_blank', 'noopener,noreferrer');
        break;

      case 'shortcut': {
        // Selecting and opening in one click, as everywhere else on this
        // desktop — a double click is hard to land on a curved tube. Three
        // kinds of item live in these folders: one that launches an
        // application, one that opens a page, and one that is simply a thing
        // sitting in the bin and does neither.
        const folder = FOLDERS[action.ns];
        if (folder) folder.selected = action.link.id;
        if (action.link.app) openWindow(action.link.app);
        else if (action.link.url) window.open(action.link.url, '_blank', 'noopener,noreferrer');
        break;
      }

      case 'photo':
        photos.selected = action.photo.slug;
        openWindow('photo-view', { photo: action.photo });
        break;

      case 'track':
        player.play(action.index);
        break;

      case 'transport':
        if (action.cmd === 'play') player.play();
        else if (action.cmd === 'pause') player.pause();
        else if (action.cmd === 'stop') player.stop();
        else if (action.cmd === 'next') player.next();
        else if (action.cmd === 'prev') player.prev();
        break;

      case 'seek':
        player.seek((x - action.x) / action.w);
        break;

      case 'desktop':
        state.selected = -1;
        state.startOpen = false;
        break;

      default:
        break;
    }
    dirty = true;
  }

  /* ── frame ───────────────────────────────────────────────────────────── */

  /**
   * Where a live web page should be shown, or null.
   *
   * Nothing in the 3D scene can draw over a DOM overlay, so the answer is null
   * whenever something WOULD have been in front of it: another window on top,
   * the browser minimised, or the Start menu open across it. Being strict here
   * is what stops the page from floating over things it should be behind.
   */
  function webTarget() {
    if (state.startOpen) return null;
    const top = state.windows[state.windows.length - 1];
    if (!top || top.app !== 'browser' || top.minimized) return null;
    const page = PAGES[browser.url];
    if (!page || !page.url) return null;
    return { rect: contentRect(top), url: page.url, zoom: PAGE_ZOOM };
  }

  /** Bind to a monitor's screen handle; repaints land there from now on. */
  function attach(screen) {
    target = screen;
    dirty = true;
  }

  function detach() {
    target = null;
    hover = null;
    armed = null;
    drag = null;
  }

  /**
   * One repaint per frame, at most. Also ticks the tray clock, which is the
   * only thing on screen that changes without being touched.
   */
  function repaint() {
    if (!target) return;
    target.redraw((ctx, w, h) => draw(ctx, w, h));
    dirty = false;
  }

  function tick(dt = 0, usable = true) {
    if (clippy.tick(dt, usable)) dirty = true;
    const now = new Date();
    if (now.getMinutes() !== state.time.getMinutes()) { state.time = now; dirty = true; }
    if (dirty) repaint();
  }

  /**
   * The desktop as it comes up, every time.
   *
   * Called once when the shell is built and again whenever the machine is
   * switched off, so a boot always lands on the same clean desktop rather than
   * on whatever was left open last time — and so the welcome note is already
   * there to be read, the way a machine set up for a visitor would be.
   */
  function reset() {
    clippy.reset();
    state.windows.length = 0;
    state.selected = -1;
    state.startOpen = false;
    hover = null;
    hoverAction = null;
    armed = null;
    drag = null;
    browser.url = HOME;
    browser.history = [HOME];
    browser.index = 0;
    browser.status = '';
    photos.selected = null;
    photos.scroll = 0;
    documents.selected = null;
    bin.selected = null;
    computer.selected = null;
    player.stop();
    openWindow('notes');
    dirty = true;
  }

  // Put the desktop into its just-booted state now, so the very first power-on
  // shows the same thing every later one does.
  reset();

  return {
    state, player, browser, draw, attach, detach, tick, reset, webTarget,
    pointerMove, pointerLeave, pointerDown, pointerUp,
    openWindow, closeWindow,
    applyNoteSettings, scrollNotes,
    invalidate() { dirty = true; },
  };
}
