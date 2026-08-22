# Household meds

Local multi-profile dose log. Not a public demo. Not Chart Assist.

Do not add this folder to `ai-build/`, QR share pages, downloads, or the root README live-app list. GitHub Pages must keep excluding this directory.

The app does not store or display names, dates of birth, or addresses. Profiles are letters (A, B, …). Each letter has its own log.

- **Preset list** — the shared household schedule (quiet hours, holds, cutoffs).
- **Own list** — add only the doses that profile needs.

## Run it

From the repo root:

```bash
python3 -m http.server 4173
```

Then open [http://127.0.0.1:4173/household-meds/](http://127.0.0.1:4173/household-meds/).

Logs stay in `localStorage` on this device (`household-meds-v2`). No account. No analytics. This page does not book appointments or contact clinics.

Timezone is America/Los_Angeles. Quiet hours: no dose pings after 8:00 PM PT; last check is 8:00 PM; pings resume 8:00 AM PT.
