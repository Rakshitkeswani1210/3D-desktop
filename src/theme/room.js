/**
 * room.js — the backdrop behind the desk scene.
 *
 * Same contract as theme/backdrop.js (render / update / resize) and drawn the
 * same way, as a fullscreen quad in its own ortho pass before the main scene.
 * The shader is deliberately much quieter than the aurora's: the wall in this
 * scene is real geometry, so all this has to do is fill whatever sits beyond
 * it with something that agrees — a dark room falling away from one warm lamp.
 *
 * It is not a solid colour for one reason: a flat dark fill bands visibly in
 * 8-bit against the wall's gradient, and the grain below is what hides it.
 */

import * as THREE from 'three';
import { ROOM } from './desk-palette.js';

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const frag = /* glsl */ `
  precision highp float;

  uniform vec2  uResolution;
  uniform vec3  uBase;
  uniform vec3  uAmbient;
  uniform vec3  uLamp;
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    // The room falls off downward: the lamp is above, the floor is unlit.
    float height = smoothstep(-0.15, 0.85, vUv.y);
    vec3 col = mix(uBase, uAmbient, height);

    // The lamp, high and to the left, matching where desk-textures.js paints
    // its pool on the wood and where room-env.js puts its key.
    vec2 p = (vUv - vec2(0.20, 0.86)) * vec2(uResolution.x / uResolution.y, 1.0);
    float lamp = exp(-dot(p, p) * 1.7);
    col += uLamp * lamp * 0.30;

    // A very slow breath, so a static camera on a static scene is not a
    // literally frozen image.
    col *= 1.0 + sin(uTime * 0.21) * 0.012;

    float vig = smoothstep(1.35, 0.25, length(vUv - 0.5) * 1.6);
    col *= mix(0.30, 1.0, vig);

    float grain = fract(sin(dot(vUv * uResolution, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * 0.016;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createRoomBackdrop() {
  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uBase: { value: new THREE.Color(ROOM.base) },
    uAmbient: { value: new THREE.Color(ROOM.ambient) },
    uLamp: { value: new THREE.Color(ROOM.lamp) },
    uTime: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  return {
    material,
    update(dt, t) {
      uniforms.uTime.value = t;
    },
    resize(w, h) {
      uniforms.uResolution.value.set(w, h);
    },
    render(renderer) {
      renderer.render(scene, camera);
    },
  };
}
