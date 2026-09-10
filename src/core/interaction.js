/**
 * interaction.js — orbiting, pressing, and spinning the wheel.
 *
 * Three problems this solves, none of which are obvious until the thing is in
 * your hands:
 *
 * 1. A drag that happens to END over a button must not fire that button. Every
 *    press is gated on the pointer having moved less than TAP_SLOP pixels.
 *
 * 2. Dragging around the wheel must not also tumble the device. On pointerdown
 *    over any wheel target we take the gesture: OrbitControls is disabled for
 *    its duration. That matches the real object, where the wheel captures your
 *    finger, and it removes the ambiguity entirely. Drag anywhere else — the
 *    body, the backdrop — and you orbit normally.
 *
 * 3. The listener runs in the CAPTURE phase so it wins the race with
 *    OrbitControls' own pointerdown handler, which is attached to the same
 *    element.
 *
 * This module never touches wheel geometry; it calls press()/setHover() on the
 * component and lets the component decide how to move.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { FRAMING, WHEEL } from '../theme/spec.js';
import * as audio from './audio.js';

/** How far the pointer may move and still count as a tap, in CSS pixels. */
const TAP_SLOP = 5;
/** Wheel travel between scroll ticks. 15 degrees is close to the real device. */
const TICK_STEP = Math.PI / 12;
/** Idle seconds before the camera starts drifting on its own. */
const IDLE_AFTER = 4.0;

export function createInteraction({ renderer, camera, device, onFrame }) {
  const el = renderer.domElement;
  const wheel = device.userData.wheel;

  // ── orbit ──────────────────────────────────────────────────────────────
  const controls = new OrbitControls(camera, el);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false; // there is one object; panning only loses it
  controls.minDistance = FRAMING.minDistance;
  controls.maxDistance = FRAMING.maxDistance;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI - 0.15;
  controls.autoRotateSpeed = 0.55;
  controls.target.set(...FRAMING.target);

  // ── state ──────────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  let armed = null; // the button id under the pointer at pointerdown
  let startX = 0;
  let startY = 0;
  let moved = 0;
  let scrolling = false;
  let lastAngle = 0;
  let angleAccum = 0;
  let idleFor = 0;
  let hovered = null;
  // The page holds two stages at once and both keep their listeners attached
  // to the one canvas. Without this flag the iPod would go on raycasting its
  // wheel and fighting over the cursor while the desk scene is on screen.
  let enabled = true;

  const events = { press: [] };
  /** Subscribe to button presses: on('press', id => ...). */
  function on(name, fn) {
    events[name].push(fn);
    return () => {
      const i = events[name].indexOf(fn);
      if (i >= 0) events[name].splice(i, 1);
    };
  }
  const emit = (name, arg) => events[name].forEach((fn) => fn(arg));

  function pick(event) {
    const rect = el.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(wheel.hitZones, false);
    return hits.length ? hits[0] : null;
  }

  function setHover(id) {
    if (hovered === id) return;
    hovered = id;
    wheel.setHover(id);
    el.style.cursor = id ? 'pointer' : 'grab';
  }

  // ── pointer handling ───────────────────────────────────────────────────
  function onPointerDown(event) {
    if (!enabled || !event.isPrimary) return;

    // Must happen inside a real gesture or the first click of the session is
    // silent — the autoplay policy keeps the AudioContext suspended until then.
    audio.unlock();

    idleFor = 0;
    controls.autoRotate = false;

    startX = event.clientX;
    startY = event.clientY;
    moved = 0;
    scrolling = false;

    const hit = pick(event);
    armed = hit ? hit.object.userData.button : null;

    if (armed) {
      // Take the gesture. See note 2 at the top of this file.
      controls.enabled = false;
      lastAngle = wheel.angleAt(hit.point);
      angleAccum = 0;
    }
  }

  function onPointerMove(event) {
    if (!enabled || !event.isPrimary) return;
    idleFor = 0;

    if (armed === null) {
      // Not pressing anything: just hover feedback.
      const hit = pick(event);
      setHover(hit ? hit.object.userData.button : null);
      return;
    }

    moved = Math.hypot(event.clientX - startX, event.clientY - startY);

    // The select button is a button, not a scroll surface.
    if (armed === 'select') return;
    if (moved <= TAP_SLOP && !scrolling) return;

    const hit = pick(event);
    if (!hit) return;

    const r = wheel.radiusAt(hit.point);
    if (r < WHEEL.centerRadius || r > WHEEL.outerRadius) return;

    scrolling = true;
    setHover(hit.object.userData.button);

    // Shortest signed angular step, so crossing the -PI/PI seam is not a jump.
    const a = wheel.angleAt(hit.point);
    let d = a - lastAngle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    lastAngle = a;

    angleAccum += d;
    while (Math.abs(angleAccum) >= TICK_STEP) {
      angleAccum -= Math.sign(angleAccum) * TICK_STEP;
      audio.click('tick');
    }
  }

  function onPointerUp(event) {
    if (!enabled || !event.isPrimary) return;

    // A tap: pressed and released without really moving.
    if (armed !== null && !scrolling && moved <= TAP_SLOP) {
      wheel.press(armed);
      audio.click(armed === 'select' ? 'select' : 'button');
      emit('press', armed);
    }

    if (armed !== null) controls.enabled = true;
    armed = null;
    scrolling = false;
  }

  function onPointerLeave() {
    if (!enabled) return;
    setHover(null);
  }

  // Capture phase: this must run before OrbitControls' own handler.
  el.addEventListener('pointerdown', onPointerDown, { capture: true });
  el.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointerleave', onPointerLeave);
  el.style.cursor = 'grab';

  // ── per-frame ──────────────────────────────────────────────────────────
  const unsubscribe = onFrame((dt, t) => {
    wheel.update(dt);
    controls.update();

    // Drift back into the idle showcase, but never while the pointer is
    // resting on a button: having the device rotate out from under a target
    // you are about to click is maddening.
    idleFor += dt;
    if (idleFor > IDLE_AFTER && hovered === null) controls.autoRotate = true;

    // A slow float, so the device never looks like it is sitting on nothing.
    device.position.y = Math.sin(t * 0.55) * 0.11;
    device.rotation.z = Math.sin(t * 0.31) * 0.012;
  });

  return {
    controls,
    on,

    /** Stop listening without tearing anything down. See the flag above. */
    setEnabled(on_) {
      enabled = on_;
      controls.enabled = on_;
      if (!on_) {
        setHover(null);
        armed = null;
        scrolling = false;
      }
      el.style.cursor = on_ ? 'grab' : '';
    },

    dispose() {
      unsubscribe();
      el.removeEventListener('pointerdown', onPointerDown, { capture: true });
      el.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerleave', onPointerLeave);
      controls.dispose();
    },
  };
}
