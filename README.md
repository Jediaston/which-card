# Which Card

A **which-card-to-swipe** app. Not a balance tracker.

You turn on the cards you own. Official issuer rates are already researched (August 2026). You never type 4x or 5%.

## Use it

- Live: after GitHub Pages is on, [https://jediaston.github.io/which-card/](https://jediaston.github.io/which-card/)
- Local: `python3 -m http.server 4173` then open `/`

First run asks **Which cards do you have?** After that, Cards is wallet-only.

Pay uses Everyday / Travel / Business pills, a plain-text store + amount (not `type=search`, not inside a `<form>` — iOS search dropdowns reload and kill the app), and category icon tiles. Store search never hides the tiles.

## Tests

```bash
npm test
```

`package.json` is `"type": "module"`; tests run with `node --test`.

## Scoring

rewards + perks + merchant + dedicated + specialist + personal + favorite − fee haircut − cobrand haircut.

Business Gold uses `rotatingCategories` with default focus **electronics + ads**. Dining is 1x on that card unless dining is one of the two chosen categories.

localStorage key: `perk-wallet-v2` (still reads `perk-wallet-v1`).

## Other apps in this Pages site

- **Where to Retire** — compares states for retirees on taxes, healthcare, climate, and airports. Live at [https://jediaston.github.io/which-card/retiree-states/](https://jediaston.github.io/which-card/retiree-states/). Installable as a home-screen app the same way as Which Card.
