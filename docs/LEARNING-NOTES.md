# Learning notes

What each stage built, why it was built that way, and what to say about it in an interview.
Read these after the project is finished, alongside the code.

---

## Stage 1: Project setup and data model

**Files:** `data/products.json`, `.gitignore`, `.gitattributes`, `README.md`

### products.json design decisions
1. **Everything is referenced by `id`, not by display text.** Rules say `"value": "methanol"`, not `"Methanol"`.
   Labels can change without breaking rules, saved configs or share links.
2. **Units are in field names** (`powerKw`, `weightKg`, `co2FactorTPerTFuel`), so nobody guesses whether a weight is kg or tonnes.
3. **Rules are data.** Two types:
   - `excludes`: if X is chosen, option Y is disabled (LNG → no SCR).
   - `requires`: if X is chosen, only option Y is allowed in that group (methanol → advanced control).
   Every rule has the same shape (`if` → `then` → `message`), so `rules.js` is one generic loop with no product-specific `if` statements.
4. **Engine–fuel compatibility** lives on the engine as `supportedFuels`.
5. **Modifiers are separate from rules.** "Enclosure adds 8% weight" doesn't block anything, it changes a calculation, so `pricing.js` reads it, not `rules.js`.
6. **CO2 assumptions are in the data** (running hours, load factor), so the estimate is transparent.
   Formula: kW × load factor × hours × g/kWh × CO2 factor ÷ 1,000,000 = tonnes CO2 per year.
7. **Every group is `required` with no default**, which gives validation something to enforce.

### How to trace a rule by hand
Search the JSON for the ID you picked (e.g. `nw-m250`). Every hit is something that choice affects.
NW-M250 + Methanol fires two rules: `m250-no-heat-exchanger` (Cooling) and `methanol-needs-advanced-control` (Control).

### Git
- `git init -b main` uses the modern default branch name.
- `.gitattributes` with `eol=lf`: Windows uses CRLF line endings, Mac/Linux use LF. Normalising them stops diffs where every line looks changed.
- Conventional commit prefixes (`feat:`, `fix:`, `style:`, `docs:`, `test:`, `chore:`), one commit per finished feature, so the history reads like a changelog and features can be reverted cleanly.

---

## Stage 2: Static HTML layout and CSS

**Files:** `index.html`, `css/styles.css`

### HTML structure (semantic elements)
| Element | Why |
|---|---|
| `<header>`, `<main>`, `<aside>`, `<footer>`, `<nav>` | Landmarks: screen-reader users can jump between them |
| `<a class="skip-link">` | First Tab stop; lets keyboard users skip the header |
| `<ol>` for the progress indicator | Steps are an ordered list; `aria-current="step"` marks the current one |
| `<form novalidate>` | We do our own validation messages instead of the browser's popups |
| `<section hidden>` per step | Only one step visible; `hidden` also removes it from the accessibility tree |
| `<fieldset>` + `<legend>` | Groups radio buttons so a screen reader says "Engine model, radio group" |
| `<label>` wrapping each `<input type="radio">` | Clicking the whole card selects it; arrow keys move between options for free |
| `<dl>` (`dt`/`dd`) in the summary | Name/value pairs: "Power: 500 kW" |
| `aria-live="polite"` on the total and the notice | Screen readers announce changes without the user moving focus |
| `aria-describedby` on disabled inputs | Links the input to its "why disabled" text so it is read out |
| `tabindex="-1"` on step headings | Lets JS move focus to the new step's heading after Next/Back |

The engine step contains **placeholder cards** so the styles can be reviewed. Stage 3 replaces them with cards generated from `products.json`. The HTML has no real product data.

### CSS techniques
- **Custom properties (design tokens)** in `:root`: colours, spacing, radius. Dark mode is one `@media (prefers-color-scheme: dark)` block that only changes colour tokens, and every component follows.
- **Mobile-first layout:** the default is one column. `@media (min-width: 60rem)` switches `.layout` to a two-column **Grid** (`minmax(0, 1fr) 22rem`) and makes the summary `position: sticky`.
- **Responsive cards without media queries:** `grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr))` fits as many 14rem cards per row as there is room for. `min(100%, …)` prevents overflow on very small screens.
- **Flexbox** for one-dimensional layouts (header, buttons, card contents). **Grid** for two-dimensional ones (page, cards, summary figures).
- **`:has()`** styles the card based on its radio: `.choice:has(input:checked)`, `.choice:has(input:disabled)`, `.choice:has(input:focus-visible)`. No JS needed for visual state.
- **`:focus-visible`** shows a clear orange focus ring for keyboard users without showing it on mouse clicks.
- **`[hidden] { display: none !important }`** stops CSS `display` rules from accidentally showing hidden elements.
- **`:empty`** hides the notice and error boxes when they have no text, while keeping them in the DOM (live regions must exist before they change, or screen readers may miss the announcement).
- **`font-variant-numeric: tabular-nums`** keeps digits the same width so the price doesn't wobble as it updates.
- **`prefers-reduced-motion`** turns off transitions for users who ask for less motion.
- **Disabled reasons are always visible**, not hover-only tooltips, because hover doesn't exist on touch screens or for keyboard users.

### Bug found while testing
On mobile there was a big empty gap between the form and the summary. The page is a flex column with `.layout { flex: 1 }`, so the grid was taller than its content and stretched its rows to fill it. Fix: `align-content: start`.

### Tested
Screenshots at 1280px (two columns, sticky summary), 375px and 320px (one column, no horizontal scroll).

---

## Stage 3: Loading the JSON, Engine and Fuel steps

**Files:** `js/main.js`, `js/state.js`, `js/rules.js`, `js/ui.js` (+ small edits to `index.html` and `styles.css`)

### How the four modules fit together
```
user clicks a radio
   └─> main.js  (event listener)
         └─> rules.js  applySelection()   pure: returns new selections + what was reset
               └─> state.js  setSelections()   stores them, notifies subscribers
                     └─> main.js render()
                           └─> ui.js  updateChoices(), updateSteps()   touches the DOM
```
This is **one-way data flow**: the DOM never holds the truth, the state does. The UI is always redrawn *from* the state, so it can't drift out of sync. This is the same idea React and Redux are built on, done by hand.

### main.js: wiring
- `fetch("data/products.json")` inside `try/catch`. If it fails, the user gets a readable message instead of a blank page.
- **Event delegation:** one `change` listener on the `<form>` handles every radio, including ones built later. `event.target.name` says which group, `.value` which item.
- Next button: `validateStep()` first. If invalid, show the message and move focus to the first radio of the missing group.
- `checkDataIntegrity()` runs on load and prints warnings for typos in the JSON.

### state.js: a tiny store
- `selections` is a flat object: `{ engine: "nw-m500", fuel: "lng" }`. Flat on purpose, because it maps directly to a URL query string (Stage 6) and to rule conditions (`selections[rule.if.group]`).
- `getSelections()` returns a **copy**, so no other module can change state by accident.
- `subscribe(listener)` is the **observer pattern**: main.js subscribes `render`, and every change triggers a redraw.

### rules.js: pure functions
- **Pure** = same input, same output, no side effects, no DOM. That's why it could be tested in Node before the browser was involved.
- `getAvailability(data, selections)` → for every item: `{ available, reason }`. Stage 3 only uses engine → `supportedFuels`; Stage 4 adds the rules from the JSON.
- `applySelection()` = add the new choice, then `sanitizeSelections()` removes anything now invalid and **returns what it removed**, so the UI can show "Fuel "LNG" was cleared: Not supported by the NW-M250 Compact."
- Why one cleaning pass is enough: removing a choice can only *remove* restrictions, never add them.
- `sanitizeSelections()` also handles **unknown ids**, so a tampered URL or old saved config with a deleted product is cleaned instead of crashing. Stage 6 relies on this.
- `checkDataIntegrity()` finds rules or `supportedFuels` that point at ids that don't exist.

### ui.js: rendering
- **build vs update:** cards are *built* once after loading, then only *updated* (checked/disabled/reason text) on each change. If we rebuilt the HTML on every change, the focused radio would be destroyed and keyboard users would lose their place while pressing the arrow keys.
- `el()` helper uses `textContent`, never `innerHTML`, so text from the JSON or a URL can't inject HTML/scripts (**XSS prevention**).
- `Intl.NumberFormat` formats money (`€112,000`) using the currency from `meta.currency`, so no hard-coded symbols.
- Accessibility: disabled radios get `aria-describedby` pointing at their reason text. After Next/Back, focus moves to the new step's heading (`tabindex="-1"`).

### Bug found while testing
Opening `index.html` straight from disk (`file://`) left the page stuck on "Loading engines…". Browsers **block ES modules on file:// URLs**, so `main.js` never ran and couldn't report its own error. Fix: a tiny classic inline `<script>` that detects `location.protocol === "file:"` and shows instructions to use Live Server.

### Tested
- Node: availability, reset when engine changes, validation messages, unknown-id cleaning, typo detection in JSON.
- Browser (headless Edge driven by script): Next without choice shows an error and focuses the first radio; arrow keys change the choice and keep focus; M500 + LNG → back → M250 clears LNG with a notice; LNG then shows disabled with its reason; progress shows step 1 complete; no console errors; desktop and 375px layouts.

---

## Stage 4: Options step and rule engine

**Files:** `js/rules.js` (rule engine), `js/ui.js` (option groups), `js/main.js`, `css/styles.css`

### The rule engine (`applyRules` in rules.js)
After every change, `getAvailability()` starts with "everything available", then walks the `rules` list from products.json:
```
for each rule:
  is rule.if.value currently selected in rule.if.group?  no -> skip
  excludes -> disable the one item rule.then.value
  requires -> disable every OTHER item in rule.then.group
  use rule.message as the reason
```
- **No product names in the code.** "Methanol", "LNG" and "SCR" appear only in the JSON. To add a rule, a product manager adds an object to `rules`, and it works with no code change. This was tested by adding a new "NW-M1200 needs 5-year warranty" rule in a test only.
- If two rules block the same item, both reasons are kept (`disable()` joins them).
- `checkDataIntegrity()` now also reports unknown rule types (e.g. a typo like `"forbids"`).

### Why availability is recalculated from scratch every time
Instead of "when fuel changes, re-enable SCR", the whole map is rebuilt from the current selections. You never have to undo a rule; you just stop applying it. This removes a whole class of bugs where something stays disabled after the cause is gone. With ~20 items it costs microseconds.

### Auto-reset with a notice (feature 3)
Same mechanism as Stage 3, now covering rules too: `applySelection()` → `sanitizeSelections()` removes any selection the rules now block and returns it, and main.js shows it in the `aria-live` notice. Example: M500 + SCR, then go back and pick LNG → *Exhaust aftertreatment "SCR (NOx reduction)" was cleared: SCR aftertreatment is not available with LNG.*
Changing engine can clear several groups at once (fuel *and* cooling), and the notice lists them all.

### Options step (`buildOptionGroups` in ui.js)
- One `<fieldset>` + `<legend>` per option group in the JSON. A screen reader announces "Cooling, radio group". The radios in each group share `name="cooling"`, so arrow keys stay within a group.
- Weight lines (`+650 kg`) come from `weightKg`; the "+8% total weight" line comes from the `modifiers` list, so it is data-driven too.
- The same `buildChoice()` and `updateChoices()` from Stage 3 are reused. Nothing new was needed to make disabling/reasons work for options.

### Validation UX improvement
The error message sits below five groups, too far away on a phone. So groups still missing a choice get `.is-missing`: a red legend with "- required" and red card borders. Picking an option removes the highlight from that group only; the others stay highlighted until filled.

### Tested
- Node: M250 + methanol disables heat exchanger and basic control (the case traced by hand in Stage 1); methanol resets basic control; LNG resets SCR; switching to M250 resets both fuel and cooling; new JSON-only rule works; unknown rule type is reported.
- Browser: disabled options with correct reasons; Next with empty groups shows the error, highlights the right groups, focuses the first one; highlights clear one by one; reaching Summary; no console errors; mobile layout.
