/**
 * Monitor.js — the CRT: pedestal, cabinet, funnel bezel, glass and picture.
 *
 * A real 17-inch tube of this era measured about 410 x 400 x 420 mm. The depth
 * is not incidental — the gun needs that distance to sweep a 90-degree
 * deflection across the faceplate — and it is the whole reason these things
 * looked the way they did. Build it shallow and you get a flat panel wearing a
 * thick frame, which is what most recreations are.
 *
 * The cabinet is four pieces, front to back:
 *
 *   face    the flat front plate, with the window cut through it
 *   funnel  a tapered frame: the opening is WIDER at the front and narrows
 *           toward the glass, so a lit room lays a bright angled band around
 *           all four inner edges. This is the detail that says "CRT" louder
 *           than the bulk does.
 *   shell   the cabinet flaring back, curved so it stays fat and then falls
 *           away, the way the glass funnel behind it actually does
 *   neck    the yoke bulge at the very back
 *
 * The window is a genuine hole through `face` and `funnel` — `THREE.Shape`
 * carries a `holes` array and `ExtrudeGeometry` honours it, which
 * `roundedFrameShape` wraps up. That is a departure from the iPod's
 * mount-everything-proud rule, and the right one: the iPod's shell is solid
 * with nothing to cut into, whereas a bezel IS a frame.
 *
 * The picture exposes the same handle as the iPod's screen, so the UI designed
 * later plugs straight in with no change to the model:
 *
 *     monitor.userData.screen.redraw((ctx, w, h) => { ... })
 */

import * as THREE from 'three';
import { MONITOR, PICTURE, MOUNT, u } from '../../theme/desk-spec.js';
import { materials, mapped, ledMaterial } from '../../theme/desk-palette.js';
import {
  crtTexture, badgeTexture, cabinetTexture, louvreTexture, monitorBackTexture,
} from '../../theme/desk-textures.js';
import {
  roundedRectShape, roundedFrameShape, taperGeometry, bulgedPlane, roundedBox,
} from '../../lib/shapes.js';

export const meta = {
  label: 'Monitor',
  camera: { position: [u(520), u(430), u(680)], target: [0, u(MONITOR.screenY), 0] },
};

export function create() {
  const group = new THREE.Group();
  group.name = 'monitor';

  // The cabinet's beige, with its yellowing and scuffs painted in. Shared by
  // every cabinet piece so the wear runs continuously across the seams.
  const skin = cabinetTexture(u(MONITOR.bezelWidth), u(MONITOR.bezelHeight));
  const cabinet = materials.cabinet.clone();
  cabinet.map = skin.texture;

  /* ── the pedestal ──────────────────────────────────────────────────── */

  // roundedBox rounds the profile it extrudes, so build it lying down and tip
  // it upright: the rounded corners then belong to the plan view, which is
  // where a monitor foot actually has them.
  const footGeo = roundedBox(
    u(MONITOR.standWidth), u(MONITOR.standDepth), u(MONITOR.standHeight),
    u(MONITOR.standRadius), u(4)
  );
  footGeo.rotateX(-Math.PI / 2);
  footGeo.translate(0, u(MONITOR.standHeight / 2), u(MONITOR.standZ));
  // Narrower at the bottom, so it reads as a moulded foot rather than a block.
  taperGeometry(footGeo, {
    axis: 'y', from: 0, to: u(MONITOR.standHeight), scaleFrom: 0.9, scaleTo: 1,
  });
  const foot = new THREE.Mesh(footGeo, materials.cabinetAged);
  foot.name = 'stand';
  group.add(foot);

  // The dome the cabinet swivels on. A squashed sphere rather than a cylinder:
  // a tilt-and-swivel base is a ball joint, and the curve is visible under the
  // front lip of the cabinet from any seated angle.
  const domeGeo = new THREE.SphereGeometry(u(MONITOR.pivotRadius), 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  domeGeo.scale(1, 0.42, 1);
  const dome = new THREE.Mesh(domeGeo, materials.cabinetAged);
  dome.position.set(0, u(MONITOR.standHeight - 6), u(MONITOR.standZ));
  dome.name = 'swivel';
  group.add(dome);

  /* ── the cabinet ───────────────────────────────────────────────────── */

  // Everything below is in TUBE-LOCAL Z, with z = 0 at the front plate and the
  // machine running backwards from there.
  const tube = new THREE.Group();
  tube.name = 'tube';
  tube.position.y = u(MONITOR.screenY);
  group.add(tube);

  const openW = MONITOR.windowWidth * MONITOR.openScale;
  const openH = MONITOR.windowHeight * MONITOR.openScale;
  const offsetY = u(MONITOR.windowOffsetY);
  const funnelBackZ = -(MONITOR.faceDepth + MONITOR.funnelDepth);

  /** A frame from the bezel outline with a window through it. */
  const frame = (depth, holeW, holeH) =>
    new THREE.ExtrudeGeometry(
      roundedFrameShape(
        u(MONITOR.bezelWidth), u(MONITOR.bezelHeight), u(MONITOR.bezelRadius),
        u(holeW), u(holeH), u(MONITOR.windowRadius),
        32, [0, offsetY]
      ),
      { depth: u(depth), bevelEnabled: false, curveSegments: 18 }
    );

  // The front plate. A small bevel on the outer corners only would be ideal;
  // ExtrudeGeometry bevels the hole too, which rounds off the crisp inner edge
  // the funnel needs to start from — so this is left square and the softness
  // comes from the funnel behind it.
  const faceGeo = frame(MONITOR.faceDepth, openW, openH);
  faceGeo.translate(0, 0, -u(MONITOR.faceDepth));
  const face = new THREE.Mesh(faceGeo, cabinet);
  face.name = 'bezel-face';
  tube.add(face);

  // The funnel. Tapering the whole frame narrows the opening AND the outer
  // wall together — which is correct, because the cabinet is narrowing here
  // too. The visible result is the angled band around the window.
  const funnelGeo = frame(MONITOR.funnelDepth, openW, openH);
  funnelGeo.translate(0, 0, u(funnelBackZ));
  taperGeometry(funnelGeo, {
    from: -u(MONITOR.faceDepth),
    to: u(funnelBackZ),
    scaleFrom: 1,
    scaleTo: MONITOR.funnelTaper,
  });
  const funnel = new THREE.Mesh(funnelGeo, cabinet);
  funnel.name = 'bezel-funnel';
  tube.add(funnel);

  // The shell: the same profile extruded backwards, then squeezed toward the
  // neck. ExtrudeGeometry cannot taper and a lathe cannot do a rounded
  // rectangle, so taperGeometry does it after the fact.
  const shellGeo = new THREE.ExtrudeGeometry(
    roundedRectShape(
      u(MONITOR.bezelWidth * MONITOR.funnelTaper),
      u(MONITOR.bezelHeight * MONITOR.funnelTaper),
      u(MONITOR.bezelRadius)
    ),
    { depth: u(MONITOR.shellDepth), bevelEnabled: false, curveSegments: 18 }
  );
  shellGeo.translate(0, offsetY, u(funnelBackZ - MONITOR.shellDepth));
  taperGeometry(shellGeo, {
    from: u(funnelBackZ),
    to: u(funnelBackZ - MONITOR.shellDepth),
    scaleFrom: 1,
    scaleTo: MONITOR.shellTaper,
    // Real tubes stay wide for a while and then fall away, rather than
    // narrowing evenly from the front.
    curve: (t) => Math.pow(t, 1.55),
  });
  const shell = new THREE.Mesh(shellGeo, cabinet);
  shell.name = 'back-shell';
  tube.add(shell);

  // The yoke bulge. Mostly hidden, but it breaks the flat back panel that
  // otherwise gives the silhouette away from a three-quarter view.
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(
      u(MONITOR.neckRadius * 0.72), u(MONITOR.neckRadius), u(MONITOR.neckDepth), 24
    ),
    cabinet
  );
  neck.rotation.x = Math.PI / 2;
  neck.position.set(0, offsetY, u(funnelBackZ - MONITOR.shellDepth - MONITOR.neckDepth / 2));
  neck.name = 'neck';
  tube.add(neck);

  // Vents on the rear face, around the neck. Same reason as the tower's back
  // panel: the camera can be unlocked, and the back of the cabinet stopped
  // being a surface nobody looks at.
  const backFace = MONITOR.bezelWidth * MONITOR.funnelTaper * MONITOR.shellTaper;
  const backVents = new THREE.Mesh(
    new THREE.PlaneGeometry(u(backFace * 0.92), u(backFace * 0.92)),
    mapped(monitorBackTexture().texture, {
      transparent: true, roughness: 0.75, envMapIntensity: 0.25,
    })
  );
  backVents.position.set(
    0, offsetY, u(funnelBackZ - MONITOR.shellDepth - MOUNT.decal)
  );
  backVents.rotation.y = Math.PI;
  backVents.name = 'back-vents';
  tube.add(backVents);

  /* ── side vents ────────────────────────────────────────────────────── */

  // The louvres sit on the flaring side wall, so they have to be rotated to
  // lie flat against it. The angle comes from the taper rather than a
  // hand-tuned number, so changing the shell's shape keeps them attached.
  const { vent } = MONITOR;
  const tAt = (z) => Math.pow(Math.min(1, Math.max(0, (funnelBackZ - z) / MONITOR.shellDepth)), 1.55);
  const halfAt = (z) => (MONITOR.bezelWidth * MONITOR.funnelTaper / 2) *
    (1 + (MONITOR.shellTaper - 1) * tAt(z));
  const dz = 30;
  const wallAngle = Math.atan2(halfAt(vent.z + dz) - halfAt(vent.z - dz), dz * 2);

  for (const side of [-1, 1]) {
    const louvre = new THREE.Mesh(
      new THREE.PlaneGeometry(u(vent.width), u(vent.height)),
      mapped(louvreTexture().texture, {
        transparent: true, roughness: 0.75, envMapIntensity: 0.3,
      })
    );
    louvre.position.set(
      side * u(halfAt(vent.z) + MOUNT.decal),
      u(vent.y) + offsetY,
      u(vent.z)
    );
    louvre.rotation.y = side * (Math.PI / 2 - wallAngle);
    louvre.name = `vent-${side < 0 ? 'left' : 'right'}`;
    tube.add(louvre);
  }

  /* ── the picture ───────────────────────────────────────────────────── */

  const screen = crtTexture();

  /**
   * The raster is 4:3 because the deflection circuit says so — not because the
   * bezel cutout happens to be.
   *
   * The window is a free dimension you can drag to any proportion; the picture
   * canvas is fixed. Stretching one onto the other means every circle drawn on
   * that canvas becomes an ellipse, and a UI drawn later would be subtly wrong
   * everywhere with no single thing to point at. So the raster keeps its own
   * aspect and is fitted INSIDE the opening — which is also what a real
   * monitor does: an unscanned strip of tube is simply dark.
   */
  const rasterOpenW = MONITOR.windowWidth - MONITOR.pictureInset * 2;
  const rasterOpenH = MONITOR.windowHeight - MONITOR.pictureInset * 2;
  const aspect = PICTURE.width / PICTURE.height;
  const rasterW = Math.min(rasterOpenW, rasterOpenH * aspect);
  const rasterH = rasterW / aspect;

  const glassZ = u(MONITOR.glassZ);

  // The unscanned tube behind the raster, so any strip the picture does not
  // cover reads as dark glass rather than a hole through to the shell.
  //
  // Deliberately FLAT. Bulging it to match looked more correct and was wrong:
  // two bulged planes of different widths have different curves, so the wider
  // one rises in front of the narrower one near its edges and the dark face
  // punches crescents into the picture. A flat plane a millimetre back sits
  // behind the raster everywhere, because a bulge only moves a vertex forward
  // and both meet the bezel at zero.
  const tubeFace = new THREE.Mesh(
    new THREE.PlaneGeometry(u(rasterOpenW), u(rasterOpenH)),
    new THREE.MeshBasicMaterial({ color: 0x05070a, toneMapped: false })
  );
  tubeFace.position.set(0, offsetY, glassZ - u(1));
  tubeFace.name = 'tube-face';
  tube.add(tubeFace);

  // MeshBasicMaterial, not Standard: a phosphor is emissive, so it must not be
  // lit by the scene. toneMapped off keeps a white raster from being crushed
  // by the ACES curve into a flat grey.
  const picture = new THREE.Mesh(
    bulgedPlane(u(rasterW), u(rasterH), u(MONITOR.bulge)),
    new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false })
  );
  picture.position.set(0, offsetY, glassZ);
  picture.name = 'picture';
  tube.add(picture);

  // Cover glass: the same swell, a hair proud. Sized to the WINDOW rather than
  // the raster — it is the physical tube face and covers the dark strips too.
  const glassMat = materials.glass.clone();
  const glass = new THREE.Mesh(
    bulgedPlane(
      u(MONITOR.windowWidth - MONITOR.pictureInset),
      u(MONITOR.windowHeight - MONITOR.pictureInset),
      u(MONITOR.bulge)
    ),
    glassMat
  );
  glass.position.set(0, offsetY, glassZ + u(1.6));
  glass.renderOrder = 2;
  glass.name = 'glass';
  tube.add(glass);

  /**
   * The light the screen throws back into the room.
   *
   * Without it a lit CRT is a bright rectangle in an unchanged scene, which
   * reads as a texture rather than a light source. The distance is short and
   * the decay physical, so it lifts the bezel and the desk in front of the
   * monitor and reaches nothing else.
   */
  const glow = new THREE.PointLight(0xdce8ff, 0, u(900), 2);
  glow.position.set(0, offsetY, u(190));
  tube.add(glow);

  /* ── the control shelf ─────────────────────────────────────────────── */

  // Real buttons rather than a painted strip. They are two millimetres of
  // geometry that catch the lamp and throw a shadow, and at the distance the
  // camera actually gets to they are the difference between a moulded front
  // panel and a decal.
  const shelfY = offsetY - u(MONITOR.windowHeight / 2 + 44);
  const btnGeo = roundedBox(u(17), u(9), u(4), u(2), u(0.6), { curveSegments: 2, bevelSegments: 1 });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(btnGeo, materials.cabinetAged);
    b.position.set(u(-96 + i * 23), shelfY, u(MOUNT.button));
    b.name = `osd-${i}`;
    tube.add(b);
  }

  // The power switch: bigger, round, off to the right, exactly where every one
  // of these put it.
  const powerGeo = new THREE.CylinderGeometry(u(13), u(13), u(5), 32);
  powerGeo.rotateX(-Math.PI / 2);
  const powerBtn = new THREE.Mesh(powerGeo, materials.cabinetAged);
  powerBtn.position.set(u(126), shelfY, u(MOUNT.button));
  powerBtn.name = 'monitor-power';
  tube.add(powerBtn);

  const ledMat = ledMaterial(0x6dff9e);
  const ledGeo = new THREE.SphereGeometry(u(3.6), 16, 12);
  ledGeo.scale(1, 1, 0.55);
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(u(92), shelfY, u(MOUNT.led));
  led.name = 'monitor-led';
  tube.add(led);

  // The badge, lower LEFT — where these always sat, never centred.
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(u(94), u(24)),
    mapped(badgeTexture('TRINITEK').texture, {
      transparent: true, roughness: 0.4, metalness: 0.2,
    })
  );
  badge.position.set(u(-118), shelfY - u(26), u(MOUNT.decal));
  badge.name = 'monitor-badge';
  tube.add(badge);

  /* ── the handle the stage and the future UI both use ───────────────── */

  let lamp = 0;

  group.userData.screen = {
    canvas: screen.canvas,
    ctx: screen.ctx,
    texture: screen.texture,
    /** redraw(fn) where fn is (ctx, width, height) => void */
    redraw: screen.redraw,
    width: screen.canvas.width,
    height: screen.canvas.height,
    /** The mesh to frame the camera on. */
    mesh: picture,
  };

  /** How reflective the cover glass is, dead versus fully lit. */
  const GLASS_OFF = 0.34;
  const GLASS_ON = 0.05;

  group.userData.monitor = {
    /** 0 = dead tube, 1 = fully lit. Drives the LED, the glass and the glow. */
    setLamp(v) {
      lamp = v;
      ledMat.emissiveIntensity = v * 2.4;
      glow.intensity = v * u(900) * 0.8;
      glassMat.opacity = GLASS_OFF + (GLASS_ON - GLASS_OFF) * v;
    },
    getLamp: () => lamp,
  };
  group.userData.monitor.setLamp(0);

  return group;
}
