/**
 * Tower.js — the mini tower, and the one interactive object in the scene.
 *
 * Two things worth knowing:
 *
 * 1. The silver front bezel is not a separate part. The whole shell is ONE
 *    bevelled extrusion split into two material groups at TOWER.seamZ by
 *    groupByZ — one extrusion carrying two finishes, split at a z seam, for the
 *    reason: modelling the bezel as its own mesh leaves either a step or a
 *    hairline gap along the edge, and a material change cannot.
 *
 * 2. The power button owns its own press animation, exactly as ClickWheel.js
 *    does. The stage calls press()/setHover()/update() and never touches
 *    geometry, so how the button physically responds is retuned here without
 *    going near the input code.
 */

import * as THREE from 'three';
import { TOWER, FRONT, MOUNT, u } from '../../theme/desk-spec.js';
import { materials, mapped, ledMaterial, highlightMaterial } from '../../theme/desk-palette.js';
import {
  bayTexture, mediaSlotTexture, frontPanelTexture,
  powerCapTexture, ventTexture, badgeTexture, towerBackTexture,
} from '../../theme/desk-textures.js';
import { roundedRectShape, groupByZ } from '../../lib/shapes.js';

export const meta = {
  label: 'Tower',
  camera: { position: [u(260), u(300), u(760)], target: [0, u(TOWER.height / 2), 0] },
};

const ATTACK = 0.04; // seconds to fully depress
const RELEASE = 0.16; // seconds to spring back

export function create() {
  const group = new THREE.Group();
  group.name = 'tower';

  const faceZ = TOWER.faceZ;

  /* ── the shell ─────────────────────────────────────────────────────── */

  // ExtrudeGeometry grows the profile by bevelSize in X/Y and spans
  // depth + 2*bevelThickness in Z, so the shape is inset to land on the real
  // outside dimensions.
  const shape = roundedRectShape(
    u(TOWER.width - 2 * TOWER.bevelSize),
    u(TOWER.height - 2 * TOWER.bevelSize),
    u(TOWER.cornerRadius)
  );
  const shellGeo = new THREE.ExtrudeGeometry(shape, {
    depth: u(TOWER.depth - 2 * TOWER.bevelThickness),
    bevelEnabled: true,
    bevelThickness: u(TOWER.bevelThickness),
    bevelSize: u(TOWER.bevelSize),
    bevelSegments: 4,
    curveSegments: 16,
  });
  // Extrude runs 0..depth' in Z; centre it, then stand the tower on y = 0.
  shellGeo.translate(0, u(TOWER.height / 2), -u(TOWER.depth / 2 - TOWER.bevelThickness));
  // Back half graphite, front bezel silver. Group order is back-to-front.
  groupByZ(shellGeo, [u(TOWER.seamZ)]);

  const shell = new THREE.Mesh(shellGeo, [materials.graphite, materials.silver]);
  shell.name = 'tower-shell';
  group.add(shell);

  /* ── everything applied to the bezel ───────────────────────────────── */

  // Same rule as the iPod: there is no CSG, so nothing is cut into the shell.
  // Every feature is a decal stacked proud of the front face, and the depth
  // you read is painted into the texture.
  const decals = [];
  const applied = (widthMm, heightMm, yMm, texture, zMm, opts) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(u(widthMm), u(heightMm)),
      mapped(texture, opts)
    );
    mesh.position.set(0, u(TOWER.height / 2 + yMm), u(faceZ + zMm));
    group.add(mesh);
    decals.push(mesh);
    return mesh;
  };

  for (const bay of FRONT.bays) {
    const tex = bayTexture(bay.label);
    applied(bay.width, bay.height, bay.y, tex.texture, MOUNT.bay, {
      roughness: 0.7, envMapIntensity: 0.3,
    }).name = `bay-${bay.label}`;
  }

  applied(FRONT.slot.width, FRONT.slot.height, FRONT.slot.y,
    mediaSlotTexture().texture, MOUNT.bay, { roughness: 0.75, envMapIntensity: 0.25 })
    .name = 'media-slot';

  applied(FRONT.panel.width, FRONT.panel.height, FRONT.panel.y,
    frontPanelTexture().texture, MOUNT.decal, { roughness: 0.5 })
    .name = 'front-panel';

  applied(FRONT.vent.width, FRONT.vent.height, FRONT.vent.y,
    ventTexture().texture, MOUNT.decal, { roughness: 0.7, envMapIntensity: 0.3 })
    .name = 'front-vent';

  applied(FRONT.badge.width, FRONT.badge.height, FRONT.badge.y,
    badgeTexture().texture, MOUNT.bay, { transparent: true, roughness: 0.35, metalness: 0.3 })
    .name = 'badge';

  /* ── the back panel ────────────────────────────────────────────────── */

  // Only worth having because the desk stage's camera can be unlocked and
  // walked round the back. From the front it is never seen; from behind it
  // is the whole object.
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(
      u(TOWER.width - TOWER.bevelSize * 2),
      u(TOWER.height - TOWER.bevelSize * 2)
    ),
    mapped(towerBackTexture().texture, { roughness: 0.62, metalness: 0.35, envMapIntensity: 0.7 })
  );
  back.position.set(0, u(TOWER.height / 2), -u(TOWER.depth / 2 + MOUNT.decal));
  back.rotation.y = Math.PI;
  back.name = 'back-panel';
  group.add(back);

  /* ── the power button ──────────────────────────────────────────────── */

  const powerY = TOWER.height / 2 + FRONT.power.y;

  // The moulded ring around the cap. Chrome, so it catches the lamp and gives
  // the eye something to land on — this is the target the whole stage is about.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(u(FRONT.power.radius + 1.2), u(FRONT.power.ringRadius), 48, 1),
    materials.chrome
  );
  ring.position.set(0, u(powerY), u(faceZ + MOUNT.decal + 0.1));
  ring.name = 'power-ring';
  group.add(ring);

  // The cap itself: a short cylinder laid on its side so its end cap faces the
  // viewer and can carry the power mark. -PI/2 about X maps the cylinder's +Y
  // to +Z, which puts material group 1 (the top) forward.
  const capDepth = 3.2;
  const capGeo = new THREE.CylinderGeometry(
    u(FRONT.power.radius), u(FRONT.power.radius * 0.97), u(capDepth), 48, 1, false
  );
  capGeo.rotateX(-Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, [
    materials.button,
    mapped(powerCapTexture().texture, { roughness: 0.3, metalness: 0.05 }),
    materials.button,
  ]);
  cap.name = 'power-cap';

  // The cap travels, so it lives under its own pivot.
  const capPivot = new THREE.Group();
  capPivot.name = 'power-pivot';
  capPivot.position.set(0, u(powerY), u(faceZ + MOUNT.button + capDepth / 2));
  capPivot.add(cap);
  group.add(capPivot);

  // Press/hover feedback, as on the iPod wheel: a translucent disc over the cap.
  const highlight = new THREE.Mesh(
    new THREE.CircleGeometry(u(FRONT.power.radius), 48),
    highlightMaterial()
  );
  highlight.position.z = u(capDepth / 2 + 0.15);
  highlight.renderOrder = 3;
  capPivot.add(highlight);

  // The hit target. Bigger than the cap and invisible — r160's raycaster does
  // not test `visible`, so it intersects normally while costing nothing to draw.
  const hit = new THREE.Mesh(
    new THREE.CircleGeometry(u(FRONT.power.ringRadius * 1.15), 24),
    new THREE.MeshBasicMaterial()
  );
  hit.visible = false;
  hit.position.set(0, u(powerY), u(faceZ + MOUNT.hit));
  hit.userData.button = 'power';
  hit.name = 'power-hit';
  group.add(hit);

  /* ── the LEDs ──────────────────────────────────────────────────────── */

  const leds = new Map();
  for (const spec of FRONT.leds) {
    const mat = ledMaterial(spec.color);
    // A squashed sphere, not a disc: the tiny dome catches a specular dot that
    // is most of what makes an unlit LED read as a lens rather than a dot.
    const geo = new THREE.SphereGeometry(u(spec.radius), 16, 12);
    geo.scale(1, 1, 0.55);
    const led = new THREE.Mesh(geo, mat);
    led.position.set(u(spec.x), u(TOWER.height / 2 + spec.y), u(faceZ + MOUNT.led));
    led.name = `led-${spec.id}`;
    group.add(led);
    leds.set(spec.id, mat);
  }

  /* ── state and animation ───────────────────────────────────────────── */

  let pressT = null;
  let hovered = false;
  let on = false;
  let lit = 0; // eased power-LED brightness
  let diskT = 0;

  /** Fast attack, slower spring back — the same envelope as the iPod's wheel. */
  function envelope(t) {
    if (t === null) return 0;
    if (t < ATTACK) return t / ATTACK;
    const r = (t - ATTACK) / RELEASE;
    return r >= 1 ? 0 : 1 - r * r * (3 - 2 * r);
  }

  group.userData.power = {
    hitZones: [hit],

    /** Depress the cap and flip the machine's state. Returns the new state. */
    press() {
      pressT = 0;
      on = !on;
      return on;
    },

    setHover(id) {
      hovered = id === 'power';
    },

    isOn: () => on,

    /** Force a state without the press animation — used when a stage resets. */
    setOn(next) {
      on = next;
    },

    update(dt, t) {
      const p = envelope(pressT);
      if (pressT !== null) {
        pressT += dt;
        if (pressT > ATTACK + RELEASE) pressT = null;
      }

      capPivot.position.z = u(faceZ + MOUNT.button + capDepth / 2 - p * FRONT.power.travel);
      // Hover is faint; the press is what you should actually feel.
      const target = hovered ? 1 : 0;
      highlight.material.opacity +=
        (target * 0.07 + p * 0.22 - highlight.material.opacity) * Math.min(1, dt * 16);

      // The power LED comes up over about a third of a second, not instantly:
      // a green LED behind a diffuser has a visible rise.
      lit += ((on ? 1 : 0) - lit) * Math.min(1, dt * 7);
      leds.get('power').emissiveIntensity = lit * 2.6;

      // The disk light flickers while the machine is running. Deterministic
      // enough to look like activity, irregular enough not to look like a
      // blinking cursor.
      diskT += dt;
      const activity = on
        ? Math.max(0, Math.sin(diskT * 7.3) * Math.sin(diskT * 2.1 + 1.3) * Math.sin(diskT * 17.7))
        : 0;
      leds.get('disk').emissiveIntensity = activity * 2.2 * lit;
    },
  };

  return group;
}
