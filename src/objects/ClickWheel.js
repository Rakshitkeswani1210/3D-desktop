/**
 * ClickWheel.js — the wheel, the select button, and the five press targets.
 *
 * Two decisions worth knowing about:
 *
 * 1. The visible wheel is ONE unbroken ring. Splitting it into four quadrant
 *    meshes would put four seams across a surface that has none on the real
 *    device. Instead the five hit targets are separate INVISIBLE meshes
 *    floating a hair above it. r160's raycaster does not test `visible`, so
 *    they intersect normally while costing nothing to draw.
 *
 * 2. The component owns its own press/hover animation. interaction.js only
 *    calls press()/setHover()/update() and never touches geometry — so how the
 *    wheel physically responds can be retuned here without going anywhere near
 *    the input code.
 */

import * as THREE from 'three';
import { WHEEL, FACE, MOUNT, u } from '../theme/spec.js';
import { materials, current } from '../theme/palette.js';
import { wheelTexture, drawWheelFace } from '../theme/textures.js';

export const meta = {
  label: 'Click Wheel',
  camera: { position: [u(12), u(WHEEL.centerY + 10), u(88)], target: [0, u(WHEEL.centerY), 0] },
};

/** The five targets. `theta` is the sector centre, measured CCW from +X. */
export const BUTTONS = [
  { id: 'menu', label: 'MENU', theta: Math.PI / 2, sound: 'button' },
  { id: 'next', label: 'Next', theta: 0, sound: 'button' },
  { id: 'playpause', label: 'Play / Pause', theta: -Math.PI / 2, sound: 'button' },
  { id: 'prev', label: 'Previous', theta: Math.PI, sound: 'button' },
  { id: 'select', label: 'Select', theta: null, sound: 'select' },
];

const ATTACK = 0.035; // seconds to fully depress
const RELEASE = 0.13; // seconds to spring back

export function create() {
  const group = new THREE.Group();
  group.name = 'click-wheel';
  group.position.y = u(WHEEL.centerY);

  const wheelZ = FACE.z + MOUNT.wheel;
  const innerR = WHEEL.centerRadius + WHEEL.gap;

  // ── the wheel face ─────────────────────────────────────────────────────
  // RingGeometry projects UVs over the bounding square of the OUTER radius, so
  // the square wheel canvas lands centred and true with no UV work.
  const face = wheelTexture(current(), WHEEL.labelRadius);
  materials.wheel.map = face.texture;
  materials.wheel.needsUpdate = true;

  const disc = new THREE.Mesh(
    new THREE.RingGeometry(u(innerR), u(WHEEL.outerRadius), 128, 1),
    materials.wheel
  );
  disc.position.z = u(wheelZ);
  disc.name = 'wheel-face';

  // The whole wheel tilts and sinks as a unit when a quadrant is pressed, so
  // the moving parts live under their own group.
  const wheelPivot = new THREE.Group();
  wheelPivot.name = 'wheel-pivot';
  wheelPivot.add(disc);
  group.add(wheelPivot);

  // Dark ring separating wheel from select button.
  const gapRing = new THREE.Mesh(
    new THREE.RingGeometry(u(WHEEL.centerRadius), u(innerR), 64, 1),
    materials.bezel
  );
  gapRing.position.z = u(FACE.z + MOUNT.gapRing);
  gapRing.name = 'gap-ring';
  wheelPivot.add(gapRing);

  // ── select button ──────────────────────────────────────────────────────
  // A lathe rather than a cylinder, so the rim has a real rounded highlight.
  // Profile runs bottom -> top so the generated normals face outward.
  const cr = WHEEL.centerRadius;
  const rr = 0.45;
  const profile = [new THREE.Vector2(u(cr), u(-1.4))];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    profile.push(
      new THREE.Vector2(u(cr - rr + Math.cos(a) * rr), u(-rr + Math.sin(a) * rr))
    );
  }
  profile.push(new THREE.Vector2(0, 0));

  const buttonGeo = new THREE.LatheGeometry(profile, 72);
  buttonGeo.rotateX(Math.PI / 2); // lathe axis Y -> Z

  const selectPivot = new THREE.Group();
  selectPivot.name = 'select-pivot';
  const selectBtn = new THREE.Mesh(buttonGeo, materials.centerButton);
  selectBtn.position.z = u(FACE.z + MOUNT.selectTop);
  selectBtn.name = 'select-button';
  selectPivot.add(selectBtn);
  group.add(selectPivot);

  // ── hit targets and highlights ─────────────────────────────────────────
  const invisible = new THREE.MeshBasicMaterial({ visible: false });
  const hitZones = [];
  const highlights = new Map();

  const highlightMat = () =>
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

  for (const b of BUTTONS) {
    let geo;
    let z;
    if (b.id === 'select') {
      geo = new THREE.CircleGeometry(u(WHEEL.centerRadius), 48);
      z = FACE.z + MOUNT.selectHit;
    } else {
      // A quarter turn centred on the sector's own direction.
      geo = new THREE.RingGeometry(
        u(innerR), u(WHEEL.outerRadius), 40, 1,
        b.theta - Math.PI / 4, Math.PI / 2
      );
      z = FACE.z + MOUNT.hit;
    }

    const hit = new THREE.Mesh(geo, invisible);
    hit.position.z = u(z);
    hit.name = `hit-${b.id}`;
    hit.userData.button = b.id;
    group.add(hit);
    hitZones.push(hit);

    const glow = new THREE.Mesh(geo.clone(), highlightMat());
    glow.position.z = u(z - 0.04);
    glow.renderOrder = 1;
    glow.name = `glow-${b.id}`;
    (b.id === 'select' ? selectPivot : wheelPivot).add(glow);
    highlights.set(b.id, glow);
  }

  // ── animation state ────────────────────────────────────────────────────
  // pressT is seconds since the press began, or null when at rest.
  const pressT = new Map(BUTTONS.map((b) => [b.id, null]));
  const hoverAmt = new Map(BUTTONS.map((b) => [b.id, 0]));
  let hovered = null;

  /** Depress envelope: fast attack, slightly slower spring back. */
  function envelope(t) {
    if (t === null) return 0;
    if (t < ATTACK) return t / ATTACK;
    const r = (t - ATTACK) / RELEASE;
    return r >= 1 ? 0 : 1 - r * r * (3 - 2 * r); // smootherstep back to rest
  }

  group.userData.wheel = {
    hitZones,
    buttons: BUTTONS,

    press(id) {
      if (pressT.has(id)) pressT.set(id, 0);
    },

    setHover(id) {
      hovered = id;
    },

    /** Angle of a world-space point around the wheel centre, in radians. */
    angleAt(worldPoint) {
      const local = group.worldToLocal(worldPoint.clone());
      return Math.atan2(local.y, local.x);
    },

    /** Distance from the wheel centre, in millimetres. */
    radiusAt(worldPoint) {
      const local = group.worldToLocal(worldPoint.clone());
      return Math.hypot(local.x, local.y) / u(1);
    },

    update(dt) {
      // Advance each press envelope; retire it once it has fully returned.
      let wheelSink = 0;
      let tiltX = 0;
      let tiltY = 0;
      let selectSink = 0;

      for (const b of BUTTONS) {
        const t = pressT.get(b.id);
        if (t !== null) {
          const nt = t + dt;
          pressT.set(b.id, nt > ATTACK + RELEASE ? null : nt);
        }
        const p = envelope(pressT.get(b.id));

        // Hover eases in and out rather than snapping.
        const target = hovered === b.id ? 1 : 0;
        const h = hoverAmt.get(b.id);
        hoverAmt.set(b.id, h + (target - h) * Math.min(1, dt * 14));

        highlights.get(b.id).material.opacity =
          hoverAmt.get(b.id) * 0.05 + p * 0.16;

        if (b.id === 'select') {
          selectSink = p * WHEEL.travel;
        } else {
          wheelSink = Math.max(wheelSink, p * WHEEL.travel);
          // Tilt so the pressed side dips: about X for top/bottom, about Y for
          // left/right. Signs come from the right-hand rule about each axis.
          tiltX += -Math.sin(b.theta) * p * WHEEL.tilt;
          tiltY += Math.cos(b.theta) * p * WHEEL.tilt;
        }
      }

      wheelPivot.position.z = u(-wheelSink);
      wheelPivot.rotation.x = tiltX;
      wheelPivot.rotation.y = tiltY;
      selectPivot.position.z = u(-selectSink);
    },
  };

  group.userData.setFinish = (colors) => {
    face.redraw((ctx, w, h) => drawWheelFace(ctx, w, h, colors, WHEEL.labelRadius));
  };

  return group;
}
