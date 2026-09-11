/**
 * tweak.js — a live control panel. Knows nothing about what it is controlling.
 *
 * Built rather than imported for the same reason nothing else here is: no npm,
 * no build step. dat.GUI would be another vendored dependency to do what two
 * hundred lines of DOM does, and this one can do the thing dat.GUI cannot —
 * tell you which numbers you actually changed, and hand them back in a form
 * you can paste into the spec file or into a prompt.
 *
 * Two kinds of control, and the difference matters:
 *
 *   live    — a transform, a light, a lens. Applied on the next frame.
 *   rebuild — a dimension. The geometry was baked from it at create() time, so
 *             the object has to be built again. Debounced, because dragging a
 *             slider would otherwise rebuild sixty times a second.
 *
 * A control reads and writes `target[key]` directly, so the panel is editing
 * the spec objects themselves — there is no second copy of the truth to drift.
 *
 * More than one panel can be open at once: each gets its own storage slot and
 * its own corner, set with `place`. The stylesheet is shared and injected once.
 */

const STYLE = `
.tweak {
  position: fixed; top: 64px; right: 24px; z-index: 5;
  width: 268px; max-height: calc(100vh - 108px);
  display: flex; flex-direction: column;
  background: rgba(10, 13, 22, 0.86);
  border: 1px solid rgba(232,236,245,.16);
  border-radius: 12px;
  backdrop-filter: blur(14px);
  font: 12px/1.45 ui-sans-serif, -apple-system, "Helvetica Neue", Arial, sans-serif;
  color: #e8ecf5;
  user-select: none; -webkit-user-select: none;
  box-shadow: 0 18px 50px rgba(0,0,0,.5);
}
.tweak[hidden] { display: none !important; }
.tweak header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-bottom: 1px solid rgba(232,236,245,.10);
}
.tweak header b { font-size: 11px; letter-spacing: .13em; text-transform: uppercase; font-weight: 600; }
.tweak header span { font-size: 10px; color: rgba(232,236,245,.4); }
.tweak .body { overflow-y: auto; padding: 4px 0 8px; }
.tweak .group > summary {
  list-style: none; cursor: pointer;
  padding: 7px 12px; font-size: 10px; letter-spacing: .12em;
  text-transform: uppercase; color: rgba(232,236,245,.42); font-weight: 600;
}
.tweak .group > summary::-webkit-details-marker { display: none; }
.tweak .group > summary:hover { color: #e8ecf5; }
.tweak .group[open] > summary { color: rgba(232,236,245,.62); }
.tweak .row { display: grid; grid-template-columns: 74px 1fr 52px; gap: 8px; align-items: center; padding: 3px 12px; }
.tweak .row label { font-size: 11px; color: rgba(232,236,245,.66); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tweak .row.dirty label { color: #7fd6ff; }
.tweak .row.text-row { grid-template-columns: 1fr; gap: 4px; }
.tweak input[type=text], .tweak textarea {
  width: 100%; min-width: 0; padding: 5px 6px;
  font: inherit; color: #e8ecf5; background: rgba(255,255,255,.06);
  border: 1px solid rgba(232,236,245,.12); border-radius: 4px;
  user-select: text; -webkit-user-select: text;
}
.tweak textarea { min-height: 130px; resize: vertical; }
.tweak input[type=range] {
  -webkit-appearance: none; appearance: none; width: 100%; height: 3px;
  background: rgba(232,236,245,.20); border-radius: 2px; outline: none; cursor: pointer;
}
.tweak input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 11px; height: 11px; border-radius: 50%;
  background: #e8ecf5; cursor: pointer;
}
.tweak .row.dirty input[type=range]::-webkit-slider-thumb { background: #7fd6ff; }
.tweak input[type=number] {
  width: 100%; font: inherit; font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #e8ecf5; background: rgba(255,255,255,.06);
  border: 1px solid rgba(232,236,245,.12); border-radius: 4px;
  padding: 2px 4px; text-align: right; -moz-appearance: textfield;
}
.tweak input[type=number]::-webkit-outer-spin-button,
.tweak input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.tweak footer {
  display: flex; gap: 6px; padding: 10px 12px;
  border-top: 1px solid rgba(232,236,245,.10);
}
.tweak footer button {
  flex: 1; font: inherit; font-size: 11px; color: #e8ecf5; cursor: pointer;
  background: rgba(255,255,255,.07); border: 1px solid rgba(232,236,245,.14);
  border-radius: 6px; padding: 6px 8px;
}
.tweak footer button:hover { background: rgba(255,255,255,.14); }
.tweak footer button.primary { color: #7fd6ff; border-color: rgba(127,214,255,.4); }
.tweak footer button:disabled { opacity: .35; cursor: default; }
`;

/**
 * @param {object} o
 * @param {Array} o.groups [{ label, open?, controls: [...] }]
 *   control: { id, label, target, key, min?, max?, step?, factor?, unit?, rebuild?, type? }
 *   `type` may be text or textarea; omitted means a numeric slider.
 *   A group's `export: { name, file, target }` includes its complete settings.
 *   `factor` converts stored units to displayed ones — radians to degrees, say.
 * @param {() => void} o.onLive     something cheap changed; reapply it
 * @param {() => void} o.onRebuild  a dimension changed; build the object again
 * @param {string} o.storageKey     localStorage slot, so tweaks survive a reload
 */
export function createTweakPanel({
  groups, onLive, onRebuild, storageKey = 'tweaks', title = 'Tweak',
  hint = 'T to hide', place = null,
}) {
  if (!document.getElementById('tweak-style')) {
    const style = document.createElement('style');
    style.id = 'tweak-style';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  const root = document.createElement('div');
  root.className = 'tweak';
  root.id = `tweak-${storageKey}`;
  // Panels stack in the same corner by default; `place` moves one aside so
  // two can be open and read at the same time.
  if (place) Object.assign(root.style, place);
  root.hidden = true;

  const controls = new Map();
  const flat = groups.flatMap((g) => g.controls);
  for (const c of flat) controls.set(c.id, { spec: c, initial: c.target[c.key] });
  const exports = groups.filter((g) => g.export);
  // Matched by target object rather than by group membership: a panel may
  // split one settings object across several groups, and every control that
  // edits an exported object belongs in that object's complete listing rather
  // than in the loose diff, which names the desk spec and talks in millimetres.
  const exportedTargets = new Set(exports.map((g) => g.export.target));
  const exportedIds = new Set(
    flat.filter((c) => exportedTargets.has(c.target)).map((c) => c.id),
  );
  const isText = (spec) => spec.type === 'text' || spec.type === 'textarea';
  const constrain = (spec, value) => spec.clamp
    ? Math.max(spec.min, Math.min(spec.max, Math.round(value / spec.step) * spec.step))
    : value;

  /* ── restore anything saved from a previous session ─────────────────── */

  // Wrapped: a private window, or site data cleared, makes every one of these
  // throw rather than return empty.
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  } catch { saved = {}; }

  let restoredRebuild = false;
  for (const [id, value] of Object.entries(saved || {})) {
    const c = controls.get(id);
    // Skip a stale id, and skip anything the spec file has since caught up
    // with: once a tweak has been applied to desk-spec.js, keeping it in
    // storage would show it as an outstanding change forever.
    if (!c || value === c.initial) continue;
    if (isText(c.spec) ? typeof value !== 'string' : !Number.isFinite(value)) continue;
    c.spec.target[c.spec.key] = isText(c.spec) ? value : constrain(c.spec, value);
    if (c.spec.rebuild) restoredRebuild = true;
  }

  function persist() {
    const out = {};
    for (const [id, c] of controls) {
      if (c.spec.target[c.spec.key] !== c.initial) out[id] = c.spec.target[c.spec.key];
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(out));
    } catch { /* storage unavailable; the panel still works for this session */ }
  }

  /* ── the DOM ────────────────────────────────────────────────────────── */

  const header = document.createElement('header');
  header.innerHTML = `<b>${title}</b><span>${hint}</span>`;
  root.appendChild(header);

  const body = document.createElement('div');
  body.className = 'body';
  root.appendChild(body);

  let rebuildTimer = null;

  for (const group of groups) {
    const details = document.createElement('details');
    details.className = 'group';
    details.open = group.open !== false;
    const summary = document.createElement('summary');
    summary.textContent = group.label;
    details.appendChild(summary);

    for (const spec of group.controls) {
      const c = controls.get(spec.id);
      const factor = spec.factor ?? 1;
      const toDisplay = (v) => +(v * factor).toFixed(spec.decimals ?? 2);
      const fromDisplay = (v) => v / factor;

      const row = document.createElement('div');
      row.className = 'row';

      const label = document.createElement('label');
      label.textContent = spec.label;
      label.title = `${spec.id}${spec.unit ? ` (${spec.unit})` : ''}`;
      label.htmlFor = `tweak-${spec.id}`;

      const write = (v) => {
        spec.target[spec.key] = v;
        if (spec.rebuild) {
          clearTimeout(rebuildTimer);
          rebuildTimer = setTimeout(onRebuild, 140);
        } else {
          onLive(spec);
        }
        syncInputs();
        persist();
        refreshFooter();
      };

      if (isText(spec)) {
        const input = document.createElement(spec.type === 'textarea' ? 'textarea' : 'input');
        if (spec.type === 'text') input.type = 'text';
        else input.rows = 7;
        input.id = label.htmlFor;
        row.classList.add('text-row');
        row.append(label, input);
        details.appendChild(row);
        Object.assign(c, { row, input });
        input.addEventListener('input', () => write(input.value));
        continue;
      }

      const range = document.createElement('input');
      range.type = 'range';
      range.min = spec.min;
      range.max = spec.max;
      range.step = spec.step;
      range.setAttribute('aria-label', `${spec.label} slider`);

      const number = document.createElement('input');
      number.type = 'number';
      number.step = spec.step;
      number.id = label.htmlFor;
      if (spec.clamp) { number.min = spec.min; number.max = spec.max; }

      row.append(label, range, number);
      details.appendChild(row);
      Object.assign(c, { row, range, number, toDisplay, fromDisplay });

      range.addEventListener('input', () => write(fromDisplay(constrain(spec, +range.value))));
      number.addEventListener('input', () => {
        if (number.value === '' || !Number.isFinite(number.valueAsNumber)) return;
        // Keep incomplete numbers editable; native validity marks the field
        // until it reaches the allowed range or is committed on blur.
        if (spec.clamp && (number.validity.rangeUnderflow || number.validity.rangeOverflow)) return;
        write(fromDisplay(constrain(spec, number.valueAsNumber)));
      });
      number.addEventListener('change', () => {
        if (Number.isFinite(number.valueAsNumber)) {
          write(fromDisplay(constrain(spec, number.valueAsNumber)));
        }
      });
    }

    body.appendChild(details);
  }

  /* ── footer ─────────────────────────────────────────────────────────── */

  const footer = document.createElement('footer');
  const copyBtn = document.createElement('button');
  copyBtn.className = 'primary';
  copyBtn.type = 'button';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset';
  footer.append(copyBtn, resetBtn);
  root.appendChild(footer);

  const changed = () =>
    [...controls.values()].filter((c) => c.spec.target[c.spec.key] !== c.initial);

  function refreshFooter() {
    const n = changed().length;
    copyBtn.textContent = exports.length ? 'Copy settings'
      : n ? `Copy ${n} change${n === 1 ? '' : 's'}` : 'No changes';
    copyBtn.disabled = n === 0 && !exports.length;
    resetBtn.disabled = n === 0;
  }

  /**
   * The changed values, as something you can act on.
   *
   * Deliberately one blob rather than two buttons: it reads as a diff, it names
   * the file, and it is phrased so it can be pasted straight back to Claude as
   * an instruction. Numbers with no context are the thing that makes a tweaking
   * session unrepeatable.
   */
  function report() {
    const rows = changed().filter((c) => !exportedIds.has(c.spec.id)).map((c) => {
      const { spec } = c;
      const display = isText(spec) ? JSON.stringify : c.toDisplay;
      const from = display(c.initial);
      const to = display(spec.target[spec.key]);
      return { id: spec.id, from, to, unit: spec.unit ?? '' };
    });
    const width = Math.max(0, ...rows.map((r) => r.id.length));
    const lines = rows.map(
      (r) => `  ${r.id.padEnd(width)}  ${String(r.from).padStart(8)} → ${String(r.to).padStart(8)}${r.unit ? ` ${r.unit}` : ''}`
    );
    const diff = rows.length ? [
      'Apply these to src/theme/desk-spec.js:',
      '',
      ...lines,
      '',
      '(angles shown in degrees, lengths in mm)',
    ].join('\n') : '';
    const complete = exports.map(({ export: { name, file, target } }) =>
      `Apply these complete settings to ${file} (${name}; layout in raster pixels):\n\n`
      + JSON.stringify({ [name]: target }, null, 2));
    return [diff, ...complete].filter(Boolean).join('\n\n');
  }

  copyBtn.addEventListener('click', async () => {
    const text = report();
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied';
      setTimeout(refreshFooter, 1200);
    } catch {
      // Clipboard is gated on permissions and a secure context; falling back to
      // the console beats a button that silently does nothing.
      console.log(text);
      copyBtn.textContent = 'See console';
      setTimeout(refreshFooter, 1800);
    }
  });

  resetBtn.addEventListener('click', () => {
    let needsRebuild = false;
    for (const c of controls.values()) {
      if (c.spec.target[c.spec.key] === c.initial) continue;
      if (c.spec.rebuild) needsRebuild = true;
      c.spec.target[c.spec.key] = c.initial;
    }
    needsRebuild ? onRebuild() : onLive();
    syncInputs();
    persist();
    refreshFooter();
  });

  /** Push the current stored values back into every input. */
  function syncInputs() {
    for (const c of controls.values()) {
      if (c.input) {
        const value = c.spec.target[c.spec.key];
        if (c.input.value !== value) c.input.value = value;
      } else {
        const v = c.toDisplay(c.spec.target[c.spec.key]);
        c.range.value = v;
        if (c.number !== document.activeElement || +c.number.value !== v) c.number.value = v;
      }
      c.row.classList.toggle('dirty', c.spec.target[c.spec.key] !== c.initial);
    }
  }

  document.body.appendChild(root);
  syncInputs();
  refreshFooter();

  return {
    element: root,
    /** True if a restored value means the object must be rebuilt before first show. */
    restoredRebuild,
    isOpen: () => !root.hidden,
    toggle(force) {
      root.hidden = force === undefined ? !root.hidden : !force;
      return !root.hidden;
    },
    report,
    /** Re-read the spec — after something outside the panel has changed it. */
    sync() { syncInputs(); persist(); refreshFooter(); },
  };
}
