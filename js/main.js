// main.js - entry point. Loads the product data, creates the state, and
// connects user events -> rules -> state -> UI. Contains no product
// knowledge itself: every option, price and rule comes from products.json.

import { createState } from "./state.js";
import {
  STEPS,
  getAvailability,
  applySelection,
  describeReset,
  validateStep,
  checkDataIntegrity,
} from "./rules.js";
import * as ui from "./ui.js";

const DATA_URL = "data/products.json";

async function loadData() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${DATA_URL}`);
  return response.json();
}

async function init() {
  let data;
  try {
    data = await loadData();
  } catch (error) {
    console.error(error);
    ui.showLoadError(
      "Sorry, the product data could not be loaded. If you opened index.html " +
        "straight from disk, run it through a local server such as VS Code Live Server."
    );
    return;
  }

  // Warn (don't crash) if someone made a typo while editing the JSON.
  for (const problem of checkDataIntegrity(data)) console.warn("[products.json]", problem);

  const form = document.getElementById("config-form");
  const state = createState();
  const fmt = ui.createFormatters(data.meta);

  ui.buildEngineChoices(document.getElementById("engine-choices"), data, fmt);
  ui.buildFuelChoices(document.getElementById("fuel-choices"), data, fmt);
  ui.setDisclaimer(data.meta.disclaimer);

  // Re-render from state on every change.
  function render() {
    const selections = state.getSelections();
    ui.updateChoices(form, selections, getAvailability(data, selections));
    ui.updateSteps(state.getStep());
  }

  // --- Events -------------------------------------------------------------

  // One listener for the whole form (event delegation) instead of one per radio.
  form.addEventListener("change", (event) => {
    const input = event.target;
    if (input.type !== "radio") return;

    const { selections, resets } = applySelection(data, state.getSelections(), input.name, input.value);
    state.setSelections(selections);

    ui.clearStepErrors();
    if (resets.length > 0) ui.showNotice(resets.map((r) => describeReset(data, r)));
    else ui.clearNotice();
  });

  function goToStep(index) {
    ui.clearStepErrors();
    ui.clearNotice();
    state.setStep(index);
    ui.focusStepHeading(index);
  }

  document.getElementById("btn-next").addEventListener("click", () => {
    const step = state.getStep();
    const result = validateStep(data, state.getSelections(), STEPS[step]);

    if (!result.valid) {
      ui.showStepError(STEPS[step], result.message);
      ui.focusGroup(form, result.missing[0]);
      return;
    }
    goToStep(step + 1);
  });

  document.getElementById("btn-back").addEventListener("click", () => {
    goToStep(Math.max(0, state.getStep() - 1));
  });

  state.subscribe(render);
  render();
}

init();
