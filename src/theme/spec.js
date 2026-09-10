/**
 * spec.js — every dimension of the device, in real millimetres.
 *
 * Nothing else in the project hard-codes a size. The model, the hit zones, the
 * cameras and the viewer all read from here, so "the wheel is 5% too big" is
 * one number rather than a hunt through five files.
 *
 * Units: the numbers below are millimetres. Scene units are centimetres
 * (U = 0.1), so the finished device is ~6.2 x 10.4 x 1.05 units. Modelling in
 * raw metres would put a 1 mm bevel at the edge of the depth buffer's useful
 * precision; centimetres keep near/far comfortable while the source numbers
 * stay readable as real measurements.
 *
 * Axis convention, written down once because everything depends on it:
 *   +X right, +Y up, +Z out of the FRONT face (screen and wheel face +Z).
 * The device is centred on the origin, so y = 0 is halfway up the body.
 */

/** Millimetres -> scene units. */
export const U = 0.1;

/** Convert a millimetre measurement to scene units. */
export const u = (mm) => mm * U;

/**
 * The shell. Taken from the reference dimensions of an iPod classic.
 *
 * It is ONE extrusion, not two halves. ExtrudeGeometry bevels both ends, which
 * gives exactly the symmetric pillowed edge you see in the side view, and
 * because it is a single continuous surface there is no step or gap anywhere
 * along the rim.
 *
 * The black front panel and the steel back are then two material GROUPS on that
 * one geometry, split at seamZ. That is why the seam is a perfectly clean line:
 * it is a material change, not a join between two objects.
 */
export const BODY = {
  width: 61.8,
  height: 103.5,
  depth: 10.5,
  cornerRadius: 6.5,

  // ExtrudeGeometry spans (depth + 2*bevelThickness) in Z and grows the shape
  // by bevelSize in X/Y, so the shape is inset by bevelSize to land on the
  // outer dimensions above.
  bevelThickness: 2.0, // along Z
  bevelSize: 1.5, // in X/Y
  bevelSegments: 14,
  curveSegments: 48,

  /**
   * Where the front panel gives way to the steel, in Z. Sitting inside the
   * front bevel (rather than on the flat cap) means the panel wraps slightly
   * over the edge, the way the real one does.
   */
  seamZ: 4.35,
};

/** The flat front cap: the plane the screen and wheel actually sit on. */
export const FACE = {
  z: BODY.depth / 2, // +5.25
  width: BODY.width - 2 * BODY.bevelSize, // 58.8
  height: BODY.height - 2 * BODY.bevelSize, // 100.5
};

export const BACK_Z = -BODY.depth / 2;

/**
 * How far each front-mounted feature sits PROUD of the flat cap, in mm.
 *
 * This is the one non-obvious rule in the whole model. The shell is a single
 * solid extrusion and there is no CSG here, so there is no hole for anything to
 * sit inside: any surface at or below FACE.z is simply buried in the body and
 * never drawn. Everything mounted on the front therefore stacks upward from
 * FACE.z in fractions of a millimetre — far too small to read as raised, but
 * enough to win the depth test.
 *
 * The recessed look of the click wheel is baked into its texture instead (see
 * drawWheelFace), which is cheaper and more controllable than real geometry.
 *
 * Two constraints tie these together: WHEEL.travel + the tilt of the outer edge
 * must stay under WHEEL mount, or a pressed wheel sinks into the body and
 * vanishes; and the camera near plane must be far enough out that a 0.05 mm
 * separation still resolves in the depth buffer (see core/engine.js).
 */
export const MOUNT = {
  surround: 0.05,
  panel: 0.09,
  glass: 0.16,
  gapRing: 0.46,
  wheel: 0.50,
  /** Top of the select button, above FACE.z. */
  selectTop: 0.82,
  /** Hit targets and highlights, clear of everything they sit over. */
  hit: 1.0,
  selectHit: 1.3,
};

/**
 * The screen. A 2.5" 4:3 LCD (50.8 x 38.1 mm active); the black window around
 * it is a little larger, and the cover glass is flush with the front face —
 * the iPod classic front is one flat plane, with no recessed screen well.
 */
export const SCREEN = {
  activeWidth: 50.8,
  activeHeight: 38.1,
  windowWidth: 54.0,
  windowHeight: 41.2,
  /** Distance from the top of the device to the top of the window. */
  topMargin: 8.0,
  /** Thickness of the black block that plugs the window so no gap can show. */
  blockDepth: 1.2,
  cornerRadius: 1.2,
};

/** Window centre, measured from the middle of the body. */
SCREEN.centerY = BODY.height / 2 - SCREEN.topMargin - SCREEN.windowHeight / 2;

/**
 * The click wheel. Outer disc, and the select button at roughly half its
 * diameter — the proportion that reads as "iPod" more than any other.
 */
export const WHEEL = {
  outerRadius: 17.25,
  centerRadius: 7.2,
  /** Dark ring between the wheel and the select button. */
  gap: 0.6,
  /** Radius the four printed labels sit at, as a fraction of outerRadius. */
  labelRadius: 0.755,
  /**
   * How far a pressed zone sinks, and how far the wheel tilts toward the
   * pressed quadrant. Kept small on purpose: travel + (outerRadius * tilt)
   * must stay below MOUNT.wheel or the pressed edge disappears into the shell.
   * At these values the outer edge dips 0.37 mm of the 0.50 mm available.
   */
  travel: 0.2,
  tilt: 0.01,
};

/** Wheel centre, measured from the middle of the body. */
WHEEL.centerY = -(BODY.height / 2 - 10.0 - WHEEL.outerRadius);

/** Headphone jack and hold switch (top face), dock connector (bottom face). */
export const PORTS = {
  jack: { radius: 3.0, x: -18.0 },
  hold: { width: 11.0, height: 4.2, x: 15.0, sliderWidth: 4.6 },
  dock: { width: 27.6, height: 3.4, contacts: 30 },
};

/** Where a camera should sit to frame the whole device, in scene units. */
export const FRAMING = {
  // A 32-degree lens needs ~25 units of standoff to fit a 10.4-unit-tall
  // device with margin: visibleHeight = 2 * dist * tan(fov/2).
  position: [u(52), u(30), u(238)],
  target: [0, 0, 0],
  minDistance: u(150),
  maxDistance: u(520),
};
