/**
 * CYBERPUMP Audio Engine - Zero-Lag PWA Edition
 * Forces immediate Speech Cancellation & Accelerated Pitch Rate for perfect second sync.
 */

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.speechSynth = window.speechSynthesis || null;
    this.cachedVoice = null;

    this.initVoices();
    this.bindUnlockEvents();
  }

  get NativeTTS() {
    return window.Capacitor?.Plugins?.TextToSpeech || null;
  }

  initVoices() {
    if (!this.speechSynth) return;

    const loadVoices = () => {
      try {
        const voices = this.speechSynth.getVoices() || [];
        if (voices.length > 0) {
          this.cachedVoice = voices.find(v => v.lang && (v.lang.includes('en-US') || v.lang.startsWith('en'))) || voices[0];
        }
      } catch (e) {
        this.cachedVoice = null;
      }
    };

    loadVoices();
    if (typeof this.speechSynth.onvoiceschanged !== 'undefined') {
      this.speechSynth.onvoiceschanged = loadVoices;
    }
  }

  bindUnlockEvents() {
    const unlock = () => {
      this.initContext();
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
    document.addEventListener('touchstart', unlock, { passive: true });
    document.addEventListener('click', unlock, { passive: true });
  }

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
   * Pronuncia frasi (Get ready, Go, Work, Rest, End set)
   */
  async speakPhrase(phrase, isSilent = false) {
    if (isSilent) return;
    this.initContext();

    const text = String(phrase);

    // 📱 1. NATIVO CAPACITOR (Android / iOS)
    if (this.NativeTTS) {
      try {
        await this.NativeTTS.stop();
        await this.NativeTTS.speak({
          text: text,
          lang: 'en-US',
          rate: 1.1,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient'
        });
        return;
      } catch (e) {
        console.warn("Native TTS error:", e);
      }
    }

    // 🌐 2. PWA BROWSER (Svuota la coda per eliminare il ritardo!)
    if (this.speechSynth) {
      try {
        this.speechSynth.cancel(); // 🚀 Taglia subito l'audio precedente
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.2;
        utterance.lang = 'en-US';
        if (this.cachedVoice) utterance.voice = this.cachedVoice;
        this.speechSynth.speak(utterance);
        return;
      } catch (e) {
        console.warn("Web Speech error:", e);
      }
    }

    this.playFallbackTones(phrase);
  }

  /**
   * Pronuncia numeri (3, 2, 1) ultra-veloci (1.6x) e istantanei
   */
  async speakNumber(text, isSilent = false) {
    if (isSilent) return;
    this.initContext();

    const numStr = String(text);

    // 📱 1. NATIVO CAPACITOR
    if (this.NativeTTS) {
      try {
        await this.NativeTTS.stop();
        await this.NativeTTS.speak({
          text: numStr,
          lang: 'en-US',
          rate: 1.4,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient'
        });
        return;
      } catch (e) {
        this.playTickSound(false);
      }
    }

    // 🌐 2. PWA BROWSER (Velocità 1.6x per zero sovrapposizione!)
    if (this.speechSynth) {
      try {
        this.speechSynth.cancel(); // 🚀 Cancella subito il numero precedente
        const utterance = new SpeechSynthesisUtterance(numStr);
        utterance.rate = 1.6; // ⚡ Rapido e secco: dura ~200ms
        utterance.lang = 'en-US';
        if (this.cachedVoice) utterance.voice = this.cachedVoice;
        this.speechSynth.speak(utterance);
        return;
      } catch (e) {
        this.playTickSound(false);
      }
    }

    this.playTickSound(false);
  }

  playStartBeep(isSilent = false) {
    if (isSilent) return;
    this.initContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, this.audioCtx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.3);
    } catch (err) {
      console.warn('Audio tone play error:', err);
    }
  }

  playTickSound(isSilent = false) {
    if (isSilent) return;
    this.initContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.1);
    } catch (err) {
      console.warn('Tick sound error:', err);
    }
  }

  playFallbackTones(phrase) {
    const text = String(phrase).toLowerCase();
    if (text.includes('start') || text.includes('go') || text.includes('work')) {
      this.playStartBeep(false);
    } else if (text.includes('rest')) {
      this.playTickSound(false);
      setTimeout(() => this.playTickSound(false), 180);
    } else {
      this.playTickSound(false);
      setTimeout(() => this.playTickSound(false), 120);
      setTimeout(() => this.playStartBeep(false), 250);
    }
  }

  vibrateFinish() {
    if ('vibrate' in navigator) {
      navigator.vibrate([400, 100, 400]);
    }
  }

  sendRestNotification(title, message) {
    if (!document.hidden) return;

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
      const { LocalNotifications } = window.Capacitor.Plugins;
      LocalNotifications.schedule({
        notifications: [
          {
            title: title || "CYBERPUMP ⚡",
            body: message || "Timer Finished!",
            id: Math.floor(Math.random() * 10000),
            schedule: { at: new Date(Date.now() + 100) },
            channelId: 'cyberpump_banner_channel',
            sound: null,
            actionTypeId: "",
            extra: null
          }
        ]
      });
      return;
    }

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title || "CYBERPUMP ⚡", {
          body: message,
          icon: 'favicon.ico'
        });
      } catch (e) {
        console.warn("Web Notification error:", e);
      }
    }
  }
}

window.audioEngine = new AudioEngine();