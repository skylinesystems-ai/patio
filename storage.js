window.PatioStorage = (() => {
  const KEY = "controlePatio.v1";
  const empty = () => ({ vehicles: [], maintenances: [], history: [] });

  function normalize(data) {
    const base = empty();
    if (!data || typeof data !== "object") return base;
    base.vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
    base.maintenances = Array.isArray(data.maintenances) ? data.maintenances : [];
    base.history = Array.isArray(data.history) ? data.history : [];
    return base;
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      return normalize(JSON.parse(raw));
    } catch (error) {
      console.error("Falha ao carregar LocalStorage:", error);
      return empty();
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(normalize(data)));
      return true;
    } catch (error) {
      console.error("Falha ao salvar LocalStorage:", error);
      return false;
    }
  }

  let state = loadData();

  return {
    getState: () => state,
    save: () => saveData(state),
    replace: (newState) => { state = normalize(newState); saveData(state); },
    reload: () => { state = loadData(); return state; },
    clear: () => { state = empty(); saveData(state); },
    key: KEY
  };
})();
