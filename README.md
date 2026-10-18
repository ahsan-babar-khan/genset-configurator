# GenSet Configurator

A web app for configuring a marine generator set for **NordWave Power**, a fictional company.
Built with plain HTML, CSS and vanilla JavaScript (ES modules). No frameworks, no build step.

> Work in progress. Full README (features, screenshots, how to run, what I learned) comes in the final stage.

## Project structure

```
genset-configurator/
├── index.html          Page markup
├── css/
│   ├── styles.css      Screen styles
│   └── print.css       Print-friendly quote
├── data/
│   └── products.json   ALL product data: engines, fuels, options, prices, rules
├── js/
│   ├── main.js         Wiring: loads data, connects state, rules and UI
│   ├── state.js        Holds the current configuration
│   ├── rules.js        Pure functions: compatibility and validation (no DOM)
│   ├── pricing.js      Pure functions: price, weight, CO2 totals (no DOM)
│   └── ui.js           Rendering
└── tests/              Tests for rules.js and pricing.js
```

## Commit conventions

One commit per finished feature, using a short prefix:

- `feat:` new feature (`feat: add options step with rule engine`)
- `fix:` bug fix
- `style:` CSS or formatting only
- `docs:` README and comments
- `test:` tests
- `chore:` setup and tooling
