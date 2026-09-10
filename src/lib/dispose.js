/**
 * dispose.js — tear down a subtree's GPU resources. Knows nothing about the
 * device, which is why the set of shared materials is a parameter rather than
 * an import.
 *
 * The distinction it exists to make: a palette hands out ONE instance per
 * surface, shared across every part. Disposing those along with the object
 * that happened to be on screen breaks every other component in the project.
 * Anything else — a decal carrying its own canvas map, the monitor's cloned
 * cover glass — belongs to that object alone and goes with it.
 */

/**
 * @param {import('three').Object3D} root
 * @param {Set<import('three').Material>} shared materials to leave alone
 */
export function disposeTree(root, shared = new Set()) {
  root.traverse((obj) => {
    obj.geometry?.dispose();
    for (const m of [].concat(obj.material || [])) {
      if (shared.has(m)) continue;
      m.map?.dispose();
      m.alphaMap?.dispose();
      m.dispose();
    }
  });
}
