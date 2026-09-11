/**
 * player.js — actual audio playback for the music app.
 *
 * A deliberate departure. core/audio.js opens by saying "No audio files, for
 * the same reason there are no image files: everything is a number you can
 * tune", and that holds for the machine's own noises — the fan, the power
 * thunk, the key clicks are all synthesised and always should be. But a music
 * player that plays a synthesised approximation of a song is not a music
 * player. Real files go through here, and core/audio.js stays pure.
 *
 * HTMLAudioElement rather than WebAudio: this needs streaming, seeking and a
 * duration, all of which come free on the element and all of which would have
 * to be rebuilt around an AudioBufferSourceNode. Nothing here needs a graph.
 */

/**
 * @param {(p: object) => void} onChange  Called whenever anything the UI
 *        draws has changed — track, playing state, position, duration.
 */
export function createPlayer(onChange = () => {}) {
  const el = new Audio();
  // metadata, not auto: the duration is wanted immediately for the track list,
  // the 3MB of audio only once somebody presses play.
  el.preload = 'metadata';

  let index = -1;
  let tracks = [];

  const publish = () => onChange(snapshot());

  function snapshot() {
    return {
      index,
      track: tracks[index] || null,
      playing: !el.paused && !el.ended && index >= 0,
      position: el.currentTime || 0,
      duration: Number.isFinite(el.duration) ? el.duration : 0,
    };
  }

  el.addEventListener('play', publish);
  el.addEventListener('pause', publish);
  el.addEventListener('ended', () => { next(); });
  el.addEventListener('loadedmetadata', publish);
  el.addEventListener('timeupdate', publish);
  // A missing or unplayable file should stop the transport, not wedge the UI
  // showing "playing" forever.
  el.addEventListener('error', () => { index = -1; publish(); });

  function load(list) {
    tracks = list;
    publish();
  }

  /**
   * Play a track by index. Selecting the track that is already loaded resumes
   * rather than restarting, which is what every player of the era did.
   *
   * play() returns a promise that rejects if the browser refuses the gesture.
   * Swallowing it is correct here: the UI already reflects the real state via
   * the 'pause' event, and an unhandled rejection in the console helps nobody.
   */
  function play(i = index) {
    if (i < 0 || i >= tracks.length) return;
    if (i !== index) {
      index = i;
      el.src = tracks[i].src;
      el.currentTime = 0;
    }
    el.play().catch(() => {});
    publish();
  }

  function pause() { el.pause(); }

  function toggle() {
    if (index < 0) return play(0);
    if (el.paused) el.play().catch(() => {}); else el.pause();
    publish();
  }

  function stop() {
    el.pause();
    el.currentTime = 0;
    publish();
  }

  function next() { if (tracks.length) play((index + 1) % tracks.length); }

  function prev() {
    // Within the first three seconds, "previous" means the previous track.
    // After that it means the start of this one — the universal convention,
    // and the reason a real transport never feels like it skipped too far.
    if (el.currentTime > 3) { el.currentTime = 0; publish(); return; }
    if (tracks.length) play((index - 1 + tracks.length) % tracks.length);
  }

  /** @param {number} f 0..1 along the track. */
  function seek(f) {
    if (!Number.isFinite(el.duration)) return;
    el.currentTime = Math.max(0, Math.min(1, f)) * el.duration;
    publish();
  }

  function setVolume(v) { el.volume = Math.max(0, Math.min(1, v)); }

  function dispose() {
    el.pause();
    el.removeAttribute('src');
    el.load();
  }

  return { load, play, pause, toggle, stop, next, prev, seek, setVolume, snapshot, dispose };
}

/** "3:34" — the only time format this UI ever shows. */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
