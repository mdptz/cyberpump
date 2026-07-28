/**
 * CYBERPUMP Main Smartphone Web Application Logic
 * Integrates state, views, tabular editor, active workout player, rest voice timer, and sharing.
 */

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

    this.initUI();
    this.bindEvents();
    this.restoreOrRenderView();
  }

  initUI() {
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

  bindEvents() {
    // Navigation items
    this.bottomNavItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const view = e.currentTarget.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Quick Silent Mode toggle in top header
    this.quickSilentBtn.addEventListener('click', () => {
      const settings = window.storageManager.getSettings();
      const newSilentState = !settings.silentMode;
      window.storageManager.updateSetting('silentMode', newSilentState);
      this.updateSilentModeIcon();
      this.showToast(newSilentState ? 'Muted: Silent Mode ON' : 'Audio ON: Voice & Beep Active');
    });

    // Modal Close
    this.modalClose.addEventListener('click', () => this.closeModal());
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) this.closeModal();
    });

    // Handle window resize / orientation
    window.addEventListener('beforeunload', () => {
      if (this.activeSession) {
        window.storageManager.saveActiveSession(this.activeSession);
      }
    });
  }

  updateSilentModeIcon() {
    const settings = window.storageManager.getSettings();
    if (settings.silentMode) {
      this.silentIcon.textContent = '🔇';
      this.quickSilentBtn.classList.add('active');
    } else {
      this.silentIcon.textContent = '🔊';
      this.quickSilentBtn.classList.remove('active');
    }
  }

  switchView(viewName, params = {}) {
    this.currentView = viewName;

    // Update bottom nav active state
    this.bottomNavItems.forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Check active session badge
    if (this.activeSession) {
      this.activeBadge.classList.remove('hidden');
    } else {
      this.activeBadge.classList.add('hidden');
    }

    // Render corresponding view
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

  /* ==========================================================================
     1. WORKOUTS LIST VIEW
     ========================================================================== */
  renderWorkoutsView() {
    const workouts = window.storageManager.getWorkouts();

    let html = `
      <div class="view-header">
        <h1 class="view-title">🏋️ My Workouts</h1>
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
        const emomCount = w.exercises.filter(ex => ex.type === 'emom').length;

        html += `
          <div class="card" style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <div>
                <h3 style="font-family: var(--font-header); font-size: 18px; color: #fff;">${this.escapeHtml(w.name)}</h3>
                <p style="font-size: 12px; color: var(--text-muted);">${this.escapeHtml(w.description || 'Custom routine')}</p>
              </div>
              <span class="exercise-badge">${w.exercises.length} Exercises (${totalSets} Sets)</span>
            </div>

            <div style="display: flex; gap: 8px; font-size: 11px; color: var(--text-dim); margin-bottom: 12px;">
              ${emomCount > 0 ? `<span style="color: var(--fluo-magenta);">⚡ ${emomCount} EMOM</span>` : ''}
              <span>🕒 Rest configured per exercise</span>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-success btn-sm btn-start-workout" data-id="${w.id}">▶️ Start</button>
              <button class="btn btn-secondary btn-sm btn-edit-workout" data-id="${w.id}">✏️ Config</button>
              <button class="btn btn-secondary btn-sm btn-clone-workout" data-id="${w.id}">📋 Clone</button>
              <button class="btn btn-secondary btn-sm btn-share-workout" data-id="${w.id}">📤 Share</button>
              <button class="btn btn-secondary btn-sm btn-delete-workout" data-id="${w.id}" style="color: var(--fluo-magenta); border-color: rgba(255,0,127,0.3);">🗑️</button>
            </div>
          </div>
        `;
      });
    }

    this.mainContent.innerHTML = html;

    // Event Bindings
    const newBtn = document.getElementById('btn-create-workout') || document.getElementById('btn-create-workout-empty');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.switchView('tabular-editor', { workoutId: null }));
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

  /* ==========================================================================
     2. TABULAR CONFIGURATION EDITOR (Req 11, 14, 15, 16)
     ========================================================================== */
  renderTabularEditorView(workoutId) {
    let workout = workoutId ? window.storageManager.getWorkoutById(workoutId) : null;
    
    if (!workout) {
      workout = {
        id: 'workout_' + Date.now(),
        name: 'New Custom Workout',
        description: '',
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
            emomIntervalSeconds: 60,
            emomTotalRounds: 5
          }
        ]
      };
    }

    // Deep copy for temporary editing state
    this.editingWorkout = JSON.parse(JSON.stringify(workout));

    let html = `
      <div class="view-header">
        <h1 class="view-title">⚙️ Configure Workout</h1>
        <button id="btn-save-tabular" class="btn btn-primary btn-sm">💾 Save Workout</button>
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

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span class="form-label" style="font-size: 13px;">Exercises & Sets List</span>
        <button id="btn-add-row" class="btn btn-secondary btn-sm" style="color: var(--fluo-cyan); border-color: var(--fluo-cyan);">+ Add Exercise</button>
      </div>

      <div class="tabular-container">
        <table class="tabular-table">
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th style="min-width: 120px;">Exercise</th>
              <th style="width: 85px;">Type</th>
              <th style="width: 50px;">Sets</th>
              <th style="width: 55px;">Reps</th>
              <th style="width: 70px;">Weight (kg)</th>
              <th style="width: 65px;">Rest / Interval</th>
              <th style="width: 90px; text-align: center;">Move / Delete</th>
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
    return this.editingWorkout.exercises.map((ex, index) => {
      const isEmom = ex.type === 'emom';
      const weightVal = (ex.weight === null || ex.weight === undefined) ? '' : ex.weight;

      return `
        <tr data-index="${index}">
          <td style="font-weight: 700; color: var(--fluo-cyan);">${index + 1}</td>
          <td>
            <input type="text" class="table-input row-name" value="${this.escapeHtml(ex.name)}" placeholder="Exercise Name">
          </td>
          <td>
            <select class="table-input row-type">
              <option value="standard" ${!isEmom ? 'selected' : ''}>Standard</option>
              <option value="emom" ${isEmom ? 'selected' : ''}>EMOM</option>
            </select>
          </td>
          <td>
            <input type="number" class="table-input row-sets" min="1" max="99" value="${ex.sets || (isEmom ? ex.emomTotalRounds || 5 : 3)}">
          </td>
          <td>
            <input type="number" class="table-input row-reps" min="1" max="999" value="${ex.reps || 10}">
          </td>
          <td>
            <input type="number" step="0.5" class="table-input row-weight" value="${weightVal}" placeholder="BW">
          </td>
          <td>
            <input type="number" class="table-input row-time" min="0" max="999" value="${isEmom ? (ex.emomIntervalSeconds || 60) : (ex.restSeconds || 60)}" title="${isEmom ? 'Interval in sec' : 'Rest in sec'}">
          </td>
          <td>
            <div class="action-btn-group">
              <button class="btn btn-secondary btn-sm row-move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>▲</button>
              <button class="btn btn-secondary btn-sm row-move-down" data-index="${index}" ${index === this.editingWorkout.exercises.length - 1 ? 'disabled' : ''}>▼</button>
              <button class="btn btn-secondary btn-sm row-delete" data-index="${index}" style="color: var(--fluo-magenta);">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  bindTabularEvents() {
    const tbody = document.getElementById('tabular-tbody');

    // Update internal editing array when input values change
    const updateExerciseState = () => {
      this.editingWorkout.name = document.getElementById('edit-workout-name').value.trim() || 'Custom Workout';
      this.editingWorkout.description = document.getElementById('edit-workout-desc').value.trim();

      const rows = tbody.querySelectorAll('tr');
      rows.forEach((tr, idx) => {
        const ex = this.editingWorkout.exercises[idx];
        if (!ex) return;

        ex.name = tr.querySelector('.row-name').value.trim() || `Exercise ${idx + 1}`;
        ex.type = tr.querySelector('.row-type').value;
        ex.sets = parseInt(tr.querySelector('.row-sets').value) || 1;
        ex.reps = parseInt(tr.querySelector('.row-reps').value) || 1;
        
        const rawWeight = tr.querySelector('.row-weight').value.trim();
        ex.weight = rawWeight === '' ? null : parseFloat(rawWeight);

        const timeVal = parseInt(tr.querySelector('.row-time').value) || 60;
        if (ex.type === 'emom') {
          ex.emomIntervalSeconds = timeVal;
          ex.emomTotalRounds = ex.sets;
          ex.restSeconds = 0;
        } else {
          ex.restSeconds = timeVal;
        }
      });
    };

    // Row reordering & action buttons
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

    // Change exercise type (toggle rest vs emom interval)
    tbody.addEventListener('change', (e) => {
      if (e.target.classList.contains('row-type')) {
        updateExerciseState();
        tbody.innerHTML = this.renderTabularRows();
      }
    });

    // Add row button
    document.getElementById('btn-add-row').addEventListener('click', () => {
      updateExerciseState();
      this.editingWorkout.exercises.push({
        id: 'ex_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: 'New Exercise',
        type: 'standard',
        sets: 3,
        reps: 10,
        restSeconds: 60,
        weight: null,
        emomIntervalSeconds: 60,
        emomTotalRounds: 5
      });
      tbody.innerHTML = this.renderTabularRows();
    });

    // Save Workout
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

  /* ==========================================================================
     3. ACTIVE WORKOUT PLAYER & EXECUTION QUEUE (Req 2, 4, 5, 6, 7, 12, 13, 15)
     ========================================================================== */
  startWorkoutSession(workoutId) {
    const workout = window.storageManager.getWorkoutById(workoutId);
    if (!workout || workout.exercises.length === 0) {
      this.showToast('Cannot start an empty workout', 'error');
      return;
    }

    // Build execution set tasks queue
    const queue = [];
    workout.exercises.forEach(ex => {
      const setsCount = parseInt(ex.sets) || 1;
      for (let s = 1; s <= setsCount; s++) {
        queue.push({
          taskId: `task_${ex.id}_set_${s}`,
          exerciseId: ex.id,
          exerciseName: ex.name,
          setIndex: s,
          totalSets: setsCount,
          reps: ex.reps,
          restSeconds: ex.restSeconds || 60,
          weight: ex.weight,
          type: ex.type || 'standard',
          emomIntervalSeconds: ex.emomIntervalSeconds || 60,
          emomTotalRounds: ex.emomTotalRounds || setsCount,
          completed: false
        });
      }
    });

    this.activeSession = {
      workoutId: workout.id,
      workoutName: workout.name,
      startedAt: new Date().toISOString(),
      queue: queue,
      activeTaskIndex: 0,
      completedLogs: [],
      inRest: false
    };

    window.storageManager.saveActiveSession(this.activeSession);
    this.switchView('active-workout');
    this.showToast(`Started "${workout.name}"! Let's go! 🚀`);
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

    // Workout finished condition
    if (remainingTasks.length === 0) {
      this.finishWorkoutSession();
      return;
    }

    // Ensure activeTaskIndex points to an uncompleted set
    if (session.queue[session.activeTaskIndex]?.completed) {
      const nextIdx = session.queue.findIndex(t => !t.completed);
      if (nextIdx >= 0) session.activeTaskIndex = nextIdx;
    }

    const currentTask = session.queue[session.activeTaskIndex];
    const isEmom = currentTask.type === 'emom';

    let html = `
      <div class="view-header">
        <div>
          <span style="font-size: 11px; color: var(--fluo-cyan); font-weight: 700;">ACTIVE SESSION</span>
          <h1 class="view-title">${this.escapeHtml(session.workoutName)}</h1>
        </div>
        <button id="btn-cancel-session" class="btn btn-secondary btn-sm" style="color: var(--fluo-magenta);">Stop</button>
      </div>
    `;

    // REST OVERLAY SCREEN (Req 5, 7, 13)
    if (session.inRest) {
      const nextTask = session.queue.find((t, i) => i > session.activeTaskIndex && !t.completed) || remainingTasks[0];

      html += `
        <div class="rest-overlay">
          <span style="font-size: 13px; font-weight: 800; color: var(--fluo-lime); letter-spacing: 1px;">
            ${isEmom ? '⚡ EMOM INTERVAL RUNNING' : '⏸️ REST & RECOVER'}
          </span>
          <div id="rest-timer-num" class="rest-timer-display">${this.timerSecondsLeft}s</div>

          ${nextTask ? `
            <div class="next-up-banner">
              <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Next Exercise Preview:</span>
              <div style="font-family: var(--font-header); font-size: 16px; color: #fff; margin-top: 2px;">
                ${this.escapeHtml(nextTask.exerciseName)} - Set ${nextTask.setIndex}/${nextTask.totalSets}
              </div>
              <div style="font-size: 12px; color: var(--fluo-lime);">
                Target: ${nextTask.reps} reps ${nextTask.weight ? `@ ${nextTask.weight} kg` : '(Bodyweight)'}
              </div>
            </div>
          ` : ''}

          <div style="display: flex; gap: 8px; justify-content: center; margin-top: 16px;">
            <button id="btn-pause-timer" class="btn btn-secondary btn-sm">${this.isTimerPaused ? '▶️ Resume' : '⏸️ Pause'}</button>
            <button id="btn-add-rest" class="btn btn-secondary btn-sm">+10s</button>
            <button id="btn-skip-rest" class="btn btn-primary btn-sm">Skip Rest ⏩</button>
          </div>
        </div>
      `;
    } else {
      // ACTIVE SET EXECUTOR CARD (Req 2, 3, 4, 12)
      const weightDisplay = currentTask.weight !== null && currentTask.weight !== undefined 
        ? `${currentTask.weight} <span style="font-size: 12px; color: var(--text-muted);">kg</span>` 
        : `<span style="font-size: 18px; color: var(--fluo-cyan);">Bodyweight</span>`;

      html += `
        <div class="card active-player-card">
          <span class="exercise-badge">${isEmom ? '⚡ EMOM MODE' : 'STANDARD SET'} • SET ${currentTask.setIndex} OF ${currentTask.totalSets}</span>
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
              <div class="metric-value">${isEmom ? currentTask.emomIntervalSeconds + 's' : currentTask.restSeconds + 's'}</div>
              <div class="metric-label">${isEmom ? 'Interval' : 'Rest'}</div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button id="btn-quick-weight" class="btn btn-secondary btn-block">⚖️ Adjust Weight</button>
          </div>

          <button id="btn-complete-set" class="btn btn-success btn-block" style="margin-top: 12px; padding: 18px; font-size: 16px;">
            ✅ Complete Set (${currentTask.setIndex}/${currentTask.totalSets})
          </button>
        </div>
      `;
    }

    // EXERCISE QUEUE & SELECTOR DRAWER (Req 2, 4, 6)
    html += `
      <div class="queue-container card" style="margin-top: 16px;">
        <h3 style="font-size: 14px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          Workout Queue (${session.queue.filter(t => t.completed).length}/${session.queue.length} Done)
        </h3>
        <p style="font-size: 11px; color: var(--text-dim); margin-bottom: 12px;">
          Tap any set below to execute it next out-of-order.
        </p>

        ${session.queue.map((task, idx) => {
          const isActive = idx === session.activeTaskIndex;
          const isDone = task.completed;

          return `
            <div class="queue-item ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}" data-index="${idx}">
              <div>
                <strong style="color: #fff;">${this.escapeHtml(task.exerciseName)}</strong>
                <div style="font-size: 11px; color: var(--text-muted);">Set ${task.setIndex}/${task.totalSets} • ${task.reps} reps ${task.weight ? `@ ${task.weight}kg` : ''}</div>
              </div>
              <div>
                ${isDone ? '<span style="color: var(--fluo-lime); font-size: 16px;">✓</span>' : (isActive ? '<span style="color: var(--fluo-cyan); font-weight: 700;">ACTIVE</span>' : '<span style="color: var(--text-dim);">Pick</span>')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.mainContent.innerHTML = html;
    this.bindActivePlayerEvents();
  }

  bindActivePlayerEvents() {
    const session = this.activeSession;
    if (!session) return;

    // Queue item picking (Req 4)
    document.querySelectorAll('.queue-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'));
        if (!session.queue[idx].completed) {
          session.activeTaskIndex = idx;
          if (session.inRest) this.stopRestTimer();
          window.storageManager.saveActiveSession(session);
          this.renderActiveWorkoutView();
        }
      });
    });

    // Stop workout session
    document.getElementById('btn-cancel-session')?.addEventListener('click', () => {
      if (confirm('Cancel active workout session?')) {
        this.stopRestTimer();
        this.activeSession = null;
        window.storageManager.saveActiveSession(null);
        this.switchView('workouts');
      }
    });

    // Complete Set Button
    document.getElementById('btn-complete-set')?.addEventListener('click', () => {
      const currentTask = session.queue[session.activeTaskIndex];
      currentTask.completed = true;
      currentTask.completedAt = new Date().toISOString();

      // Log set execution
      session.completedLogs.push({
        exerciseId: currentTask.exerciseId,
        exerciseName: currentTask.exerciseName,
        setIndex: currentTask.setIndex,
        reps: currentTask.reps,
        weight: currentTask.weight,
        timestamp: new Date().toISOString()
      });

      // Start Rest or EMOM interval timer
      const restSec = currentTask.type === 'emom' ? currentTask.emomIntervalSeconds : currentTask.restSeconds;
      if (restSec > 0) {
        this.startRestTimer(restSec);
      } else {
        this.moveToNextUncompletedSet();
      }
    });

    // Quick Weight Adjuster Modal (Req 12 & Req 5 note: updates workout template config as well!)
    document.getElementById('btn-quick-weight')?.addEventListener('click', () => {
      const currentTask = session.queue[session.activeTaskIndex];
      const currentWeight = currentTask.weight !== null && currentTask.weight !== undefined ? currentTask.weight : '';

      const modalHtml = `
        <h3 style="font-family: var(--font-header); color: #fff; margin-bottom: 12px;">⚖️ Adjust Weight</h3>
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

        // 1. Update current live set task
        currentTask.weight = newWeight;

        // 2. Update remaining sets of same exercise in live session queue
        session.queue.forEach(t => {
          if (t.exerciseId === currentTask.exerciseId && !t.completed) {
            t.weight = newWeight;
          }
        });

        // 3. Update workout template configuration (Req 12 & user prompt update)
        window.storageManager.updateWorkoutExerciseWeight(session.workoutId, currentTask.exerciseId, newWeight);

        window.storageManager.saveActiveSession(session);
        this.closeModal();
        this.showToast('Weight updated and saved to workout template!');
        this.renderActiveWorkoutView();
      });
    });

    // Rest overlay button controls (Req 7)
    document.getElementById('btn-pause-timer')?.addEventListener('click', () => {
      this.isTimerPaused = !this.isTimerPaused;
      this.renderActiveWorkoutView();
    });

    document.getElementById('btn-add-rest')?.addEventListener('click', () => {
      this.timerSecondsLeft += 10;
      const numElem = document.getElementById('rest-timer-num');
      if (numElem) numElem.textContent = `${this.timerSecondsLeft}s`;
    });

    document.getElementById('btn-skip-rest')?.addEventListener('click', () => {
      this.stopRestTimer();
      this.moveToNextUncompletedSet();
    });
  }

  startRestTimer(seconds) {
    this.stopRestTimer();

    this.activeSession.inRest = true;
    this.timerSecondsLeft = seconds;
    this.timerTotalSeconds = seconds;
    this.isTimerPaused = false;

    window.storageManager.saveActiveSession(this.activeSession);
    this.renderActiveWorkoutView();

    this.timerInterval = setInterval(() => {
      if (this.isTimerPaused) return;

      this.timerSecondsLeft--;

      const timerElem = document.getElementById('rest-timer-num');
      if (timerElem) {
        timerElem.textContent = `${this.timerSecondsLeft}s`;
      }

      const settings = window.storageManager.getSettings();

      // Audio Voice Countdown at 3, 2, 1 seconds (Req 13, 15, 20)
      if (this.timerSecondsLeft <= 3 && this.timerSecondsLeft > 0) {
        window.audioEngine.speakNumber(this.timerSecondsLeft, settings.silentMode);
      }

      // Finish rest at 0s
      if (this.timerSecondsLeft <= 0) {
        window.audioEngine.playStartBeep(settings.silentMode);
        this.stopRestTimer();
        this.moveToNextUncompletedSet();
      }
    }, 1000);
  }

  stopRestTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.activeSession) {
      this.activeSession.inRest = false;
      window.storageManager.saveActiveSession(this.activeSession);
    }
  }

  moveToNextUncompletedSet() {
    if (!this.activeSession) return;

    const remainingTasks = this.activeSession.queue.filter(t => !t.completed);
    if (remainingTasks.length === 0) {
      this.finishWorkoutSession();
    } else {
      // Find next uncompleted set index
      const nextIdx = this.activeSession.queue.findIndex((t, i) => i > this.activeSession.activeTaskIndex && !t.completed);
      if (nextIdx >= 0) {
        this.activeSession.activeTaskIndex = nextIdx;
      } else {
        // Wrap around to first uncompleted task
        this.activeSession.activeTaskIndex = this.activeSession.queue.findIndex(t => !t.completed);
      }
      window.storageManager.saveActiveSession(this.activeSession);
      this.renderActiveWorkoutView();
    }
  }

  finishWorkoutSession() {
    this.stopRestTimer();

    const session = this.activeSession;
    if (!session) return;

    const durationSeconds = Math.round((new Date().getTime() - new Date(session.startedAt).getTime()) / 1000);
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    // Save into Workout Log Diary (Req 17)
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

    // Show Celebration Modal
    const modalHtml = `
      <div style="text-align: center; padding: 12px 0;">
        <span style="font-size: 48px;">🏆</span>
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

  /* ==========================================================================
     4. WORKOUT DIARY SUMMARY VIEW (Req 17)
     ========================================================================== */
  renderDiaryView() {
    const logs = window.storageManager.getLogs();

    let html = `
      <div class="view-header">
        <h1 class="view-title">📅 Workout Diary</h1>
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
                ⏱️ ${log.durationMinutes} min
              </span>
            </div>

            <div style="font-size: 12px; color: var(--text-main); margin: 8px 0;">
              <strong>${log.completedSetsCount} Sets Executed:</strong>
              <ul style="margin-top: 4px; padding-left: 16px; color: var(--text-muted); font-size: 11px;">
                ${(log.setsDetail || []).map(s => `
                  <li>${this.escapeHtml(s.exerciseName)} (Set ${s.setIndex}): ${s.reps} reps ${s.weight ? `@ ${s.weight}kg` : '(BW)'}</li>
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

  /* ==========================================================================
     5. DATA SHARE & SELECTIVE IMPORT VIEW (Req 9, 10)
     ========================================================================== */
  renderShareImportView() {
    let html = `
      <div class="view-header">
        <h1 class="view-title">📤 Export & Import</h1>
      </div>

      <div class="card" style="margin-bottom: 16px;">
        <h3 style="font-family: var(--font-header); font-size: 16px; color: #fff; margin-bottom: 8px;">Export & Share Database</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
          Export your local workouts into a portable text string file to share with friends or transfer to another device.
        </p>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="btn-export-share" class="btn btn-primary btn-sm">📱 Share via App</button>
          <button id="btn-export-copy" class="btn btn-secondary btn-sm">📋 Copy Text String</button>
          <button id="btn-export-file" class="btn btn-secondary btn-sm">💾 Download JSON File</button>
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
            📂 Pick File
            <input type="file" id="import-file-input" accept=".json,.txt" style="display: none;">
          </label>
        </div>
      </div>
    `;

    this.mainContent.innerHTML = html;

    // Export Handlers
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

    // Selective Import Handlers (Req 10)
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
    const modalHtml = `
      <h3 style="font-family: var(--font-header); color: #fff; margin-bottom: 8px;">Select Workouts to Import</h3>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
        Choose which workouts from the imported data you want to save into your local storage:
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

    // Toggle all checkboxes
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

      const workoutsToImport = selectedIndexes.map(idx => candidateWorkouts[idx]);
      const importedCount = window.exportImportManager.importWorkouts(workoutsToImport, 'keep_both');

      this.closeModal();
      this.showToast(`Successfully imported ${importedCount} workout(s)!`);
      this.switchView('workouts');
    });
  }

  /* ==========================================================================
     6. SETTINGS VIEW (Req 20, 21)
     ========================================================================== */
  renderSettingsView() {
    const settings = window.storageManager.getSettings();

    let html = `
      <div class="view-header">
        <h1 class="view-title">⚙️ App Settings</h1>
      </div>

      <div class="card" style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <strong style="color: #fff; font-size: 15px;">Silent Mode (Req 20)</strong>
            <p style="font-size: 11px; color: var(--text-muted);">Mutes all voice countdowns and start audio beeps.</p>
          </div>
          <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
            <input type="checkbox" id="setting-silent" ${settings.silentMode ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
            <span style="position: absolute; cursor: pointer; top:0; left:0; right:0; bottom:0; background: ${settings.silentMode ? 'var(--fluo-cyan)' : '#334155'}; border-radius: 24px; transition: 0.2s;"></span>
          </label>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <strong style="color: #fff; font-size: 15px;">Voice Countdown (3, 2, 1)</strong>
            <p style="font-size: 11px; color: var(--text-muted);">Web Speech synthesis counts down 3s before rest ends.</p>
          </div>
          <span style="color: var(--fluo-lime); font-size: 12px; font-weight: 700;">Active</span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="color: #fff; font-size: 15px;">Start Chime Beep Tone</strong>
            <p style="font-size: 11px; color: var(--text-muted);">Web Audio API tone signals exercise start.</p>
          </div>
          <button id="btn-test-audio" class="btn btn-secondary btn-sm">🔊 Test Audio</button>
        </div>
      </div>

      <div class="card">
        <h3 style="font-family: var(--font-header); font-size: 15px; color: #fff; margin-bottom: 8px;">Storage & Reset</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
          All workout data is stored locally on this smartphone device.
        </p>
        <button id="btn-reset-defaults" class="btn btn-secondary btn-sm" style="color: var(--fluo-magenta); border-color: rgba(255,0,127,0.3);">
          ⚠️ Restore Preset Workouts
        </button>
      </div>
    `;

    this.mainContent.innerHTML = html;

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

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  window.cyberPumpApp = new CyberPumpApp();
});
