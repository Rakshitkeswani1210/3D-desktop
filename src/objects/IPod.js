/**
 * IPod.js — composes the four parts into the finished device.
 *
 * Assembles and nothing more: it decides that a screen and a wheel are mounted
 * on a body, and forwards the handles the rest of the app needs. Every actual
 * dimension lives in theme/spec.js, and each part knows only how to build
 * itself.
 */

import * as THREE from 'three';
import * as Body from './Body.js';
import * as Screen from './Screen.js';
import * as ClickWheel from './ClickWheel.js';
import * as Ports from './Ports.js';
import { current, onFinishChange } from '../theme/palette.js';
import { FRAMING } from '../theme/spec.js';

export const meta = {
  label: 'iPod',
  camera: { position: FRAMING.position, target: FRAMING.target },
};

export function create() {
  const group = new THREE.Group();
  group.name = 'ipod';

  const parts = [Body.create(), Screen.create(), ClickWheel.create(), Ports.create()];
  parts.forEach((p) => group.add(p));

  // Forward the two handles the rest of the app cares about.
  const wheel = parts.find((p) => p.userData.wheel);
  const screen = parts.find((p) => p.userData.screen);
  group.userData.wheel = wheel.userData.wheel;
  group.userData.screen = screen.userData.screen;

  // Repaint any part that draws its own canvas when the colourway changes.
  // Materials themselves are mutated in palette.applyFinish, so nothing here
  // needs to touch them.
  const repaint = (colors) =>
    parts.forEach((p) => p.userData.setFinish?.(colors));
  group.userData.unsubscribeFinish = onFinishChange(repaint);
  repaint(current());

  return group;
}
