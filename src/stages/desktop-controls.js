/**
 * desktop-controls.js — which numbers the tweak panel exposes, and how.
 *
 * Separate from the stage because it is a list, not behaviour, and it is the
 * file you edit to expose one more slider. Every control points straight at a
 * property of theme/desk-spec.js, so the panel edits the spec itself and there
 * is never a second copy of a dimension to fall out of sync.
 *
 * `rebuild: true` marks a number that was baked into geometry at create() time.
 * Positions, angles and lens settings are not — they are applied to the objects
 * that already exist, every frame, for free.
 */

import { MONITOR, TOWER, KEYBOARD, DESK, FRAMING } from '../theme/desk-spec.js';
import { NOTE_SETTINGS } from '../ui/win95/notes.js';
import { CLIPPY_SETTINGS } from '../ui/win95/clippy.js';

const DEG = 180 / Math.PI;

/** Shorthand: a millimetre control. */
const mm = (id, label, target, key, min, max, step = 1, rebuild = false) =>
  ({ id, label, target, key, min, max, step, unit: 'mm', decimals: 1, rebuild });

/** Shorthand: an angle, stored in radians and shown in degrees. */
const deg = (id, label, target, key, min = -30, max = 30) =>
  ({ id, label, target, key, min, max, step: 0.5, factor: DEG, unit: '°', decimals: 1 });

export const CONTROL_GROUPS = [
  {
    label: 'Note transform',
    export: { name: 'NOTE_SETTINGS', file: 'src/ui/win95/notes.js', target: NOTE_SETTINGS },
    controls: [
      ...[
        ['w', 'Width', 280, 784],
        ['h', 'Height', 180, 556],
        ['x', 'Left (X)', 0, 520],
        ['y', 'Top (Y)', 0, 392],
      ].map(([key, label, min, max]) => ({
        id: `NOTE_SETTINGS.${key}`, label, target: NOTE_SETTINGS, key,
        min, max, step: 1, unit: 'px', decimals: 0, clamp: true,
      })),
      { id: 'NOTE_SETTINGS.title', label: 'Title', target: NOTE_SETTINGS, key: 'title', type: 'text' },
      { id: 'NOTE_SETTINGS.body', label: 'Body text', target: NOTE_SETTINGS, key: 'body', type: 'textarea' },
    ],
  },
  {
    label: 'Camera',
    controls: [
      mm('FRAMING.position[0]', 'Eye X', FRAMING.position, 0, -900, 900, 2),
      mm('FRAMING.position[1]', 'Eye Y', FRAMING.position, 1, 100, 1200, 2),
      mm('FRAMING.position[2]', 'Eye Z', FRAMING.position, 2, 300, 2000, 2),
      mm('FRAMING.target[0]', 'Look X', FRAMING.target, 0, -600, 600, 2),
      mm('FRAMING.target[1]', 'Look Y', FRAMING.target, 1, 0, 700, 2),
      mm('FRAMING.target[2]', 'Look Z', FRAMING.target, 2, -500, 400, 2),
      { id: 'FRAMING.fov', label: 'Lens (fov)', target: FRAMING, key: 'fov', min: 18, max: 70, step: 0.5, unit: '°', decimals: 1 },
      mm('FRAMING.parallax', 'Parallax', FRAMING, 'parallax', 0, 120, 1),
    ],
  },
  {
    label: 'Zoom-in',
    open: false,
    controls: [
      { id: 'FRAMING.zoomPadding', label: 'Padding', target: FRAMING, key: 'zoomPadding', min: 1, max: 2, step: 0.01, decimals: 2 },
      { id: 'FRAMING.zoomDuration', label: 'Duration', target: FRAMING, key: 'zoomDuration', min: 0.4, max: 6, step: 0.1, unit: 's', decimals: 1 },
    ],
  },
  {
    label: 'Monitor',
    controls: [
      mm('MONITOR.x', 'X', MONITOR, 'x', -700, 700, 2),
      mm('MONITOR.z', 'Z', MONITOR, 'z', -380, 380, 2),
      deg('MONITOR.yaw', 'Turn', MONITOR, 'yaw', -45, 45),
      deg('MONITOR.tilt', 'Tilt', MONITOR, 'tilt', -25, 25),
      mm('MONITOR.bezelWidth', 'Bezel W', MONITOR, 'bezelWidth', 240, 620, 2, true),
      mm('MONITOR.bezelHeight', 'Bezel H', MONITOR, 'bezelHeight', 240, 600, 2, true),
      mm('MONITOR.windowWidth', 'Window W', MONITOR, 'windowWidth', 180, 560, 2, true),
      mm('MONITOR.windowHeight', 'Window H', MONITOR, 'windowHeight', 140, 520, 2, true),
      mm('MONITOR.windowOffsetY', 'Window up', MONITOR, 'windowOffsetY', -40, 60, 1, true),
      mm('MONITOR.bulge', 'Tube bulge', MONITOR, 'bulge', 0, 45, 1, true),
      mm('MONITOR.funnelDepth', 'Funnel', MONITOR, 'funnelDepth', 8, 90, 1, true),
      { id: 'MONITOR.funnelTaper', label: 'Funnel in', target: MONITOR, key: 'funnelTaper', min: 0.8, max: 1, step: 0.005, decimals: 3, rebuild: true },
      { id: 'MONITOR.openScale', label: 'Opening', target: MONITOR, key: 'openScale', min: 1, max: 1.3, step: 0.005, decimals: 3, rebuild: true },
      mm('MONITOR.shellDepth', 'Tube depth', MONITOR, 'shellDepth', 120, 620, 4, true),
      { id: 'MONITOR.shellTaper', label: 'Taper', target: MONITOR, key: 'shellTaper', min: 0.2, max: 1, step: 0.01, decimals: 2, rebuild: true },
      mm('MONITOR.standHeight', 'Stand H', MONITOR, 'standHeight', 20, 180, 2, true),
      mm('MONITOR.standWidth', 'Stand W', MONITOR, 'standWidth', 120, 420, 2, true),
      mm('MONITOR.standZ', 'Stand back', MONITOR, 'standZ', -300, 40, 2, true),
    ],
  },
  {
    label: 'Tower',
    controls: [
      mm('TOWER.x', 'X', TOWER, 'x', -700, 700, 2),
      mm('TOWER.z', 'Z', TOWER, 'z', -380, 380, 2),
      deg('TOWER.yaw', 'Turn', TOWER, 'yaw', -60, 60),
      mm('TOWER.width', 'Width', TOWER, 'width', 110, 340, 2, true),
      mm('TOWER.height', 'Height', TOWER, 'height', 220, 640, 2, true),
      mm('TOWER.depth', 'Depth', TOWER, 'depth', 220, 640, 2, true),
      mm('TOWER.cornerRadius', 'Corner r', TOWER, 'cornerRadius', 0, 40, 1, true),
    ],
  },
  {
    label: 'Keyboard',
    open: false,
    controls: [
      mm('KEYBOARD.x', 'X', KEYBOARD, 'x', -700, 700, 2),
      mm('KEYBOARD.z', 'Z', KEYBOARD, 'z', -200, 380, 2),
      deg('KEYBOARD.yaw', 'Turn', KEYBOARD, 'yaw', -35, 35),
      mm('KEYBOARD.width', 'Width', KEYBOARD, 'width', 280, 640, 2, true),
      mm('KEYBOARD.depth', 'Depth', KEYBOARD, 'depth', 110, 280, 2, true),
      { id: 'KEYBOARD.unit', label: 'Key pitch', target: KEYBOARD, key: 'unit', min: 12, max: 26, step: 0.05, unit: 'mm', decimals: 2, rebuild: true },
    ],
  },
  {
    label: 'Desk',
    open: false,
    controls: [
      mm('DESK.width', 'Width', DESK, 'width', 700, 2600, 10, true),
      mm('DESK.depth', 'Depth', DESK, 'depth', 400, 1200, 10, true),
      mm('DESK.thickness', 'Thickness', DESK, 'thickness', 10, 80, 1, true),
      mm('DESK.wallZ', 'Wall Z', DESK, 'wallZ', -900, -180, 5, true),
    ],
  },
];

/* ── the assistant's own panel, on L ─────────────────────────────────────
   Separate from the list above because it is a separate panel: desk tweaks
   are millimetres of furniture, and these are raster pixels on the screen
   the furniture is showing. Mixing them in one scroll would make both harder
   to find. */

/** Shorthand: a pixel control on the 800x600 desktop. */
const px = (key, label, min, max, step = 1, decimals = 0) =>
  ({ id: `CLIPPY_SETTINGS.${key}`, label, target: CLIPPY_SETTINGS, key,
    min, max, step, unit: 'px', decimals });

export const CLIPPY_GROUPS = [
  {
    label: 'Clippy transform',
    export: { name: 'CLIPPY_SETTINGS', file: 'src/ui/win95/clippy.js', target: CLIPPY_SETTINGS },
    controls: [
      // min/max/step are in DISPLAYED units, as the degree controls above are:
      // 30 to 300 percent, stored as 0.3 to 3.
      { id: 'CLIPPY_SETTINGS.scale', label: 'Scale', target: CLIPPY_SETTINGS, key: 'scale', min: 30, max: 300, step: 1, factor: 100, unit: '%', decimals: 0 },
      px('right', 'From right', 0, 700, 1),
      px('bottom', 'Up from bar', 0, 460, 1),
      { id: 'CLIPPY_SETTINGS.wire', label: 'Wire', target: CLIPPY_SETTINGS, key: 'wire', min: 2, max: 14, step: 0.1, unit: 'px', decimals: 1 },
      { id: 'CLIPPY_SETTINGS.eye', label: 'Eyes', target: CLIPPY_SETTINGS, key: 'eye', min: 5, max: 22, step: 0.5, unit: 'px', decimals: 1 },
    ],
  },
  {
    label: 'What he says',
    controls: [
      { id: 'CLIPPY_SETTINGS.font', label: 'Font', target: CLIPPY_SETTINGS, key: 'font', type: 'text' },
      px('size', 'Text size', 7, 24, 1),
      px('line', 'Line height', 8, 32, 1),
      px('width', 'Balloon wrap', 90, 460, 2),
      px('pad', 'Balloon pad', 2, 20, 1),
      px('sayX', 'Balloon X', -420, 160, 1),
      px('sayY', 'Balloon Y', -260, 200, 1),
      { id: 'CLIPPY_SETTINGS.dwell', label: 'Seconds a line', target: CLIPPY_SETTINGS, key: 'dwell', min: 2, max: 40, step: 0.5, unit: 's', decimals: 1 },
    ],
  },
];
