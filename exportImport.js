/**
 * CYBERPUMP Data Export, Import & Web Sharing Engine (Req 9, 10)
 */

class ExportImportManager {
  /**
   * Export all or selected workouts as JSON string formatted payload
   * @param {Array<string>} workoutIds Optional filter of specific workout IDs
   */
  exportData(workoutIds = null) {
    const allWorkouts = window.storageManager.getWorkouts();
    const workoutsToExport = workoutIds 
      ? allWorkouts.filter(w => workoutIds.includes(w.id))
      : allWorkouts;

    const payload = {
      app: 'CYBERPUMP',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workoutsCount: workoutsToExport.length,
      workouts: workoutsToExport
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Trigger native Web Share API on mobile devices or fallback to clipboard
   */
  async shareWorkouts(workoutIds = null) {
    const jsonString = this.exportData(workoutIds);
    const title = 'CYBERPUMP Workouts Export';
    const text = `Here are my CYBERPUMP workouts export (${new Date().toLocaleDateString()}). Copy and import into your app:`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `${text}\n\n${jsonString}`
        });
        return { success: true, method: 'native-share' };
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Native share error, falling back to clipboard:', err);
        } else {
          return { success: false, reason: 'cancelled' };
        }
      }
    }

    // Fallback to Clipboard
    try {
      await navigator.clipboard.writeText(jsonString);
      return { success: true, method: 'clipboard' };
    } catch (err) {
      return { success: false, reason: 'clipboard-denied' };
    }
  }

  /**
   * Download export payload as a text/json file
   */
  downloadExportFile(workoutIds = null) {
    const jsonString = this.exportData(workoutIds);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyberpump_workouts_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Parse text payload from string or file content
   * @param {string} rawString 
   * @returns {Array<Object>|null} Array of candidate workouts or null if invalid
   */
  parseImportString(rawString) {
    try {
      const cleanString = rawString.trim();
      const data = JSON.parse(cleanString);
      
      let workoutsList = [];
      if (Array.isArray(data)) {
        workoutsList = data;
      } else if (data && Array.isArray(data.workouts)) {
        workoutsList = data.workouts;
      } else if (data && data.name && Array.isArray(data.exercises)) {
        // Single workout payload
        workoutsList = [data];
      }

      // Basic structure validation
      const validWorkouts = workoutsList.filter(w => w && w.name && Array.isArray(w.exercises));
      return validWorkouts.length > 0 ? validWorkouts : null;
    } catch (e) {
      console.error('Import parse error:', e);
      return null;
    }
  }

  /**
   * Import selected workouts into local storage with duplicate protection
   * @param {Array<Object>} selectedWorkouts 
   * @param {'overwrite'|'keep_both'|'skip'} duplicateStrategy 
   */
  importWorkouts(selectedWorkouts, duplicateStrategy = 'keep_both') {
    const existingWorkouts = window.storageManager.getWorkouts();
    let importedCount = 0;

    selectedWorkouts.forEach(item => {
      const cloned = JSON.parse(JSON.stringify(item));
      const existing = existingWorkouts.find(w => w.id === cloned.id || w.name.toLowerCase() === cloned.name.toLowerCase());

      if (existing) {
        if (duplicateStrategy === 'overwrite') {
          cloned.id = existing.id;
          window.storageManager.saveWorkout(cloned);
          importedCount++;
        } else if (duplicateStrategy === 'keep_both') {
          cloned.id = 'imported_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          cloned.name = `${cloned.name} (Imported)`;
          window.storageManager.saveWorkout(cloned);
          importedCount++;
        }
        // 'skip' does nothing
      } else {
        cloned.id = cloned.id || ('imported_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));
        window.storageManager.saveWorkout(cloned);
        importedCount++;
      }
    });

    return importedCount;
  }
}

window.exportImportManager = new ExportImportManager();
