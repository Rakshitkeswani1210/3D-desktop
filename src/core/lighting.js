/**
 * lighting.js — a three-point product rig, not an outdoor sun.
 *
 * The environment map does most of the work on the metal and the gloss; these
 * lights exist to give the plastic front panel a readable gradient and to put a
 * bright line along the top edge so the silhouette separates from the backdrop.
 *
 * Built once and returned, so intensities can be retuned live from the console
 * without rebuilding anything.
 */

import * as THREE from 'three';

export function createLighting(scene) {
  // Lifts the black so unlit faces still show their form.
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x171a22, 0.9);

  // Key: high and well off the camera axis, so highlights travel ACROSS the
  // device as it turns rather than sitting dead centre.
  const key = new THREE.DirectionalLight(0xfff6e8, 2.4);
  key.position.set(-6, 9, 7);

  // Fill: cool, opposite side, deliberately weak — it opens the shadow side
  // without flattening the form.
  const fill = new THREE.DirectionalLight(0xb2ccf5, 0.7);
  fill.position.set(7, 1.5, 5);

  // Rim: behind and above, catching the top bevel. This is the light that makes
  // the device look like a photographed object rather than a render.
  const rim = new THREE.DirectionalLight(0xd8e6ff, 2.1);
  rim.position.set(2, 6, -8);

  scene.add(hemi, key, fill, rim);
  return { hemi, key, fill, rim };
}
