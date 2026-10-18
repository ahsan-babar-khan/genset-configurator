// state.js - the single source of truth for the current configuration.
// Holds the user's selections and the current step. Other modules never
// change these directly: they call the methods below, and anything that
// subscribed is told to re-render.

export function createState() {
  let selections = {};
  let step = 0;
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
