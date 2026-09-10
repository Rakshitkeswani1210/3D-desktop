/**
 * backdrop.js — the animated aurora behind the device.
 *
 * This is a fullscreen quad in its own orthographic scene, drawn before the
 * main scene. Deliberately NOT a sky sphere: a sphere rotates with the camera,
 * which makes it read as a room you are standing inside. A separate ortho pass
 * stays perfectly still while you orbit, so it reads as a backdrop effect and
 * the device is unambiguously the only object in the scene.
 *
 * The colours come from palette.AURORA, the same values that tint the
 * reflection map, so what slides across the polished steel matches what is
 * actually behind it.
 */

import * as THREE from 'three';
import { AURORA } from './palette.js';

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const frag = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec3  uBase;
  uniform vec3  uC1;
  uniform vec3  uC2;
  uniform vec3  uC3;

  varying vec2 vUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  // Simplex-style gradient noise.
  float noise(vec2 p) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;
    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    float m = step(a.y, a.x);
    vec2 o = vec2(m, 1.0 - m);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;
    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3 n = h * h * h * h * vec3(
      dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0))
    );
    return dot(n, vec3(70.0));
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Aspect-corrected so the fields never stretch on a wide window.
    vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    float t = uTime * 0.045;

    // Two rounds of domain warping. This is what turns plain fbm into the
    // folded, curtain-like shapes that read as an aurora rather than clouds.
    vec2 q = vec2(
      fbm(p * 1.35 + t),
      fbm(p * 1.35 + vec2(3.2, 1.7) - t)
    );
    vec2 r = vec2(
      fbm(p * 1.9 + 1.6 * q + vec2(1.7, 9.2) + t * 1.25),
      fbm(p * 1.9 + 1.6 * q + vec2(8.3, 2.8) - t * 1.05)
    );

    float f = fbm(p * 1.6 + 2.0 * r);
    float g = fbm(p * 2.3 - 1.4 * r + 4.0);
    float band = clamp(length(r), 0.0, 1.0);

    vec3 col = uBase;
    col = mix(col, uC1, clamp(f * 0.55 + 0.5, 0.0, 1.0));
    col = mix(col, uC2, clamp(g * 0.6 + 0.4, 0.0, 1.0) * 0.62);
    col = mix(col, uC3, pow(band, 2.0) * 0.55);

    // Lift the very brightest folds so the curtains have a visible edge.
    col += uC3 * pow(clamp(f, 0.0, 1.0), 6.0) * 0.5;

    // Vignette, so the device always sits on the brighter middle.
    float vig = smoothstep(1.3, 0.2, length(vUv - 0.5) * 1.65);
    col *= mix(0.18, 1.0, vig);

    // A touch of grain. Large smooth gradients band badly in 8-bit otherwise.
    float grain = fract(sin(dot(vUv * uResolution, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * 0.014;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Build the backdrop pass.
 * @returns {{ render(renderer): void, update(dt, t): void, resize(w,h): void, material: THREE.ShaderMaterial }}
 */
export function createBackdrop() {
  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uBase: { value: new THREE.Color(AURORA.base) },
    uC1: { value: new THREE.Color(AURORA.c1) },
    uC2: { value: new THREE.Color(AURORA.c2) },
    uC3: { value: new THREE.Color(AURORA.c3) },
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
  // A single full-viewport triangle-pair; the vertex shader ignores the camera
  // and writes clip space directly, so the geometry is just a unit quad.
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
