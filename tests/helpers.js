// Shared test helpers: loads the real products.json, so the tests check
// the data the app actually ships with.
import { readFileSync } from "node:fs";

export function loadData() {
  const url = new URL("../data/products.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8"));
}

// A full, valid configuration used by several tests.
export const FULL_CONFIG = Object.freeze({
  engine: "nw-m500",
  fuel: "lng",
  cooling: "heat-exchanger",
  control: "advanced",
  aftertreatment: "none",
  enclosure: "yes",
  warranty: "5y",
});
