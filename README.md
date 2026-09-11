# Rakshit's First Desktop — an interactable 3D scene

A **2000s desktop PC** photographed on a wood desk, whose power button actually
boots Windows 95 on the CRT. No build step and no npm: every texture is drawn
on a `<canvas>`, and every noise the machine makes — clicks, the fan, the power
thunk — is synthesised in WebAudio.

Internet Explorer is the one place the illusion is a composite: the chrome is
painted on the tube like everything else, but the page itself is a real iframe
warped onto the content area, because a live website cannot be turned into a
WebGL texture. It hides itself whenever the renderer would have drawn something
in front of it, and a hand-drawn version of the page sits underneath as the
fallback.

The two exceptions to "no binary assets" are both in the desktop's UI, and both
are deliberate. The Windows 95 icons are hand-pixelled bitmaps that cannot be
drawn procedurally without looking like an imitation, so they travel as base64
in `src/ui/win95/icons.js`. And the music player plays real files from
`assets/music/`, because a music player that plays a synthesised approximation
of a song is not a music player.

```bash
python3 serve.py 5174
```

- scene — <http://localhost:5174/index.html>
- parts — <http://localhost:5174/viewer.html>

`serve.py` exists because `python3 -m http.server` caches aggressively: you edit
a module, refresh, and run the *old* code. It sends `Cache-Control: no-store` and
serves `.js` as `text/javascript`, so a refresh always runs what is on disk.

> The Browser-pane launcher in `.claude/launch.json` may fail with
> `Operation not permitted` — macOS withholds access to `~/Documents` from the
> python it spawns. Running `serve.py` from a terminal works fine.


## What you can do

| Gesture | Result |
| --- | --- |
| Move the pointer | A slight, heavily damped camera parallax |
| Wait 3s on arrival | A callout appears over the power button, and goes when you press it |
| Click the tower's power button | Boots: LED, fan, the tube striking on, camera flies into the screen |
| — | The welcome note is already open when it comes up, every boot |
| <kbd>esc</kbd> or **Back** | Fly back out to the wide shot; the machine stays on |
| Click the power button again | Shut down — the raster collapses and the camera pulls back |
| <kbd>c</kbd> or **Camera** | Unlock the camera and orbit freely; again to fly it back |
| <kbd>t</kbd> or **Tweak** | Open the live control panel |
| Click **My Music** on the screen | Opens the player |
| Click a track | Plays it — transport, scrub bar and clock all live |
| Drag the window's title bar | Moves it, clamped so the bar stays grabbable |
| Click **My Computer** | A folder holding everything else on the desktop |
| Click **My Documents** | A folder of shortcuts to shipped work |
| Click a shortcut | Opens the real page in a new browser tab |
| Click **Recycle Bin** | A folder too — a link, and one thing Figma replaced |
| Click **My Photos** | Opens Rakshit's Memories as a folder of thumbnails |
| Click a photo | Opens it full size in a single-document viewer |
| Click **Notes** | Opens Rakshit's welcome note in Notepad |
| Click **Internet Explorer** | Opens rakshit.design, live, inside the drawn browser |
| Scroll or click inside the page | It is a real iframe — the site behaves normally |
| **Start** > Shut Down | Powers the machine off |

Both screens are **deliberately blank**. Adding a UI later needs no change to
either model, and the two expose the *same* handle, so a UI written against one
works against the other:

```js
window.app.current.screen.redraw((ctx, w, h) => {
  ctx.fillStyle = '#1c1c1e'; ctx.fillRect(0, 0, w, h);
});
```

## The free camera

The desk camera is on rails by default — the iPod is an object you pick up and
turn over, this is a room you are sitting in, and orbiting it by accident would
destroy the one thing it is trying to be. But rails are the right default and
the wrong prison, so <kbd>c</kbd> unlocks it.

The handover is the part worth knowing. Unlocking seeds OrbitControls from the
rig's **current** view, so the first frame after pressing <kbd>c</kbd> is
identical to the last one before it; without that the camera snaps to whatever
framing the rails nominally held. Re-locking is the mirror image: the rig adopts
wherever you actually left the camera, *then* flies from there to where it
belongs — so the way back is the same graceful move as the way in, whether you
are six inches from the glass or standing behind the desk.

Exactly one of the two ever drives the camera. Running both means the rig
rewrites the position OrbitControls just set, every frame, and the camera sticks
to the rails while appearing to fight you.

Pressing the tower's power button while unlocked takes the camera back **without
a flight of its own** — the boot is about to fly it anyway, so it starts from
wherever you were rather than dumping you at the wide shot first. Leaving the
stage re-locks too: switching away and back should not drop you under the desk
with no memory of why.

This feature is also why the tower has a back panel and the monitor has rear
vents. Until the camera could be unlocked, the backs of both were surfaces
nobody would ever see; the moment it could, they became the least convincing
thing in either scene.

## The tweak panel

<kbd>t</kbd> on the desk scene opens sliders bound directly to `theme/desk-spec.js`
— positions, angles, the lens, and the dimensions of the monitor, tower,
keyboard and desk. The preview is the actual scene, not a mock, so what you are
adjusting is the thing you are looking at.

Two kinds of control, and the difference is the whole design:

- **live** — a transform, a light, a lens. Nothing was baked from it, so it
  applies on the next frame.
- **rebuild** — a dimension. The geometry was extruded from that number at
  `create()` time, so the desk is built again. Debounced by 140 ms, because
  dragging a slider would otherwise rebuild it sixty times a second. The
  machine's power state, the tube's contents and every handle the stage holds
  survive the swap.

Changes persist in `localStorage`, so a session survives a reload, and **Copy**
puts the diff on the clipboard in a form you can paste into `desk-spec.js` — or
straight back to Claude as an instruction:

```
Apply these to src/theme/desk-spec.js:

  MONITOR.bezelWidth       406 →      520 mm
  TOWER.x                 -358 →     -420 mm

(angles shown in degrees, lengths in mm)
```

**Reset** puts everything back. `core/tweak.js` is the generic panel and knows
nothing about the desk; `stages/desktop-controls.js` is the list of what it
exposes, and is the one file to edit to add a slider.

Once a change is written into `desk-spec.js`, the panel drops it from storage on
the next load rather than reporting it as outstanding forever — so the loop is
tweak → copy → paste into the spec → reload → clean panel.

## Layout

```
index.html / viewer.html    the two pages
serve.py                    no-cache dev server
vendor/three/               three.js r160, pinned locally
src/
  main.js                   the router — picks a stage, wires the keys
  registry.js               the one list of components, for the inspector
  stages/   ipod, desktop — each owns a scene, a camera and its HUD
            desktop-controls.js — what the tweak panel exposes
  core/     engine, camera-rig, environment, room-env, lighting, audio,
            interaction, tweak — the live control panel
  theme/    spec + desk-spec (dimensions), palettes, textures, backdrop, room
  lib/      shapes.js — rounded rects and frames, tapers, bulges
            dispose.js — tear down a subtree without killing shared materials
  objects/  IPod, Body, Screen, ClickWheel, Ports
            desktop/ Desktop, Desk, Monitor, Tower, Keyboard
```

Every component exports `meta` + `create()` and appears in `registry.js`, so one
entry adds a part to the inspector. Every dimension comes from
`theme/desk-spec.js`, in real millimetres.

## The stage contract

`core/engine.js` owns the renderer and the frame loop and **nothing else** — no
scene, no camera. A stage is any object shaped like:

```js
{ scene, camera, backdrop?, activate?(), deactivate?(), resize?(w, h), update?(dt, t) }
```

The camera has to belong to the stage rather than the engine because the two
scenes disagree about the near plane by a factor of six, for reasons that are
not negotiable in either direction (see below).

Only the active stage's `update` is called, so an idle stage is genuinely
free: everything a stage animates hangs off its own frame bus rather than
subscribing to the engine.

## Things that are not obvious

**The iPod's shell is one extrusion carrying two finishes.** Modelling the black
front and the steel back as separate meshes always leaves either a step or a
hairline gap along the rim. Instead a single bevelled `ExtrudeGeometry` is split
into two material groups at `BODY.seamZ` by `groupByZ` in `lib/shapes.js`. The
seam is a material change, so it is clean from every angle. The tower's silver
front bezel over its graphite shell is the same trick.

**Everything on the iPod's front is mounted *proud* of the face.** There is no
CSG, so the solid shell has no hole for anything to sit in: a surface at or
below `FACE.z` is simply buried inside the body and never drawn. The screen and
wheel stack upward from `FACE.z` in fractions of a millimetre (`MOUNT` in
`spec.js`) — too small to read as raised, enough to win the depth test. The
wheel's recessed *look* is painted into its texture instead. Two constraints
follow: the iPod camera's near plane is 3, not 0.1, or those 0.05 mm layers
z-fight at 20 units out; and `WHEEL.travel` plus the tilt of the outer edge must
stay under `MOUNT.wheel`, or a pressed wheel sinks into the body and vanishes.

**The CRT is built at the real dimensions of one, and the depth is the point.**
A period 17-inch monitor measured about 410 x 400 x 420 mm — as deep as it is
wide — because the gun needs that distance to sweep a 90-degree deflection
across the faceplate. Build it shallow and you get a flat panel wearing a thick
frame, which is what most recreations are. The cabinet is four pieces front to
back: a flat front plate, a tapered *funnel* whose opening is wider at the front
and narrows toward the glass, a shell flaring back on a curve, and the yoke
bulge at the neck. That funnel is what lays a bright angled band around all four
inner edges of the window, and it says "CRT" louder than the bulk does.

Two consequences worth knowing. The base sits at `MONITOR.standZ`, well BACK of
the glass — the cabinet runs 420 mm backwards from its front plate, so a base at
the tube's origin would be under the front lip and the thing would pitch forward
off it. And the desk had to grow to 880 mm deep, because a tube that size eats
more than half of it: exactly why "computer desks" of the period were deeper
than writing desks. The machine dictated the furniture.

**The beige is two beiges.** The ABS of this era used a bromine flame retardant
that yellows under UV, and it never yellowed evenly — different mouldings came
from different batches and sat in different light, so a stand is routinely a
shade further gone than the cabinet above it. `cabinetTexture` paints that
unevenly too: worst at the top where the light fell, pooling in blotches, with
scuffs concentrated along the top edge and the front corners where a monitor
actually gets knocked. Matching the tones makes a beige monitor look like a NEW
beige monitor, which is not what anyone remembers.

**A dead tube is green, not black.** The faceplate is tinted glass over grey
phosphor and reads as a dark bottle-green slab in any lit room. Pure black reads
as a hole cut in the bezel — and the cover glass drops from 0.34 opacity to 0.05
as the raster comes up, because a lit tube is mostly emission where a dead one
is mostly reflection.

**The CRT's bezel breaks the mount-it-proud rule, and should.** `THREE.Shape` carries a `holes`
array and `ExtrudeGeometry` honours it, so `roundedFrameShape` gives the monitor
a genuine window rather than the plugged block `objects/Screen.js` uses. The
plugged block exists because the iPod's shell is solid and has nothing to cut
into; the bezel *is* a frame, so a real opening is both simpler and chamfers the
window edge for free. The desk scene's own `MOUNT` steps are 0.2 mm rather than
0.05, because its camera's near plane is 0.5 — the fly-in ends a few units off
the glass, and the depth buffer has correspondingly less to spend far away.

**The environment map matters more than the lights.** `core/room-env.js` is a
map for the desk — nothing there is a mirror and the camera never orbits, so it
only has to put a warm lamp on one side of every matte plastic and a cool fill
on the other.

**The desk's contact shadows are painted into the wood.** Shadow mapping is off
in both scenes, so those blurred ellipses in `woodTexture` are the only thing
putting the monitor, tower and keyboard *on* the desk rather than a centimetre
above it. They are drawn from the same `desk-spec.js` numbers that position the
objects, so moving the tower moves its shadow.

**The CRT's cover glass fades as the tube lights.** A dead tube is mostly
reflection and a lit one is mostly emission, so the glass animates between 0.30
and 0.05 opacity. Leaving it at its resting value over a white raster costs a
third of the brightness — white comes out grey — and the screen's own glow light
then reflects off it as a hotspot in the middle of the picture.

**Switching off is the boot played backwards.** A CRT waking up strikes a single
bright line and opens it vertically into a full raster; switching off is that
raster closing. `drawBoot(ctx, w, h, k)` runs `k` forward for one and backward
for the other, so there is one animation rather than two. The overshoot in the
middle — a collapsing raster is brighter, because the same beam energy covers
less area — is the flash everyone remembers.

**The wheel and the power button capture your gesture.** On pointerdown over any
wheel target, OrbitControls is disabled for the duration — otherwise dragging
around the wheel also tumbles the device. The listener runs in the capture phase
to beat OrbitControls' own handler on the same element. Both scenes gate presses
on the pointer having moved under 5 px, so a drag that happens to end over a
target does not fire it.

**Audio has to be unlocked inside a gesture.** The `AudioContext` starts
suspended under the autoplay policy, so `audio.unlock()` runs from pointerdown.
Miss that and the first click of every session is silent.

**The fly-in re-frames on resize.** `camera-rig.js` computes the zoom distance
from the picture's bounds and the *live* viewport aspect, checking width as well
as height. Only checking height looks right on a wide window and crops the sides
the moment the window is narrow — which is exactly the shape a browser gets
resized into.

## Deliberate omissions

- **No shadow mapping.** The iPod floats with no ground plane; the desk's
  contact shadows are painted. Form comes from the environment and the rim
  light.
- **No keycap legends.** The 104 caps are one `InstancedMesh` — 104 separate
  meshes would be more draw calls than the rest of both scenes combined, for
  the least important thing on the desk. The cost is that every cap shares one
  UV set. At the distance the board is ever seen a legend is well under a pixel,
  and buying them back means per-instance UV offsets and a patched shader for
  something nobody can read.
- **No logos.** The iPod's etched back and the PC's badges carry generic product
  text rather than reproductions of trademarked marks.
