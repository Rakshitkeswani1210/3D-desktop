/**
 * web-frame.js — a real, live web page inside the drawn Internet Explorer.
 *
 * The problem this solves: the CRT's picture is an 800x600 <canvas> uploaded
 * as a WebGL texture, and there is no way to rasterise a live page into it. An
 * <iframe> cannot be a texture. So the page cannot go IN the picture.
 *
 * What it can do is sit exactly ON TOP of it. This projects the four corners of
 * IE's content area — through the actual bulged geometry of the tube and the
 * actual camera — into page coordinates, then warps a real iframe onto that
 * quad with a CSS projective transform. Move the camera, drag the window, tilt
 * the monitor, and the page follows, because every frame re-derives the corners
 * from the same mesh the renderer draws.
 *
 * Two honest limitations, both inherent to compositing DOM over WebGL:
 *
 *   - The page is FLAT. The tube's bulge is reproduced in where the corners
 *     land, but not across the middle of the page, so a straight line drawn on
 *     the site stays straight where the glass would bend it slightly.
 *   - Nothing in the scene can occlude it. That is why it hides itself when
 *     another window is in front, or the Start menu is open, or the machine is
 *     off — anything the renderer would have drawn over it.
 *
 * The scanlines are re-applied over the iframe in CSS so the live page still
 * reads as something on a tube rather than a browser pasted onto a photograph.
 */

/**
 * Solve the projective transform taking four source points to four
 * destination points, and return it as a CSS matrix3d.
 *
 * A 2D projective map has eight unknowns:
 *     X = (a·x + b·y + c) / (g·x + h·y + 1)
 *     Y = (d·x + e·y + f) / (g·x + h·y + 1)
 * Four point pairs give eight equations, which is exactly determined — so this
 * is a plain 8x8 solve rather than a fit.
 */
function matrix3dFromQuad(w, h, dst) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
  }

  // Gaussian elimination with partial pivoting.
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-12) return null;   // degenerate quad
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      if (!f) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const k = b.map((v, i) => v / A[i][i]);
  const [a, bb, c, d, e, f, g, hh] = k;

  // CSS matrix3d is column-major, and applies to (x, y, 0, 1) with a divide
  // by w afterwards — which is precisely the projective divide above.
  return `matrix3d(${a},${d},0,${g}, ${bb},${e},0,${hh}, 0,0,1,0, ${c},${f},0,1)`;
}

export function createWebFrame() {
  const root = document.createElement('div');
  root.id = 'web-frame';
  Object.assign(root.style, {
    position: 'fixed', left: '0', top: '0', width: '0', height: '0',
    zIndex: '1',                     // above the canvas, below the HUD
    pointerEvents: 'none',
    display: 'none',
  });

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'absolute', left: '0', top: '0', border: '0',
    transformOrigin: '0 0', background: '#fff', pointerEvents: 'auto',
  });
  iframe.setAttribute('title', 'Internet Explorer content');
  // Same-origin is not needed and not wanted; this is somebody else's page.
  iframe.setAttribute('referrerpolicy', 'no-referrer');

  // The tube, re-applied over the live page. pointer-events off so it is
  // scanlines and nothing else — every click still reaches the site.
  const glass = document.createElement('div');
  Object.assign(glass.style, {
    position: 'absolute', left: '0', top: '0', transformOrigin: '0 0',
    pointerEvents: 'none',
    backgroundImage:
      'repeating-linear-gradient(to bottom, rgba(0,0,0,0.10) 0 2px, rgba(0,0,0,0) 2px 4px)',
  });

  root.append(iframe, glass);
  document.body.appendChild(root);

  let src = null;
  let cachedBox = null;
  let visible = false;

  /**
   * The local-space point on the picture mesh for a UV.
   *
   * Reproduces bulgedPlane()'s displacement rather than sampling the geometry:
   * the falloff is (1 - nx²)(1 - ny²) scaled by the peak, and the peak is the
   * bounding box's own max z.
   */
  function localAt(box, u, v, out) {
    const W = box.max.x - box.min.x;
    const H = box.max.y - box.min.y;
    const x = box.min.x + u * W;
    const y = box.min.y + v * H;
    const nx = x / (W / 2);
    const ny = y / (H / 2);
    out.set(x, y, box.max.z * (1 - nx * nx) * (1 - ny * ny));
    return out;
  }

  function setSrc(url) {
    if (url === src) return;
    src = url;
    iframe.src = url;
  }

  function hide() {
    if (!visible) return;
    visible = false;
    root.style.display = 'none';
  }

  /**
   * @param o.THREE      the three namespace (this module stays import-free of it)
   * @param o.camera     the stage camera
   * @param o.mesh       the picture mesh
   * @param o.canvas     the renderer's canvas, for its client rect
   * @param o.rect       content area in raster pixels {x, y, w, h}
   * @param o.raster     {width, height} of the raster
   */
  function update({ THREE, camera, mesh, canvas, rect, raster, zoom = 1 }) {
    if (!mesh || !camera) return hide();

    if (!cachedBox || cachedBox.geometry !== mesh.geometry) {
      mesh.geometry.computeBoundingBox();
      cachedBox = { geometry: mesh.geometry, box: mesh.geometry.boundingBox };
    }
    const box = cachedBox.box;
    const view = canvas.getBoundingClientRect();
    const tmp = new THREE.Vector3();

    // Raster pixels -> UV -> local -> world -> page pixels, for each corner.
    // v is flipped because a texture counts up and a canvas counts down.
    const corners = [
      [rect.x, rect.y],
      [rect.x + rect.w, rect.y],
      [rect.x + rect.w, rect.y + rect.h],
      [rect.x, rect.y + rect.h],
    ].map(([px, py]) => {
      localAt(box, px / raster.width, 1 - py / raster.height, tmp);
      mesh.localToWorld(tmp).project(camera);
      return [
        view.left + (tmp.x * 0.5 + 0.5) * view.width,
        view.top + (-tmp.y * 0.5 + 0.5) * view.height,
      ];
    });

    // Behind the camera, or edge-on: nothing sensible to draw.
    if (corners.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return hide();

    // Two transforms onto the SAME quad, from different source sizes.
    //
    // The page is laid out at rect/zoom and then squeezed into the quad, which
    // is exactly what a browser's zoom control does: at 0.7 the site believes
    // it has a ~1000px viewport and lays out its desktop design, and that is
    // then drawn at 70%. Sizing the iframe rather than using CSS zoom keeps
    // the site's own media queries honest.
    //
    // The scanlines are NOT zoomed. They belong to the tube, not the document,
    // so their pitch has to stay fixed in raster pixels however far the page
    // is zoomed out.
    const pageW = Math.round(rect.w / zoom);
    const pageH = Math.round(rect.h / zoom);
    const mPage = matrix3dFromQuad(pageW, pageH, corners);
    const mGlass = matrix3dFromQuad(rect.w, rect.h, corners);
    if (!mPage || !mGlass) return hide();

    iframe.style.width = `${pageW}px`;
    iframe.style.height = `${pageH}px`;
    iframe.style.transform = mPage;

    glass.style.width = `${rect.w}px`;
    glass.style.height = `${rect.h}px`;
    glass.style.transform = mGlass;

    if (!visible) { visible = true; root.style.display = 'block'; }
  }

  function dispose() {
    root.remove();
  }

  return { update, hide, setSrc, dispose, element: root };
}
