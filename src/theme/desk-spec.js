/**
 * desk-spec.js — every dimension of the desktop scene, in real millimetres.
 *
 * Units: the numbers below are millimetres, and scene units are centimetres
 * (U = 0.1). Modelling in raw metres would put a 1 mm bevel at the edge of the
 * depth buffer's useful precision; centimetres keep near and far comfortable
 * while the source numbers stay readable as real measurements.
 *
 * Axis convention, written down once because everything depends on it:
 *   +X right, +Y up, +Z toward the viewer.
 * The DESK SURFACE is y = 0. Everything in the scene sits at y > 0, which makes
 * "how tall is it" and "where does it stand" the same number.
 */

/** Millimetres -> scene units. */
export const U = 0.1;

/** Convert a millimetre measurement to scene units. */
export const u = (mm) => mm * U;

/**
 * How far each applied feature sits proud of the surface it is mounted on.
 *
 * Same rule as the iPod: there is no CSG, so anything at or below the host
 * surface is buried inside it and never drawn. The steps here are 0.2 mm rather
 * than the iPod's 0.05 mm — this stage's camera has a near plane at 0.5 scene
 * units instead of 3, so the depth buffer has far less precision to spend out
 * at the far end and needs the extra separation.
 */
export const MOUNT = {
  decal: 0.2,
  bay: 0.4,
  button: 0.6,
  led: 0.8,
  hit: 3.0,
};

/* ─────────────────────────────── the desk ─────────────────────────────── */

export const DESK = {
  width: 1500,
  /**
   * 880 mm, which is deep for a desk and correct for this one.
   *
   * A 17-inch CRT is 420 mm front to back and has to sit with its neck near
   * the back edge, which eats more than half the depth on its own. This is
   * exactly why "computer desks" of the period were deeper than writing desks
   * and usually had a monitor shelf — the machine dictated the furniture.
   */
  depth: 880,
  thickness: 28,
  edgeRadius: 8,
  /** The wall behind. Far enough back that nothing casts onto it visually. */
  wallZ: -520,
  wallHeight: 1500,
};

/* ─────────────────────────────── the CRT ──────────────────────────────── */

/**
 * A 17-inch tube, at the real dimensions of one.
 *
 * The number that matters most is the DEPTH. A period 17-inch CRT measured
 * about 410 x 400 x 420 mm — as deep as it is wide — because the electron gun
 * needs that whole distance to sweep a 90-degree deflection across the
 * faceplate. Every recreation that gets this wrong builds a flat panel wearing
 * a thick bezel, and the thing that says "CRT" is precisely the bulk.
 *
 * Front to back the cabinet is three sections, and they add up to `depth`:
 *
 *   faceDepth    the flat front plate you touch
 *   funnelDepth  the chamfered tunnel angling back to the glass
 *   shellDepth   the cabinet flaring back toward the neck
 *
 * A "17-inch" tube showed about 16 inches, because an inch of glass was under
 * the bezel. The window below is that viewable area, not the nominal size.
 */
export const MONITOR = {
  bezelWidth: 410,
  bezelHeight: 400,
  bezelRadius: 18,

  /** The flat front plate: the frontmost surface of the whole machine. */
  faceDepth: 7,
  /**
   * The chamfered tunnel from the front plate back to the glass.
   *
   * This is the single biggest thing separating a CRT from a flat panel in a
   * thick frame. The opening is WIDER at the front and narrows toward the
   * glass, so a lit room lays a bright angled band around all four inner
   * edges — which is exactly what you see on any photograph of one.
   */
  funnelDepth: 28,
  /** How much the cabinet narrows across the funnel. */
  funnelTaper: 0.955,
  /** The funnel's front opening, as a multiple of the window. */
  openScale: 1.055,

  /** The viewable raster: ~16 inches diagonal, and exactly 4:3. */
  windowWidth: 336,
  windowHeight: 252,
  windowRadius: 18,
  /**
   * How far the window sits ABOVE the middle of the bezel.
   *
   * Real tubes are not centred in their surround: the bottom bezel is deeper,
   * because that is where the controls, the badge and the power lamp go.
   */
  windowOffsetY: 13,

  /** How far the tube face swells forward at its centre. */
  bulge: 16,
  /** The glass is inset inside the window so the bezel overlaps its edge. */
  pictureInset: 5,

  /**
   * The cabinet behind the funnel.
   *
   * A real funnel is a pyramid flare into a round neck. This is the rounded-
   * rectangle approximation of that, with the taper curved so the cabinet
   * stays fat for a while and then falls away, rather than narrowing evenly
   * from the front — which is what the glass actually does.
   */
  shellDepth: 385,
  shellTaper: 0.44,
  /** The neck and yoke bulge at the very back. */
  neckRadius: 46,
  neckDepth: 30,

  /** Ventilation louvres down each side, just behind the bezel. */
  vent: { width: 150, height: 74, y: -40, z: -96 },

  /**
   * The tilt-and-swivel pedestal it stands on.
   *
   * `standZ` is the one worth explaining: the cabinet runs 420 mm BACKWARDS
   * from its front plate, so a base at the tube's local origin sits under the
   * front lip and the whole thing would pitch forward off it. The base belongs
   * under the cabinet's mass, which is well behind the glass — look at any
   * photograph and the front of the monitor overhangs its foot considerably.
   */
  standWidth: 272,
  standDepth: 236,
  standHeight: 52,
  standRadius: 42,
  standZ: -168,
  /** The domed cap the cabinet actually rests on. */
  pivotRadius: 62,

  /** Where it stands, how far it is turned toward the camera, and its tilt. */
  x: 0,
  /**
   * Pushed back until the tube's neck almost touches the desk's rear edge,
   * which is where one always ended up. With a 420 mm cabinet that puts the
   * GLASS near the middle of the desk, not the back of it.
   */
  z: -5,
  /**
   * Turned AWAY from the camera, not toward it.
   *
   * Your tweak had this facing the camera, which was right when the cabinet
   * was 354 mm deep and had no depth worth showing. Now that it is a true 420,
   * a face-on tube hides the one thing that makes it a CRT: the camera sits
   * left of centre, so turning the monitor right opens up its left flank and
   * the whole taper reads. The screen is still within 13 degrees of square on,
   * which is nothing once you have flown into it.
   */
  yaw: 0.1484,
  /**
   * Tilt on the swivel. Currently upright.
   *
   * Worth knowing before changing it: a tipped-back tube shows the top of its
   * own shell. That mattered when the cabinet was shallow; now that it is a
   * true 420 mm deep, the bulk reads from the side on its own and upright is a
   * fair choice. A few degrees still looks more lived-in.
   */
  tilt: 0,
};

/**
 * Recompute everything derived from the numbers above.
 *
 * Called once at load, and again by the tweak panel whenever it changes a
 * dimension something else is measured from — a screen centre worked out from
 * a stand height that has since moved is the kind of bug that looks like a
 * modelling error for an hour.
 */
export function recompute() {
  /** Screen centre above the desk. The pedestal lifts the whole tube. */
  MONITOR.screenY = MONITOR.standHeight + MONITOR.bezelHeight / 2 + 4;
  /** Total cabinet depth, front plate to the back of the shell. */
  MONITOR.depth = MONITOR.faceDepth + MONITOR.funnelDepth + MONITOR.shellDepth;
  /** Where the glass sits, measured back from the front plate. */
  MONITOR.glassZ = -(MONITOR.faceDepth + MONITOR.funnelDepth) + 6;
}
recompute();

/** The picture canvas. 4:3, like the tube. */
export const PICTURE = { width: 800, height: 600 };

/* ────────────────────────────── the tower ─────────────────────────────── */

/**
 * A mini tower of the Dimension era: narrow, tall, deep, with a silver front
 * bezel over a graphite shell. The bezel is not a separate part — it is a
 * material group on the one extrusion, split at `seamZ`, the same trick the
 * iPod's shell uses for its two finishes.
 */
export const TOWER = {
  width: 186,
  height: 404,
  depth: 442,
  cornerRadius: 13,
  bevelSize: 2.5,
  bevelThickness: 2.5,

  /** Front of the shell, in local Z. */
  get faceZ() {
    return this.depth / 2;
  },
  /** Where graphite gives way to the silver bezel. */
  get seamZ() {
    return this.depth / 2 - 15;
  },

  x: -358,
  z: -118,
  yaw: 0.1309,
};

/**
 * Everything printed, cut or mounted on the front bezel, in bezel-local
 * coordinates: x from the centre, y from the middle of the tower.
 *
 * The power button is the one interactive object in this entire stage, so its
 * numbers are the ones worth getting right — big enough to be an obvious
 * target, low enough on the bezel to read as a real machine's.
 */
export const FRONT = {
  bays: [
    { y: 150, width: 152, height: 42, label: 'DVD-ROM' },
    { y: 101, width: 152, height: 42, label: 'CD-RW' },
  ],
  slot: { y: 57, width: 134, height: 15 },

  /** The recessed middle panel the button and LEDs sit in. */
  panel: { y: -22, width: 158, height: 96, radius: 10 },

  power: {
    y: -20,
    /** The button cap. */
    radius: 15,
    /** The ring moulded around it. */
    ringRadius: 22,
    /** How far the cap sinks when pressed. */
    travel: 1.4,
  },

  leds: [
    { id: 'power', x: -54, y: -20, radius: 3.4, color: 0x51ff8a },
    { id: 'disk', x: 54, y: -20, radius: 3.4, color: 0xffb545 },
  ],

  badge: { y: -112, width: 78, height: 30 },
  vent: { y: -166, width: 122, height: 28 },
};

/* ───────────────────────────── the keyboard ───────────────────────────── */

export const KEYBOARD = {
  width: 454,
  depth: 170,
  /** A wedge: thicker at the back, so the key rows rake toward you. */
  frontHeight: 17,
  backHeight: 30,
  radius: 7,

  /** One key unit. Everything on the deck is a multiple of this. */
  unit: 19.3,
  keyGap: 3.2,
  keyHeight: 9,
  keyRadius: 1.8,

  x: 16,
  z: 174,
  yaw: 0.0087,
};

/* ────────────────────────────── the camera ────────────────────────────── */

/**
 * The wide shot: seated at the desk and slightly left of the monitor, looking
 * a little down, on a long lens. Deliberately NOT orbitable — this stage is a
 * photograph of a machine, not a product turntable.
 *
 * The 30.5-degree lens is doing real work. A wide lens put the near corner of
 * the tower into visible perspective distortion and made the keyboard loom;
 * this is close to the 32 degrees the iPod scene uses, so both scenes now read
 * as though they were shot on the same glass.
 */
export const FRAMING = {
  // In millimetres, like every other number in this file. Converted at the
  // point of use, so the tweak panel can offer them in units you can reason
  // about against the desk they sit on.
  position: [-96, 452, 1330],
  target: [-120, 168, -120],
  /** Vertical FOV. Wider than the iPod's 32: this is a room, not a product. */
  fov: 30.5,
  /** Nearer than the iPod's 3, because the fly-in ends close to the glass. */
  near: 0.5,
  far: 800,
  /** How far the eye drifts with the pointer, in mm. */
  parallax: 32,
  /** Margin around the screen at the end of the fly-in. 1.0 fills the frame. */
  zoomPadding: 1.1,
  /** Seconds for the fly-in. Slow on purpose. */
  zoomDuration: 2.4,
};
