/**
 * stages/desktop.js — the desk scene: a machine photographed, not a turntable.
 *
 * The camera is on rails by default. The iPod is an object you pick up and turn
 * over; this is a room you are sitting in, and orbiting it freely by accident
 * would destroy the one thing it is trying to be. So core/camera-rig.js places
 * the camera and moves it between two known framings, and the pointer only
 * nudges it a few millimetres of parallax.
 *
 * `c` unlocks it anyway. Rails are the right default and the wrong prison: the
 * desk is a real model and sometimes you want to walk round the back of it.
 * Unlocking hands the rig's CURRENT view to OrbitControls so there is no jump,
 * and re-locking hands it back — flying from wherever you left the camera to
 * wherever it should have been, rather than cutting.
 *
 * The whole stage is one small state machine:
 *
 *     off ──press──> booting ──> on, camera flying in ──> zoomed
 *      ^                                                    │
 *      └───────────── press again, or Esc ──────────────────┘
 *
 * Two rules about pointer input matter everywhere: audio.unlock() has to run
 * inside a real gesture or the first sound of the session is silent, and a
 * press is gated on
 * the pointer having barely moved, so a drag that happens to end over the
 * button does not fire it.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { createFrameBus } from '../core/engine.js';
import { createRoomEnvironment, createRoomLighting } from '../core/room-env.js';
import { createCameraRig, frameObject } from '../core/camera-rig.js';
import { createRoomBackdrop } from '../theme/room.js';
import { FRAMING, MONITOR, TOWER, KEYBOARD, recompute, u } from '../theme/desk-spec.js';
import { createTweakPanel } from '../core/tweak.js';
import { CONTROL_GROUPS } from './desktop-controls.js';
import { disposeTree } from '../lib/dispose.js';
import { SHARED_MATERIALS } from '../theme/shared-materials.js';
import { drawBoot, drawOff, crtGrille } from '../theme/desk-textures.js';
import { createShell } from '../ui/win95/shell.js';
import { NOTE_SETTINGS } from '../ui/win95/notes.js';
import { createWebFrame } from '../ui/win95/web-frame.js';
import * as Desktop from '../objects/desktop/Desktop.js';
import * as audio from '../core/audio.js';

export const meta = {
  id: 'desktop',
  label: 'Desktop',
  title: "Rakshit’s Desktop",
  hud: 'hud-desktop',
};

/** How far the pointer may move and still count as a tap, in CSS pixels. */
const TAP_SLOP = 5;
/** The tube stays dark this long after the switch — the PSU has to come up. */
const BOOT_DELAY = 0.22;
/** How long the raster takes to open and settle. */
const BOOT_RISE = 0.85;
/** A CRT switching off collapses much faster than it comes up. */
const BOOT_FALL = 0.38;
/** Into the flight before the camera starts, so the flash lands first. */
const FLY_AFTER = 0.55;

export function createDesktopStage({ renderer }) {
  const el = renderer.domElement;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(
    FRAMING.fov,
    1, // corrected by the engine's first resize
    // Much nearer than the iPod stage's 3: the fly-in ends a few units off the
    // glass. Affordable because this scene's applied features are stacked
    // 0.2 mm apart rather than 0.05 (see MOUNT in theme/desk-spec.js).
    FRAMING.near,
    FRAMING.far
  );

  const backdrop = createRoomBackdrop();
  createRoomEnvironment(renderer, scene);
  createRoomLighting(scene);

  let desktop = Desktop.create();
  scene.add(desktop);

  // `let`, not `const`: the tweak panel can rebuild the whole desk when a
  // dimension changes, and every one of these handles is replaced with it.
  let { screen, monitor, keyboard, power } = desktop.userData;

  /**
   * The operating system on the tube.
   *
   * It owns its own state and repaints itself; this stage only tells it when
   * the machine is on, hands it pointer positions in raster pixels, and gives
   * it the tube's scanlines to lay over whatever it drew.
   */
  const shell = createShell({
    width: screen.width,
    height: screen.height,
    overlay: (ctx, w, h) => crtGrille(ctx, w, h, 1),
    onShutDown: () => throwSwitch(),
    onNoteChange: () => tweak.sync(),
  });

  /**
   * The live page overlay.
   *
   * A real iframe warped onto IE's content area. It is DOM over WebGL, so it
   * cannot be occluded by anything the renderer draws — which is why it is
   * driven from the frame loop and hidden the moment the shell says something
   * should be in front of it.
   */
  const webFrame = createWebFrame();

  /* ── framings ──────────────────────────────────────────────────────── */

  /**
   * The wide shot, read fresh each time.
   *
   * A function rather than a constant because the tweak panel edits
   * FRAMING.position in place — a snapshot taken at construction would leave
   * every later pull-back flying to where the camera used to live.
   */
  const wide = () => ({
    position: new THREE.Vector3(...FRAMING.position.map(u)),
    target: new THREE.Vector3(...FRAMING.target.map(u)),
  });
  const rig = createCameraRig(camera, wide());

  // Straight down the tube's axis. Anything off-axis makes a UI read as a
  // photograph of a screen rather than as the screen itself.
  //
  // Read off the picture's own world orientation rather than rebuilt from
  // MONITOR.yaw: the tube is tilted back as well as turned, and a hand-built
  // normal silently stops matching the moment either number changes.
  const faceNormal = new THREE.Vector3(0, 0, 1);
  function refreshFaceNormal() {
    desktop.updateMatrixWorld(true);
    faceNormal
      .set(0, 0, 1)
      .applyQuaternion(screen.mesh.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
  }
  refreshFaceNormal();

  /** Where the camera has to be for the picture to fill the frame with padding. */
  const zoomFraming = () =>
    frameObject(screen.mesh, {
      camera,
      direction: faceNormal,
      padding: FRAMING.zoomPadding,
    });

  /* ── free orbit, off by default ────────────────────────────────────── */

  const controls = new OrbitControls(camera, el);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  // Panning is allowed here, unlike the iPod's single object: this is a desk
  // with three things on it and sliding across is a reasonable thing to want.
  // Getting lost is recoverable — `c` flies you back.
  controls.enablePan = true;
  controls.minDistance = u(260);
  controls.maxDistance = u(3200);
  controls.minPolarAngle = 0.12;
  // Stop just above horizontal so you cannot get under the desk and look up
  // through a surface that has no underside worth seeing.
  controls.maxPolarAngle = Math.PI * 0.495;

  /* ── state ─────────────────────────────────────────────────────────── */

  const frame = createFrameBus();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const parallax = new THREE.Vector2();
  const parallaxTarget = new THREE.Vector2();

  let enabled = false;
  let armed = null;
  let startX = 0;
  let startY = 0;
  let moved = 0;
  let hovered = null;
  // True while a press that began on the glass is still down.
  let screenArmed = false;

  /** null when settled; otherwise seconds since the switch was thrown. */
  let bootT = null;
  let degaussed = false;
  let on = false;
  let zoomed = false;
  let unlocked = false;
  // The fly-in fires once per power-on. Without this, hitting Esc during the
  // first half-second would send the camera straight back in again.
  let flown = false;

  const backBtn = document.getElementById('desk-back');
  const camBtn = document.getElementById('desk-camera');
  const hint = document.getElementById('desk-hint');
  const powerHint = document.getElementById('power-hint');

  /**
   * The sound toggle.
   *
   * There was no way to mute this scene at all — audio.setEnabled() existed and
   * nothing called it — which is why the feedback asked for "mute by default".
   * The level was the other half of that, and is fixed in core/audio.js.
   *
   * It starts OFF. The power thunk and the fan spinning up are a large part of
   * what this is, so muting by default does spend them on anyone who never
   * finds the toggle — but a link like this gets opened on a work machine, and
   * a page that makes noise unasked during a meeting is the worse failure. The
   * default has to be the one that is never embarrassing; the pill is right
   * there for everyone else.
   */
  const soundBtn = document.getElementById('desk-sound');
  let soundOn = false;

  /**
   * Scope: the machine's own noises only — the fan whirring away in the
   * background, and the clicks and thunks it makes when you press its
   * buttons. Everything behind core/audio.js, in other words.
   *
   * Deliberately NOT the music player. That is a song somebody chose to put
   * on, not a noise the computer decided to make, and a play button that
   * produces silence because of a toggle across the room is a worse surprise
   * than the sound itself. It has its own transport; whoever pressed play can
   * press stop.
   */
  function applySound() {
    audio.setEnabled(soundOn);
    soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off';
    soundBtn.classList.toggle('off', !soundOn);
  }

  applySound();

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    applySound();
  });

  /**
   * The nudge toward the power button.
   *
   * Everything on this machine is behind one press, and a dark screen on a
   * photograph of a desk does not obviously invite one.
   *
   * This was three seconds, on the theory that arriving instantly would talk
   * over the scene. Two of three testers still said they did not realise they
   * had to power it on, so the theory was wrong: with nothing else to do, three
   * seconds of a dark screen is long enough to conclude the page is broken.
   * One second, and styled as a callout rather than as more HUD furniture.
   */
  const HINT_AFTER = 1;
  const hintAnchor = new THREE.Vector3();
  let hintT = null;                 // seconds since arming, or null when not armed

  function dismissHint() {
    hintT = null;
    powerHint.classList.remove('show');
  }

  /** Re-arm on arrival, but only if there is anything to ask for. */
  function armHint() {
    powerHint.classList.remove('show');
    hintT = on ? null : 0;
  }

  /**
   * Park the pill above the power button, in page coordinates.
   * Returns false when the button is behind the camera or off screen, which is
   * the only sane time to hide a callout that points at something.
   */
  function placeHint() {
    const zone = power.hitZones[0];
    if (!zone) return false;
    zone.getWorldPosition(hintAnchor).project(camera);
    if (hintAnchor.z > 1) return false;
    const rect = el.getBoundingClientRect();
    const px = rect.left + (hintAnchor.x * 0.5 + 0.5) * rect.width;
    const py = rect.top + (-hintAnchor.y * 0.5 + 0.5) * rect.height;
    if (px < rect.left || px > rect.right || py < rect.top || py > rect.bottom) return false;
    powerHint.style.left = `${Math.round(px)}px`;
    powerHint.style.top = `${Math.round(py - 64)}px`;
    return true;
  }

  /**
   * Hand the camera to the user, or take it back.
   *
   * Both directions matter. Unlocking seeds OrbitControls from the rig's
   * current view, so the first frame after pressing `c` is identical to the
   * last one before it — without that the camera jumps to whatever framing the
   * rails were nominally at. Re-locking does the mirror image: the rig adopts
   * wherever the user actually left the camera, THEN flies from there to where
   * it belongs, so the way back is the same graceful move as the way in.
   *
   * @param {boolean} next
   * @param {boolean} fly re-lock with a flight (false = adopt and stay put,
   *        used when the boot sequence is about to fly somewhere itself)
   */
  function setUnlocked(next, fly = true) {
    if (next === unlocked) return;
    unlocked = next;

    if (unlocked) {
      const view = rig.view;
      camera.position.copy(view.position);
      controls.target.copy(view.target);
      controls.enabled = true;
      controls.update();
    } else {
      controls.enabled = false;
      // Adopt the user's camera before flying, or the move starts from the
      // rails' stale idea of where it was and the first frame snaps.
      rig.snapTo({ position: camera.position.clone(), target: controls.target.clone() });
      if (fly) {
        rig.flyTo({
          ...(zoomed ? zoomFraming() : wide()),
          duration: FRAMING.zoomDuration * 0.8,
        });
      }
    }

    el.style.cursor = unlocked ? 'grab' : 'default';
    setChrome();
  }

  function setChrome() {
    backBtn.classList.toggle('on', zoomed && !unlocked);
    camBtn.classList.toggle('on', unlocked);
    if (unlocked) {
      hint.innerHTML =
        '<kbd>drag</kbd> to orbit · <kbd>scroll</kbd> to zoom · ' +
        '<kbd>c</kbd> or <kbd>esc</kbd> to put the camera back';
      return;
    }
    // The tweak panel is deliberately absent from this line. It is still on the
    // t key for building the scene, but it is not something a visitor should be
    // invited to open.
    hint.innerHTML = on
      ? '<kbd>esc</kbd> to pull back · click the power button again to shut down · ' +
        '<kbd>c</kbd> free camera'
      : 'click the power button on the tower · <kbd>c</kbd> free camera';
  }
  setChrome();

  /* ── the machine ───────────────────────────────────────────────────── */

  function throwSwitch() {
    // The boot is about to fly the camera itself, so take it back WITHOUT a
    // flight of its own — the rig adopts wherever you left it and the fly-in
    // starts from there. Pressing power is asking for the boot; being dumped
    // back at the wide shot first, only to be flown in again, is not.
    if (unlocked) setUnlocked(false, false);

    on = power.press();
    audio.click('power');
    dismissHint();
    bootT = 0;
    degaussed = false;
    flown = false;

    if (on) {
      // The fan deliberately does NOT start here. Pressing power kicks off the
      // boot animation — a full 800x600 repaint every frame — and a camera
      // flight at the same time, and starting a looping WebAudio source into
      // that much main-thread work is what made the sound choppy. It starts
      // when the boot lands instead, where its 1.6s ramp reads as the fan
      // spinning up rather than as a glitch.
      //
      // The flight is started from update(), FLY_AFTER into the boot, so the
      // flash lands before the camera begins to move.
    } else {
      audio.stopHum();
      if (zoomed) pullBack();
    }
    setChrome();
  }

  function flyIn() {
    zoomed = true;
    setChrome();
    rig.flyTo({ ...zoomFraming(), duration: FRAMING.zoomDuration });
  }

  function pullBack() {
    if (!zoomed) return;
    zoomed = false;
    setChrome();
    rig.flyTo({ ...wide(), duration: FRAMING.zoomDuration * 0.85 });
  }

  /* ── the tweak panel ───────────────────────────────────────────────── */

  /**
   * Reapply everything that is NOT baked into geometry.
   *
   * Placement, angle and lens are all read from the spec every time rather
   * than captured at build time, which is what lets a slider move the tower
   * across the desk with no rebuild at all.
   */
  function applyLive() {
    shell.applyNoteSettings();
    const { monitor: mon, tower, keyboard: kb } = desktop.userData.parts;

    mon.position.set(u(MONITOR.x), 0, u(MONITOR.z));
    mon.rotation.set(MONITOR.tilt, MONITOR.yaw, 0);
    tower.position.set(u(TOWER.x), 0, u(TOWER.z));
    tower.rotation.y = TOWER.yaw;
    kb.position.set(u(KEYBOARD.x), 0, u(KEYBOARD.z));
    kb.rotation.y = KEYBOARD.yaw;

    camera.fov = FRAMING.fov;
    camera.updateProjectionMatrix();

    refreshFaceNormal();
    // Re-aim wherever the rig is meant to be sitting. Without this, moving the
    // monitor while zoomed in leaves the camera pointing at where it used to
    // be, which reads as the model breaking rather than the camera being stale.
    //
    // Not while the camera is unlocked, though: you may well be orbiting in
    // order to see what a slider is doing, and yanking the view on every drag
    // of that slider would make the panel unusable.
    if (!unlocked) rig.snapTo(zoomed ? zoomFraming() : wide());
  }

  /**
   * Rebuild the desk from the spec.
   *
   * Dimensions are baked into geometry at create() time — there is no way to
   * widen a bezel that has already been extruded — so a size change means
   * building the whole thing again. Cheap enough at this scale (about 30
   * meshes) that debouncing the slider is all the throttling it needs.
   *
   * Everything transient has to survive the swap: whether the machine is on,
   * what the tube is showing, and every handle the stage holds.
   */
  function rebuild() {
    recompute(); // derived values first — screenY depends on two of the sliders

    const wasOn = power.isOn();

    scene.remove(desktop);
    disposeTree(desktop, SHARED_MATERIALS);

    desktop = Desktop.create();
    scene.add(desktop);
    ({ screen, monitor, keyboard, power } = desktop.userData);

    power.setOn(wasOn);
    monitor.setLamp(wasOn ? 1 : 0);
    keyboard.setLamp(wasOn ? 1 : 0);
    if (wasOn) shell.attach(screen);
    else { shell.detach(); screen.redraw(drawOff); }
    bootT = null;

    applyLive();
  }

  const tweak = createTweakPanel({
    groups: CONTROL_GROUPS,
    storageKey: 'desk-tweaks',
    title: 'Desk tweaks',
    onLive: (spec) => {
      if (spec?.target === NOTE_SETTINGS) shell.applyNoteSettings();
      else applyLive();
    },
    onRebuild: rebuild,
  });

  // A saved session may have changed a dimension, in which case what was built
  // a moment ago was built from the defaults.
  if (tweak.restoredRebuild) rebuild();
  else applyLive();
  tweak.sync();

  const tweakBtn = document.getElementById('desk-tweak');
  const syncTweakBtn = () => tweakBtn.classList.toggle('on', tweak.isOpen());
  tweakBtn.addEventListener('click', () => {
    tweak.toggle();
    syncTweakBtn();
  });

  /* ── pointer ───────────────────────────────────────────────────────── */

  function pick(event) {
    const rect = el.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(power.hitZones, false);
    return hits.length ? hits[0] : null;
  }

  /**
   * Where on the raster the pointer is, in canvas pixels, or null.
   *
   * The picture is a bulged PlaneGeometry, so it carries UVs and the raycaster
   * returns them with the intersection. UV maps straight to canvas pixels — v
   * is flipped because a texture counts up from the bottom and a canvas counts
   * down from the top. Raycasting the real curved surface rather than a flat
   * stand-in is what keeps the mapping honest near the edges, where the bulge
   * has moved the glass a visible distance toward the viewer.
   */
  function screenPoint(event) {
    if (!on || bootT !== null) return null;
    const rect = el.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const uv = raycaster.intersectObject(screen.mesh, false)[0]?.uv;
    return uv ? { x: uv.x * screen.width, y: (1 - uv.y) * screen.height } : null;
  }

  function setHover(id) {
    if (hovered === id) return;
    hovered = id;
    power.setHover(id);
    el.style.cursor = id ? 'pointer' : unlocked ? 'grab' : 'default';
  }

  function onPointerDown(event) {
    if (!enabled || !event.isPrimary) return;
    // Inside a real gesture, or the first sound of the session is silent.
    audio.unlock();
    startX = event.clientX;
    startY = event.clientY;
    moved = 0;

    // The glass wins over everything behind it: if the press landed on a lit
    // screen, it belongs to the operating system, not to the model.
    const p = screenPoint(event);
    if (p) {
      screenArmed = true;
      armed = null;
      shell.pointerDown(p.x, p.y);
      return;
    }
    screenArmed = false;
    armed = pick(event)?.object.userData.button ?? null;
  }

  function onPointerMove(event) {
    if (!enabled || !event.isPrimary) return;

    const rect = el.getBoundingClientRect();
    parallaxTarget.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // A press that began on the glass keeps feeding the shell, because that is
    // what a window drag is made of. Off the glass the drag simply pauses:
    // there is no raster coordinate out there to move it to.
    if (screenArmed) {
      const p = screenPoint(event);
      if (p) shell.pointerMove(p.x, p.y);
      return;
    }
    if (armed !== null) {
      moved = Math.hypot(event.clientX - startX, event.clientY - startY);
      return;
    }

    const p = screenPoint(event);
    if (p) {
      setHover(null);
      // The shell reports whether the pointer is over something it would act
      // on, which is the only hover signal a texture can give back.
      const overControl = shell.pointerMove(p.x, p.y);
      el.style.cursor = overControl ? 'pointer' : unlocked ? 'grab' : 'default';
      return;
    }
    // Off the glass: drop any highlight the shell was showing.
    shell.pointerLeave();

    // Raycasting every move is affordable here: there is exactly one hit zone.
    setHover(pick(event)?.object.userData.button ?? null);
  }

  function onPointerUp(event) {
    if (!enabled || !event.isPrimary) return;
    if (screenArmed) {
      screenArmed = false;
      const p = screenPoint(event);
      // The shell does its own same-region check, so a press that slid off a
      // button cancels rather than firing the wrong one.
      if (p) shell.pointerUp(p.x, p.y);
      return;
    }
    if (armed === 'power' && moved <= TAP_SLOP) throwSwitch();
    armed = null;
  }

  function onPointerLeave() {
    if (!enabled) return;
    shell.pointerLeave();
    setHover(null);
    parallaxTarget.set(0, 0);
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointerleave', onPointerLeave);
  el.addEventListener('wheel', (event) => {
    if (!enabled || unlocked || event.deltaY === 0) return;
    const p = screenPoint(event);
    if (p && shell.scrollNotes(p.x, p.y, Math.sign(event.deltaY) * 3)) event.preventDefault();
  }, { passive: false });

  backBtn.addEventListener('click', pullBack);
  camBtn.addEventListener('click', () => setUnlocked(!unlocked));

  /* ── per-frame ─────────────────────────────────────────────────────── */

  frame.add((dt) => {
    power.update(dt);

    // Tracks the button every frame once shown, so it follows the tower through
    // the camera drift, a free-camera orbit, or a tweak-panel rebuild.
    if (hintT !== null) {
      if (on) dismissHint();
      else {
        hintT += dt;
        if (hintT >= HINT_AFTER) powerHint.classList.toggle('show', placeHint());
      }
    }
    // One repaint per frame at most, and only when something actually changed.
    shell.tick(dt, on && bootT === null && zoomed && !rig.moving && !unlocked);

    // The overlay re-derives its corners every frame from the same mesh and
    // camera the renderer uses, so it tracks the tube through camera moves,
    // window drags and the monitor's own tilt without being told about any
    // of them.
    const web = on && bootT === null ? shell.webTarget() : null;
    if (web) {
      webFrame.setSrc(web.url);
      webFrame.update({
        THREE, camera, canvas: el,
        mesh: screen.mesh,
        rect: web.rect,
        zoom: web.zoom,
        raster: { width: screen.width, height: screen.height },
      });
    } else {
      webFrame.hide();
    }

    /**
     * The boot.
     *
     * `k` runs 0..1 forward when switching on and 1..0 when switching off, and
     * both directions go through the same draw. A CRT collapsing is a raster
     * closing, which is exactly the boot played backwards — so there is one
     * animation here, not two.
     */
    if (bootT !== null) {
      bootT += dt;
      const span = on ? BOOT_RISE : BOOT_FALL;
      const raw = Math.min(1, Math.max(0, (bootT - (on ? BOOT_DELAY : 0)) / span));
      const k = on ? raw : 1 - raw;

      if (on && !degaussed && bootT >= BOOT_DELAY) {
        audio.click('degauss');
        degaussed = true;
      }

      if (bootT >= (on ? BOOT_DELAY : 0)) {
        if (raw >= 1) {
          // The boot ends on the desktop, which is the whole point of booting.
          if (on) {
            shell.attach(screen);
            audio.startHum();
          } else {
            // Powering off closes everything and silences the music, so the
            // next boot comes up on a clean desktop rather than mid-song.
            shell.detach();
            shell.reset();
            screen.redraw(drawOff);
          }
          bootT = null;
        } else {
          screen.redraw((ctx, w, h) => drawBoot(ctx, w, h, k));
        }
      }

      // The room's share of the screen light tracks the raster, so the bezel
      // and the desk in front of it brighten as the tube comes up.
      monitor.setLamp(k);
      keyboard.setLamp(on ? Math.min(1, bootT / 0.5) : k);

      if (on && !flown && bootT >= FLY_AFTER) {
        flown = true;
        flyIn();
      }
    }

    // Exactly one of these drives the camera. Running both means the rig
    // rewrites the position OrbitControls just set, every frame, and the
    // camera sticks to the rails while appearing to fight you.
    if (unlocked) {
      controls.update();
      return;
    }

    // Parallax: a heavily damped drift, and much smaller once the screen is
    // the subject — at that range even a small shift swims.
    const scale = u(FRAMING.parallax) * (zoomed ? 0.22 : 1);
    parallax.lerp(parallaxTarget, Math.min(1, dt * 2.2));
    rig.setOffset(parallax.x * scale, parallax.y * scale * 0.55, 0);

    rig.update(dt);
  });

  /* ── keys ──────────────────────────────────────────────────────────── */

  function onKeyDown(event) {
    if (!enabled) return;
    // Editing a note must not trigger the scene's T/C/Escape shortcuts.
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    if (event.key === 'c' || event.key === 'C') {
      setUnlocked(!unlocked);
      return;
    }
    if (event.key === 'Escape') {
      // Esc means "undo the thing I am currently in". Free camera first,
      // because that is the more surprising state to be stuck in.
      if (unlocked) setUnlocked(false);
      else pullBack();
      return;
    }
    if (event.key === 't' || event.key === 'T') {
      tweak.toggle();
      syncTweakBtn();
    }
  }
  window.addEventListener('keydown', onKeyDown);

  return {
    ...meta,
    scene,
    camera,
    backdrop,
    desktop,
    screen,

    activate() {
      enabled = true;
      armHint();
      // The machine kept running while the other stage was on screen, so if it
      // is on, its fan comes back with it.
      if (on) audio.startHum(0.6);
      setChrome();
    },

    deactivate() {
      enabled = false;
      shell.pauseTour();
      webFrame.hide();
      dismissHint();
      // Put the camera back before leaving, so switching away and returning
      // does not drop you somewhere under the desk with no memory of why.
      setUnlocked(false, false);
      if (!rig.moving) rig.snapTo(zoomed ? zoomFraming() : wide());
      tweak.toggle(false);
      syncTweakBtn();
      setHover(null);
      parallaxTarget.set(0, 0);
      el.style.cursor = '';
      // The tower keeps running in the background; only the fan is silenced,
      // because a hum with no visible machine is just noise.
      audio.stopHum(0.4);
    },

    /**
     * Re-frame on resize.
     *
     * The zoom distance depends on the viewport aspect, so a window that gets
     * narrower while zoomed in would crop the screen it is supposed to be
     * framing. Recomputing is the whole fix.
     */
    resize() {
      if (zoomed && !unlocked) rig.snapTo(zoomFraming());
    },

    update(dt, t) {
      frame.run(dt, t);
    },

    /** For the console, and for the UI that gets designed against it later. */
    api: {
      isOn: () => on,
      isZoomed: () => zoomed,
      isUnlocked: () => unlocked,
      setUnlocked,
      flyIn, pullBack, throwSwitch, rig, controls, tweak,
      applyLive, rebuild,
      get desktop() { return desktop; },
    },
  };
}
