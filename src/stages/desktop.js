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
 * Two rules are carried over from core/interaction.js because they matter
 * everywhere, not just on the iPod: audio.unlock() has to run inside a real
 * gesture or the first sound of the session is silent, and a press is gated on
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
import { drawBoot, drawOn, drawOff } from '../theme/desk-textures.js';
import * as Desktop from '../objects/desktop/Desktop.js';
import * as audio from '../core/audio.js';

export const meta = {
  id: 'desktop',
  label: 'Desktop',
  title: '2000s desktop — 3D',
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
    hint.innerHTML = on
      ? '<kbd>esc</kbd> to pull back · click the power button again to shut down · ' +
        '<kbd>c</kbd> free camera · <kbd>t</kbd> tweak panel'
      : 'click the power button on the tower · ' +
        '<kbd>c</kbd> free camera · <kbd>t</kbd> tweak panel';
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
    bootT = 0;
    degaussed = false;
    flown = false;

    if (on) {
      audio.startHum();
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
    screen.redraw(wasOn ? drawOn : drawOff);
    bootT = null;

    applyLive();
  }

  const tweak = createTweakPanel({
    groups: CONTROL_GROUPS,
    storageKey: 'desk-tweaks',
    title: 'Desk tweaks',
    onLive: applyLive,
    onRebuild: rebuild,
  });

  // A saved session may have changed a dimension, in which case what was built
  // a moment ago was built from the defaults.
  if (tweak.restoredRebuild) rebuild();
  else applyLive();

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
    armed = pick(event)?.object.userData.button ?? null;
  }

  function onPointerMove(event) {
    if (!enabled || !event.isPrimary) return;

    const rect = el.getBoundingClientRect();
    parallaxTarget.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    if (armed !== null) {
      moved = Math.hypot(event.clientX - startX, event.clientY - startY);
      return;
    }
    // Raycasting every move is affordable here: there is exactly one hit zone.
    setHover(pick(event)?.object.userData.button ?? null);
  }

  function onPointerUp(event) {
    if (!enabled || !event.isPrimary) return;
    if (armed === 'power' && moved <= TAP_SLOP) throwSwitch();
    armed = null;
  }

  function onPointerLeave() {
    if (!enabled) return;
    setHover(null);
    parallaxTarget.set(0, 0);
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointerleave', onPointerLeave);

  backBtn.addEventListener('click', pullBack);
  camBtn.addEventListener('click', () => setUnlocked(!unlocked));

  /* ── per-frame ─────────────────────────────────────────────────────── */

  frame.add((dt) => {
    power.update(dt);

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
          screen.redraw(on ? drawOn : drawOff);
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
    // Never steal a key from the tweak panel's number fields.
    if (event.target instanceof HTMLInputElement) return;

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
      // The machine kept running while the other stage was on screen, so if it
      // is on, its fan comes back with it.
      if (on) audio.startHum(0.6);
      setChrome();
    },

    deactivate() {
      enabled = false;
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
