/**
 * Scanner sound feedback using the Web Audio API.
 * Generates a short success beep or a failure buzz for the POS barcode
 * scanner so operators get audible confirmation without looking at the screen.
 */

let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

/**
 * Play a tone with a given frequency/duration/fade.
 * @param {number} frequency
 * @param {number} startAt - seconds into the future (0 = now)
 * @param {number} duration - seconds
 * @param {number} volume - 0..1
 * @param {string} type - oscillator waveform type
 */
function playTone(frequency, startAt = 0, duration = 0.12, volume = 0.08, type = "square") {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  const start = ctx.currentTime + startAt;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

export function beepSuccess() {
  playTone(1318.5, 0, 0.07);
  playTone(1760, 0.09, 0.1);
}

export function beepError() {
  playTone(320, 0, 0.18, 0.1, "sawtooth");
}

export { playTone };