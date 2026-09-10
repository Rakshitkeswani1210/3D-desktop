# Rakshit's computer — a plan for the screen

A plan, not a design. What goes on the CRT once you press the power button, why
it should feel the way it does, and the order to build it in.

The premise is the thing to hold onto: **this is not a Windows XP demo, it is
Rakshit's machine.** A generic XP recreation is a nostalgia exercise anyone
could ship. A machine with *his* files on it, *his* half-finished projects in
the Recycle Bin and *his* music in Winamp is a portfolio piece. Every decision
below should be read through that.

---

## 1. What "XP" actually means here

### 1.1 The look

XP's Luna theme has a small, very specific vocabulary. Getting these exact is
90% of the recognition, and getting any of them wrong is instantly uncanny.

| Thing | Value | Note |
| --- | --- | --- |
| Window / dialog face | `#ECE9D8` | The single most recognisable colour in the OS. Warm grey-beige, never neutral grey. |
| Title bar (active) | `#0E5FD8` → `#2A85EF` → `#0A4DC0` | Vertical gradient, brightest around 40%, with a 1px white-ish top highlight. |
| Title bar (inactive) | Desaturated, ~`#7FA5DE` | The *fade* is how you know which window has focus. |
| Taskbar | `#245EDB` base, 1px `#3F8CF3` line on top, darkening to `#1941A5` | 30px tall at 96dpi. |
| Start button | `#379337` → `#5EB157` | Rounded on the right only. Lowercase "start", bold, slightly italic. |
| Selection | `#316AC5`, white text | Also the rubber-band, at ~30% alpha with a solid border. |
| Button / control face | `#ECE9D8` with white top-left, `#ACA899` bottom-right | Every control is bevelled. Nothing is flat. |
| Tooltip | `#FFFFE1`, 1px black border | |
| UI font | Tahoma 11px | Fallback chain: Tahoma → Verdana → DejaVu Sans → sans-serif. **Never fall through to the system UI font** — the letterforms are the tell, and `-apple-system` reads as 2020 instantly. |

Exact hexes above are close but eyeballed. Before building, eyedrop a real
screenshot for the six or seven that matter and put them in one
`theme/luna.js` — the same way `theme/palette.js` is the one place the iPod's
colours live.

### 1.2 The feel — which matters more

This is the part worth being deliberate about, because it is the part every XP
recreation on the web gets wrong. They build the *pictures* and skip the
*behaviour*, and the result looks right in a screenshot and feels like a
website the moment you touch it.

**Nothing was flat, and depth meant something.** A raised bevel meant press me;
a sunken well meant type here or read this. You could tell what was interactive
without hovering. That is a real information channel modern flat UI threw away,
and reinstating it is most of why this will feel like a computer rather than a
page.

**Latency was performed, not hidden.** Windows opened with a visible expanding
ghost from the taskbar button. Menus faded in over ~150ms. The hourglass
appeared. Progress bars filled in discrete chunks that had no relationship to
actual progress. Modern interfaces work hard to hide the machine; XP narrated
it. **A Start menu that appears in 0ms will feel wrong**, and inserting 120–400ms
of deliberate delay in the right places is not a bug to be fixed later — it is
the single highest-leverage thing on this list.

**Double-click, not click.** Desktop icons select on one click and open on two.
Getting this "wrong" is right.

**Right-click was everywhere, and most of it was greyed out.** The disabled
items matter as much as the enabled ones — they are what made the system feel
larger than the part you were using. A context menu with three live items and
six greyed ones reads as a real OS; one with three live items reads as a demo.

**Windows overlapped and you managed them.** Z-order, focus, drag by the title
bar, minimise to the taskbar. Tiling and full-screen-by-default are later ideas.

**It made noise.** The chime, the ding, the click. See §5 on what we can and
cannot reproduce.

---

## 2. How it plugs into what already exists

The model is already finished for this. `Monitor.js` exposes:

```js
window.app.current.screen  // { canvas, ctx, texture, redraw, width, height, mesh }
```

An 800×600 2D canvas at the tube's 4:3 ratio. Whatever is drawn there gets the
bulge, the scanlines, the vignette, the cover glass and the room glow for free.

### 2.1 The rendering decision

Three options, and the third is the one to take.

**A — DOM overlay positioned over the canvas.** Real HTML, real `<input>`s,
real accessibility, and XP chrome is very CSS-able. **Rejected**: the screen is
a bulged, tilted, perspective-projected quad. An overlay would need a CSS 3D
transform tracking the camera every frame, would not follow the bulge, would
sit *outside* the glass and the scanlines, and would be a rectangle floating in
mid-air whenever you were zoomed out. It would look like a website taped to a
render.

**B — Immediate-mode canvas drawing.** `fillRect` everything, hit-test by
hand. Works, but it means writing the same bevel forty times and maintaining a
parallel list of clickable rectangles that silently drifts from what is drawn.

**C — A tiny retained-mode widget toolkit, drawn to the canvas.** ✅ A widget
tree with a layout pass, a paint pass and a hit-test pass that walks the *same*
tree. Bevels, fonts and metrics live in one `luna.js`. Drawn and clickable can
never disagree, because they are the same structure. Consistent with every
existing rule in the project: no dependencies, no binary assets, everything in
code.

Escape hatch for text entry: summon a real, invisible `<input>` positioned
offscreen and mirror its value into a drawn text field, so IME, autocorrect and
mobile keyboards keep working. Do this only where text is genuinely typed
(Notepad, the Run box, the address bar), not for every field.

### 2.2 The one non-obvious enabler

Turning a mouse position into a coordinate on the screen sounds like the hard
part. It isn't — **`THREE.Raycaster` returns `uv` on the intersection**, so:

```js
const hit = raycaster.intersectObject(screen.mesh)[0];
if (hit) {
  const x = hit.uv.x * screen.width;
  const y = (1 - hit.uv.y) * screen.height;   // canvas y is flipped
}
```

That is correct through the bulge, the tilt, the yaw and the perspective, with
no maths of our own. Everything in §2.1 becomes tractable because of this one
line.

Two consequences:

- **The real cursor must be hidden while zoomed in**, and an XP arrow drawn on
  the tube at that position instead. A macOS cursor floating over a CRT breaks
  the illusion harder than anything else on this page. `canvas { cursor: none }`
  while zoomed.
- **The OS only takes input while zoomed in.** From the wide shot the machine
  is furniture; clicking it should fly you in, not press a button you cannot
  read.

### 2.3 Redraw discipline

Do **not** repaint 800×600 and re-upload the texture every frame. It is
wasteful and it will show up as heat on a laptop. Repaint only when something
changes — a dirty-rectangle list, or at minimum a dirty flag per window. The
cursor moves constantly, so either give the cursor its own tiny composite pass
over a cached background, or accept full repaints only while the pointer is
over the screen. Measure before optimising, but design for it now: retrofitting
dirty rects onto an immediate-mode renderer is miserable.

### 2.4 Conflicts to settle early

Real collisions between the OS and the stage that already exists:

- <kbd>esc</kbd> currently pulls the camera back. Inside the OS it should close
  a menu or dialog first, and only pull back when nothing is open.
- <kbd>t</kbd> opens the tweak panel. It also types a "t" in Notepad. Keyboard
  events must route to the OS when it has focus, and the stage's own shortcuts
  need a modifier or should be disabled while zoomed.
- <kbd>1</kbd>/<kbd>2</kbd> switch scenes and will do so mid-sentence. Same fix.

Decide this once, in the stage, with an explicit "who has keyboard focus" flag.

---

## 3. The boot sequence

We currently strike the raster and go to white. White is a placeholder; the real
sequence is four phases, and it is worth all of them because it is the most
faithfully *felt* moment in the whole piece.

1. **Tube strikes** — already built. The line, the raster opening, the flash.
2. **POST** — black screen, white monospace, left-aligned. Memory count ticking
   up, a detected drive, "Press DEL to enter SETUP". ~1.5s. Make the memory
   count a joke amount.
3. **Splash** — dark background, the machine's name, and the scrolling
   three-block progress marquee that famously indicated nothing at all. ~3s.
4. **Welcome** — the blue-to-orange split screen, "welcome", a user tile with
   Rakshit's name. Click it (or auto-advance after a beat) and it fades to the
   desktop.
5. **Desktop** — wallpaper first, then icons, then the taskbar sliding up, then
   a balloon tip from the tray a couple of seconds later. Staggered. Everything
   arriving at once feels like a web page; things arriving in sequence feels
   like a computer waking up.

The whole thing is ~7 seconds. That is a long time by web standards and exactly
right here — but it must be **skippable on click**, and it should not replay on
every power cycle within a session. Second boot goes straight to the desktop.

**Shutdown closes the loop.** Start → Turn Off Computer → the "It is now safe
to turn off your computer" screen → the raster collapses (already built) → the
camera pulls back to the desk. Which means the Start menu and the physical
power button on the tower do the same thing from two directions. That loop is
worth building early; it is the moment the scene stops being two separate
pieces of work.

---

## 4. What's on the machine

The content plan. This is the part that has to be Rakshit's, and the part I
cannot invent for him — what follows are **proposals and shapes**, and the ones
marked 🔸 need real material.

### 4.1 Desktop

Icons top-left, snapped to a grid, white labels with a hard drop shadow, blue
selection highlight on the label only.

- **My Computer**
- **My Documents** 🔸
- **Internet** — opens the browser
- **Recycle Bin** — the good one, see below
- **Portfolio** 🔸 — the one icon that should do something real
- `resume_FINAL_v7_actually_final.doc` — opens in the word processor, and is
  mostly a real résumé with one increasingly unhinged bullet point
- **Minesweeper**

Wallpaper: **do not reproduce Bliss.** Paint an original rolling-hill-and-sky in
code — a few bezier hills, a vertical sky gradient, procedural cumulus. It reads
instantly without being a copy, and it belongs to the project's "every texture
is drawn in code" rule. A second option worth prototyping: a photo *Rakshit*
took, which is more personal and sidesteps the question entirely.

### 4.2 Start menu

The two-column Luna menu, not the old single column.

**Header** — Rakshit's name and an avatar tile.

**Left, pinned:** Internet · E-mail · Winamp · Notepad · Minesweeper.
**Left, below the separator:** "recently used" — the apps he actually uses 🔸,
which is a small autobiographical detail most people will not consciously read
but will feel.

**Right column:** My Documents · My Recent Documents · My Pictures · My Music ·
My Computer · Control Panel · Help and Support · Search · Run…

**All Programs** with the green arrow and a flyout, opening *upward* the way it
did, with Accessories → Games nesting one level deeper.

**Footer strip**, darker blue: Log Off · Turn Off Computer.

Working items, at minimum: Notepad, Winamp, Minesweeper, My Computer, My
Documents, Run…, Turn Off Computer. Everything else greys out or opens a
stub dialog — and greyed-out is a legitimate finished state here, not a TODO.

**Run…** is a cheap, high-value easter-egg surface. `notepad`, `winamp`,
`mine`, `cmd`, `explorer` work. Typing something rude gets a polite error
dialog. Typing `format c:` gets a very serious-looking confirmation that does
nothing.

### 4.3 Recycle Bin — "random stuff"

The best joke surface on the machine, because a Recycle Bin is *implicitly*
autobiographical: it is the things you decided against. Proposals 🔸:

- `portfolio_v1.psd` — deleted three years ago
- `cover_letter_draft_ANGRY.doc` — openable, and funnier the more restrained it is
- `idea_notes.txt` — a list of abandoned side projects, one of which is this one
- `Screenshot (1247).png`
- `dont_open_this.txt` — opens
- `dissertation_backup_FINAL.zip` — "This file is corrupt."

Behaviours that make it feel alive:

- **Empty Recycle Bin** works, plays the crumple, and empties — but one file
  refuses: "Access is denied." It is still there next time.
- **Restore** puts the item on the desktop, where it stays.
- The bin icon changes between empty and full, and it starts **full**.

### 4.4 My Computer

- **Rakshit (C:)** — a capacity bar that is alarmingly full
- **3½ Floppy (A:)** — "Please insert a disk into drive A:" with the ding
- **CD-RW Drive (D:)** — ties to the actual CD-RW bay modelled on the tower.
  Empty by default; clicking the physical eject button on the model could put
  a disc in. That is a lovely link between the 3D object and the UI, and it is
  the kind of thing worth doing once, well, rather than five of cheaply.
- A disconnected network drive with a red X

### 4.5 The apps

**Notepad** — `readme.txt` as the colophon: what this project is, how it was
built, that every texture is drawn in code. The About box for the whole piece,
hidden in the most boring possible application. Real text editing, real
word-wrap toggle, a File menu where Save says "Access is denied."

**Winamp** ↔ **the iPod**. 🔸 The strongest idea in this document. Winamp on the
PC and the iPod on stage 1 share **one track list**, so switching with
<kbd>1</kbd>/<kbd>2</kbd> shows the same library on two devices twenty years and
one form factor apart. If the iPod's click wheel eventually scrolls that list,
the two scenes stop being neighbours and become one piece of work. Whether
audio actually plays is a separate, later question — the visual link carries it
alone.

**Minesweeper** — genuinely small (a grid, flood fill, a timer, a counter) and
enormously evocative. The bevels are already built by then. Worth doing
properly: right-click flags, the face button, the middle-click chord.

**Internet** — a browser window with a homepage 🔸 that is Rakshit's actual work.
This is where a portfolio piece justifies itself. Do not build a real browser;
build one page that looks like it is in a browser, plus a 404 for everything
else and a very slow loading bar.

**Control Panel** — mostly a grid of icons that open "not available" dialogs,
except **Display → Appearance**, which actually re-themes the OS between Luna
Blue, Olive Green, Silver, and Windows Classic. Cheap if `luna.js` is the one
source of colour, and it is the single best demonstration that the toolkit is
real rather than a picture.

### 4.6 Ambient life

- **Balloon tip** from the tray on first boot. The real "There are unused icons
  on your desktop" is already funny; a personal one is funnier.
- **Clock** in the tray showing the real time, because it should.
- **Screensaver** after ~60s idle while zoomed in: a marquee or a starfield.
  Original implementations, and it should wake on any input.
- **BSOD** as an easter egg — an original blue screen with a joke stop code,
  which then reboots into §3 from POST. Trigger it from something deliberate,
  not something anyone can hit by accident.

---

## 5. What not to copy

The project already takes this line — the iPod has no Apple logo and the PC's
badges say DIMENSION and TRINITEK rather than anything real. Same rule here.

**Fine:** the visual *language* — Luna's colours, bevels, gradients, layout
metrics, Tahoma. That is style, and style is not protected expression.

**Not fine, and each has a good substitute:**

| Don't | Do |
| --- | --- |
| The Bliss wallpaper | An original hill-and-sky painted in code, or Rakshit's own photo |
| The Windows flag on the Start button | An original four-pane mark, or drop the mark and keep "start" |
| Microsoft's icon set | Pixel art drawn in code — see below |
| The XP startup sound | An original chime, synthesised in `audio.js` like everything else |
| The name "Windows" in the UI | Name the machine something of his own |

**On icons:** hand-writing `fillRect` for a 32×32 icon is unbearable. Use a
compact string encoding — one character per pixel, a short palette — so an icon
is a ten-line array that stays readable and diffable. That one helper makes a
whole icon set feasible; without it, icons quietly become the reason the project
stalls.

---

## 6. Build order

Each phase should be independently shippable — the screen should never be
broken in the middle of one.

**Phase 0 — plumbing.** Pointer→UV raycast, hidden real cursor + drawn XP
cursor, the widget toolkit (layout / paint / hit-test), `luna.js`, the icon
encoder, dirty-rect redraw, keyboard focus routing. *Nothing visible ships. Do
it properly anyway — every phase after this is easy or hard depending on it.*

**Phase 1 — it boots.** POST → splash → welcome → desktop. Wallpaper, icons
(select and double-click, no windows yet), taskbar with a clock. **The moment
this works, the piece is already worth showing.**

**Phase 2 — windows.** Chrome, drag, focus and z-order, minimise/maximise/close,
taskbar buttons, the open/close ghost animation. One real app: Notepad with
`readme.txt`.

**Phase 3 — the Start menu, and the shutdown loop.** Menu with the fade,
All Programs flyout, Turn Off Computer → the raster collapse → the camera pulls
back. *This is the phase where the 3D scene and the UI become one thing.*

**Phase 4 — the personal content.** My Computer, Recycle Bin with real
behaviour, My Documents, the résumé, the browser homepage. 🔸 Needs Rakshit's
material.

**Phase 5 — the toys.** Minesweeper, Winamp ↔ iPod, Control Panel theming,
screensaver, balloon tips, BSOD, Run… easter eggs.

Phases 1–3 are the piece. Phases 4–5 are what make it *his*, and 4 is worth
more than 5 — a machine with one real personal file on it beats a machine with
three working games.

---

## 7. Open questions for Rakshit

Answers here change the plan; guesses would make it generic, which is the one
failure mode that matters.

1. **What is actually in My Documents?** Real project folders, or a curated
   joke set? The honest version is better and riskier.
2. **What does Portfolio open?** A real page, a slideshow of work, a link out?
3. **The Winamp track list** — real music he listens to, or period-correct 2003?
4. **What is the machine called?** It appears on the welcome screen, in My
   Computer, and on the Start menu header.
5. **How far does the joke go?** There is a real fork between *warm and
   nostalgic* and *dry and self-deprecating*, and the Recycle Bin contents,
   the résumé and the error messages all have to pick the same one.
6. **Does audio play?** Changes how much Winamp has to be.
7. **Mobile.** Everything above assumes a pointer. A phone has no hover, no
   right-click, no double-click, and the screen would be tiny. Decide now
   whether mobile gets the full OS, a read-only desktop, or a polite "this one
   needs a mouse" — retrofitting touch onto a hover-and-right-click interface
   is a rewrite, not an adjustment.
