// ui.js - everything that touches the DOM.
// Two kinds of functions:
//   build*  create elements once, when the data has loaded
//   update* change existing elements (checked, disabled, text) on every
//           state change. Updating in place, instead of rebuilding, keeps
//           keyboard focus where it is while the user arrows through radios.

import { STEPS } from "./rules.js";

const $ = (selector, root = document) => root.querySelector(selector);

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function createFormatters(meta) {
  const money = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: meta.currency,
    maximumFractionDigits: 0,
  });
  const number = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 });

  return {
    money: (value) => money.format(value),
    number: (value) => number.format(value),
    // Price of an add-on relative to the base: "+€9,800" or "Included"
    extra: (value) => (value > 0 ? `+${money.format(value)}` : "Included"),
  };
}

// ---------------------------------------------------------------------------
// Element helper
// ---------------------------------------------------------------------------

// Small createElement wrapper. Text is always set with textContent, never
// innerHTML, so data from the JSON or URL can't inject HTML.
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

// ---------------------------------------------------------------------------
// Choice cards
// ---------------------------------------------------------------------------

// One radio card. `lines` are extra text lines under the title.
function buildChoice({ name, id, title, lines = [], price }) {
  const inputId = `${name}-${id}`;
  const input = el("input", { type: "radio", name, value: id, id: inputId });

  const body = el("span", { class: "choice__body" }, [
    el("span", { class: "choice__title", text: title }),
    ...lines.map((line) => el("span", { class: "choice__meta", text: line })),
    el("span", { class: "choice__price", text: price }),
    el("span", { class: "choice__reason", id: `${inputId}-reason`, hidden: "" }),
  ]);

  return el("label", { class: "choice", for: inputId }, [input, body]);
}

export function buildEngineChoices(container, data, fmt) {
  const fuelLabel = (id) => data.fuels.find((f) => f.id === id)?.label ?? id;

  container.replaceChildren(
    ...data.engines.map((engine) =>
      buildChoice({
        name: "engine",
        id: engine.id,
        title: engine.name,
        lines: [
          `${fmt.number(engine.powerKw)} kW · ${engine.cylinders} cylinders · ${fmt.number(engine.weightKg)} kg`,
          `Fuels: ${engine.supportedFuels.map(fuelLabel).join(", ")}`,
        ],
        price: fmt.money(engine.basePrice),
      })
    )
  );
}

export function buildFuelChoices(container, data, fmt) {
  container.replaceChildren(
    ...data.fuels.map((fuel) =>
      buildChoice({
        name: "fuel",
        id: fuel.id,
        title: fuel.label,
        lines: [fuel.description],
        price: fmt.extra(fuel.price),
      })
    )
  );
}

// Syncs every radio in the form with the state: checked, disabled, and the
// "why disabled" text, which is linked to the input with aria-describedby.
export function updateChoices(form, selections, availability) {
  for (const input of form.querySelectorAll('input[type="radio"]')) {
    const status = availability[input.name]?.[input.value] ?? { available: true, reason: "" };
    const reason = document.getElementById(`${input.id}-reason`);

    input.checked = selections[input.name] === input.value;
    input.disabled = !status.available;

    if (reason) {
      reason.textContent = status.reason;
      reason.hidden = status.available;
    }
    if (status.available) input.removeAttribute("aria-describedby");
    else input.setAttribute("aria-describedby", reason.id);
  }
}

// ---------------------------------------------------------------------------
// Steps and progress
// ---------------------------------------------------------------------------

export function updateSteps(stepIndex) {
  STEPS.forEach((step, i) => {
    $(`#step-${step}`).hidden = i !== stepIndex;
  });

  document.querySelectorAll(".progress__item").forEach((item, i) => {
    item.classList.toggle("is-complete", i < stepIndex);
    if (i === stepIndex) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });

  const isLast = stepIndex === STEPS.length - 1;
  $("#btn-back").hidden = stepIndex === 0;
  $("#btn-next").hidden = isLast;
  $("#btn-next").textContent = stepIndex === STEPS.length - 2 ? "Review quote" : "Next";
}

// Moves focus to the new step's heading, so screen-reader and keyboard
// users start at the top of the step instead of on a now-hidden button.
export function focusStepHeading(stepIndex) {
  $(`#step-${STEPS[stepIndex]}-title`)?.focus();
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function showStepError(step, message) {
  $(`#${step}-error`).textContent = message;
}

export function clearStepErrors() {
  for (const step of STEPS) {
    const box = $(`#${step}-error`);
    if (box) box.textContent = "";
  }
}

// Puts focus on the first selectable radio of a group, used after a
// validation error so the user lands right where the fix is needed.
export function focusGroup(form, group) {
  form.querySelector(`input[name="${group}"]:not(:disabled)`)?.focus();
}

export function showNotice(messages) {
  $("#notice").textContent = messages.join(" ");
}

export function clearNotice() {
  $("#notice").textContent = "";
}

export function showLoadError(message) {
  const box = el("p", { class: "load-error", role: "alert", text: message });
  $("#engine-choices").replaceChildren(box);
  $("#btn-next").disabled = true;
}

export function setDisclaimer(text) {
  $("#disclaimer").textContent = text;
}
