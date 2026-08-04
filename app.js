/**
 * CYBERPUMP Main Smartphone Application Logic
 * Integrates state, views, tabular editor, active workout player, rest voice timer, sharing, and Freemium/IAP logic.
 * Designed for Capacitor (Android & iOS) and Web PWA.
 */

// FREEMIUM CONFIGURATION LIMITS
const FREEMIUM_LIMITS = {
  MAX_WORKOUTS: 3,
  MAX_EXERCISES_PER_WORKOUT: 6
};

class CyberPumpApp {
  constructor() {
    this.currentView = 'workouts';
    this.editingWorkout = null; // Workout object being edited in tabular config
    
    // Active Workout State
    this.activeSession = null;
    this.timerInterval = null;
    this.timerSecondsLeft = 0;
    this.timerTotalSeconds = 0;
    this.isTimerPaused = false;
    this.wakeLock = null;

    this.initUI();
    this.bindEvents();
    this.restoreOrRenderView();
  }

  initUI() {
    this.requestAppPermissions();

    this.mainContent = document.getElementById('main-content');
    this.bottomNavItems = document.querySelectorAll('.nav-item');
    this.activeBadge = document.getElementById('active-badge');
    this.silentIcon = document.getElementById('silent-icon');
    this.quickSilentBtn = document.getElementById('quick-silent-toggle');
    this.modalOverlay = document.getElementById('modal-overlay');
    this.modalBody = document.getElementById('modal-body');
    this.modalClose = document.getElementById('modal-close');

    this.updateSilentModeIcon();
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock error:', err);
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
  }

  async requestAppPermissions() {
    try {
      const triggerCapacitorPermission = async () => {
        const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications || window.CapacitorCustomPlugins?.LocalNotifications;

        if (LocalNotifications) {
          await LocalNotifications.createChannel({
            id: 'cyberpump_banner_channel',
            name: 'Timer Banner Alerts',
            description: 'CYBERPUMP Rest Timer Banner',
            importance: 4,
            visibility: 1,
            sound: null,
            vibration: false
          });

          let perm = await LocalNotifications.checkPermissions();
          if (perm.display !== 'granted') {
            await LocalNotifications.requestPermissions();
          }
        }
      };

      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        setTimeout(triggerCapacitorPermission, 300);
      } else if (window.Capacitor?.Plugins?.LocalNotifications) {
        await triggerCapacitorPermission();
      } else if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch (err) {
      console.warn("Permission request error:", err);
    }
  }

  bindEvents() {
    this.bottomNavItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const view = e.currentTarget.getAttribute('data-view');
        this.switchView(view);
      });
    });

    this.quickSilentBtn.addEventListener('click', () => {
      const settings = window.storageManager.getSettings();
      const newSilentState = !settings.silentMode;
      window.storageManager.updateSetting('silentMode', newSilentState);
      this.updateSilentModeIcon();
      this.showToast(newSilentState ? 'Muted: Silent Mode ON' : 'Audio ON: Voice & Beep Active');
    });

    this.modalClose.addEventListener('click', () => this.closeModal());
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) this.closeModal();
    });

    window.addEventListener('beforeunload', () => {
      if (this.activeSession) {
        window.storageManager.saveActiveSession(this.activeSession);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.activeSession && this.timerTargetEndTime && !this.isTimerPaused) {
        this.updateTimerFromTimestamp();
        this.requestWakeLock();
      }
    });
  }

  updateSilentModeIcon() {
    const settings = window.storageManager.getSettings();
    if (settings.silentMode) {
      this.silentIcon.textContent = '??';
      this.quickSilentBtn.classList.add('active');
    } else {
      this.silentIcon.textContent = '??';
      this.quickSilentBtn.classList.remove('active');
    }
  }

  switchView(viewName, params = {}) {
    this.currentView = viewName;

    this.bottomNavItems.forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    if (this.activeSession) {
      this.activeBadge.classList.remove('hidden');
    } else {
      this.activeBadge.classList.add('hidden');
    }

    switch (viewName) {
      case 'workouts':
        this.renderWorkoutsView();
        break;
      case 'tabular-editor':
        this.renderTabularEditorView(params.workoutId);
        break;
      case 'active-workout':
        this.renderActiveWorkoutView();
        break;
      case 'diary':
        this.renderDiaryView();
        break;
      case 'share':
        this.renderShareImportView();
        break;
      case 'settings':
        this.renderSettingsView();
        break;
      default:
        this.renderWorkoutsView();
    }
  }

  restoreOrRenderView() {
    const restored = window.storageManager.getActiveSession();
    if (restored) {
      this.activeSession = restored;
    }
    this.switchView('workouts');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  openModal(htmlContent) {
    this.modalBody.innerHTML = htmlContent;
    this.modalOverlay.classList.remove('hidden');
  }

  closeModal() {
    this.modalOverlay.classList.add('hidden');
    this.modalBody.innerHTML = '';
  }

  showPaywallModal(reasonMessage = '') {
    const modalHtml = `
      <div style="text-align: center; padding: 12px 4px;">
        <span style="font-size: 54px; filter: drop-shadow(0 0 10px var(--fluo-cyan));">??</span>
        <h2 style="font-family: var(--font-header); color: var(--fluo-cyan); font-size: 22px; margin: 8px 0 4px 0;">CYBERPUMP PREMIUM</h2>
        
        <p style="color: var(--fluo-orange); font-size: 13px; font-weight: 600; margin-bottom: 16px;">
          ${this.escapeHtml(reasonMessage || 'Unlock the full power of your training!')}
        </p>

        <div class="card" style="text-align: left; background: rgba(0, 240, 255, 0.05); border-color: var(--fluo-cyan); margin-bottom: 20px;">
          <ul style="font-size: 13px; color: #fff; padding-left: 20px; display: flex; flex-direction: column; gap: 10px;">
            <li>? <strong>Unlimited Workouts</strong> (Free limit: 3)</li>
            <li>? <strong>Unlimited Exercises per Routine</strong> (Free limit: 6)</li>
            <li>? <strong>Unlimited Import & Cloning</strong></li>
            <li>? <strong>Lifetime Access (No Subscriptions)</strong></li>
          </ul>
        </div>

        <button id="btn-buy-premium-modal" class="btn btn-primary btn-block" style="padding: 16px; font-size: 15px; margin-bottom: 10px;">
          ?? Unlock Unlimited
        </button>
        <button id="btn-restore-paywall" class="btn btn-secondary btn-block btn-sm" style="margin-bottom: 8px;">
          ?? Restore Purchases
        </button>
        <button id="btn-cancel-paywall" class="btn btn-secondary btn-block btn-sm">
          Continue with Free Version
        </button>
      </div>
    `;

    this.openModal(modalHtml);

    document.getElementById('btn-buy-premium-modal')?.addEventListener('click', () => {
      if (window.iapManager && window.iapManager.initialized) {
        window.iapManager.buyPremium();
      } else {
        this.triggerMockPurchase();
      }
    });

    document.getElementById('btn-restore-paywall')?.addEventListener('click', () => {
      if (window.iapManager && window.iapManager.initialized) {
        window.iapManager.restorePurchases();
      } else {
        this.showToast('IAP Manager not initialized or running in browser mode', 'warning');
      }
    });

    document.getElementById('btn-cancel-paywall')?.addEventListener('click', () => {
      this.closeModal();
    });
  }

  triggerMockPurchase() {
    this.showToast('? Connecting to Store...');
    setTimeout(() => {
      window.storageManager.unlockPremium();
      this.closeModal();
      this.showToast('?? CYBERPUMP Premium Unlocked (Web Test)!');
      this.switchView(this.currentView);
    }, 1200);
  }

  renderWorkoutsView() {
    const workouts = window.storageManager.getWorkouts();
    const isPremium = window.storageManager.isPremiumUser();

    let html = `
      <div class="view-header">
        <div>
          <h1 class="view-title">??? My Workouts</h1>
          <span style="font-size: 11px; color: ${isPremium ? 'var(--fluo-cyan)' : 'var(--text-muted)'}; font-weight: 600;">
            ${isPremium ? '?? PREMIUM USER (Unlimited)' : `FREE PLAN (${workouts.length}/${FREEMIUM_LIMITS.MAX_WORKOUTS} Workouts Used)`}
          </span>
        </div>
        <button id="btn-create-workout" class="btn btn-primary btn-sm">+ New Workout</button>
      </div>
    `;

    if (workouts.length === 0) {
      html += `
        <div class="card" style="text-align: center; padding: 40px 20px;">
          <p style="color: var(--text-muted); margin-bottom: 16px;">No saved workouts found.</p>
          <button id="btn-create-workout-empty" class="btn btn-primary">Create Your First Workout</button>
        </div>
      `;
    } else {
      workouts.forEach(w => {
        const totalSets = w.exercises.reduce((sum, ex) => sum + (parseInt(ex.sets) || 1), 0);
        const timebasedCount = w.exercises.filter(ex => ex.type === 'timebased').length;
        const isCircuit = w.mode === 'circuit';

        html += `
          <div class="card" style="margin-bottom: 12px; ${isCircuit ? 'border-color: var(--fluo-cyan); box-shadow: 0 0 15px rgba(0, 240, 255, 0.15);' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <div>
                <h3 style="font-family: var(--font-header); font-size: 18px; color: #fff;">${this.escapeHtml(w.name)}</h3>
                <p style="font-size: 12px; color: var(--text-muted);">${this.escapeHtml(w.description || 'Custom routine')}</p>
              </div>
              <span class="exercise-badge" style="${isCircuit ? 'background: rgba(0, 240, 255, 0.2); color: var(--fluo-cyan); border: 1px solid var(--fluo-cyan);' : ''}">
                ${isCircuit ? `?? CIRCUIT (${w.circuitCycles || 3} Cycles)` : `${w.exercises.length} Exercises (${totalSets} Sets)`}
              </span>
            </div>

            <div style="display: flex; gap: 8px; font-size: 11px; color: var(--text-dim); margin-bottom: 12px;">
              ${isCircuit ? `<span style="color: var(--fluo-cyan);">?? ${w.exercises.length} Exercises per Cycle • Rest: ${w.circuitRestSeconds || 90}s</span>` : ''}
              ${timebasedCount > 0 ? `<span style="color: var(--fluo-magenta);">? ${timebasedCount} Time-Based</span>` : ''}
              ${!isCircuit ? `<span>?? Rest configured per exercise</span>` : ''}
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-success btn-sm btn-start-workout" data-id="${w.id}">?? Start</button>
              <button class="btn btn-secondary btn-sm btn-edit-workout" data-id="${w.id}">?? Config</button>
              <button class="btn btn-secondary btn-sm btn-clone-workout" data-id="${w.id}">?? Clone</button>
              <button class="btn btn-secondary btn-sm btn-share-workout" data-id="${w.id}">?? Share</button>
              <button class="btn btn-secondary btn-sm btn-delete-workout" data-id="${w.id}" style="color: var(--fluo-magenta); border-color: rgba(255,0,127,0.3);">???</button>
            </div>
          </div>
        `;
      });
    }

    this.mainContent.innerHTML = html;

    const handleCreateClick = () => {
      const isUserPremium = window.storageManager.isPremiumUser();
      const currentCount = window.storageManager.getWorkouts().length;

      if (!isUserPremium && currentCount >= FREEMIUM_LIMITS.MAX_WORKOUTS) {
        this.showPaywallModal(`Free plan limit reached (${FREEMIUM_LIMITS.MAX_WORKOUTS} Workouts Max). Upgrade to Premium to create unlimited workouts!`);
        return;
      }
      this.switchView('tabular-editor', { workoutId: null });
    };

    const newBtn = document.getElementById('btn-create-workout') || document.getElementById('btn-create-workout-empty');
    if (newBtn) {
      newBtn.addEventListener('click', handleCreateClick);
    }

    document.querySelectorAll('.btn-start-workout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.startWorkoutSession(id);
      });
    });

    document.querySelectorAll('.btn-edit-workout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.switchView('tabular-editor', { workoutId: id });
      });
    });

    document.querySelectorAll('.btn-clone-workout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const isUserPremium = window.storageManager.isPremiumUser();
        const currentCount = window.storageManager.getWorkouts().length;

        if (!isUserPremium && currentCount >= FREEMIUM_LIMITS.MAX_WORKOUTS) {
          this.showPaywallModal(`Cannot clone: Free plan limit reached (${FREEMIUM_LIMITS.MAX_WORKOUTS} Workouts Max). Unlock Premium for unlimited cloning!`);
          return;
        }

        const id = e.currentTarget.getAttribute('data-id');
        const cloned = window.storageManager.cloneWorkout(id);
        if (cloned) {
          this.showToast(`Cloned workout as "${cloned.name}"`);
          this.renderWorkoutsView();
        }
      });
    });

    document.querySelectorAll('.btn-share-workout').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const res = await window.exportImportManager.shareWorkouts([id]);
        if (res.success) {
          this.showToast(res.method === 'clipboard' ? 'Export string copied to clipboard!' : 'Workout shared!');
        }
      });
    });

    document.querySelectorAll('.btn-delete-workout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this workout?')) {
          window.storageManager.deleteWorkout(id);
          this.showToast('Workout deleted');
          this.renderWorkoutsView();
        }
      });
    });
  }

  renderTabularEditorView(workoutId) {
    let workout = workoutId ? window.storageManager.getWorkoutById(workoutId) : null;
    
    if (!workout) {
      workout = {
        id: 'workout_' + Date.now(),
        name: 'New Custom Workout',
        description: '',
        mode: 'standard',
        circuitCycles: 3,
        circuitRestSeconds: 90,
        createdAt: new Date().toISOString(),
        exercises: [
          {
            id: 'ex_' + Date.now(),
            name: 'Bench Press',
            type: 'standard',
            sets: 3,
            reps: 10,
            restSeconds: 60,
            weight: 50,
            timebasedIntervalSeconds: 60,
            timebasedTotalRounds: 5
          }
        ]
      };
    }

    this.editingWorkout = JSON.parse(JSON.stringify(workout));
    const isPremium = window.storageManager.isPremiumUser();

    let html = `
      <div class="view-header">
        <div>
          <h1 class="view-title">?? Configure Workout</h1>
          <span style="font-size: 11px; color: ${isPremium ? 'var(--fluo-cyan)' : 'var(--text-muted)'}; font-weight: 600;">
            ${isPremium ? '?? PREMIUM (Unlimited Exercises)' : `FREE PLAN (${this.editingWorkout.exercises.length}/${FREEMIUM_LIMITS.MAX_EXERCISES_PER_WORKOUT} Exercises Max)`}
          </span>
        </div>
        <button id="btn-save-tabular" class="btn btn-primary btn-sm">?? Save Workout</button>
      </div>

      <div class="card" style="margin-bottom: 12px;">
        <div class="form-group">
          <label class="form-label">Workout Title</label>
          <input type="text" id="edit-workout-name" class="form-input" value="${this.escapeHtml(this.editingWorkout.name)}" placeholder="Workout Name (e.g. Legs & Core)">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Description (Optional)</label>
          <input type="text" id="edit-workout-desc" class="form-input" value="${this.escapeHtml(this.editingWorkout.description || '')}" placeholder="Short notes or focus area">
        </div>
      </div>

      <div class="card" style="margin-bottom: 12px; border-color: var(--fluo-cyan);">
        <div class="form-group" style="margin-bottom: 8px;">
          <label class="form-label" style="color: var(--fluo-cyan); font-weight: 700;">Workout Execution Mode</label>
          <select id="edit-workout-mode" class="form-input" style="background: rgba(0, 240, 255, 0.05); color: #fff; border-color: var(--fluo-cyan);">
            <option value="standard" ${this.editingWorkout.mode !== 'circuit' ? 'selected' : ''}>?? Standard Mode (All Sets per Exercise sequentially)</option>
            <option value="circuit" ${this.editingWorkout.mode === 'circuit' ? 'selected' : ''}>?? Cyclic / Circuit Mode (1 Set per Exercise sequentially across N Cycles)</option>
          </select>
        </div>

        <div id="circuit-config-box" style="display: ${this.editingWorkout.mode === 'circuit' ? 'flex' : 'none'}; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(0, 240, 255, 0.2);">
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label class="form-label">Circuit Cycles (N Repetitions)</label>
            <input type="number" id="edit-circuit-cycles" class="form-input" min="1" max="99" value="${this.editingWorkout.circuitCycles || 3}">
          </div>
          <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label class="form-label">Rest Between Cycles (Sec)</label>
            <input type="number" id="edit-circuit-rest" class="form-input" min="0" max="999" value="${this.editingWorkout.circuitRestSeconds || 90}">
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span class="form-label" style="font-size: 13px;">Exercises & Sets List</span>
        <button id="btn-add-row" class="btn btn-secondary btn-sm" style="color: var(--fluo-cyan); border-color: var(--fluo-cyan);">+ Add Exercise</button>
      </div>

      <div class="tabular-container">
        <table class="tabular-table">
          <thead>
            <tr>
              <th style="width: 25px;">#</th>
              <th style="min-width: 110px;">Exercise</th>
              <th style="width: 95px;">Type</th>
              <th style="width: 55px; text-align: center;">Sets</th>
              <th style="width: 55px; text-align: center;">Reps</th>
              <th style="width: 60px; text-align: center;">Weight</th>
              <th style="width: 65px; text-align: center;">Rest / Interval</th>
              <th style="width: 85px; text-align: center;">Move / Delete</th>
            </tr>
          </thead>
          <tbody id="tabular-tbody">
            ${this.renderTabularRows()}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 16px; display: flex; gap: 8px;">
        <button id="btn-cancel-tabular" class="btn btn-secondary" style="flex: 1;">Cancel</button>
        <button id="btn-save-tabular-bottom" class="btn btn-primary" style="flex: 2;">Save & Finish Config</button>
      </div>
    `;

    this.mainContent.innerHTML = html;
    this.bindTabularEvents();
  }

  renderTabularRows() {
    const isCircuitMode = this.editingWorkout.mode === 'circuit';

    return this.editingWorkout.exercises.map((ex, index) => {
      const istimebased = ex.type === 'timebased';
      const weightVal = (ex.weight === null || ex.weight === undefined) ? '' : ex.weight;
      const restVal = istimebased ? (ex.restSeconds || 0) : (ex.restSeconds || 60);

      const setsDisabled = isCircuitMode;
      const setsVal = setsDisabled ? 1 : (ex.sets || (istimebased ? (ex.timebasedTotalRounds || 5) : 3));

      return `
        <tr data-index="${index}">
          <td style="font-weight: 700; color: var(--fluo-cyan);">${index + 1}</td>
          <td>
            <input type="text" class="table-input row-name" value="${this.escapeHtml(ex.name)}" placeholder="Exercise Name">
          </td>
          <td>
            <select class="table-input row-type">
              <option value="standard" ${!istimebased ? 'selected' : ''}>Standard</option>
              <option value="timebased" ${istimebased ? 'selected' : ''}>Time-Based</option>
            </select>
          </td>
          <td>
            <input type="number" 
                   class="table-input row-sets" 
                   min="1" 
                   max="99" 
                   value="${setsVal}" 
                   ${setsDisabled ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} 
                   title="${setsDisabled ? 'In Circuit Mode, rounds are controlled by Circuit Cycles above' : (istimebased ? 'Total Rounds / EMOM Minutes' : 'Sets')}">
          </td>
          <td>
            <input type="number" class="table-input row-reps" min="1" max="999" value="${ex.reps || 10}" title="Reps per round">
          </td>
          <td>
            <input type="number" step="0.5" class="table-input row-weight" value="${weightVal}" placeholder="BW">
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <input type="number" class="table-input row-time" min="1" max="999" value="${istimebased ? (ex.timebasedIntervalSeconds || 60) : (ex.restSeconds || 60)}" title="${istimebased ? 'Interval in sec' : 'Rest in sec'}">
              ${istimebased ? `
                <input type="number" class="table-input row-rest" min="0" max="999" value="${restVal}" placeholder="Rest (opt)" title="Optional Rest between rounds (sec)">
              ` : ''}
            </div>
          </td>
          <td>
            <div class="action-btn-group">
              <button class="btn btn-secondary btn-sm row-move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>?</button>
              <button class="btn btn-secondary btn-sm row-move-down" data-index="${index}" ${index === this.editingWorkout.exercises.length - 1 ? 'disabled' : ''}>?</button>
              <button class="btn btn-secondary btn-sm row-delete" data-index="${index}" style="color: var(--fluo-magenta);">???</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  bindTabularEvents() {
    const tbody = document.getElementById('tabular-tbody');

    document.getElementById('edit-workout-mode')?.addEventListener('change', (e) => {
      const isCircuit = e.target.value === 'circuit';
      this.editingWorkout.mode = e.target.value;
      const box = document.getElementById('circuit-config-box');
      if (box) box.style.display = isCircuit ? 'flex' : 'none';

      updateExerciseState();
      tbody.innerHTML = this.renderTabularRows();
    });

    const updateExerciseState = () => {
      this.editingWorkout.name = document.getElementById('edit-workout-name').value.trim() || 'Custom Workout';
      this.editingWorkout.description = document.getElementById('edit-workout-desc').value.trim();
      this.editingWorkout.mode = document.getElementById('edit-workout-mode').value;
      this.editingWorkout.circuitCycles = parseInt(document.getElementById('edit-circuit-cycles').value) || 3;
      this.editingWorkout.circuitRestSeconds = parseInt(document.getElementById('edit-circuit-rest').value) || 90;

      const isCircuitMode = this.editingWorkout.mode === 'circuit';
      const rows = tbody.querySelectorAll('tr');

      rows.forEach((tr, idx) => {
        const ex = this.editingWorkout.exercises[idx];
        if (!ex) return;

        ex.name = tr.querySelector('.row-name').value.trim() || `Exercise ${idx + 1}`;
        ex.type = tr.querySelector('.row-type').value;

        if (isCircuitMode) {
          ex.sets = 1;
        } else {
          ex.sets = parseInt(tr.querySelector('.row-sets').value) || 1;
        }

        ex.reps = parseInt(tr.querySelector('.row-reps').value) || 1;
        
        const rawWeight = tr.querySelector('.row-weight').value.trim();
        ex.weight = rawWeight === '' ? null : parseFloat(rawWeight);

        const timeVal = parseInt(tr.querySelector('.row-time').value) || 60;
        if (ex.type === 'timebased') {
          ex.timebasedIntervalSeconds = timeVal;
          ex.timebasedTotalRounds = ex.sets;
          const restInput = tr.querySelector('.row-rest');
          ex.restSeconds = restInput ? (parseInt(restInput.value) || 0) : 0;
        } else {
          ex.restSeconds = timeVal;
        }
      });
    };
	
    tbody.addEventListener('click', (e) => {
      const target = e.target;
      updateExerciseState();

      if (target.classList.contains('row-move-up')) {
        const idx = parseInt(target.getAttribute('data-index'));
        if (idx > 0) {
          const temp = this.editingWorkout.exercises[idx];
          this.editingWorkout.exercises[idx] = this.editingWorkout.exercises[idx - 1];
          this.editingWorkout.exercises[idx - 1] = temp;
          tbody.innerHTML = this.renderTabularRows();
        }
      } else if (target.classList.contains('row-move-down')) {
        const idx = parseInt(target.getAttribute('data-index'));
        if (idx < this.editingWorkout.exercises.length - 1) {
          const temp = this.editingWorkout.exercises[idx];
          this.editingWorkout.exercises[idx] = this.editingWorkout.exercises[idx + 1];
          this.editingWorkout.exercises[idx + 1] = temp;
          tbody.innerHTML = this.renderTabularRows();
        }
      } else if (target.classList.contains('row-delete')) {
        const idx = parseInt(target.getAttribute('data-index'));
        if (this.editingWorkout.exercises.length > 1) {
          this.editingWorkout.exercises.splice(idx, 1);
          tbody.innerHTML = this.renderTabularRows();
        } else {
          this.showToast('Workout must have at least one exercise', 'warning');
        }
      }
    });

    tbody.addEventListener('change', (e) => {
      if (e.target.classList.contains('row-type')) {
        updateExerciseState();
        tbody.innerHTML = this.renderTabularRows();
      }
    });

    document.getElementById('btn-add-row').addEventListener('click', () => {
      updateExerciseState();
      const isUserPremium = window.storageManager.isPremiumUser();
      const currentExerciseCount = this.editingWorkout.exercises.length;

      if (!isUserPremium && currentExerciseCount >= FREEMIUM_LIMITS.MAX_EXERCISES_PER_WORKOUT) {
        this.showPaywallModal(`Free plan limit reached (${FREEMIUM_LIMITS.MAX_EXERCISES_PER_WORKOUT} Exercises Max per Routine). Unlock Premium to add unlimited exercises!`);
        return;
      }

      this.editingWorkout.exercises.push({
        id: 'ex_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: 'New Exercise',
        type: 'standard',
        sets: 3,
        reps: 10,
        restSeconds: 60,
        weight: null,
        timebasedIntervalSeconds: 60,
        timebasedTotalRounds: 5
      });
      tbody.innerHTML = this.renderTabularRows();
    });

    const saveHandler = () => {
      updateExerciseState();
      window.storageManager.saveWorkout(this.editingWorkout);
      this.showToast(`Saved workout "${this.editingWorkout.name}"!`);
      this.switchView('workouts');
    };

    document.getElementById('btn-save-tabular').addEventListener('click', saveHandler);
    document.getElementById('btn-save-tabular-bottom').addEventListener('click', saveHandler);

    document.getElementById('btn-cancel-tabular').addEventListener('click', () => {
      this.switchView('workouts');
    });
  }

  startWorkoutSession(workoutId) {
    const workout = window.storageManager.getWorkoutById(workoutId);
    if (!workout || workout.exercises.length === 0) {
      this.showToast('Cannot start an empty workout', 'error');
      return;
    }

    const isCircuit = workout.mode === 'circuit';
    const queue = [];

    if (isCircuit) {
      const totalCycles = parseInt(workout.circuitCycles) || 3;
      const circuitRest = parseInt(workout.circuitRestSeconds) || 90;

      for (let c = 1; c <= totalCycles; c++) {
        workout.exercises.forEach((ex, exIdx) => {
          const isLastExInCycle = exIdx === workout.exercises.length - 1;
          const restTime = isLastExInCycle ? circuitRest : (ex.type === 'timebased' ? (ex.restSeconds || 0) : (ex.restSeconds || 60));

          queue.push({
            taskId: `task_cycle_${c}_ex_${ex.id}`,
            exerciseId: ex.id,
            exerciseName: ex.name,
            setIndex: 1,
            totalSets: 1,
            cycleIndex: c,
            totalCycles: totalCycles,
            isCircuitMode: true,
            isLastExerciseInCycle: isLastExInCycle,
            circuitRestSeconds: circuitRest,
            reps: ex.reps,
            restSeconds: restTime,
            weight: ex.weight,
            type: ex.type || 'standard',
            timebasedIntervalSeconds: ex.timebasedIntervalSeconds || 60,
            timebasedTotalRounds: 1,
            completed: false
          });
        });
      }
    } else {
      workout.exercises.forEach(ex => {
        const setsCount = parseInt(ex.sets) || 1;
        for (let s = 1; s <= setsCount; s++) {
          queue.push({
            taskId: `task_${ex.id}_set_${s}`,
            exerciseId: ex.id,
            exerciseName: ex.name,
            setIndex: s,
            totalSets: setsCount,
            cycleIndex: 1,
            totalCycles: 1,
            isCircuitMode: false,
            reps: ex.reps,
            restSeconds: ex.type === 'timebased' ? (ex.restSeconds || 0) : (ex.restSeconds || 60),
            weight: ex.weight,
            type: ex.type || 'standard',
            timebasedIntervalSeconds: ex.timebasedIntervalSeconds || 60,
            timebasedTotalRounds: ex.timebasedTotalRounds || setsCount,
            completed: false
          });
        }
      });
    }

    this.activeSession = {
      workoutId: workout.id,
      workoutName: workout.name,
      startedAt: new Date().toISOString(),
      queue: queue,
      activeTaskIndex: 0,
      completedLogs: [],
      inRest: false,
      intimebasedTimer: false,
      intimebasedRestPause: false,
      awaitingExerciseStart: false
    };

    this.requestWakeLock();

    window.storageManager.saveActiveSession(this.activeSession);
    this.switchView('active-workout');
    this.showToast(`Started "${workout.name}"! Let's go! ??`);
  }

  getNextPreviewTask(session) {
    if (!session || !session.queue || session.queue.length === 0) return null;

    const currentTask = session.queue[session.activeTaskIndex];
    const isCircuitMode = session.queue[0]?.isCircuitMode;

    if (isCircuitMode) {
      return session.queue.find(t => !t.completed) || null;
    } else {
      if (currentTask) {
        const nextSameEx = session.queue.find(t => !t.completed && t.exerciseId === currentTask.exerciseId);
        if (nextSameEx) return nextSameEx;
      }
      return session.queue.find(t => !t.completed) || null;
    }
  }
  
  renderActiveWorkoutView() {
    if (!this.activeSession) {
      this.mainContent.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px 20px;">
          <h2 style="font-family: var(--font-header); color: #fff; margin-bottom: 12px;">No Active Workout</h2>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Select a workout from your library to start training.</p>
          <button id="btn-go-workouts" class="btn btn-primary">Go to Workouts</button>
        </div>
      `;
      document.getElementById('btn-go-workouts')?.addEventListener('click', () => this.switchView('workouts'));
      return;
    }

    const session = this.activeSession;
    const remainingTasks = session.queue.filter(t => !t.completed);

    if (remainingTasks.length === 0) {
      this.finishWorkoutSession();
      return;
    }

    const isTimerRunning = session.inRest || session.intimebasedTimer || session.intimebasedRestPause;

    if (!isTimerRunning && session.queue[session.activeTaskIndex]?.completed) {
      const isCircuitMode = session.queue[0]?.isCircuitMode;

      if (isCircuitMode) {
        const nextIdx = session.queue.findIndex(t => !t.completed);
        if (nextIdx >= 0) session.activeTaskIndex = nextIdx;
      } else {
        const lastLog = session.completedLogs && session.completedLogs.length > 0
          ? session.completedLogs[session.completedLogs.length - 1]
          : null;
        const lastExId = lastLog ? lastLog.exerciseId : null;

        let nextIdx = session.queue.findIndex(t => !t.completed && t.exerciseId === lastExId);
        if (nextIdx === -1) {
          nextIdx = session.queue.findIndex(t => !t.completed);
        }

        if (nextIdx >= 0) {
          session.activeTaskIndex = nextIdx;
        }
      }
    }

    const currentTask = session.queue[session.activeTaskIndex];
    const istimebased = currentTask.type === 'timebased';

    let html = `
      <div class="view-header">
        <div>
          <span style="font-size: 11px; color: var(--fluo-cyan); font-weight: 700;">ACTIVE SESSION</span>
          <h1 class="view-title">${this.escapeHtml(session.workoutName)}</h1>
        </div>
        <button id="btn-cancel-session" class="btn btn-secondary btn-sm" style="color: var(--fluo-magenta);">Stop</button>
      </div>
    `;

    if (session.awaitingExerciseStart) {
      const nextTask = currentTask;

      html += `
        <div class="card active-player-card" style="border-color: var(--fluo-cyan); box-shadow: 0 0 25px rgba(0, 240, 255, 0.25);">
          <span class="exercise-badge" style="background: rgba(0, 240, 255, 0.2); color: var(--fluo-cyan);">
            ?? EXERCISE COMPLETED
          </span>
          <h2 class="exercise-title" style="margin-bottom: 4px;">Get Ready for Next Exercise</h2>

          <div class="next-up-banner" style="margin: 16px 0; border-left-color: var(--fluo-lime); text-align: left; background: rgba(0, 255, 136, 0.05); padding: 14px;">
            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">NEXT EXERCISE:</span>
            <div style="font-family: var(--font-header); font-size: 20px; color: #fff; margin-top: 2px;">
              ${this.escapeHtml(nextTask.exerciseName)}
            </div>
            <div style="font-size: 13px; color: var(--fluo-lime); margin-top: 4px;">
              Target: ${nextTask.totalSets} Sets x ${nextTask.reps} Reps ${nextTask.weight !== null && nextTask.weight !== undefined ? `@ ${nextTask.weight} kg/lbs` : '(Bodyweight)'}
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button id="btn-quick-weight-transition" class="btn btn-secondary" style="flex: 1;">?? Adjust Weight</button>
            <button id="btn-confirm-next-exercise" class="btn btn-success" style="flex: 2; padding: 16px; font-size: 16px;">?? Start ${this.escapeHtml(nextTask.exerciseName)}</button>
          </div>
        </div>
      `;
    } else if (session.intimebasedRestPause) {
      const nextTask = this.getNextPreviewTask(session);

      html += `
        <div class="rest-overlay" style="border-color: var(--fluo-orange); box-shadow: 0 0 20px rgba(255, 153, 0, 0.3);">
          <span style="font-size: 13px; font-weight: 800; color: var(--fluo-orange); letter-spacing: 1px;">
            ?? TIMEBASED REST PAUSE
          </span>
          <div id="timebased-rest-timer-num" class="rest-timer-display" style="color: var(--fluo-orange); text-shadow: 0 0 20px var(--fluo-orange); font-size: 72px;">
            ${this.timerSecondsLeft}s
          </div>

          ${nextTask ? `
            <div class="next-up-banner" style="border-left-color: var(--fluo-magenta);">
              <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Next Up:</span>
              <div style="font-family: var(--font-header); font-size: 16px; color: #fff; margin-top: 2px;">
                ${this.escapeHtml(nextTask.exerciseName)} ${nextTask.isCircuitMode ? `(Cycle ${nextTask.cycleIndex}/${nextTask.totalCycles})` : `- Round ${nextTask.setIndex}/${nextTask.totalSets}`}
              </div>
              <div style="font-size: 12px; color: var(--fluo-magenta);">
                Target: ${nextTask.reps} reps ${nextTask.type === 'timebased' ? `• ${nextTask.timebasedIntervalSeconds}s interval` : (nextTask.weight ? `@ ${nextTask.weight} kg/lbs` : '(Bodyweight)')}
              </div>
            </div>
          ` : ''}

          <div style="display: flex; gap: 8px; justify-content: center; margin-top: 16px;">
            <button id="btn-pause-timebased" class="btn btn-secondary btn-sm">${this.isTimerPaused ? '?? Resume' : '?? Pause'}</button>
            <button id="btn-quick-weight-rest" class="btn btn-secondary btn-sm">?? Weight</button>
            <button id="btn-skip-rest" class="btn btn-primary btn-sm">Skip Rest ?</button>
          </div>
        </div>
      `;
    } else if (session.inRest) {
      const nextTask = this.getNextPreviewTask(session);
      const isCycleRest = currentTask.isCircuitMode && currentTask.isLastExerciseInCycle;

      html += `
        <div class="rest-overlay" style="${isCycleRest ? 'border-color: var(--fluo-cyan); box-shadow: 0 0 25px rgba(0,240,255,0.3);' : ''}">
          <span style="font-size: 13px; font-weight: 800; color: ${isCycleRest ? 'var(--fluo-cyan)' : 'var(--fluo-lime)'}; letter-spacing: 1px;">
            ${isCycleRest ? `?? CIRCUIT CYCLE ${currentTask.cycleIndex} COMPLETED!` : '?? REST & RECOVER'}
          </span>
          <div id="rest-timer-num" class="rest-timer-display" style="${isCycleRest ? 'color: var(--fluo-cyan); text-shadow: 0 0 20px var(--fluo-cyan);' : ''}">${this.timerSecondsLeft}s</div>

          ${nextTask ? `
            <div class="next-up-banner" style="${isCycleRest ? 'border-left-color: var(--fluo-cyan);' : ''}">
              <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">${isCycleRest ? `Next Up (Cycle ${nextTask.cycleIndex}/${nextTask.totalCycles}):` : 'Next Exercise Preview:'}</span>
              <div style="font-family: var(--font-header); font-size: 16px; color: #fff; margin-top: 2px;">
                ${this.escapeHtml(nextTask.exerciseName)} ${nextTask.isCircuitMode ? `(Cycle ${nextTask.cycleIndex})` : `- Set ${nextTask.setIndex}/${nextTask.totalSets}`}
              </div>
              <div style="font-size: 12px; color: ${isCycleRest ? 'var(--fluo-cyan)' : 'var(--fluo-lime)'};">
                Target: ${nextTask.reps} reps ${nextTask.weight ? `@ ${nextTask.weight} kg/lbs` : '(Bodyweight)'}
              </div>
            </div>
          ` : ''}

          <div style="display: flex; gap: 8px; justify-content: center; margin-top: 16px;">
            <button id="btn-pause-timer" class="btn btn-secondary btn-sm">${this.isTimerPaused ? '?? Resume' : '?? Pause'}</button>
            <button id="btn-add-rest" class="btn btn-secondary btn-sm">+10s</button>
            <button id="btn-quick-weight-rest" class="btn btn-secondary btn-sm">?? Weight</button>
            <button id="btn-skip-rest" class="btn btn-primary btn-sm">Skip Rest ?</button>
          </div>
        </div>
      `;
    } else if (istimebased) {
      const currentExDoneSetsCount = session.completedLogs.filter(log => log.exerciseId === currentTask.exerciseId).length;
      const currentRoundNumber = Math.min(currentExDoneSetsCount + 1, currentTask.totalSets);

      const weightDisplay = currentTask.weight !== null && currentTask.weight !== undefined 
        ? `${currentTask.weight} <span style="font-size: 12px; color: var(--text-muted);">kg/lbs</span>` 
        : `<span style="font-size: 18px; color: var(--fluo-cyan);">Bodyweight</span>`;

      const istimebasedRunning = session.intimebasedTimer || session.timebasedStarted;

      html += `
        <div class="card active-player-card" style="border-color: var(--fluo-magenta); box-shadow: 0 0 25px rgba(255, 0, 127, 0.25);">
          <span class="exercise-badge" style="background: rgba(255, 0, 127, 0.2); color: var(--fluo-magenta);">
            ${currentTask.isCircuitMode ? `? CIRCUIT • CYCLE ${currentTask.cycleIndex}/${currentTask.totalCycles} • TIMEBASED ROUND ${currentRoundNumber}/${currentTask.totalSets}` : `? TIMEBASED MODE • ROUND ${currentRoundNumber} OF ${currentTask.totalSets}`}
          </span>
          <h2 class="exercise-title">${this.escapeHtml(currentTask.exerciseName)}</h2>

          <div id="timebased-timer-num" class="rest-timer-display" style="color: var(--fluo-magenta); text-shadow: 0 0 20px var(--fluo-magenta); font-size: 72px;">
            ${this.timerSecondsLeft > 0 ? this.timerSecondsLeft : currentTask.timebasedIntervalSeconds}s
          </div>

          <div class="metrics-grid">
            <div class="metric-box">
              <div class="metric-value" style="color: #fff;">${currentTask.reps}</div>
              <div class="metric-label">Reps per Round</div>
            </div>
            <div class="metric-box">
              <div class="metric-value">${weightDisplay}</div>
              <div class="metric-label">Weight</div>
            </div>
            <div class="metric-box">
              <div class="metric-value" style="color: var(--fluo-magenta);">${currentTask.timebasedIntervalSeconds}s</div>
              <div class="metric-label">${currentTask.restSeconds > 0 ? `Interval (+${currentTask.restSeconds}s Rest)` : 'Interval'}</div>
            </div>
          </div>

          ${!istimebasedRunning ? `
            <button id="btn-start-timebased-manual" class="btn btn-success btn-block" style="margin-top: 16px; padding: 18px; font-size: 18px; box-shadow: var(--shadow-neon-lime);">
              ?? START TIMEBASED (ROUND 1/${currentTask.totalSets})
            </button>
          ` : `
            <p style="font-size: 11px; color: var(--text-muted); margin: 8px 0;">
              ?? Hands-Free Mode: Timer auto-advances rounds when time reaches 0s.
            </p>
          `}

          <div style="display: flex; gap: 8px; margin-top: 12px;">
            ${istimebasedRunning ? `<button id="btn-pause-timebased" class="btn btn-secondary" style="flex: 1;">${this.isTimerPaused ? '?? Resume' : '?? Pause'}</button>` : ''}
            <button id="btn-quick-weight" class="btn btn-secondary" style="flex: 1;">?? Adjust Weight</button>
            <button id="btn-skip-current-set" class="btn btn-secondary" style="flex: 1; color: var(--fluo-orange); border-color: rgba(255, 153, 0, 0.4);">?? Skip Exercise</button>
          </div>
        </div>
      `;
    } else {
      const currentExDoneSetsCount = session.completedLogs.filter(log => log.exerciseId === currentTask.exerciseId).length;
      const currentSetNumber = Math.min(currentExDoneSetsCount + 1, currentTask.totalSets);

      const weightDisplay = currentTask.weight !== null && currentTask.weight !== undefined 
        ? `${currentTask.weight} <span style="font-size: 12px; color: var(--text-muted);">kg/lbs</span>` 
        : `<span style="font-size: 18px; color: var(--fluo-cyan);">Bodyweight</span>`;

      html += `
        <div class="card active-player-card">
          <span class="exercise-badge" style="${currentTask.isCircuitMode ? 'background: rgba(0, 240, 255, 0.15); color: var(--fluo-cyan); border: 1px solid var(--fluo-cyan);' : ''}">
            ${currentTask.isCircuitMode ? `?? CIRCUIT • CYCLE ${currentTask.cycleIndex} OF ${currentTask.totalCycles}` : `STANDARD SET • SET ${currentSetNumber} OF ${currentTask.totalSets}`}
          </span>
          <h2 class="exercise-title">${this.escapeHtml(currentTask.exerciseName)}</h2>

          <div class="metrics-grid">
            <div class="metric-box">
              <div class="metric-value">${currentTask.reps}</div>
              <div class="metric-label">Reps</div>
            </div>
            <div class="metric-box">
              <div class="metric-value">${weightDisplay}</div>
              <div class="metric-label">Weight</div>
            </div>
            <div class="metric-box">
              <div class="metric-value">${currentTask.restSeconds}s</div>
              <div class="metric-label">Rest</div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button id="btn-quick-weight" class="btn btn-secondary" style="flex: 1;">?? Adjust Weight</button>
            <button id="btn-skip-current-set" class="btn btn-secondary" style="flex: 1; color: var(--fluo-orange); border-color: rgba(255, 153, 0, 0.4);">?? Skip Set</button>
          </div>

          <button id="btn-complete-set" class="btn btn-success btn-block" style="margin-top: 12px; padding: 18px; font-size: 16px;">
            ? Complete Set (${currentSetNumber}/${currentTask.totalSets})
          </button>
        </div>
      `;
    }

    const isCircuitMode = session.queue[0]?.isCircuitMode;
    const totalCompletedSets = session.queue.filter(t => t.completed).length;

    if (isCircuitMode) {
      html += `
        <div class="queue-container card" style="margin-top: 16px; border-color: var(--fluo-cyan);">
          <h3 style="font-size: 14px; color: var(--fluo-cyan); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            ?? Circuit Queue (${totalCompletedSets}/${session.queue.length} Tasks Executed)
          </h3>
          <p style="font-size: 11px; color: var(--text-dim); margin-bottom: 12px;">
            Tap any task step to switch to it in the circuit.
          </p>

          ${session.queue.map((task, idx) => {
            const isActive = idx === session.activeTaskIndex;
            const isDone = task.completed;
            const isSkipped = task.skipped;

            const weightText = task.weight !== null && task.weight !== undefined 
              ? `@ ${task.weight}kg/lbs` 
              : '(BW)';

            let badgeText = isDone ? (isSkipped ? '?? SKIPPED' : '? DONE') : (isActive ? '? ACTIVE' : `Cycle ${task.cycleIndex}`);
            let badgeColor = isDone ? (isSkipped ? 'var(--fluo-orange)' : 'var(--fluo-lime)') : (isActive ? 'var(--fluo-cyan)' : 'var(--text-muted)');

            return `
              <div class="queue-item ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}" data-exercise-id="${task.exerciseId}" data-target-index="${idx}" style="${isActive ? 'border-color: var(--fluo-cyan); background: rgba(0, 240, 255, 0.08);' : ''}">
                <div>
                  <strong style="color: #fff; font-size: 14px;">${this.escapeHtml(task.exerciseName)}</strong>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                    Cycle ${task.cycleIndex} of ${task.totalCycles} • ${task.reps} reps ${weightText}
                  </div>
                </div>
                <div>
                  <span style="font-size: 11px; font-weight: 700; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 2px 8px; border-radius: 12px;">
                    ${badgeText}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      const exercisesMap = new Map();
      session.queue.forEach(task => {
        if (!exercisesMap.has(task.exerciseId)) {
          exercisesMap.set(task.exerciseId, {
            exerciseId: task.exerciseId,
            exerciseName: task.exerciseName,
            totalSets: task.totalSets,
            completedSets: 0,
            remainingTasks: [],
            firstTaskIndex: -1,
            weight: task.weight,
            reps: task.reps,
            type: task.type
          });
        }
        const group = exercisesMap.get(task.exerciseId);
        if (task.completed) {
          group.completedSets++;
        } else {
          group.remainingTasks.push(task);
          if (group.firstTaskIndex === -1) {
            group.firstTaskIndex = session.queue.indexOf(task);
          }
        }
      });

      const exercisesList = Array.from(exercisesMap.values());

      html += `
        <div class="queue-container card" style="margin-top: 16px;">
          <h3 style="font-size: 14px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            Exercises List (${totalCompletedSets}/${session.queue.length} Sets Done)
          </h3>
          <p style="font-size: 11px; color: var(--text-dim); margin-bottom: 12px;">
            Tap an exercise to switch to it after completing or skipping the current set.
          </p>

          ${exercisesList.map(group => {
            const isCurrentActiveEx = currentTask && currentTask.exerciseId === group.exerciseId;
            const isFullyDone = group.completedSets === group.totalSets;

            const weightText = group.weight !== null && group.weight !== undefined 
              ? `@ ${group.weight}kg/lbs` 
              : '(Bodyweight)';

            return `
              <div class="queue-item ${isCurrentActiveEx ? 'active' : ''} ${isFullyDone ? 'completed' : ''}" data-exercise-id="${group.exerciseId}" data-target-index="${group.firstTaskIndex}">
                <div>
                  <strong style="color: #fff; font-size: 14px;">${this.escapeHtml(group.exerciseName)}</strong>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                    ${group.completedSets}/${group.totalSets} Sets Done • ${group.reps} reps ${weightText}
                  </div>
                </div>
                <div>
                  ${isFullyDone 
                    ? '<span style="color: var(--fluo-lime); font-weight: 700; font-size: 12px;">? DONE</span>' 
                    : (isCurrentActiveEx 
                      ? '<span style="color: var(--fluo-cyan); font-weight: 700; font-size: 12px;">? ACTIVE</span>' 
                      : '<span style="color: var(--text-muted); font-size: 12px;">Select</span>')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    this.mainContent.innerHTML = html;
    this.bindActivePlayerEvents();
  }

  bindActivePlayerEvents() {
    const session = this.activeSession;
    if (!session) return;

    document.querySelectorAll('.queue-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (session.queue[0]?.isCircuitMode) {
          this.showToast('In Circuit Mode, exercises run strictly in sequence. Use "Skip Set" if needed', 'warning');
          return;
        }

        const isTimerActive = session.inRest || session.intimebasedTimer || session.intimebasedRestPause || (this.timerInterval !== null);
        if (isTimerActive) {
          this.showToast('Cannot switch exercises while a timer is counting down. Wait or skip rest', 'warning');
          return;
        }

        const targetIndex = parseInt(e.currentTarget.getAttribute('data-target-index'));
        const targetExId = e.currentTarget.getAttribute('data-exercise-id');
        const currentTask = session.queue[session.activeTaskIndex];

        if (targetIndex === -1 || isNaN(targetIndex)) return;

        if (currentTask && currentTask.exerciseId !== targetExId) {
          const currentExCompletedCount = (session.completedLogs || []).filter(log => log.exerciseId === currentTask.exerciseId).length;

          if (currentExCompletedCount > 0) {
            this.showToast(`Finish all sets of "${currentTask.exerciseName}" or tap "Skip Set" to switch exercise`, 'warning');
            return;
          }
        }

        session.activeTaskIndex = targetIndex;
        window.storageManager.saveActiveSession(session);
        this.renderActiveWorkoutView();
      });
    });

    document.getElementById('btn-confirm-next-exercise')?.addEventListener('click', () => {
      session.awaitingExerciseStart = false;
      const currentTask = session.queue[session.activeTaskIndex];
      const settings = window.storageManager.getSettings();

      if (currentTask && currentTask.type === 'timebased') {
        session.timebasedStarted = true;
        window.storageManager.saveActiveSession(session);
        window.audioEngine.speakPhrase("Go", settings.silentMode);
        this.starttimebasedTimer(currentTask.timebasedIntervalSeconds);
      } else {
        window.storageManager.saveActiveSession(session);
        this.renderActiveWorkoutView();
      }
    });

    document.getElementById('btn-skip-current-set')?.addEventListener('click', () => {
      const activeTask = session.queue[session.activeTaskIndex];
      if (!activeTask) return;

      const isCircuitMode = session.queue[0]?.isCircuitMode;

      if (isCircuitMode) {
        activeTask.completed = true;
        activeTask.skipped = true;
        activeTask.completedAt = new Date().toISOString();
        this.showToast(`Skipped "${activeTask.exerciseName}" (Cycle ${activeTask.cycleIndex})`, 'info');
      } else {
        session.queue.forEach(t => {
          if (t.exerciseId === activeTask.exerciseId && !t.completed) {
            t.completed = true;
            t.skipped = true;
            t.completedAt = new Date().toISOString();
          }
        });
        this.showToast(`Skipped all remaining sets for "${activeTask.exerciseName}"`, 'info');
      }

      this.stopRestTimer();
      session.timebasedStarted = false;
      window.storageManager.saveActiveSession(session);
      this.moveToNextUncompletedSet();
    });

    document.getElementById('btn-cancel-session')?.addEventListener('click', () => {
      if (confirm('Cancel active workout session?')) {
        this.stopRestTimer();
        this.releaseWakeLock();
        this.activeSession = null;
        window.storageManager.saveActiveSession(null);
        this.switchView('workouts');
      }
    });

    document.getElementById('btn-complete-set')?.addEventListener('click', () => {
      const currentTask = session.queue[session.activeTaskIndex];
      const settings = window.storageManager.getSettings();

      const remainingUncompletedSameExSets = session.queue.filter(t => !t.completed && t.exerciseId === currentTask.exerciseId).length;

      currentTask.completed = true;
      currentTask.completedAt = new Date().toISOString();

      session.completedLogs.push({
        exerciseId: currentTask.exerciseId,
        exerciseName: currentTask.exerciseName,
        setIndex: currentTask.setIndex,
        reps: currentTask.reps,
        weight: currentTask.weight,
        timestamp: new Date().toISOString()
      });

      if (remainingUncompletedSameExSets > 1) {
        window.audioEngine.speakPhrase("Rest", settings.silentMode);
      } else {
        window.audioEngine.speakPhrase("End set", settings.silentMode);
      }

      const restSec = currentTask.type === 'timebased' ? currentTask.timebasedIntervalSeconds : currentTask.restSeconds;
      if (restSec > 0) {
        this.startRestTimer(restSec);
      } else {
        this.moveToNextUncompletedSet();
      }
    });

    const attachWeightModal = (btnId) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        const currentTask = session.queue[session.activeTaskIndex];
        if (!currentTask) return;
        const currentWeight = currentTask.weight !== null && currentTask.weight !== undefined ? currentTask.weight : '';

        const modalHtml = `
          <h3 style="font-family: var(--font-header); color: #fff; margin-bottom: 12px;">?? Adjust Weight</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
            Update weight for <strong>${this.escapeHtml(currentTask.exerciseName)}</strong>. This will also update the default weight in your workout configuration.
          </p>

          <div class="form-group">
            <label class="form-label">Weight (kg / lbs)</label>
            <input type="number" step="0.5" id="quick-weight-input" class="form-input" value="${currentWeight}" placeholder="Leave empty for Bodyweight">
          </div>

          <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button id="btn-save-quick-weight" class="btn btn-primary btn-block">Save Weight</button>
          </div>
        `;

        this.openModal(modalHtml);

        document.getElementById('btn-save-quick-weight').addEventListener('click', () => {
          const val = document.getElementById('quick-weight-input').value.trim();
          const newWeight = val === '' ? null : parseFloat(val);

          currentTask.weight = newWeight;

          session.queue.forEach(t => {
            if (t.exerciseId === currentTask.exerciseId && !t.completed) {
              t.weight = newWeight;
            }
          });

          window.storageManager.updateWorkoutExerciseWeight(session.workoutId, currentTask.exerciseId, newWeight);

          window.storageManager.saveActiveSession(session);
          this.closeModal();
          this.showToast('Weight updated and saved to workout template!');
          this.renderActiveWorkoutView();
        });
      });
    };

    attachWeightModal('btn-quick-weight');
    attachWeightModal('btn-quick-weight-rest');
    attachWeightModal('btn-quick-weight-transition');

    document.getElementById('btn-start-timebased-manual')?.addEventListener('click', () => {
      const currentTask = session.queue[session.activeTaskIndex];
      const settings = window.storageManager.getSettings();

      session.timebasedStarted = true;
      window.storageManager.saveActiveSession(session);

      window.audioEngine.speakPhrase("Go", settings.silentMode);
      this.starttimebasedTimer(currentTask.timebasedIntervalSeconds);
    });

    document.getElementById('btn-pause-timer')?.addEventListener('click', () => {
      this.isTimerPaused = !this.isTimerPaused;
      this.renderActiveWorkoutView();
    });

    document.getElementById('btn-pause-timebased')?.addEventListener('click', () => {
      this.isTimerPaused = !this.isTimerPaused;
      this.renderActiveWorkoutView();
    });

    document.getElementById('btn-add-rest')?.addEventListener('click', () => {
      this.timerSecondsLeft += 10;
      this.timerTargetEndTime += 10000;
      const numElem = document.getElementById('rest-timer-num');
      if (numElem) numElem.textContent = `${this.timerSecondsLeft}s`;
    });

    document.getElementById('btn-skip-rest')?.addEventListener('click', () => {
      this.stopRestTimer();
      this.moveToNextUncompletedSet();
    });
  }

  updateTimerFromTimestamp() {
    if (!this.timerTargetEndTime) return;
    if (this.isTimerPaused) return;

    const now = Date.now();
    const diffMs = this.timerTargetEndTime - now;
    const remainingSec = Math.max(0, Math.ceil(diffMs / 1000));

    if (remainingSec !== this.timerSecondsLeft) {
      this.timerSecondsLeft = remainingSec;

      const timerElem = document.getElementById('timebased-timer-num') || 
                        document.getElementById('timebased-rest-timer-num') || 
                        document.getElementById('rest-timer-num');
      if (timerElem) {
        timerElem.textContent = `${this.timerSecondsLeft}s`;
      }

      const settings = window.storageManager.getSettings();
      if (remainingSec <= 5 && remainingSec > 0) {
        window.audioEngine.speakNumber(remainingSec, settings.silentMode);
      }
    }
  }

  starttimebasedTimer(seconds) {
    this.stopRestTimer();

    const session = this.activeSession;
    if (!session) return;

    session.intimebasedTimer = true;
    this.timerSecondsLeft = seconds;
    this.timerTotalSeconds = seconds;
    this.timerTargetEndTime = Date.now() + (seconds * 1000);
    this.isTimerPaused = false;

    window.storageManager.saveActiveSession(session);
    this.renderActiveWorkoutView();

    this.timerInterval = setInterval(() => {
      if (this.isTimerPaused) return;

      this.updateTimerFromTimestamp();

      if (this.timerSecondsLeft <= 0) {
        this.stopRestTimer();

        window.audioEngine.vibrateFinish();
        window.audioEngine.sendRestNotification("CYBERPUMP ?", "Round Completed! Next Round Starting!");

        const currentTask = session.queue[session.activeTaskIndex];
        if (currentTask && !currentTask.completed) {
          currentTask.completed = true;
          currentTask.completedAt = new Date().toISOString();

          session.completedLogs.push({
            exerciseId: currentTask.exerciseId,
            exerciseName: currentTask.exerciseName,
            setIndex: currentTask.setIndex,
            reps: currentTask.reps,
            weight: currentTask.weight,
            timestamp: new Date().toISOString()
          });
        }

        session.intimebasedTimer = false;

        const settings = window.storageManager.getSettings();

        if (currentTask && currentTask.isCircuitMode) {
          if (currentTask.restSeconds > 0) {
            window.audioEngine.playStartBeep(settings.silentMode);
            window.audioEngine.speakPhrase("Rest", settings.silentMode);
            this.starttimebasedRestPauseTimer(currentTask.restSeconds);
          } else {
            window.audioEngine.playStartBeep(settings.silentMode);
            window.audioEngine.speakPhrase("Go", settings.silentMode);
            this.moveToNextUncompletedSet();
          }
        } else {
          const nextSameExIndex = session.queue.findIndex(t => !t.completed && t.exerciseId === currentTask?.exerciseId);
          
          if (nextSameExIndex >= 0) {
            session.activeTaskIndex = nextSameExIndex;
            const nextTask = session.queue[nextSameExIndex];

            if (currentTask && currentTask.restSeconds > 0) {
              window.audioEngine.playStartBeep(settings.silentMode);
              window.audioEngine.speakPhrase("Rest", settings.silentMode);
              this.starttimebasedRestPauseTimer(currentTask.restSeconds);
            } else {
              window.audioEngine.playStartBeep(settings.silentMode);
              window.audioEngine.speakPhrase("Go", settings.silentMode);
              this.starttimebasedTimer(nextTask.timebasedIntervalSeconds);
            }
          } else {
            if (currentTask && currentTask.restSeconds > 0) {
              window.audioEngine.playStartBeep(settings.silentMode);
              window.audioEngine.speakPhrase("Rest", settings.silentMode);
              this.starttimebasedRestPauseTimer(currentTask.restSeconds);
            } else {
              session.timebasedStarted = false;
              window.audioEngine.playStartBeep(settings.silentMode);
              window.audioEngine.speakPhrase("End set", settings.silentMode);
              this.moveToNextUncompletedSet();
            }
          }
        }
      }
    }, 50);
  }

  starttimebasedRestPauseTimer(seconds) {
    this.stopRestTimer();

    const session = this.activeSession;
    if (!session) return;

    session.intimebasedRestPause = true;
    this.timerSecondsLeft = seconds;
    this.timerTotalSeconds = seconds;
    this.timerTargetEndTime = Date.now() + (seconds * 1000);
    this.isTimerPaused = false;

    window.storageManager.saveActiveSession(session);
    this.renderActiveWorkoutView();

    this.timerInterval = setInterval(() => {
      if (this.isTimerPaused) return;

      this.updateTimerFromTimestamp();

      if (this.timerSecondsLeft <= 0) {
        this.stopRestTimer();
        session.intimebasedRestPause = false;

        window.audioEngine.vibrateFinish();
        window.audioEngine.sendRestNotification("CYBERPUMP ??????", "Rest Over! Time for the next interval!");

        const currentTask = session.queue[session.activeTaskIndex];
        const settings = window.storageManager.getSettings();

        if (currentTask && !currentTask.completed) {
          window.audioEngine.playStartBeep(settings.silentMode);
          window.audioEngine.speakPhrase("Work", settings.silentMode);
          this.starttimebasedTimer(currentTask.timebasedIntervalSeconds);
        } else {
          session.timebasedStarted = false;
          window.audioEngine.playStartBeep(settings.silentMode);
          window.audioEngine.speakPhrase("End set", settings.silentMode);
          this.moveToNextUncompletedSet();
        }
      }
    }, 50);
  }

  startRestTimer(seconds) {
    this.stopRestTimer();

    this.activeSession.inRest = true;
    this.timerSecondsLeft = seconds;
    this.timerTotalSeconds = seconds;
    this.timerTargetEndTime = Date.now() + (seconds * 1000);
    this.isTimerPaused = false;

    window.storageManager.saveActiveSession(this.activeSession);
    this.renderActiveWorkoutView();

    this.timerInterval = setInterval(() => {
      if (this.isTimerPaused) return;

      this.updateTimerFromTimestamp();

      if (this.timerSecondsLeft <= 0) {
        const settings = window.storageManager.getSettings();
        window.audioEngine.playStartBeep(settings.silentMode);
        window.audioEngine.speakPhrase("Get ready", settings.silentMode);
        
        window.audioEngine.vibrateFinish();
        window.audioEngine.sendRestNotification("CYBERPUMP ??????", "Rest Over! Get ready for your next set!");

        this.stopRestTimer();
        this.moveToNextUncompletedSet();
      }
    }, 50);
  }

  stopRestTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerTargetEndTime = null;
    this.timerSecondsLeft = 0;
    this.isTimerPaused = false;
    if (this.activeSession) {
      this.activeSession.inRest = false;
      this.activeSession.intimebasedTimer = false;
      this.activeSession.intimebasedRestPause = false;
      window.storageManager.saveActiveSession(this.activeSession);
    }
  }

  moveToNextUncompletedSet() {
    if (!this.activeSession) return;

    this.stopRestTimer();

    const session = this.activeSession;
    const remainingTasks = session.queue.filter(t => !t.completed);
    
    if (remainingTasks.length === 0) {
      this.finishWorkoutSession();
      return;
    }

    const isCircuitMode = session.queue[0]?.isCircuitMode;
    const lastLog = session.completedLogs && session.completedLogs.length > 0
      ? session.completedLogs[session.completedLogs.length - 1]
      : null;

    const lastExerciseId = lastLog ? lastLog.exerciseId : null;

    if (isCircuitMode) {
      const nextUncompletedIdx = session.queue.findIndex(t => !t.completed);
      if (nextUncompletedIdx >= 0) {
        session.activeTaskIndex = nextUncompletedIdx;
        if (nextUncompletedIdx === 0) {
          session.timebasedStarted = false;
        }
      }
    } else {
      const lastExId = lastLog ? lastLog.exerciseId : session.queue[session.activeTaskIndex]?.exerciseId;

      const nextSameExIdx = session.queue.findIndex(t => !t.completed && t.exerciseId === lastExId);

      if (nextSameExIdx >= 0) {
        session.activeTaskIndex = nextSameExIdx;
      } else {
        const nextUncompletedIdx = session.queue.findIndex(t => !t.completed);
        if (nextUncompletedIdx >= 0) {
          session.activeTaskIndex = nextUncompletedIdx;
          session.timebasedStarted = false;
        }
      }
    }

    const nextTask = session.queue[session.activeTaskIndex];

    if (lastExerciseId && nextTask && nextTask.exerciseId !== lastExerciseId) {
      session.awaitingExerciseStart = true;
    }

    if (session.awaitingExerciseStart) {
      window.storageManager.saveActiveSession(session);
      this.renderActiveWorkoutView();
      return;
    }

    if (nextTask && nextTask.type === 'timebased' && nextTask.isCircuitMode && session.activeTaskIndex > 0) {
      session.timebasedStarted = true;
      window.storageManager.saveActiveSession(session);
      const settings = window.storageManager.getSettings();
      window.audioEngine.speakPhrase("Go", settings.silentMode);
      this.starttimebasedTimer(nextTask.timebasedIntervalSeconds);
      return;
    }

    window.storageManager.saveActiveSession(session);
    this.renderActiveWorkoutView();
  }

  finishWorkoutSession() {
    this.stopRestTimer();
    this.releaseWakeLock();

    const session = this.activeSession;
    if (!session) return;

    const durationSeconds = Math.round((new Date().getTime() - new Date(session.startedAt).getTime()) / 1000);
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    const logEntry = {
      id: 'log_' + Date.now(),
      workoutId: session.workoutId,
      workoutName: session.workoutName,
      date: new Date().toISOString(),
      durationSeconds: durationSeconds,
      durationMinutes: durationMinutes,
      completedSetsCount: session.completedLogs.length,
      setsDetail: session.completedLogs
    };

    window.storageManager.addLog(logEntry);
    this.activeSession = null;
    window.storageManager.saveActiveSession(null);

    window.audioEngine.vibrateFinish();
    window.audioEngine.sendRestNotification("CYBERPUMP ??", "WORKOUT COMPLETED! Great session!");

    this.switchView('workouts');

    const modalHtml = `
      <div style="text-align: center; padding: 12px 0;">
        <span style="font-size: 48px;">??</span>
        <h2 style="font-family: var(--font-header); color: var(--fluo-lime); font-size: 24px; margin: 8px 0;">WORKOUT COMPLETED!</h2>
        <p style="color: var(--text-muted); font-size: 13px;">Great job! Your session has been saved to your Workout Diary.</p>

        <div class="metrics-grid" style="margin: 20px 0;">
          <div class="metric-box">
            <div class="metric-value">${durationMinutes}m</div>
            <div class="metric-label">Time</div>
          </div>
          <div class="metric-box">
            <div class="metric-value">${logEntry.completedSetsCount}</div>
            <div class="metric-label">Sets Done</div>
          </div>
        </div>

        <button id="btn-finish-dialog-close" class="btn btn-primary btn-block">View Workout Diary</button>
      </div>
    `;

    this.openModal(modalHtml);
    document.getElementById('btn-finish-dialog-close').addEventListener('click', () => {
      this.closeModal();
      this.switchView('diary');
    });
  }

  renderDiaryView() {
    const logs = window.storageManager.getLogs();

    let html = `
      <div class="view-header">
        <h1 class="view-title">?? Workout Diary</h1>
        <span style="font-size: 12px; color: var(--text-muted);">${logs.length} Logged Sessions</span>
      </div>
    `;

    if (logs.length === 0) {
      html += `
        <div class="card" style="text-align: center; padding: 40px 20px;">
          <p style="color: var(--text-muted);">No completed workouts logged yet.</p>
        </div>
      `;
    } else {
      logs.forEach(log => {
        const dateStr = new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        html += `
          <div class="card" style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <div>
                <h3 style="font-family: var(--font-header); font-size: 16px; color: #fff;">${this.escapeHtml(log.workoutName)}</h3>
                <span style="font-size: 11px; color: var(--text-muted);">${dateStr}</span>
              </div>
              <span class="exercise-badge" style="background: rgba(0, 255, 136, 0.15); color: var(--fluo-lime);">
                ?? ${log.durationMinutes} min
              </span>
            </div>

            <div style="font-size: 12px; color: var(--text-main); margin: 8px 0;">
              <strong>${log.completedSetsCount} Sets Executed:</strong>
              <ul style="margin-top: 4px; padding-left: 16px; color: var(--text-muted); font-size: 11px;">
                ${(log.setsDetail || []).map(s => `
                  <li>${this.escapeHtml(s.exerciseName)} (Set ${s.setIndex}): ${s.reps} reps ${s.weight ? `@ ${s.weight}kg/lbs` : '(BW)'}</li>
                `).join('')}
              </ul>
            </div>

            <div style="text-align: right; margin-top: 8px;">
              <button class="btn btn-secondary btn-sm btn-delete-log" data-id="${log.id}" style="color: var(--fluo-magenta);">Delete Log</button>
            </div>
          </div>
        `;
      });
    }

    this.mainContent.innerHTML = html;

    document.querySelectorAll('.btn-delete-log').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('Delete this workout log entry?')) {
          window.storageManager.deleteLog(id);
          this.showToast('Log entry removed');
          this.renderDiaryView();
        }
      });
    });
  }

  renderShareImportView() {
    let html = `
      <div class="view-header">
        <h1 class="view-title">?? Export & Import</h1>
      </div>

      <div class="card" style="margin-bottom: 16px;">
        <h3 style="font-family: var(--font-header); font-size: 16px; color: #fff; margin-bottom: 8px;">Export & Share Database</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
          Export your local workouts into a portable text string file to share with friends or transfer to another device.
        </p>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="btn-export-share" class="btn btn-primary btn-sm">?? Share via App</button>
          <button id="btn-export-copy" class="btn btn-secondary btn-sm">?? Copy Text String</button>
          <button id="btn-export-file" class="btn btn-secondary btn-sm">?? Download JSON File</button>
        </div>
      </div>

      <div class="card">
        <h3 style="font-family: var(--font-header); font-size: 16px; color: #fff; margin-bottom: 8px;">Import Workouts</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
          Paste a CYBERPUMP export text string or upload a JSON export file to selectively import workouts.
        </p>

        <div class="form-group">
          <textarea id="import-text-input" class="form-textarea" rows="4" placeholder="Paste export string JSON here..."></textarea>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="btn-parse-import" class="btn btn-success btn-sm">Preview & Select Workouts</button>
          <label class="btn btn-secondary btn-sm" style="cursor: pointer; margin: 0;">
            ?? Pick File
            <input type="file" id="import-file-input" accept=".json,.txt" style="display: none;">
          </label>
        </div>
      </div>
    `;

    this.mainContent.innerHTML = html;

    document.getElementById('btn-export-share').addEventListener('click', async () => {
      const res = await window.exportImportManager.shareWorkouts();
      if (res.success) this.showToast('Workouts shared successfully!');
    });

    document.getElementById('btn-export-copy').addEventListener('click', async () => {
      const text = window.exportImportManager.exportData();
      await navigator.clipboard.writeText(text);
      this.showToast('Export string copied to clipboard!');
    });

    document.getElementById('btn-export-file').addEventListener('click', () => {
      window.exportImportManager.downloadExportFile();
      this.showToast('Export file downloaded!');
    });

    const handleImportParsing = (rawText) => {
      const parsedWorkouts = window.exportImportManager.parseImportString(rawText);
      if (!parsedWorkouts || parsedWorkouts.length === 0) {
        this.showToast('Invalid or empty export text string', 'error');
        return;
      }
      this.showSelectiveImportModal(parsedWorkouts);
    };

    document.getElementById('btn-parse-import').addEventListener('click', () => {
      const raw = document.getElementById('import-text-input').value;
      handleImportParsing(raw);
    });

    document.getElementById('import-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => handleImportParsing(event.target.result);
        reader.readAsText(file);
      }
    });
  }

  showSelectiveImportModal(candidateWorkouts) {
    const isPremium = window.storageManager.isPremiumUser();
    const currentWorkoutCount = window.storageManager.getWorkouts().length;
    const remainingSlots = isPremium ? Infinity : Math.max(0, FREEMIUM_LIMITS.MAX_WORKOUTS - currentWorkoutCount);

    const modalHtml = `
      <h3 style="font-family: var(--font-header); color: #fff; margin-bottom: 8px;">Select Workouts to Import</h3>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
        ${isPremium 
          ? '?? <strong>Premium Plan:</strong> You can import all selected workouts.' 
          : `?? <strong>Free Plan:</strong> You can import up to <strong>${remainingSlots}</strong> more workout(s).`}
      </p>

      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <label style="font-size: 12px; color: var(--fluo-cyan); cursor: pointer;">
          <input type="checkbox" id="toggle-all-import" checked> Select All (${candidateWorkouts.length})
        </label>
      </div>

      <div style="max-height: 240px; overflow-y: auto; border: 1px solid var(--border-muted); border-radius: var(--radius-md); padding: 8px; margin-bottom: 16px; background: rgba(0,0,0,0.3);">
        ${candidateWorkouts.map((w, idx) => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #fff; cursor: pointer;">
              <input type="checkbox" class="import-workout-check" data-index="${idx}" checked>
              <strong>${this.escapeHtml(w.name)}</strong>
            </label>
            <span style="font-size: 11px; color: var(--text-muted);">${w.exercises.length} Exercises</span>
          </div>
        `).join('')}
      </div>

      <div style="display: flex; gap: 8px;">
        <button id="btn-cancel-modal-import" class="btn btn-secondary" style="flex: 1;">Cancel</button>
        <button id="btn-confirm-import" class="btn btn-success" style="flex: 2;">Import Selected</button>
      </div>
    `;

    this.openModal(modalHtml);

    document.getElementById('toggle-all-import').addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.import-workout-check').forEach(chk => chk.checked = isChecked);
    });

    document.getElementById('btn-cancel-modal-import').addEventListener('click', () => this.closeModal());

    document.getElementById('btn-confirm-import').addEventListener('click', () => {
      const selectedIndexes = [];
      document.querySelectorAll('.import-workout-check:checked').forEach(chk => {
        selectedIndexes.push(parseInt(chk.getAttribute('data-index')));
      });

      if (selectedIndexes.length === 0) {
        this.showToast('Please select at least one workout to import', 'warning');
        return;
      }

      if (!isPremium && (currentWorkoutCount + selectedIndexes.length) > FREEMIUM_LIMITS.MAX_WORKOUTS) {
        this.closeModal();
        this.showPaywallModal(`Import failed: Importing ${selectedIndexes.length} workout(s) would exceed your Free plan limit of ${FREEMIUM_LIMITS.MAX_WORKOUTS} workouts. Upgrade to Premium for unlimited imports!`);
        return;
      }

      const workoutsToImport = selectedIndexes.map(idx => candidateWorkouts[idx]);
      const importedCount = window.exportImportManager.importWorkouts(workoutsToImport, 'keep_both');

      this.closeModal();
      this.showToast(`Successfully imported ${importedCount} workout(s)!`);
      this.switchView('workouts');
    });
  }

  renderSettingsView() {
    const settings = window.storageManager.getSettings();

    let html = `
      <div class="view-header">
        <h1 class="view-title">?? App Settings</h1>
      </div>

      <div class="card" style="margin-bottom: 12px;">
        <h3 style="font-family: var(--font-header); font-size: 15px; color: #fff; margin-bottom: 8px;">Purchases & Account</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
          Already bought Premium on another device? Restore your active purchase.
        </p>
        <button id="btn-restore-purchases" class="btn btn-secondary btn-sm" style="color: var(--fluo-cyan); border-color: var(--fluo-cyan);">
          ?? Restore Purchases
        </button>
      </div>

      <div class="card" style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <strong style="color: #fff; font-size: 15px;">Silent Mode</strong>
            <p style="font-size: 11px; color: var(--text-muted);">Mutes all voice countdowns and start audio beeps.</p>
          </div>
          <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
            <input type="checkbox" id="setting-silent" ${settings.silentMode ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
            <span style="position: absolute; cursor: pointer; top:0; left:0; right:0; bottom:0; background: ${settings.silentMode ? 'var(--fluo-cyan)' : '#334155'}; border-radius: 24px; transition: 0.2s;"></span>
          </label>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #fff; font-size: 15px;">Start Chime Beep Tone</strong>
            <p style="font-size: 11px; color: var(--text-muted);">Audio tone signals test.</p>
          </div>
          <button id="btn-test-audio" class="btn btn-secondary btn-sm">?? Test Audio</button>
        </div>
      </div>

      <div class="card" style="margin-bottom: 16px;">
        <h3 style="font-family: var(--font-header); font-size: 15px; color: #fff; margin-bottom: 8px;">Storage & Reset</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
          All workout data is stored locally on this smartphone device.
        </p>
        <button id="btn-reset-defaults" class="btn btn-secondary btn-sm" style="color: var(--fluo-magenta); border-color: rgba(255,0,127,0.3);">
          ?? Restore Preset Workouts
        </button>
      </div>

      <div class="card" style="text-align: center; padding: 20px 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(0, 240, 255, 0.2);">
        <div style="font-family: var(--font-header); font-size: 14px; font-weight: 700; color: var(--fluo-cyan); letter-spacing: 1px; margin-bottom: 4px;">
          ? CYBERPUMP WORKOUT LOG
        </div>
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">
          Version <span style="color: var(--fluo-lime); font-weight: 700;">1.0.9</span> • Native App
        </div>

        <div style="border-top: 1px dashed rgba(255, 255, 255, 0.1); width: 60%; margin: 10px auto;"></div>

        <div style="font-size: 12px; color: var(--text-main); margin-bottom: 4px;">
          Created by <strong style="color: #fff;">mdpt</strong>
        </div>
        <div style="font-size: 11px;">
          <a href="mailto:mttdptrz@gmail.com" style="color: var(--fluo-cyan); text-decoration: none;">
            ?? mttdptrz@gmail.com
          </a>
        </div>
      </div>
    `;

    this.mainContent.innerHTML = html;

    document.getElementById('btn-restore-purchases')?.addEventListener('click', () => {
      if (window.iapManager && window.iapManager.initialized) {
        window.iapManager.restorePurchases();
      } else {
        this.showToast('IAP Manager not initialized or running in browser mode', 'warning');
      }
    });

    document.getElementById('setting-silent').addEventListener('change', (e) => {
      window.storageManager.updateSetting('silentMode', e.target.checked);
      this.updateSilentModeIcon();
      this.showToast(e.target.checked ? 'Silent Mode Enabled' : 'Silent Mode Disabled');
      this.renderSettingsView();
    });

    document.getElementById('btn-test-audio').addEventListener('click', () => {
      const isSilent = window.storageManager.getSettings().silentMode;
      if (isSilent) {
        this.showToast('Silent Mode is ON - unmute to test sound', 'warning');
      } else {
        window.audioEngine.speakNumber('Three', false);
        setTimeout(() => window.audioEngine.playStartBeep(false), 800);
      }
    });

    document.getElementById('btn-reset-defaults').addEventListener('click', () => {
      if (confirm('Reset to default workout presets? This will reload initial workouts.')) {
        localStorage.clear();
        window.storageManager.initDefaults();
        this.showToast('Presets restored!');
        this.switchView('workouts');
      }
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.cyberPumpApp = new CyberPumpApp();
});