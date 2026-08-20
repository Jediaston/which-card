# Which Card

> This repo is still named `which-card` on GitHub (renaming/deleting repos requires GitHub account
> permissions this environment doesn't have). The user-facing brand for the whole collection is
> **AI Build** — see [`ai-build/`](./ai-build) for the landing hub that ties all the apps together
> under that name without needing the underlying repo renamed.

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
- **BH Clinical Audit Console** — scores a behavioral health claim line against coding rules and against what the note shows clinically. Fully self-contained (no network calls, even parses `.docx` notes client-side), so it works offline once installed. **Personal demo** — not a coverage determination; not for real member/patient/claim data; nothing is saved. Live at [https://jediaston.github.io/which-card/bh-audit-console/](https://jediaston.github.io/which-card/bh-audit-console/).
- **Watchlist Ledger** — a stock watchlist with analyst notes, saved locally via `localStorage`. Prices refresh live via a free Finnhub API key (entered once, kept on-device); analyst write-ups are still compiled by hand — ask in chat to refresh those. Live at [https://jediaston.github.io/which-card/watchlist-ledger/](https://jediaston.github.io/which-card/watchlist-ledger/).
- **Chart Assist** — drafts nursing notes from diagnosis-specific checklists (falls, UTI, pressure injury, CHF, and more), composing a suggested note you can edit and copy. Fully self-contained, no data persistence or network calls beyond loading fonts. **Personal demo** — not a coverage determination; not for real member/patient/claim data; nothing is saved. Live at [https://jediaston.github.io/which-card/chart-assist/](https://jediaston.github.io/which-card/chart-assist/).
- **What's Cooking?** — type a dish name and get its ingredients as a shopping or cooking checklist, with progress tracking, instructions, favorite-cuisine browsing, and a heart-to-favorite list (Filipino, Thai, Italian, Vietnamese, Taiwanese, Japanese, Mexican, Indian). Pulls recipes from the free [TheMealDB](https://www.themealdb.com) API plus a curated set of local recipes. Live at [https://jediaston.github.io/which-card/whats-cooking/](https://jediaston.github.io/which-card/whats-cooking/).
- **Medora** — a directory of hospitals, clinics, veterinarians, care homes, and private practices across Bacolod, Silay, and Talisay, with filtering by type/city, search, sort (name, city, type, rating, review count), and ratings/reviews shown read-only (no way to submit new ones — includes a simple built-in check for spammy/bot-like review patterns). Fully self-contained, no network calls beyond loading fonts/icons. Live at [https://jediaston.github.io/which-card/medora/](https://jediaston.github.io/which-card/medora/).
