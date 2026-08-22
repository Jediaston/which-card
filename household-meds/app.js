import {
  PATIENT,
  HOLD_NOTE,
  NO_CLINIC_NOTE,
  QUIET_NOTE,
  buildDay,
  formatClock,
  formatDateLabel,
  takeEntry,
  skipEntry,
  addPrnLog,
  zonedParts,
} from "./schedule.js";
import { createStore } from "./store.js";

const store = createStore();
const root = document.getElementById("app");

function nowParts() {
  return zonedParts(new Date());
}

function stampIso() {
  return new Date().toISOString();
}

function formatLoggedAt(iso) {
  if (!iso) return "";
  const parts = zonedParts(new Date(iso));
  return formatClock(parts.minutes);
}

function render() {
  const now = nowParts();
  const dayState = store.getDay(now.dateKey);
  const model = buildDay(now.dateKey, now.minutes, dayState);
  root.innerHTML = "";
  root.append(
    header(now, model),
    alerts(model),
    section("Due", "due", model.groups.due, model),
    section("Taken", "taken", model.groups.taken, model),
    section("Skipped", "skipped", model.groups.skipped, model),
    section("Later today", "later", model.groups.later, model),
    section("Optional log", "optional", model.groups.optional, model),
    footer(model)
  );
}

function header(now, model) {
  const el = document.createElement("header");
  el.className = "top";
  const quiet = model.quiet
    ? `<span class="chip quiet">Quiet hours · last check 8:00 PM</span>`
    : model.lastCheck
      ? `<span class="chip check">Last check of the day</span>`
      : `<span class="chip on">Pings on until 8:00 PM</span>`;
  el.innerHTML = `
    <p class="eyebrow">Household · local only</p>
    <h1>Today</h1>
    <p class="when">${formatDateLabel(now.dateKey)} · ${formatClock(now.minutes)} PT</p>
    <p class="who">${escapeHtml(PATIENT.given)} ${escapeHtml(PATIENT.family)} · DOB ${escapeHtml(PATIENT.dob)} · ${escapeHtml(PATIENT.city)}</p>
    <div class="chips">${quiet}</div>
  `;
  return el;
}

function alerts(model) {
  const wrap = document.createElement("div");
  wrap.className = "alerts";
  if (model.sedationCombo) {
    wrap.innerHTML += `<div class="banner flag" role="status">Sedation combo: Serax 15mg and Benadryl 25mg logged the same day.</div>`;
  }
  if (model.quiet) {
    wrap.innerHTML += `<div class="banner mute" role="status">${escapeHtml(QUIET_NOTE)}</div>`;
  } else if (model.lastCheck) {
    wrap.innerHTML += `<div class="banner mute" role="status">8:00 PM last check — Serax 15mg is here. No 10pm dose. No more pings tonight.</div>`;
  }
  if (model.aspirinActive) {
    wrap.innerHTML += `<div class="banner note">Aspirin EC 81mg BID through Sep 16, 2026.</div>`;
  }
  if (!model.postopScheduled) {
    wrap.innerHTML += `<div class="banner note">Post-op timed slots are off. Cyclobenzaprine, ondansetron, oxycodone, and acetaminophen are optional logs only.</div>`;
  }
  return wrap;
}

function section(title, kind, rows, model) {
  const el = document.createElement("section");
  el.className = `block block-${kind}`;
  el.setAttribute("aria-label", title);
  const count = rows.length;
  const heading = document.createElement("h2");
  heading.innerHTML = `${escapeHtml(title)} <span>${count}</span>`;
  el.append(heading);
  if (!count) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = kind === "due" && model.quiet && !model.lastCheck
      ? "Nothing to ping during quiet hours."
      : "None.";
    el.append(empty);
    return el;
  }
  for (const row of rows) el.append(card(row, model));
  return el;
}

function card(row, model) {
  const { slot, entry, status, qty } = row;
  const el = document.createElement("article");
  el.className = `card is-${status}`;
  el.dataset.slot = slot.id;

  const title = [slot.name, slot.strength].filter(Boolean).join(" · ");
  const logged = entry?.at ? ` · logged ${formatLoggedAt(entry.at)}` : "";
  const qtyLine =
    slot.qtyMax > 1 && (status === "partial" || status === "taken")
      ? `${qty} of ${slot.qtyMax} ${slot.qtyUnit}${qty === 1 ? "" : "s"}`
      : slot.dose;

  el.innerHTML = `
    <div class="card-top">
      <div>
        <p class="name">${escapeHtml(title)}</p>
        <p class="dose">${escapeHtml(qtyLine)}</p>
        ${slot.note ? `<p class="hint">${escapeHtml(slot.note)}</p>` : ""}
      </div>
      <p class="time">${escapeHtml(slot.timeLabel)}${escapeHtml(logged)}</p>
    </div>
  `;

  const actions = document.createElement("div");
  actions.className = "actions";

  if (status === "taken" || status === "skipped") {
    actions.append(btn("Undo", "ghost", () => store.setEntry(model.dateKey, slot.id, null)));
  } else if (slot.kind === "prn" || slot.kind === "optional" || slot.kind === "log-only" || slot.kind === "photo-only") {
    if (slot.qtyChoices) {
      for (const choice of slot.qtyChoices) {
        actions.append(
          btn(choice.label, "primary", () =>
            store.setEntry(model.dateKey, slot.id, addPrnLog(entry, choice.qty, stampIso()))
          )
        );
      }
    } else {
      actions.append(
        btn("Log", "primary", () =>
          store.setEntry(model.dateKey, slot.id, addPrnLog(entry, 1, stampIso()))
        )
      );
    }
    if (entry?.logs?.length) {
      const list = document.createElement("p");
      list.className = "hint";
      list.textContent = entry.logs.map((log) => `${log.qty} at ${formatLoggedAt(log.at)}`).join(" · ");
      el.append(list);
    }
  } else if (slot.qtyChoices) {
    for (const choice of slot.qtyChoices) {
      const label = status === "partial" && choice.qty > qty ? choice.label : choice.label;
      actions.append(
        btn(label, choice.qty >= slot.completeAt ? "primary" : "soft", () =>
          store.setEntry(model.dateKey, slot.id, takeEntry(entry, choice.qty, stampIso()))
        )
      );
    }
    actions.append(btn("Skip", "ghost", () => store.setEntry(model.dateKey, slot.id, skipEntry(stampIso()))));
  } else {
    actions.append(
      btn("Taken", "primary", () => store.setEntry(model.dateKey, slot.id, takeEntry(entry, 1, stampIso())))
    );
    actions.append(btn("Skip", "ghost", () => store.setEntry(model.dateKey, slot.id, skipEntry(stampIso()))));
  }

  el.append(actions);
  return el;
}

function btn(label, kind, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn ${kind}`;
  b.textContent = label;
  b.addEventListener("click", () => {
    onClick();
    render();
  });
  return b;
}

function footer(model) {
  const el = document.createElement("footer");
  el.className = "foot";
  el.innerHTML = `
    <p>${escapeHtml(HOLD_NOTE)}</p>
    <p>Ice pack reminders are off.${model.postopScheduled ? "" : " Overnight doses are not pinged."}</p>
    <p>${escapeHtml(NO_CLINIC_NOTE)}</p>
    <p>Saved on this device only. No account. No analytics.</p>
  `;
  return el;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

render();
setInterval(render, 60_000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
