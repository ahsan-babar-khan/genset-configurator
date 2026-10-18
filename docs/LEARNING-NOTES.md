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
