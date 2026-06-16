(function () {
  const DATA_KEY = "challenge-dashboard:data:v1";
  const SETTINGS_KEY = "challenge-dashboard:settings:v1";

  window.Store = {
    loadData() {
      try {
        return JSON.parse(localStorage.getItem(DATA_KEY)) || null;
      } catch {
        return null;
      }
    },
    saveData(data) {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
    },
    loadSettings() {
      try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
      } catch {
        return {};
      }
    },
    saveSettings(settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  };
})();
