# Feedback → to-dos

**Status: the P1 and P2 items below are done.** What each one actually
turned into is noted inline. The remaining open question is how much further to
cut the note, which is a call about Rakshit's own writing rather than a fix.

Three reviewers, 11 Sep. Grouped by what they were actually trying to do, not by
who said it — two of the three biggest items were raised independently by more
than one person, which is the strongest signal in here.

> **tldr from the room:** *"great work! just guide the viewer to the next action
> to explore."* Nobody struggled with the scene. They struggled with knowing
> what to do in it.

---

## P1 — Nobody knows to press the power button

**Raised by:** reviewer 1 ("took a while before i realized i needed to power on
the PC"), Sam ("didn't realize in the beginning").

There IS a callout — it fades in over the power button after 3 seconds
(`HINT_AFTER` in `src/stages/desktop.js`). Two of three people still missed it,
so the question is not whether to add one but why this one does not land.

- [x] **Shorten the delay.** Now 1s. 3s was chosen to avoid talking over the arrival. It
      is too long when the screen is dark and nothing suggests the thing is
      interactive. Try ~1s.
- [x] **Make it louder visually.** Accent fill, heavier type, a tail pointing at the button. Right now it is a small dark pill with one
      pulsing dot, in the same style as the HUD chrome — so it reads as chrome
      and gets filtered out. Consider a brighter fill, an arrow pointing at the
      button, or a soft highlight ring on the button itself.
- [x] **Decided: no auto-boot.** Reviewer 1 suggested powering on by default.
      *Recommendation: do not.* Pressing the button is the best moment in the
      piece — the LED, the fan, the tube striking. Auto-booting spends it before
      anyone is looking. Fix the callout instead.

## P1 — Nobody knows the desktop is clickable

**Raised by:** all three. Reviewer 1 ("I was lost after the notepad — didnt
realize i can click around"), Vivek ("after the initial note, I wished to see
some pointer/helper to guide me to open the next thing"), Sam ("add some
instructions").

This is the single most-repeated note. The desktop looks like a screenshot until
you happen to click something.

- [x] **Added a next-step pointer after the note is closed or read.** Same
      machinery as the power hint — it already projects onto the tube and tracks
      the camera, so pointing it at a desktop icon is a small change.
- [x] **It is Clippy now.** The tooltip was still chrome, and chrome is what
      people filter out. A paperclip in the bottom right corner, on screen from
      the first frame, blinking and changing what it says, is the one piece of
      guidance from this era nobody ever managed to ignore.
      `src/ui/win95/clippy.js`.
- [x] **No delay on the guidance.** Five seconds of nothing was five seconds
      spent losing the people the hint was for. He is there when the desktop is.
- [x] **Sequenced.** Photos → Documents → Music → Internet Explorer, then it stops. Point at one thing at a time (My Photos → My Documents →
      My Music), advancing as each is opened, rather than labelling everything
      at once.
- [ ] **Still open: hover affordance on desktop icons** so the cursor moving over
      one shows it is live before any click happens.

## P2 — The note is too long and ends without a next step

**Raised by:** reviewer 1 ("the notepad could be shorter too — and call out what
the user needs to do next").

Currently 776 characters over four paragraphs. It is the first thing anyone
reads and it ends on "Happy exploring", which is warm but not an instruction.

- [x] **Cut down, and the window with it.** 431px of Notepad for 13 lines of
      text was mostly empty field; the window is 278 now, which is the text
      plus its caret and nothing else.
- [x] **Ends with an action.** "Close this note and click around — every icon here opens something." Something like "Start with My Photos —
      double-click anything on the desktop."
- [x] Checked: 16 wrapped lines, still fits with room. Lives in `NOTE` in `src/ui/win95/notes.js`; the window auto-fits, but
      re-check the wrapped line count after editing.

## P2 — Audio is too loud, and choppy on boot

**Raised by:** reviewer 1 ("felt like the audio is choppy and too loud. maybe
mute by default?"), Sam ("reduce the background noise/machine running sound").

- [x] **Mute control added.** A Sound button in the HUD, starting on. `audio.setEnabled()` exists in
      `src/core/audio.js` and is never called from any file. That is why
      "mute by default" came up — there is no way to turn it off at all.
      Add a sound toggle to the HUD.
- [x] **Default: on.** Muted-by-default is safest for a link someone
      opens at work; the counter-argument is that the fan and the power thunk
      are a real part of the piece. A toggle that starts ON but is visibly
      present is a reasonable middle.
- [x] **Fan turned down.** Hum 0.05 → 0.026, whine 0.35 → 0.18, master 0.9 → 0.7. It settles at gain `0.05` with the bearing whine at
      `0.35` of that. Try halving both.
- [x] **Diagnosed.** `startHum()` fired inside `throwSwitch()`, i.e. during the boot repaint and camera flight. Moved to boot-complete. **Diagnose "choppy" before turning it down.** The hum starts at the same
      moment the boot animation runs and the desktop texture is first painted.
      Suspect main-thread jank starving the audio thread rather than a level
      problem. Check whether delaying `startHum` until after the boot completes
      removes it.

## P3 — Smaller

- [ ] Reviewer 2 specifically liked the Recycle Bin contents. Worth keeping that
      energy — it is the detail people mention unprompted.
