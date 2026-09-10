/**
 * shared-materials.js — the one set of material instances neither scene owns.
 *
 * Both palettes hand out shared instances, and two places need to know which
 * ones those are before disposing anything: the part inspector when you switch
 * parts, and the desk stage when the tweak panel rebuilds it. Collecting them
 * here means neither has to remember to check both palettes — the bug that
 * causes is silent, and shows up later as an untextured part.
 */

import { materials as ipod } from './palette.js';
import { materials as desk } from './desk-palette.js';

export const SHARED_MATERIALS = new Set([
  ...Object.values(ipod),
  ...Object.values(desk),
]);
