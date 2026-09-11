/**
 * engine.js — renderer, frame loop, resize, and the stage swap. Models nothing.
 *
 * The engine deliberately does NOT own a scene or a camera. The page shows two
 * different subjects — today a desktop PC
 * photographed on a desk — and they disagree about almost everything a camera
 * cares about, most importantly the near plane (see below). So each stage
 * brings its own, and `setStage` decides which one the loop draws.
 *
 * A stage is any object shaped like:
 *
 *     { scene, camera, backdrop?, activate?(), deactivate?(), resize?(w, h) }
 *
 * The one thing here that is not boilerplate is the backdrop pass: autoClear is
 * off, and each frame clears once, draws the stage's backdrop, clears depth,
 * then draws the scene on top. That lets a background be a genuine 2D pass
 * instead of a giant sphere the camera lives inside.
 */

import * as THREE from 'three';

export function createEngine({ canvas, antialias = true } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias,
    alpha: false,
    powerPreference: 'high-performance',
  });
  // 3x devicePixelRatio is 2.25x the pixels of 2x for no visible gain.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  // Shadow mapping is deliberately OFF. Neither stage has a shadow-casting
  // setup worth the cost: the desk
  // scene gets its contact shadows painted into textures instead. See README.
  renderer.shadowMap.enabled = false;
  renderer.autoClear = false;

  const clock = new THREE.Clock();
  const updaters = new Set();
  let stage = null;

  /** Register a per-frame callback fn(dt, t). Returns an unsubscribe function. */
  function onFrame(fn) {
    updaters.add(fn);
    return () => updaters.delete(fn);
  }

  /**
   * Swap the active stage.
   *
   * Stages are built once and kept alive, so switching back finds a scene
   * exactly where it was left. `deactivate` is where a stage drops its
   * per-frame subscriptions, which is what keeps the inactive one free.
   */
  function setStage(next) {
    if (stage === next) return stage;
    stage?.deactivate?.();
    stage = next;
    stage?.activate?.();
    resize();
    return stage;
  }

  const getStage = () => stage;

  /**
   * Size from the CANVAS's own box, never window.innerWidth.
   *
   * The window is the wrong source of truth twice over: it is stale if the
   * viewport changes between module evaluation and first paint, and it is
   * simply wrong the moment the canvas is not full-bleed. Reading clientWidth
   * and passing updateStyle=false leaves layout to CSS and keeps the drawing
   * buffer following whatever size the element actually is.
   */
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    if (!stage) return;
    if (stage.camera) {
      stage.camera.aspect = w / h;
      stage.camera.updateProjectionMatrix();
    }
    stage.backdrop?.resize(w, h);
    // After the camera, so a stage that re-frames on resize sees the new aspect.
    stage.resize?.(w, h);
  }

  new ResizeObserver(resize).observe(canvas);
  resize();

  let running = false;
  function start() {
    if (running) return;
    running = true;
    // setAnimationLoop rather than requestAnimationFrame: it is what works if
    // this ever needs to run in WebXR.
    renderer.setAnimationLoop(() => {
      // getDelta spikes after the tab has been backgrounded; clamping it stops
      // every spring in the scene from exploding on the first frame back.
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsedTime();

      updaters.forEach((fn) => fn(dt, t));
      // Only the ACTIVE stage ticks. This is what makes an idle stage free:
      // everything a stage animates hangs off its own update, so a stage that
      // is not being drawn is also not being simulated.
      stage?.update?.(dt, t);

      renderer.clear();
      if (!stage) return;
      if (stage.backdrop) {
        stage.backdrop.update(dt, t);
        stage.backdrop.render(renderer);
        renderer.clearDepth();
      }
      renderer.render(stage.scene, stage.camera);
    });
  }

  function stop() {
    running = false;
    renderer.setAnimationLoop(null);
  }

  return { renderer, canvas, clock, onFrame, setStage, getStage, start, stop, resize };
}

/**
 * A private per-frame registrar, with the same signature as engine.onFrame.
 *
 * Stages hand this to anything that wants a frame callback — interaction, a
 * camera rig — instead of subscribing to the engine directly. The callbacks
 * then run only when the stage's own update() is called, which is only when it
 * is the stage on screen.
 */
export function createFrameBus() {
  const fns = new Set();
  return {
    add(fn) {
      fns.add(fn);
      return () => fns.delete(fn);
    },
    run(dt, t) {
      fns.forEach((fn) => fn(dt, t));
    },
  };
}
