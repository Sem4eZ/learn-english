/**
 * LexiFlow Audio Engine
 * Combines Web Speech API for English speech synthesis and
 * Web Audio API for synthetic sound effects without any external audio files.
 */

class AudioController {
  constructor() {
    this.audioCtx = null;
    this.speechSynth = window.speechSynthesis || null;
    this.voices = [];
    this.selectedVoice = null;
    this.rate = 1.0;
    this.soundEffectsEnabled = true;
    this.speechEnabled = true;

    this.initVoices();
  }

  initAudioContext() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  initVoices() {
    if (!this.speechSynth) return;

    const load = () => {
      this.voices = this.speechSynth.getVoices();
      // Prefer high quality English voices (Google US English, Samantha, Daniel, etc.)
      const enVoices = this.voices.filter(v => v.lang.startsWith("en"));
      const naturalEn = enVoices.find(v => 
        (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Siri")) && v.lang.includes("US")
      ) || enVoices.find(v => v.lang.includes("US")) || enVoices[0];

      this.selectedVoice = naturalEn || this.voices[0] || null;
    };

    load();
    if (this.speechSynth.onvoiceschanged !== undefined) {
      this.speechSynth.onvoiceschanged = load;
    }
  }

  getAvailableEnVoices() {
    if (!this.speechSynth) return [];
    return this.speechSynth.getVoices().filter(v => v.lang.startsWith("en"));
  }

  setVoice(voiceURI) {
    const found = this.voices.find(v => v.voiceURI === voiceURI);
    if (found) {
      this.selectedVoice = found;
    }
  }

  setRate(rate) {
    this.rate = Math.max(0.6, Math.min(1.5, rate));
  }

  /**
   * Speak English text
   * @param {string} text - text to speak
   * @param {number} customRate - optional speed override (e.g. 0.8 for slow listening)
   */
  speak(text, customRate = null) {
    if (!this.speechEnabled || !this.speechSynth || !text) return;

    // Cancel current speaking to avoid queue build up
    this.speechSynth.cancel();

    const cleanText = text.trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-US";
    utterance.rate = customRate || this.rate;
    utterance.pitch = 1.0;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    this.speechSynth.speak(utterance);
  }

  /**
   * Synthesize sound effects using Web Audio API oscillators
   */
  playFx(type) {
    if (!this.soundEffectsEnabled) return;
    try {
      this.initAudioContext();
      if (!this.audioCtx) return;

      const t = this.audioCtx.currentTime;

      if (type === "flip") {
        // Soft click
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(350, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.05);

        gain.gain.setValueAtTime(0.08, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.05);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
      } else if (type === "correct") {
        // Cheerful major chord (C5 -> E5 -> G5)
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, t + idx * 0.07);

          gain.gain.setValueAtTime(0.12, t + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.28);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(t + idx * 0.07);
          osc.stop(t + idx * 0.07 + 0.3);
        });
      } else if (type === "wrong") {
        // Low gentle error buzzer
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.linearRampToValueAtTime(120, t + 0.25);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      } else if (type === "combo") {
        // High sparkle chime
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(1320, t + 0.15);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
      } else if (type === "levelup") {
        // Fanfare chord sequence
        const freqs = [440, 554.37, 659.25, 880];
        freqs.forEach((freq, i) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t + i * 0.09);

          gain.gain.setValueAtTime(0.15, t + i * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.4);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(t + i * 0.09);
          osc.stop(t + i * 0.09 + 0.45);
        });
      }
    } catch (e) {
      console.warn("Audio FX could not be synthesized:", e);
    }
  }
}

if (typeof window !== "undefined") {
  window.audioCtrl = new AudioController();
}
