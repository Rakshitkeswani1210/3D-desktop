/**
 * stages/ipod.js — the iPod scene, as a stage.
 *
 * This is everything main.js used to do, moved behind the stage contract so
 * the page can hold a second, unrelated scene alongside it. Nothing about the
 * scene itself changed: same camera, same lens, same near plane, same rig,
 * same interaction. If this stage renders differently from the way the page
 * used to, that is a bug.
 *
 * The one structural difference is the frame bus. Interaction is handed the
 * stage's own registrar rather than the engine's, so when this stage is not on
 * screen its wheel springs and idle turntable stop being simulated at all.
 */

import * as THREE from 'three';
import { createFrameBus } from '../core/engine.js';
import { createEnvironment } from '../core/environment.js';
import { createLighting } from '../core/lighting.js';
import { createInteraction } from '../core/interaction.js';
import { createBackdrop } from '../theme/backdrop.js';
import { applyFinish, finishIds, FINISHES } from '../theme/palette.js';
import { FRAMING } from '../theme/spec.js';
import * as IPod from '../objects/IPod.js';
import * as audio from '../core/audio.js';

export const meta = {
  id: 'ipod',
  label: 'iPod',
  title: 'iPod classic — 3D',
  hud: 'hud-ipod',
};

export function createIpodStage({ renderer }) {
  const scene = new THREE.Scene();
  scene.background = null; // the backdrop pass paints the background

  const camera = new THREE.PerspectiveCamera(
    32, // a longish lens: product shots flatten perspective distortion
    1, // corrected by the engine's first resize
    // near is deliberately far out. Front-mounted parts are stacked 0.05 mm
    // apart (theme/spec.js MOUNT), and a 0.1 near plane spreads the depth
    // buffer so thinly at 20+ units that those layers z-fight. Orbit distance
    // is clamped to 15 units minimum, so nothing ever comes closer than ~9.
    3,
    120
  );
  camera.position.set(...FRAMING.position);
  camera.lookAt(...FRAMING.target);

  const backdrop = createBackdrop();
  createEnvironment(renderer, scene);
  createLighting(scene);

  const device = IPod.create();
  scene.add(device);

  const frame = createFrameBus();
  const interaction = createInteraction({
    renderer, camera, device, onFrame: frame.add,
  });

  /* ───────────────────────────── HUD ───────────────────────────── */

  const readout = document.getElementById('readout');
  let clearTimer = null;
  interaction.on('press', (id) => {
    const label = device.userData.wheel.buttons.find((b) => b.id === id)?.label ?? id;
    readout.textContent = label;
    readout.classList.add('on');
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => readout.classList.remove('on'), 1100);
  });

  // Finish toggle.
  const finishBtn = document.getElementById('finish');
  let finishIndex = 0;
  const order = finishIds();
  finishBtn.textContent = FINISHES[order[finishIndex]].label;
  finishBtn.addEventListener('click', () => {
    finishIndex = (finishIndex + 1) % order.length;
    finishBtn.textContent = applyFinish(order[finishIndex]).label;
  });

  // Sound toggle. Shared with the desk scene — one audio bus, one switch.
  const soundBtn = document.getElementById('sound');
  soundBtn.addEventListener('click', () => {
    const on = !audio.isEnabled();
    audio.setEnabled(on);
    soundBtn.textContent = on ? 'Sound on' : 'Sound off';
    soundBtn.classList.toggle('off', !on);
  });

  return {
    ...meta,
    scene,
    camera,
    backdrop,
    device,
    interaction,
    // Both stages expose `screen` with the same shape, so a UI written against
    // one works against the other. See the README.
    screen: device.userData.screen,

    activate() {
      interaction.setEnabled(true);
    },

    deactivate() {
      interaction.setEnabled(false);
      // Leave the readout behind; it belongs to this stage's HUD.
      readout.classList.remove('on');
    },

    update(dt, t) {
      frame.run(dt, t);
    },
  };
}
