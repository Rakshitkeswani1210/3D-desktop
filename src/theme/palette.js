/**
 * palette.js — the two colourways, and the one set of materials the whole
 * device shares.
 *
 * Materials are created once and never replaced. Switching finish MUTATES the
 * existing material instances rather than swapping in new ones, which means no
 * mesh ever needs re-assigning, nothing leaks, and the toggle is instant.
 *
 * Anything that has to redraw a canvas texture when the finish changes (the
 * wheel labels, the etched back) subscribes with onFinishChange().
 */

import * as THREE from 'three';

export const FINISHES = {
  black: {
    label: 'Black',
    // Lifted well above "true black". A #1a1a1d base reflects ~10% of the
    // light that hits it, so under any honest lighting it renders as a
    // silhouette with no readable detail. Real black anodised plastic photographs
    // considerably lighter than it looks in the hand.
    frontPanel: 0x2b2b30,
    frontRoughness: 0.18,
    wheel: 0x3a3a41,
    wheelRoughness: 0.44,
    centerButton: 0x313136,
    labelInk: 0xc4c4cc,
    bezel: 0x0d0d10,
    steel: 0xdadce2,
    etchInk: 0x8d9099,
  },
  silver: {
    label: 'Silver',
    frontPanel: 0xf2f3f6,
    frontRoughness: 0.2,
    wheel: 0xe8e9ed,
    wheelRoughness: 0.46,
    centerButton: 0xdcdde2,
    labelInk: 0x7d7e85,
    bezel: 0x0f0f12,
    steel: 0xdadce2,
    etchInk: 0x8d9099,
  },
};

export const finishIds = () => Object.keys(FINISHES);

let currentId = 'black';
export const current = () => FINISHES[currentId];
export const currentId_ = () => currentId;

/**
 * The shared material set. Created once, mutated by applyFinish().
 *
 * The steel is the important one: metalness 1 with near-zero roughness means it
 * renders almost entirely from scene.environment. Without the env map built in
 * core/environment.js it is a flat black slab, not a mirror.
 */
export const materials = {
  frontPanel: new THREE.MeshPhysicalMaterial({
    color: FINISHES.black.frontPanel,
    roughness: 0.16,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    reflectivity: 0.6,
    envMapIntensity: 1.5,
  }),

  steel: new THREE.MeshStandardMaterial({
    color: FINISHES.black.steel,
    roughness: 0.075,
    metalness: 1.0,
    envMapIntensity: 1.4,
  }),

  wheel: new THREE.MeshStandardMaterial({
    color: 0xffffff, // tinted by its canvas map; keep white so the map is true
    roughness: 0.42,
    metalness: 0.02,
    envMapIntensity: 1.5,
  }),

  centerButton: new THREE.MeshPhysicalMaterial({
    color: FINISHES.black.centerButton,
    roughness: 0.34,
    metalness: 0.02,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1.5,
  }),

  bezel: new THREE.MeshStandardMaterial({
    color: FINISHES.black.bezel,
    roughness: 0.5,
    metalness: 0.0,
  }),

  /**
   * The cover glass.
   *
   * Kept deliberately weak. The key softbox sits directly behind the camera so
   * that the flat front panel has something to reflect, which means a mirror-
   * grade glass reflects that same softbox straight back — a blown-out white
   * rectangle covering the entire screen. A low opacity and a slightly rougher
   * finish turn that into the broad sheen a real screen has.
   */
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.10,
    metalness: 0.0,
    transparent: true,
    opacity: 0.07,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.45,
    envMapIntensity: 0.7,
    depthWrite: false,
  }),

  /** Dock connector contacts. */
  contact: new THREE.MeshStandardMaterial({
    color: 0xb9a06a,
    roughness: 0.35,
    metalness: 1.0,
  }),
};

const subscribers = new Set();

/** Run fn(colors) whenever the finish changes. Returns an unsubscribe. */
export function onFinishChange(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Switch colourway. Mutates the shared materials, then notifies redraws. */
export function applyFinish(id) {
  if (!FINISHES[id]) throw new Error(`Unknown finish: ${id}`);
  currentId = id;
  const c = FINISHES[id];

  materials.frontPanel.color.setHex(c.frontPanel);
  materials.frontPanel.roughness = c.frontRoughness;
  materials.steel.color.setHex(c.steel);
  materials.centerButton.color.setHex(c.centerButton);
  materials.bezel.color.setHex(c.bezel);
  materials.wheel.roughness = c.wheelRoughness;

  subscribers.forEach((fn) => fn(c));
  return c;
}

/** Backdrop / environment colours. Shared so reflections match the aurora. */
export const AURORA = {
  base: 0x04050b,
  c1: 0x123a6e,
  c2: 0x7a2ec4,
  c3: 0x12a58c,
};
