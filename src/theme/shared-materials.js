/**
 * shared-materials.js — the material instances the palette hands out shared.
 *
 * Two places need to know which those are before disposing anything: the part
 * inspector when you switch parts, and the desk stage when the tweak panel
 * rebuilds it. Disposing a shared instance is a silent bug that shows up later
 * as an untextured part, so both ask here rather than remembering the rule.
 */

import { materials as desk } from './desk-palette.js';

export const SHARED_MATERIALS = new Set(Object.values(desk));
