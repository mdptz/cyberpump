/**
 * CYBERPUMP Storage & Data Management Module
 * Uses browser localStorage for complete offline capability.
 */

const STORAGE_KEYS = {
  WORKOUTS: 'cyberpump_workouts_v1',
  LOGS: 'cyberpump_logs_v1',
  SETTINGS: 'cyberpump_settings_v1',
  ACTIVE_SESSION: 'cyberpump_active_session_v1'
};

const DEFAULT_WORKOUTS = [
  {
    id: 'workout_timebased_burn',
    name: '(SAMPLE) ⚡ Cyber Burn (HIIT)',
    description: 'Every Minute On the Minute interval training for maximum conditioning.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exercises: [
      {
        id: 'ex_timebased_1',
        name: 'Kettlebell Swings',
        type: 'timebased',
        sets: 10,
        reps: 15,
        restSeconds: 0,
        weight: 20,
        timebasedIntervalSeconds: 60, // 1 minute per round
        timebasedTotalRounds: 10
      },
      {
        id: 'ex_timebased_2',
        name: 'Burpees Blitz',
        type: 'timebased',
        sets: 5,
        reps: 10,
        restSeconds: 0,
        weight: null,
        timebasedIntervalSeconds: 45, // 45 sec interval
        timebasedTotalRounds: 5
      }
    ]
  },
  {
    id: 'workout_circuit_mode',
    name: '(SAMPLE) 🔄 Full Body Circuit',
    description: 'Cyclic circuit workout executing exercises sequentially across 3 rounds.',
    mode: 'circuit',
    circuitCycles: 3,
    circuitRestSeconds: 90,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    exercises: [
      {
        id: 'ex_circ_1',
        name: 'Goblet Squat',
        type: 'standard',
        sets: 1,
        reps: 12,
        restSeconds: 15,
        weight: 16,
        timebasedIntervalSeconds: 60,
        timebasedTotalRounds: 1
      },
      {
        id: 'ex_circ_2',
        name: 'Plank timebased',
        type: 'timebased',
        sets: 1,
        reps: 1,
        restSeconds: 15,
        weight: null,
        timebasedIntervalSeconds: 45,
        timebasedTotalRounds: 1
      },
      {
        id: 'ex_circ_3',
        name: 'Push-ups',
        type: 'standard',
        sets: 1,
        reps: 15,
        restSeconds: 15,
        weight: null,
        timebasedIntervalSeconds: 60,
        timebasedTotalRounds: 1
      }
    ]
  }
];

const DEFAULT_SETTINGS = {
  silentMode: false,
  countdownVoice: true,
  startBeep: true,
  keepScreenAwake: true,
  isPremium: false // 👑 Freemium Status Flag
};

class StorageManager {
  constructor() {
    this.initDefaults();
  }

  initDefaults() {
    if (!localStorage.getItem(STORAGE_KEYS.WORKOUTS)) {
      this.saveWorkouts(DEFAULT_WORKOUTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      this.saveSettings(DEFAULT_SETTINGS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.LOGS)) {
      this.saveLogs([]);
    }
  }

  // Workouts CRUD
  getWorkouts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.WORKOUTS)) || [];
    } catch (e) {
      return [];
    }
  }

  getWorkoutById(id) {
    const workouts = this.getWorkouts();
    return workouts.find(w => w.id === id) || null;
  }

  saveWorkouts(workouts) {
    localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
  }

  saveWorkout(workout) {
    const workouts = this.getWorkouts();
    const index = workouts.findIndex(w => w.id === workout.id);
    workout.updatedAt = new Date().toISOString();
    
    if (index >= 0) {
      workouts[index] = workout;
    } else {
      workouts.push(workout);
    }
    this.saveWorkouts(workouts);
  }

  deleteWorkout(id) {
    let workouts = this.getWorkouts();
    workouts = workouts.filter(w => w.id !== id);
    this.saveWorkouts(workouts);
  }

  cloneWorkout(id) {
    const workout = this.getWorkoutById(id);
    if (!workout) return null;

    const cloned = JSON.parse(JSON.stringify(workout));
    cloned.id = 'workout_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    cloned.name = `${workout.name} (Copy)`;
    cloned.createdAt = new Date().toISOString();
    cloned.updatedAt = new Date().toISOString();
    
    // Refresh exercise IDs
    cloned.exercises = cloned.exercises.map((ex, idx) => ({
      ...ex,
      id: `ex_clone_${Date.now()}_${idx}`
    }));

    this.saveWorkout(cloned);
    return cloned;
  }

  /**
   * Update weight for a specific exercise inside a workout template
   * (Req 5 & 12 requirement: modifying weight during execution updates workout configuration as well)
   */
  updateWorkoutExerciseWeight(workoutId, exerciseId, newWeight) {
    const workout = this.getWorkoutById(workoutId);
    if (!workout) return;

    const exercise = workout.exercises.find(e => e.id === exerciseId);
    if (exercise) {
      exercise.weight = (newWeight === '' || newWeight === null || isNaN(newWeight)) ? null : parseFloat(newWeight);
      this.saveWorkout(workout);
    }
  }

  // Workout Logs CRUD (Diary Req 17)
  getLogs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS)) || [];
    } catch (e) {
      return [];
    }
  }

  saveLogs(logs) {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  }

  addLog(logEntry) {
    const logs = this.getLogs();
    logs.unshift(logEntry); // Most recent first
    this.saveLogs(logs);
  }

  deleteLog(logId) {
    let logs = this.getLogs();
    logs = logs.filter(l => l.id !== logId);
    this.saveLogs(logs);
  }

  // Settings Management (Req 20)
  getSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS));
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  updateSetting(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    this.saveSettings(settings);
  }

  // 👑 Freemium Status Helpers
  isPremiumUser() {
    return !!this.getSettings().isPremium;
  }

  unlockPremium() {
    this.updateSetting('isPremium', true);
  }

  lockPremium() {
    this.updateSetting('isPremium', false);
  }

  togglePremiumDev() {
    const currentState = this.isPremiumUser();
    this.updateSetting('isPremium', !currentState);
    return !currentState;
  }

  // Active Session Persistence (Resiliency against refresh)
  getActiveSession() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION));
    } catch (e) {
      return null;
    }
  }

  saveActiveSession(sessionState) {
    if (!sessionState) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    } else {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(sessionState));
    }
  }
}

window.storageManager = new StorageManager();