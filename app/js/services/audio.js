/**
 * services/audio.js — WebAudio sound engine (browser only).
 * Chimes are synthesized (no audio assets → tiny footprint, fully offline).
 * Ambient noise is procedurally generated brown noise.
 */

export function createAudio(settings) {
  let ctx = null;
  let noiseNode = null;
  let noiseGain = null;

  const ensureCtx = () => {
    if (!ctx) {
      const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };

  /** Soft envelope helper: attack + exponential decay to near silence. */
  function envelope(gain, t0, peak, attack = 0.01, decay = 1.4) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  return {
    /** Call from any user gesture to unlock audio on iOS/Safari. */
    unlock() { ensureCtx(); },

    /** Three-note completion chime; different flavor for breaks. */
    chime(kind = 'focus') {
      if (!settings.sound) return;
      const ac = ensureCtx();
      if (!ac) return;
      const notes = kind === 'focus' ? [523.25, 659.25, 783.99] : [440, 523.25, 659.25];
      notes.forEach((freq, i) => {
        const t0 = ac.currentTime + i * 0.12;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        envelope(gain, t0, 0.22, 0.015, 1.6);
        osc.connect(gain).connect(ac.destination);
        osc.start(t0);
        osc.stop(t0 + 1.8);
      });
    },

    /** Short confirmation blip for button feedback. */
    blip() {
      if (!settings.sound) return;
      const ac = ensureCtx();
      if (!ac) return;
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, t0);
      envelope(gain, t0, 0.08, 0.005, 0.15);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    },

    /** Start the brown-noise ambient loop (respects settings.ambientVolume). */
    startAmbient() {
      const ac = ensureCtx();
      if (!ac || noiseNode) return;
      const seconds = 2;
      const buffer = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02; // leaky integrator → brown-ish
        data[i] = last * 3.5; // compensation gain
      }
      noiseNode = ac.createBufferSource();
      noiseNode.buffer = buffer;
      noiseNode.loop = true;
      noiseGain = ac.createGain();
      noiseGain.gain.setValueAtTime(settings.ambientVolume * 0.5, ac.currentTime);
      // Gentle low-pass for warmth
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      noiseNode.connect(filter).connect(noiseGain).connect(ac.destination);
      noiseNode.start();
    },

    stopAmbient() {
      try { noiseNode?.stop(); } catch { /* already stopped */ }
      noiseNode?.disconnect();
      noiseGain?.disconnect();
      noiseNode = null;
      noiseGain = null;
    },

    setAmbientVolume(v) {
      if (noiseGain && ctx) {
        noiseGain.gain.setTargetAtTime(v * 0.5, ctx.currentTime, 0.1);
      }
    },

    /** Apply current settings: start/stop ambient as configured. */
    syncAmbient() {
      if (settings.ambient === 'brown' && settings.sound) this.startAmbient();
      else this.stopAmbient();
    },

    isAmbientPlaying: () => !!noiseNode,
  };
}
