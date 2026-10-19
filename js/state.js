// state.js - the single source of truth for the current configuration.
// Holds the user's selections and the current step. Other modules never
// change these directly: they call the methods below, and anything that
// subscribed is told to re-render.
//
// Also converts the configuration to and from the two places it is kept
// outside memory: localStorage (save/load) and the URL (shareable link).

export function createState({ selections: initialSelections = {}, step: initialStep = 0 } = {}) {
  let selections = { ...initialSelections };
  let step = initialStep;
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    getSelections() {
      return { ...selections }; // a copy, so callers can't mutate state by accident
    },

    getStep() {
      return step;
    },

    setSelections(next) {
      selections = { ...next };
      notify();
    },

    setStep(index) {
      if (index === step) return;
      step = index;
      notify();
    },

    reset() {
      selections = {};
      step = 0;
      notify();
    },

    // Returns an unsubscribe function.
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ---------------------------------------------------------------------------
// Shareable link (URL query string)
// ---------------------------------------------------------------------------

// { engine: "nw-m500", fuel: "lng" } -> "engine=nw-m500&fuel=lng"
// `groups` fixes the order, so the same configuration always gives the same link.
export function selectionsToQuery(selections, groups) {
  const params = new URLSearchParams();
  for (const group of groups) {
    if (selections[group]) params.set(group, selections[group]);
  }
  return params.toString();
}

// "?engine=nw-m500&fuel=lng&utm_source=x" -> { engine: "nw-m500", fuel: "lng" }
// Unknown keys are ignored. Values are NOT trusted here: the caller must run
// them through sanitizeSelections() because anyone can edit a URL.
export function selectionsFromQuery(search, groups) {
  const params = new URLSearchParams(search);
  const selections = {};
  for (const group of groups) {
    const value = params.get(group);
    if (value) selections[group] = value;
  }
  return selections;
}

// ---------------------------------------------------------------------------
// Save / load (localStorage)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "genset-configurator:v1";

// localStorage can throw: it may be disabled, full, or blocked in private
// browsing, and the stored text may be corrupted. Saving is a convenience,
// so every failure is caught and the app keeps working without it.
export function saveConfiguration(selections, dataVersion) {
  try {
    if (Object.keys(selections).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    }
    const record = { selections, dataVersion, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch (error) {
    console.warn("Could not save configuration:", error);
    return false;
  }
}

// Returns the saved selections, or null if there is nothing usable.
export function loadConfiguration() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    const selections = record?.selections;
    if (typeof selections !== "object" || selections === null || Array.isArray(selections)) return null;
    // Keep only string values; anything else is not something we wrote.
    return Object.fromEntries(Object.entries(selections).filter(([, v]) => typeof v === "string"));
  } catch (error) {
    console.warn("Could not load saved configuration:", error);
    return null;
  }
}

export function clearSavedConfiguration() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear saved configuration:", error);
  }
}
