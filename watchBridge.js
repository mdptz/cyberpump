/**
 * CYBERPUMP Watch Bridge — MediaSession Smartwatch Integration
 * Handles display metadata & controls on Apple Watch and Wear OS via Phone Media Controls.
 */
class WatchBridge {
  constructor() {
    this.isSupported = 'mediaSession' in navigator;
    if (this.isSupported) {
      this.bindHandlers();
    }
  }

  bindHandlers() {
    navigator.mediaSession.setActionHandler('play', () => {
      if (window.cyberPumpApp?.activeSession && window.cyberPumpApp.isTimerPaused) {
        window.cyberPumpApp.toggleTimerPause();
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      if (window.cyberPumpApp?.activeSession && !window.cyberPumpApp.isTimerPaused) {
        window.cyberPumpApp.toggleTimerPause();
      }
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (window.cyberPumpApp?.activeSession) {
        const session = window.cyberPumpApp.activeSession;
        if (session.inRest || session.intimebasedRestPause) {
          document.getElementById('btn-skip-rest')?.click();
        } else {
          document.getElementById('btn-complete-set')?.click();
        }
      }
    });
  }

  updateFromSession(session) {
    if (!this.isSupported || !session) return;

    try {
      const currentTask = session.queue[session.activeTaskIndex];
      const remainingTasks = session.queue.filter(t => !t.completed);

      let title = currentTask ? currentTask.exerciseName : 'CYBERPUMP';
      let artist = 'Active Workout';
      let album = session.workoutName || 'CYBERPUMP';

      if (session.inRest) {
        artist = `⏸️ REST (${window.cyberPumpApp.timerSecondsLeft}s)`;
      } else if (session.intimebasedTimer) {
        artist = `⚡ WORK (${window.cyberPumpApp.timerSecondsLeft}s)`;
      } else if (currentTask) {
        const weightStr = currentTask.weight ? `@ ${currentTask.weight}kg` : '(BW)';
        artist = `Set ${currentTask.setIndex}/${currentTask.totalSets} • ${currentTask.reps} reps ${weightStr}`;
      }

      const nextTask = remainingTasks.find(t => t.exerciseId !== currentTask?.exerciseId) || remainingTasks[1];
      if (nextTask) {
        album = `Next: ${nextTask.exerciseName}`;
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist,
        album: album
      });
      
      navigator.mediaSession.playbackState = window.cyberPumpApp?.isTimerPaused ? 'paused' : 'playing';
    } catch (err) {
      console.warn('WatchBridge update error:', err);
    }
  }

  clear() {
    if (!this.isSupported) return;
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    } catch (e) {}
  }
}

window.watchBridge = new WatchBridge();