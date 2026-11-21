// Tiny synthesised sounds, all WebAudio, no audio files: a chime for a pocketed relic, a
// low sting when a guard spots the thief, a bright clink for a tossed coin, and a soft tick
// for a guard's footstep. The context is created on the first user gesture, so the page
// stays silent until play begins.
export function createAudio() {
  let context = null;

  function ensure() {
    if (context === null) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
      } catch {
        context = false;
      }
    }
    if (context && context.state === 'suspended') context.resume();
    return context || null;
  }

  function tone(frequency, duration, type, gain, when = 0) {
    const audio = ensure();
    if (audio === null) return;
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, audio.currentTime + when);
    envelope.gain.linearRampToValueAtTime(gain, audio.currentTime + when + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + when + duration);
    oscillator.connect(envelope);
    envelope.connect(audio.destination);
    oscillator.start(audio.currentTime + when);
    oscillator.stop(audio.currentTime + when + duration + 0.05);
  }

  return {
    /** Call once from a user gesture so later sounds are allowed to play. */
    unlock() {
      ensure();
    },
    pickup() {
      tone(660, 0.16, 'sine', 0.12);
      tone(990, 0.22, 'sine', 0.1, 0.07);
    },
    spotted() {
      tone(196, 0.4, 'sawtooth', 0.1);
      tone(147, 0.5, 'sawtooth', 0.09, 0.08);
    },
    coin() {
      tone(1568, 0.12, 'triangle', 0.12);
      tone(2093, 0.1, 'triangle', 0.08, 0.05);
    },
    caught() {
      tone(110, 0.5, 'square', 0.08);
      tone(82, 0.7, 'square', 0.07, 0.12);
    },
    win() {
      tone(523, 0.18, 'sine', 0.11);
      tone(659, 0.18, 'sine', 0.11, 0.12);
      tone(784, 0.3, 'sine', 0.11, 0.24);
    },
  };
}
