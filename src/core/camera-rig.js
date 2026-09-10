/**
 * camera-rig.js — framing maths, and an eased move between two framings.
 *
 * The desk scene has no orbit controls: the camera is placed, not flown by
 * hand. Two jobs follow from that.
 *
 * 1. Work out where a camera has to sit for a given object to fill the frame
 *    with a margin. Doing this by eye is a number you have to re-tune every
 *    time the object moves; doing it from the object's bounds is a number that
 *    stays correct.
 *
 * 2. Move between two such framings gracefully. The move interpolates the
 *    camera POSITION and the LOOK-AT TARGET separately, which is the whole
 *    trick: slerping the camera's quaternion instead makes the subject drift
 *    across the frame during the move, because a rotation that is correct at
 *    both ends is wrong in the middle once the position has changed too.
 */

import * as THREE from 'three';

/** Ease with zero velocity AND zero acceleration at both ends. */
const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * Where must a camera sit for `object` to fill the frame with padding?
 *
 * Checks the horizontal fit as well as the vertical one. Only checking height
 * looks right on a wide window and crops the sides the moment the window is
 * narrow — which is exactly the shape a browser gets resized into.
 *
 * @param {THREE.Object3D} object
 * @param {object} o
 * @param {THREE.PerspectiveCamera} o.camera supplies fov and aspect
 * @param {THREE.Vector3} o.direction unit vector from the subject toward the camera
 * @param {number} o.padding 1.0 = exactly filling the frame; 1.15 = 15% margin
 * @returns {{ position: THREE.Vector3, target: THREE.Vector3 }}
 */
export function frameObject(object, { camera, direction, padding = 1.15 }) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const target = box.getCenter(new THREE.Vector3());

  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);

  const distV = ((size.y * padding) / 2) / Math.tan(vFov / 2);
  const distH = ((size.x * padding) / 2) / Math.tan(hFov / 2);

  // Half the depth, because the framing distance is measured to the subject's
  // centre but the near face is what has to clear the frame.
  const dist = Math.max(distV, distH) + size.z / 2;

  return {
    position: target.clone().addScaledVector(direction.clone().normalize(), dist),
    target,
  };
}

/**
 * A camera on rails.
 *
 * Holds the base framing, animates between framings, and applies a parallax
 * offset on top without that offset ever leaking into the animation's
 * endpoints — otherwise a move that starts mid-parallax lands somewhere
 * slightly wrong, and the error accumulates over repeated moves.
 */
export function createCameraRig(camera, framing) {
  const base = { position: framing.position.clone(), target: framing.target.clone() };
  const from = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const to = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const offset = new THREE.Vector3();
  const eased = new THREE.Vector3();

  let duration = 0;
  let elapsed = 0;
  let settle = null; // resolve fn of the in-flight move

  function apply() {
    camera.position.copy(base.position).add(offset);
    camera.lookAt(base.target);
  }
  apply();

  return {
    /** The framing the rig is heading for (or resting at). */
    get destination() {
      return duration > 0 ? { position: to.position.clone(), target: to.target.clone() } : { ...base };
    },

    /** True while a move is in flight. */
    get moving() {
      return duration > 0;
    },

    /**
     * Where the rig is right NOW, mid-move included.
     *
     * Used when handing the view over to something else — free orbit, say —
     * so the other controller can pick up exactly where the rails left off
     * instead of snapping to wherever the last framing happened to be.
     */
    get view() {
      return { position: base.position.clone(), target: base.target.clone() };
    },

    /**
     * Ease to a new framing. A second call retargets from wherever the camera
     * currently is, so an interrupted move never snaps.
     * @returns {Promise<void>} resolves when the move lands
     */
    flyTo({ position, target, duration: d = 2.2 }) {
      settle?.(); // let anyone awaiting the previous move go
      from.position.copy(base.position);
      from.target.copy(base.target);
      to.position.copy(position);
      to.target.copy(target);
      duration = Math.max(0.0001, d);
      elapsed = 0;
      return new Promise((resolve) => {
        settle = resolve;
      });
    },

    /** Jump to a framing with no animation — used on resize while at rest. */
    snapTo({ position, target }) {
      if (duration > 0) {
        // Mid-flight: correct the destination rather than the camera, so the
        // move keeps its easing instead of jumping.
        to.position.copy(position);
        to.target.copy(target);
        return;
      }
      base.position.copy(position);
      base.target.copy(target);
      apply();
    },

    /** Parallax and the like. Shifts the eye, never the subject. */
    setOffset(x, y, z) {
      offset.set(x, y, z);
    },

    update(dt) {
      if (duration > 0) {
        elapsed += dt;
        const k = smootherstep(Math.min(1, elapsed / duration));
        base.position.copy(eased.copy(from.position).lerp(to.position, k));
        base.target.copy(eased.copy(from.target).lerp(to.target, k));
        if (elapsed >= duration) {
          duration = 0;
          const done = settle;
          settle = null;
          done?.();
        }
      }
      apply();
    },
  };
}
