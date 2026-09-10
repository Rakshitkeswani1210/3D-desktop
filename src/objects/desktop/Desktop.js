/**
 * Desktop.js — composes the desk, the monitor, the tower and the keyboard.
 *
 * Assembles and nothing more, in the same spirit as objects/IPod.js: it decides
 * where things stand and forwards the handles the stage needs. Every actual
 * dimension and position lives in theme/desk-spec.js, and each part knows only
 * how to build itself standing at the origin on y = 0.
 */

import * as THREE from 'three';
import * as Desk from './Desk.js';
import * as Monitor from './Monitor.js';
import * as Tower from './Tower.js';
import * as Keyboard from './Keyboard.js';
import { MONITOR, TOWER, KEYBOARD, FRAMING, u } from '../../theme/desk-spec.js';

export const meta = {
  label: 'Desktop',
  camera: {
    position: FRAMING.position.map(u),
    target: FRAMING.target.map(u),
  },
};

export function create() {
  const group = new THREE.Group();
  group.name = 'desktop';

  const desk = Desk.create();
  group.add(desk);

  // Each part is built standing at the origin on the desk surface, so placing
  // it is two lines and reads directly against the spec.
  const monitor = Monitor.create();
  monitor.position.set(u(MONITOR.x), 0, u(MONITOR.z));
  monitor.rotation.y = MONITOR.yaw;
  monitor.rotation.x = MONITOR.tilt;
  group.add(monitor);

  const tower = Tower.create();
  tower.position.set(u(TOWER.x), 0, u(TOWER.z));
  tower.rotation.y = TOWER.yaw;
  group.add(tower);

  const keyboard = Keyboard.create();
  keyboard.position.set(u(KEYBOARD.x), 0, u(KEYBOARD.z));
  keyboard.rotation.y = KEYBOARD.yaw;
  group.add(keyboard);

  // Forward the handles the stage cares about. Note `screen` uses the same
  // shape as the iPod's, so a UI written against one works against the other.
  group.userData.screen = monitor.userData.screen;
  group.userData.monitor = monitor.userData.monitor;
  group.userData.keyboard = keyboard.userData.keyboard;
  group.userData.power = tower.userData.power;
  group.userData.parts = { desk, monitor, tower, keyboard };

  return group;
}
