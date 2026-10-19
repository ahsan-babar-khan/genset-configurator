// rules.js - compatibility and validation logic.
// Pure functions only: they take product data and selections and return
// new values. No DOM access, so they can be tested in Node.
//
// "selections" is a flat object keyed by group id, e.g.
//   { engine: "nw-m500", fuel: "lng", cooling: "radiator" }
// A group with no choice yet is missing or null.

// The order of the steps in the form. This is app structure, not product data.
export const STEPS = ["engine", "fuel", "options", "summary"];

const AVAILABLE = Object.freeze({ available: true, reason: "" });

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

// Every selection group, in display order: engine, fuel, then option groups.
export function getAllGroups(data) {
  return ["engine", "fuel", ...data.optionGroups.map((g) => g.id)];
}

// All selectable items of a group, whatever kind of group it is.
export function getGroupItems(data, group) {
  if (group === "engine") return data.engines;
  if (group === "fuel") return data.fuels;
  const optionGroup = data.optionGroups.find((g) => g.id === group);
  return optionGroup ? optionGroup.options : [];
}

export function findItem(data, group, id) {
  return getGroupItems(data, group).find((item) => item.id === id) ?? null;
}

// Engines have a "name", everything else has a "label".
export function getItemLabel(data, group, id) {
  const item = findItem(data, group, id);
  return item ? item.name ?? item.label : id;
}

export function getGroupLabel(data, group) {
  if (group === "engine") return "Engine";
  if (group === "fuel") return "Fuel";
  const optionGroup = data.optionGroups.find((g) => g.id === group);
  return optionGroup ? optionGroup.label : group;
}

// Which selection groups each step is responsible for.
export function getStepGroups(data, step) {
  if (step === "engine") return ["engine"];
  if (step === "fuel") return ["fuel"];
  if (step === "options") return data.optionGroups.filter((g) => g.required).map((g) => g.id);
  return [];
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

// Works out, for every item in every group, whether it can be chosen with
// the current selections, and if not, why. Shape of the result:
//   { fuel: { lng: { available: false, reason: "Not supported by ..." } } }
export function getAvailability(data, selections) {
  const engine = findItem(data, "engine", selections.engine);
  const availability = {};

  availability.engine = Object.fromEntries(data.engines.map((e) => [e.id, AVAILABLE]));

  availability.fuel = Object.fromEntries(
    data.fuels.map((fuel) => {
      if (engine && !engine.supportedFuels.includes(fuel.id)) {
        return [fuel.id, { available: false, reason: `Not supported by the ${engine.name}.` }];
      }
      return [fuel.id, AVAILABLE];
    })
  );

  for (const group of data.optionGroups) {
    availability[group.id] = Object.fromEntries(group.options.map((o) => [o.id, AVAILABLE]));
  }

  applyRules(data, selections, availability);
  return availability;
}

// The rule engine. Walks the "rules" list from products.json and disables
// items in the availability map. There is no product-specific code here:
// a new rule in the JSON works without touching this function.
//
//   excludes: if X is selected, the "then" item is disabled
//   requires: if X is selected, every OTHER item in the "then" group is disabled
function applyRules(data, selections, availability) {
  for (const rule of data.rules ?? []) {
    if (selections[rule.if.group] !== rule.if.value) continue; // rule not triggered

    const targetGroup = availability[rule.then.group];
    if (!targetGroup) continue;

    let blockedIds;
    if (rule.type === "excludes") {
      blockedIds = [rule.then.value];
    } else if (rule.type === "requires") {
      blockedIds = Object.keys(targetGroup).filter((id) => id !== rule.then.value);
    } else {
      continue; // unknown type: reported by checkDataIntegrity()
    }

    for (const id of blockedIds) {
      if (targetGroup[id]) targetGroup[id] = disable(targetGroup[id], rule.message);
    }
  }
}

// Marks an item unavailable. If several rules block the same item, all
// their reasons are kept.
function disable(status, reason) {
  if (status.available) return { available: false, reason };
  if (status.reason.includes(reason)) return status;
  return { available: false, reason: `${status.reason} ${reason}` };
}

// Selections that are no longer allowed (or no longer exist in the data).
export function findInvalidSelections(data, selections) {
  const availability = getAvailability(data, selections);
  const invalid = [];

  for (const [group, value] of Object.entries(selections)) {
    if (value == null) continue;
    const status = availability[group]?.[value];
    if (!status) {
      invalid.push({ group, value, reason: "This choice is no longer offered." });
    } else if (!status.available) {
      invalid.push({ group, value, reason: status.reason });
    }
  }
  return invalid;
}

// Removes invalid selections. Returns the cleaned selections plus a list of
// what was removed, so the UI can tell the user.
// One pass is enough: removing a choice can only lift restrictions, never
// create new ones, because rules only trigger on things that are selected.
export function sanitizeSelections(data, selections) {
  const resets = findInvalidSelections(data, selections);
  const cleaned = { ...selections };
  for (const { group } of resets) delete cleaned[group];
  return { selections: cleaned, resets };
}

// Applies one user choice and resolves any knock-on effects.
export function applySelection(data, selections, group, value) {
  return sanitizeSelections(data, { ...selections, [group]: value });
}

// Human-readable text for a reset, e.g.
//   'Fuel "LNG" was cleared: Not supported by the NW-M250 Compact.'
export function describeReset(data, { group, value, reason }) {
  return `${getGroupLabel(data, group)} "${getItemLabel(data, group, value)}" was cleared: ${reason}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// Checks that every required group of a step has a choice.
export function validateStep(data, selections, step) {
  const missing = getStepGroups(data, step).filter((group) => !selections[group]);
  if (missing.length === 0) return { valid: true, missing, message: "" };

  let message;
  if (step === "engine") message = "Please choose an engine to continue.";
  else if (step === "fuel") message = "Please choose a fuel type to continue.";
  else message = `Please make a choice for: ${missing.map((g) => getGroupLabel(data, g)).join(", ")}.`;

  return { valid: false, missing, message };
}

// The first step that still has missing choices, or -1 if all are complete.
export function firstIncompleteStep(data, selections) {
  return STEPS.findIndex((step) => !validateStep(data, selections, step).valid);
}

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------

// Catches typos in products.json, e.g. a rule pointing at an option id that
// doesn't exist. Returns a list of problems (empty when the data is fine).
export function checkDataIntegrity(data) {
  const problems = [];
  const exists = (group, id) => findItem(data, group, id) !== null;

  for (const engine of data.engines) {
    for (const fuel of engine.supportedFuels) {
      if (!exists("fuel", fuel)) problems.push(`Engine "${engine.id}" lists unknown fuel "${fuel}".`);
    }
  }
  for (const rule of data.rules ?? []) {
    if (!["excludes", "requires"].includes(rule.type)) {
      problems.push(`Rule "${rule.id}" has unknown type "${rule.type}".`);
    }
    for (const cond of [rule.if, rule.then]) {
      if (!exists(cond.group, cond.value)) {
        problems.push(`Rule "${rule.id}" refers to unknown ${cond.group} "${cond.value}".`);
      }
    }
  }
  for (const mod of data.modifiers ?? []) {
    if (!exists(mod.when.group, mod.when.value)) {
      problems.push(`Modifier "${mod.id}" refers to unknown ${mod.when.group} "${mod.when.value}".`);
    }
  }
  return problems;
}
