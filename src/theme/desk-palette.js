/**
 * desk-palette.js — the materials of the desktop scene.
 *
 * Matte injection-moulded ABS and satin oak under one warm lamp. There is no
 * finish toggle, so these are built once and never mutated.
 *
 * One rule runs through all of it: nothing is `roughness: 0.1`. Every plastic
 * on a machine of this era was deliberately matte to hide mould flow lines, and
 * a shiny one instantly reads as a render rather than a photograph.
 */

import * as THREE from 'three';

export const COLORS = {
  /** The silver-grey of a Dimension-era front bezel. Warm, not blue. */
  silver: 0xc6c8cb,
  /** The shell around it. Dark, but well above black or it eats the light. */
  graphite: 0x34373d,
  /** Bay fronts, vents, slots — the recessed dark bits. */
  shadow: 0x141517,

  /**
   * The monitor's beige, and the yellower beige of its stand.
   *
   * Two tones on purpose. The ABS of this era used a bromine flame retardant
   * that yellows under UV, and it never yellowed evenly — different mouldings
   * came from different batches and sat in different light, so a stand is
   * routinely a shade or two further gone than the cabinet above it. Matching
   * them is the thing that makes a beige monitor look like a new beige
   * monitor, which is not what anyone remembers.
   */
  beige: 0xd6cfba,
  beigeAged: 0xcabf99,
  /** Satin oak. */
  wood: 0x6d4527,
  /** The wall. Barely lit; almost all of its value comes from the lamp. */
  wall: 0x3b3f4b,
  ledPower: 0x54ff92,
  ledDisk: 0xffb545,
};

/**
 * The SHARED materials: the plain plastics, used by more than one part and
 * never carrying a texture. Created once, never mutated.
 *
 * Anything that carries a canvas map is deliberately NOT in here — see
 * `mapped()` below.
 */
export const materials = {
  /** The silver front bezels — tower and monitor share one instance. */
  silver: new THREE.MeshPhysicalMaterial({
    color: COLORS.silver,
    roughness: 0.38,
    metalness: 0.04,
    clearcoat: 0.25,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.8,
  }),

  /** The dark shell of the tower, the monitor's back, the keyboard deck. */
  graphite: new THREE.MeshStandardMaterial({
    color: COLORS.graphite,
    roughness: 0.55,
    metalness: 0.03,
    envMapIntensity: 0.7,
  }),

  /** Anything that should read as an opening rather than a surface. */
  shadow: new THREE.MeshStandardMaterial({
    color: COLORS.shadow,
    roughness: 0.8,
    metalness: 0.0,
    envMapIntensity: 0.25,
  }),

  /** The power button cap. Slightly glossier than the bezel around it. */
  button: new THREE.MeshPhysicalMaterial({
    color: 0xd2d4d8,
    roughness: 0.3,
    metalness: 0.05,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.9,
  }),

  /**
   * The tube's cover glass.
   *
   * Weak on purpose, for the same reason the iPod's is: the key light sits
   * near the camera axis so the plastics have something to reflect, and a
   * mirror-grade glass would throw that straight back as a white rectangle
   * over the whole picture. A dark, low-opacity sheen is what a real CRT
   * looks like — and when the machine is off, this sheen is the ONLY thing
   * that distinguishes the screen from a hole.
   */
  glass: new THREE.MeshPhysicalMaterial({
    // Not black. A dead tube is a slab of tinted glass over grey phosphor, and
    // it reads distinctly green-grey in any lit room — see any photograph of
    // one switched off. Pure black reads as a hole cut in the bezel.
    color: 0x121a19,
    roughness: 0.12,
    metalness: 0.0,
    transparent: true,
    opacity: 0.30,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    reflectivity: 0.5,
    envMapIntensity: 0.65,
    depthWrite: false,
  }),

  /** The monitor cabinet. Matte ABS — nothing from this era was glossy. */
  cabinet: new THREE.MeshStandardMaterial({
    color: 0xffffff, // tinted by its map; keep white so the map is true
    roughness: 0.66,
    metalness: 0.0,
    envMapIntensity: 0.6,
  }),

  /** The stand, which has yellowed further than the cabinet. */
  cabinetAged: new THREE.MeshStandardMaterial({
    color: COLORS.beigeAged,
    roughness: 0.7,
    metalness: 0.0,
    envMapIntensity: 0.55,
  }),

  keycap: new THREE.MeshStandardMaterial({
    color: 0x3c4046,
    roughness: 0.68,
    metalness: 0.0,
    envMapIntensity: 0.6,
  }),

  /** Trim rings and the badge surround. */
  chrome: new THREE.MeshStandardMaterial({
    color: 0xb8bcc4,
    roughness: 0.3,
    metalness: 0.85,
    envMapIntensity: 1.0,
  }),
};

/**
 * A material carrying a canvas map, created FRESH each time.
 *
 * Deliberately not shared. viewer.js disposes any material it does not
 * recognise as shared, along with its map — which is exactly the behaviour a
 * one-off decal wants when you switch parts in the inspector, and exactly the
 * behaviour that would destroy a shared material's texture. Keeping every
 * mapped surface local makes that distinction safe.
 *
 * `color: white` because a map multiplies the base colour: anything else and
 * the painted values are not the values you get.
 */
export function mapped(map, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    roughness: 0.55,
    metalness: 0.0,
    envMapIntensity: 0.6,
    ...opts,
  });
}

/**
 * An LED, off.
 *
 * One material per LED rather than a shared one: they are different colours and
 * they light independently, so sharing would mean the disk light coming on
 * every time the power light did.
 */
export function ledMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color: 0x1b1d20,
    roughness: 0.25,
    metalness: 0.0,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.0,
    toneMapped: false,
  });
}

/** A translucent white overlay for hover/press feedback, as on the iPod wheel. */
export function highlightMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
}

/** The room's light and reflection colours, shared with room.js and room-env.js. */
export const ROOM = {
  /** The desk lamp, off to the left and high. */
  lamp: 0xffd9a8,
  /** A cold window on the opposite side, so the shadow side is not dead. */
  window: 0x9dc0f0,
  /** The wall in shadow. */
  ambient: 0x1a1d26,
  base: 0x0a0b10,
};
