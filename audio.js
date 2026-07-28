/**
 * CYBERPUMP Audio Engine
 * Handles Web Speech API (voice countdown 3, 2, 1) and Web Audio API (start beep tone).
 * Strictly respects global Silent Mode setting.
 */

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.speechSynth = window.speechSynthesis || null;
  }

  // Lazy init AudioContext on user interaction
  initContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Speak a number or short string using Web Speech API
   * @param {string|number} text 
   * @param {boolean} isSilent 
   */
  speakNumber(text, isSilent = false) {
    if (isSilent) return;

    this.initContext();

    if (this.speechSynth) {
      // Cancel previous utterances to avoid speech lag
      this.speechSynth.cancel();
      
      const utterance = new SpeechSynthesisUtterance(String(text));
      utterance.rate = 1.2;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      this.speechSynth.speak(utterance);
    }
  }

  /**
   * Play high-pitch start workout / round beep tone using Web Audio API
   * @param {boolean} isSilent 
   */
  playStartBeep(isSilent = false) {
    if (isSilent) return;

    this.initContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // High pitch A5
      osc.frequency.exponentialRampToValueAtTime(1760, this.audioCtx.currentTime + 0.3); // Sweep up to A6

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.35);
    } catch (err) {
      console.warn('Audio tone play error:', err);
    }
  }

  /**
   * Play short low tick sound for countdown seconds
   * @param {boolean} isSilent 
   */
  playTickSound(isSilent = false) {
    if (isSilent) return;

    this.initContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.audioCtx.currentTime); // A4

      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.1);
    } catch (err) {
      console.warn('Tick sound error:', err);
    }
  }
}

window.audioEngine = new AudioEngine();
