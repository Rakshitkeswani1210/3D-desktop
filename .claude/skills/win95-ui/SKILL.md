---
name: win95-ui
description: Build Windows 95-style interfaces — windows, dialogs, menus, taskbars, buttons and form controls — with the exact bevel system, palette, type scale and metrics from the Windows 95 Design System Figma file, plus 76 authentic 32px Win95 icons and tools to convert more. Use whenever the user asks for a Win95, Windows 95, retro-Windows, 9x, or "old Microsoft" look, or wants to extend an existing Win95-styled screen.
---

# Windows 95 UI

Everything here is measured out of the [Windows 95 Design System (Community)](https://www.figma.com/design/tBdtZJg51bvaPtGzpmpzgG/Windows-95-Design-System--Community-?node-id=312-4259)
Figma file — file key `tBdtZJg51bvaPtGzpmpzgG`. The numbers are not from memory
or from a screenshot; they were pulled node by node. Where the file departs from
the real operating system, that is [called out at the bottom](#where-this-file-departs-from-real-windows-95).

Drop-in stylesheet: [`win95.css`](./win95.css) — every class below is in it.
Live component sheet: [`demo.html`](./demo.html), which exercises every state
in this document; open it when you want to check something visually.
76 real icons in [`icons/`](./icons/) — browse them at [`icons/index.html`](./icons/index.html).
Renders straight from Figma: [`reference/`](./reference/).

---

## 1. The whole system in one idea

Windows 95 has no gradients, no shadows that fall on anything, no rounded
corners, no transitions and no opacity. It has **one grey face colour and a
four-band bevel**. Every control is that face, lit from the top-left, bevelled
either outward or inward. Get the bevel exactly right and everything else
follows; get it wrong and no amount of correct colour will save it.

The bevel is four 1px bands (2px in this file, which is drawn at 2×), running
from the outside in:

```
┌────────────────────────┐
│ ██ outer top-left      │  #f0f0f0  hilight   ← the lit edge
│ ▓▓ inner top-left      │  #b1b1b1  light
│         face  #c3c3c3  │
│ ▒▒ inner bottom-right  │  #7e7e7e  shadow
│ ██ outer bottom-right  │  #262626  dkshadow  ← the cast edge
└────────────────────────┘
```

In CSS this is four `inset` box-shadows on one element. **Order matters** —
earlier shadows paint over later ones, so the outer bands are listed first:

```css
box-shadow:
  inset  2px  2px 0 0 #f0f0f0,   /* outer top-left  */
  inset -2px -2px 0 0 #262626,   /* outer bottom-right */
  inset  4px  4px 0 0 #b1b1b1,   /* inner top-left  */
  inset -4px -4px 0 0 #7e7e7e;   /* inner bottom-right */
```

No borders, no pseudo-elements, no nested divs. One element, one property.

---

## 2. The four bevels

There are exactly four, and using the wrong one is the most common way to make
something look almost-right-but-off.

| Bevel | Class | Outer TL | Inner TL | Inner BR | Outer BR | Use for |
| --- | --- | --- | --- | --- | --- | --- |
| **Raised** | `.w95-raised` | hilight | light | shadow | dkshadow | Buttons at rest, window frames, menus, taskbar tabs, group boxes |
| **Sunken** | `.w95-sunken` | dkshadow | shadow | light | hilight | A button *being pressed*, the active taskbar tab |
| **Field** | `.w95-field` | shadow | dkshadow | light | hilight | Text inputs, checkboxes, list boxes, content areas |
| **Well** | `.w95-well` | shadow | — | — | hilight | Status bar panels, the clock tray (2 bands only) |

### Sunken vs Field — the distinction that matters

They look similar and they are not the same.

- **Sunken** is a raised control flipped corner-for-corner. Its outer top-left
  is the *darkest* value (`#262626`). It reads as *"this button is currently
  held down."*
- **Field** is one step softer: outer top-left is mid grey (`#7e7e7e`), inner is
  black. It reads as *"this is a hole you look into."*

A text input that uses the sunken bevel looks like a stuck button. A pressed
button that uses the field bevel looks mushy. Text inputs, checkboxes, list
boxes and window content wells are **fields**. Only a control under an active
mouse-down is **sunken**.

---

## 3. Palette

These are the file's published variables, plus the four bevel greys (which the
file hardcodes rather than tokenising).

| Token | Hex | Role |
| --- | --- | --- |
| `--w95-face` | `#c3c3c3` | Every chrome surface. Windows, buttons, bars, menus. |
| `--w95-face-lit` | `#e3e3e3` | The active taskbar tab's lighter face. |
| `--w95-white` | `#ffffff` | Content wells, list and input backgrounds. |
| `--w95-black` | `#000000` | All body text. Never a soft grey. |
| `--w95-hilight` | `#f0f0f0` | Bevel, outer top-left. |
| `--w95-light` | `#b1b1b1` | Bevel, inner top-left. |
| `--w95-shadow` | `#7e7e7e` | Bevel, inner bottom-right. |
| `--w95-dkshadow` | `#262626` | Bevel, outer bottom-right. |
| `--w95-titlebar` | `#02007f` | Active title bar. |
| `--w95-titlebar-off` | `#8e8e8e` | Inactive title bar — the fade *is* the focus indicator. |
| `--w95-select` | `#000ea3` | Menu and list selection, white text on top. |
| `--w95-desktop` | `#008282` | The teal. |
| `--w95-disabled` | `#a0a0a0` | Greyed-out text. |

The remaining file variables — `#001cf5`, `#26b50f`, `#eb3323`, `#9c2054` — are
the Minesweeper digit ramp (1 blue, 2 green, 3 red, 5 maroon, 6 teal). Reuse
them as accents if you need colour; do not invent new hues.

---

## 4. Type

The file uses **W95FA**, the pixel-accurate revival of the Win95 system font
(freeware, by Alina Sava). It is what makes the text read as 1995 rather than as
"grey buttons".

```css
font-family: "W95FA", "MS Sans Serif", "Microsoft Sans Serif",
             Tahoma, Geneva, Verdana, sans-serif;
-webkit-font-smoothing: none;   /* pixel fonts must not be antialiased */
```

Put `W95FA.woff2` next to `win95.css` and uncomment the `@font-face` block. The
fallback stack is deliberately Tahoma-first — it is the closest metric match
that ships everywhere.

| Size | Where |
| --- | --- |
| `30px` | Title bars |
| `26px` | Menus, menu bar, buttons, labels, taskbar |
| `24px` | Body text, dialog copy, status bars |
| `20px` | Desktop icon labels |

**Access keys are underlined.** Every menu, button and label in the file
underlines its keyboard letter — <u>F</u>ile, <u>E</u>dit, <u>S</u>hut down.
This is not decoration; skipping it is the fastest way to look like a modern
imitation. Mark it up as `<u>` or `<span class="w95-ak">`, and wire the actual
Alt+key handler if the UI is interactive.

---

## 5. Metrics

The Figma file is drawn at **2×**. `win95.css` ships at that scale because it is
what looks right on a modern display. For authentic 96dpi metrics set
`--w95-b: 1px` and halve every number below.

| Element | Size |
| --- | --- |
| Bevel band | `2px` |
| Window padding (frame to content) | `4px` |
| Title bar height | `42px`, padding `5px 4px 5px 8px` |
| Title bar button | `32px` square, `4px` gap |
| Menu bar | `46px` tall, `16px` inset, `32px` between items |
| Button | `147 × 48`, min-width 147 |
| Small icon button | `32 × 32` |
| Text input | `44px` tall |
| Checkbox / radio | `26px` / `24px` |
| Menu item | `44px` (submenu), `72px` (Start menu top level) |
| Menu icon | `32px` (submenu), `56px` (Start menu) |
| Taskbar | `66px` tall, `8px` padding |
| Start button | `120 × 50` |
| Taskbar program tab | `270 × 50` |
| Status bar | `34px` tall |
| Desktop icon | `122px` wide, `56px` glyph |

---

## 6. Component recipes

### Window

Frame, title bar, menu bar, white content well, status bar — in that order.

```html
<div class="w95 w95-window" style="width: 737px">
  <div class="w95-titlebar">
    <span class="w95-titlebar-title">
      <img src="icons/my-computer.png" width="24" height="24" alt="">
      My Computer
    </span>
    <span class="w95-titlebar-buttons">
      <button class="w95-titlebar-btn" data-glyph="minimize" aria-label="Minimize"></button>
      <button class="w95-titlebar-btn" data-glyph="maximize" aria-label="Maximize"></button>
      <button class="w95-titlebar-btn" data-glyph="close"    aria-label="Close"></button>
    </span>
  </div>

  <nav class="w95-menubar">
    <span><u>F</u>ile</span><span><u>E</u>dit</span>
    <span><u>V</u>iew</span><span><u>H</u>elp</span>
  </nav>

  <div class="w95-content w95-scroll" style="height: 363px"> … </div>

  <div class="w95-statusbar">
    <div class="w95-statusbar-panel" style="flex: 1">4 object(s)</div>
    <div class="w95-statusbar-panel" style="flex: 1"></div>
  </div>
</div>
```

An **inactive** window gets `.is-inactive` on its title bar and nothing else.
The grey title bar is the entire focus affordance — do not dim the frame, do not
add opacity.

### Dialog

A dialog is a window with **no menu bar and no white content well**. Its body
sits directly on the face colour. Icon on the left, copy on the right, buttons
centred at the bottom.

```html
<div class="w95 w95-window" style="width: 740px">
  <div class="w95-titlebar">
    <span class="w95-titlebar-title">Internet Explorer</span>
    <span class="w95-titlebar-buttons">
      <button class="w95-titlebar-btn" data-glyph="close" aria-label="Close"></button>
    </span>
  </div>
  <div class="w95-dialog-body">
    <img src="icons/warning.png" width="56" height="56" alt="Warning">
    <div>
      <p>Internet Explorer 3.0 is not currently your default browser.<br>
         Would you like to make it your default browser?</p>
      <label class="w95-checkbox">
        <input type="checkbox" checked>
        Always perform this check when starting Internet Explorer
      </label>
    </div>
  </div>
  <div class="w95-dialog-actions">
    <button class="w95-btn is-default"><u>Y</u>es</button>
    <button class="w95-btn"><u>N</u>o</button>
  </div>
</div>
```

`.is-default` draws the 2px black ring around the button Enter triggers. Exactly
one per dialog.

### Menu

```html
<div class="w95 w95-menu" style="width: 316px">
  <div class="w95-menu-item is-large is-selected">
    <img class="w95-menu-item-icon" src="icons/programs.png" alt="">
    <span><u>P</u>rograms</span>
    <i class="w95-menu-item-arrow"></i>
  </div>
  <div class="w95-menu-item is-large"> … </div>
  <div class="w95-menu-sep"></div>
  <div class="w95-menu-item is-large"> … </div>
</div>
```

Submenus drop `.is-large`, use 32px icons and 44px rows. Separators are the
two-band groove, never a single hairline.

### Taskbar

```html
<div class="w95 w95-taskbar">
  <div class="w95-taskbar-programs">
    <button class="w95-start-btn">
      <img src="icons/windows.png" width="32" height="32" alt=""> Start
    </button>
    <button class="w95-task-btn is-active">
      <img src="icons/figma.png" width="32" height="32" alt=""> Figma
    </button>
  </div>
  <div class="w95-tray">
    <img src="icons/volume.png" width="32" height="32" alt="Volume"> 10:32AM
  </div>
</div>
```

The taskbar has **only a top highlight**, not a full bevel — a single
`inset 0 2px 0 #f0f0f0`. The clock tray is a two-band well.

---

## 7. State model

There are four states and they are all instant. No transitions, ever.

| State | What changes |
| --- | --- |
| **Hover** | Menu items only — fill `--w95-select`, text to white. Buttons do **not** react to hover. |
| **Active** (mouse down) | Raised → sunken, *and* the label shifts down-right by one band. That 2px shift is what sells the click. |
| **Focus** | `1px dashed #000`, inset by ~2 bands. Nothing else. Never a glow, never a colour. |
| **Disabled** | Text to `#a0a0a0` with a `1px 1px #f0f0f0` text-shadow — the embossed grey. The bevel stays raised. |

---

## 8. Rules that make or break it

**Never:**
- round a corner (`border-radius: 0` everywhere except the radio dot)
- blur a shadow, or cast a drop shadow behind a window
- animate or transition anything
- use a grey text colour for enabled text — it is `#000`
- antialias the pixel font, or smooth a bitmap icon
- hand-draw an icon as an SVG path when a real 16/32/56px bitmap exists
- use a modern focus ring, a hover lift, or a colour other than those in §3

**Always:**
- `image-rendering: pixelated` on every icon
- underline the access key
- give one dialog exactly one `.is-default` button
- put the label shift in the `:active` state
- keep text left-aligned and buttons centred in dialogs

---

## 9. Accessibility

The retro look does not excuse an inaccessible page, and most of it is free:

- The dashed focus ring is real and visible — keep `:focus-visible` working, and
  never set `outline: none` without replacing it.
- `#000` on `#c3c3c3` is 10.4:1; white on `#02007f` is 15.9:1; white on
  `#000ea3` is 14.6:1. All comfortably AAA.
- Disabled `#a0a0a0` on `#c3c3c3` is **1.5:1** and fails badly. That is
  authentic, and it is fine for genuinely disabled controls (which are exempt
  from WCAG contrast) — but never use that grey for text a user must read.
- Use real `<button>`, `<input>` and `<nav>` elements as shown, so the controls
  keep their semantics. Style the native control; do not rebuild it from divs.
- The title-bar buttons are icon-only — they need `aria-label`.
- The 2× scale is a genuine accessibility win: 24px body text at default zoom.
  If you drop to `--w95-b: 1px`, you also halve the type, so do it only for a
  deliberately tiny "authentic" mode.

---

## 10. Icons

Icons are the one thing you cannot fake. The bevel is 30 lines of CSS; the icons
are hand-pixelled 32×32 bitmaps, and a modern flat-vector substitute wrecks the
illusion instantly. 76 real ones ship with this skill.

### What is here

| Set | Count | Where | Source |
| --- | --- | --- | --- |
| Windows 95 shell icons | 72 | `icons/png/*.png` | [trapd00r/win95-winxp_icons](https://github.com/trapd00r/win95-winxp_icons) |
| Message-box icons | 4 | `icons/dialog/*.png` | [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Windows_95_icons) |
| Unconverted originals | 72 | `icons/ico/*.ico` | as downloaded |

All PNGs are 32×32 RGBA with a real alpha channel. Browse the whole set with
labels at [`icons/index.html`](./icons/index.html); the machine-readable index,
including each icon's original filename, is [`icons/icons.json`](./icons/icons.json).

### Two things to know about the sources

**The GitHub set ships numbered, not named.** Of its 1,191 icons only 72 are
actually Windows 95 (the rest are 98 / 2000 / XP), and those 72 arrive as
`w95_1.ico` … `w95_72.ico` with no semantic names at all. The names in
`icons/png/` are **visual identification** — I converted all 72, laid them out
and labelled what each depicts. A handful are genuinely ambiguous (`server`,
`computer-shared`, `desk-lamp`, `tree`); trust the picture over the name, which
is what the index page is for. `icons.json` records the original number for
every one, so nothing is lost.

**The Commons files are 500px blow-ups.** They are authentic pixel art, stored
nearest-neighbour-upscaled from 32×32. Downscaling those with a normal resampler
smears them, so `tools/pngshrink.py` samples the centre of each source block and
recovers the original grid exactly. That is how the four message-box icons here
were made.

### Pulling more icons

The GitHub repo has 1,119 more from Windows 98 / 2000 / XP, semantically named
(`w98_recycle_bin_empty.ico`, `w2k_my_computer.ico`). They are a later visual
generation — 98 mixes acceptably with 95, 2000 and XP do not. If you need one:

```bash
curl -sL -o /tmp/x.ico https://raw.githubusercontent.com/trapd00r/win95-winxp_icons/master/icons/w98_clock.ico
python3 tools/ico2png.py /tmp/x.ico icons/png --size 32
```

**Use `tools/ico2png.py`, not `sips`.** macOS `sips` mishandles the 1-bit AND
mask in classic 4bpp icons and silently returns a near-transparent image — it
looks like a faded ghost rather than an error. The bundled decoder is pure
stdlib and handles 1/4/8/24/32-bpp plus PNG-in-ICO.

### Using them

```css
img { image-rendering: pixelated; }   /* non-negotiable */
```

- **Sizes are 16, 32 and 56** — the file uses 32px in menus and taskbars, 56px
  in Start-menu rows, dialog icons and on the desktop. Always set both `width`
  and `height`; never leave one `auto`.
- **Scale by whole numbers only.** 32 → 64 → 96. A 32px bitmap at 40px is a
  smeared mess even with `pixelated`.
- **Never recolour, rotate or add effects.** These have baked-in highlights and
  a fixed light source (top-left, same as the bevel).
- **Do not substitute a vector icon set.** Feather, Lucide and friends read as
  2015, not 1995. If the exact icon you want is missing, pick the nearest real
  one rather than drawing a new one.

### Licensing — the honest version

The Commons files are tagged **public domain**: US copyright law does not
protect works below the threshold of originality, and low-resolution pixel art
of simple shapes generally falls under it. The Windows flag additionally carries
a **trademark** restriction, so it is fine as period UI decoration and not fine
as a logo for anything you ship.

The GitHub repo declares **no licence at all**. These are Microsoft system
assets extracted from shipped DLLs, and no one has granted rights to them. In
practice they are used constantly in nostalgia projects, emulators and personal
sites without incident, and that is almost certainly fine for a portfolio piece.
It is genuinely not fine for anything commercial, anything trading on Microsoft
branding, or anything you would need to defend. That is the real state of it —
your call, but make it knowingly.

---

## 11. Using it in this repo

The project is vanilla ES modules with no build step, so:

```html
<link rel="stylesheet" href=".claude/skills/win95-ui/win95.css">
```

…or copy `win95.css` into `src/` and import it however the page you are building
does. There is no npm dependency and no preprocessor.

**If you are drawing this onto the CRT in the 3D desktop scene** (`src/objects/desktop/`,
textures in `src/theme/desk-textures.js`), the CSS does not apply — you are
painting to a `<canvas>`. Port the bevel as four `fillRect` calls in the same
outer-to-inner order, and set `ctx.imageSmoothingEnabled = false`. The palette,
metrics and type scale above transfer unchanged.

> **Note on `INTERFACE-PLAN.md`:** that document specifies **Windows XP / Luna**
> (`#ECE9D8` faces, gradient title bars, the green Start button) for the CRT
> screen. This skill is **Windows 95** — a different, older visual language.
> They share the bevel concept and nothing else. Pick one per surface; mixing a
> Luna title bar with a 95 button reads as broken rather than retro.

---

## Where this file departs from real Windows 95

Worth knowing so you can decide whether to follow the file or the OS:

| | This Figma file | Real Windows 95 |
| --- | --- | --- |
| Face | `#c3c3c3` | `#c0c0c0` |
| Bevel outer TL | `#f0f0f0` | `#ffffff` |
| Bevel inner TL | `#b1b1b1` | `#dfdfdf` — noticeably lighter |
| Bevel outer BR | `#262626` | `#000000` |
| Title bar | Flat `#02007f` | Flat `#000080` (the gradient is a Plus!/98 thing) |
| Desktop | `#008282` | `#008080` |
| Start menu | No banner | Vertical "Windows 95" banner down the left edge |
| Scale | 2× throughout | 1× at 96dpi |

The inner top-left band is the real divergence: at `#b1b1b1` the bevel is
flatter and greyer than the OS, which used a bright `#dfdfdf`. If you want more
pop, override `--w95-light: #dfdfdf` — the rest of the system is unaffected.

---

## Source node map

For going back to Figma to check something:

| Component | Node |
| --- | --- |
| Screens section ("UI for desktop") | `312:4259` |
| Desktop | `70:119` |
| Start menu + submenus | `70:78` |
| My Computer window | `73:8150` |
| Shut Down dialog | `81:10983` |
| Internet Explorer dialog | `75:7766` |
| Taskbar ("Bottom Bar") | `70:26` |
| Menu bar ("Panel Menu") | `73:8155` |
| Start menu item | `70:88` |
| Radio | `81:10991` |
| Raised surface primitive ("Material-Out") | `8:3` |
| Minesweeper | `79:7796` |
| Calculator | `70:38` |

Icons are bitmaps in the Figma file, and its set is smaller than the one in
[`icons/`](./icons/) — reach for the bundled icons first. If you do need one
straight from Figma, export it at 1× from the node rather than redrawing it:
`get_design_context` returns asset URLs valid for ~7 days, so download and
commit the bytes rather than hotlinking.
