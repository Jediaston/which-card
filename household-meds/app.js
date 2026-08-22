import {
  HOLD_NOTE,
  NO_CLINIC_NOTE,
  QUIET_NOTE,
  TIME_OPTIONS,
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

function newCustomId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function render() {
  const now = nowParts();
  const profile = store.getActive();
  const dayState = store.getDay(now.dateKey);
  const model = buildDay(now.dateKey, now.minutes, dayState, profile);
  root.innerHTML = "";
  const nodes = [
    header(now, model, profile),
    packBar(profile),
  ];
  if (profile.pack === "custom") nodes.push(customEditor());
  nodes.push(
    alerts(model),
    section("Due", "due", model.groups.due, model, profile),
    section("Taken", "taken", model.groups.taken, model, profile),
    section("Skipped", "skipped", model.groups.skipped, model, profile),
    section("Later today", "later", model.groups.later, model, profile),
    section("Optional log", "optional", model.groups.optional, model, profile),
    footer(model)
  );
  root.append(...nodes);
}

function header(now, model, profile) {
  const el = document.createElement("header");
  el.className = "top";
  const quiet = model.quiet
    ? `<span class="chip quiet">Quiet hours · last check 8:00 PM</span>`
    : model.lastCheck
      ? `<span class="chip check">Last check of the day</span>`
      : `<span class="chip on">Pings on until 8:00 PM</span>`;
  el.innerHTML = `
    <p class="eyebrow">Local only · no names</p>
    <h1>Today</h1>
    <p class="when">${formatDateLabel(now.dateKey)} · ${formatClock(now.minutes)} PT</p>
    <div class="chips">${quiet}</div>
  `;
  el.append(profileSwitch(profile));
  return el;
}

function profileSwitch(active) {
  const nav = document.createElement("div");
  nav.className = "people";
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", "Profiles");
  for (const profile of store.listProfiles()) {
    nav.append(
      btn(profile.letter, profile.id === active.id ? "person is-on" : "person", () => {
        store.setActive(profile.id);
      })
    );
  }
  nav.append(btn("+", "person add", () => store.addProfile()));
  if (store.listProfiles().length > 1) {
    nav.append(
      btn("Remove", "ghost tiny", () => {
        store.removeProfile(active.id);
      })
    );
  }
  return nav;
}

function packBar(profile) {
  const el = document.createElement("div");
  el.className = "pack";
  el.append(
    btn("Preset list", profile.pack === "preset" ? "pack-btn is-on" : "pack-btn", () => store.setPack("preset")),
    btn("Own list", profile.pack === "custom" ? "pack-btn is-on" : "pack-btn", () => store.setPack("custom"))
  );
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    profile.pack === "preset"
      ? `Profile ${profile.letter} · shared preset. Logs for this letter stay separate.`
      : `Profile ${profile.letter} · add only the doses this letter needs.`;
  el.append(hint);
  return el;
}

function customEditor() {
  const el = document.createElement("form");
  el.className = "adder";
  el.innerHTML = `
    <p class="adder-title">Add a dose to this list</p>
    <div class="adder-row">
      <label>Label<input name="label" maxlength="80" placeholder="Dose label" autocomplete="off"></label>
      <label>When
        <select name="timeKey">
          ${TIME_OPTIONS.map((t) => `<option value="${t.key}">${t.label}</option>`).join("")}
        </select>
      </label>
      <label>Count
        <select name="qtyMax">
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
      </label>
    </div>
    <button type="submit" class="btn primary">Add to list</button>
  `;
  el.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(el);
    const label = String(data.get("label") || "").trim();
    if (!label) return;
    store.addCustom({
      id: newCustomId(),
      label,
      timeKey: String(data.get("timeKey") || "8am"),
      qtyMax: Number(data.get("qtyMax") || 1),
    });
    render();
  });
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
  } else if (model.lastCheck && model.usingPreset) {
    wrap.innerHTML += `<div class="banner mute" role="status">8:00 PM last check — Serax 15mg is here. No 10pm dose. No more pings tonight.</div>`;
  }
  if (model.aspirinActive) {
    wrap.innerHTML += `<div class="banner note">Aspirin EC 81mg BID through Sep 16, 2026.</div>`;
  }
  if (model.usingPreset && !model.postopScheduled) {
    wrap.innerHTML += `<div class="banner note">Post-op timed slots are off. Cyclobenzaprine, ondansetron, oxycodone, and acetaminophen are optional logs only.</div>`;
  }
  return wrap;
}

function section(title, kind, rows, model, profile) {
  const el = document.createElement("section");
  el.className = `block block-${kind}`;
  el.setAttribute("aria-label", title);
  const heading = document.createElement("h2");
  heading.innerHTML = `${escapeHtml(title)} <span>${rows.length}</span>`;
  el.append(heading);
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    if (kind === "due" && profile.pack === "custom" && !(profile.custom || []).length) {
      empty.textContent = "Own list is empty. Add a dose above.";
    } else if (kind === "due" && model.quiet && !model.lastCheck) {
      empty.textContent = "Nothing to ping during quiet hours.";
    } else {
      empty.textContent = "None.";
    }
    el.append(empty);
    return el;
  }
  for (const row of rows) el.append(card(row, model, profile));
  return el;
}

function card(row, model, profile) {
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
      actions.append(
        btn(choice.label, choice.qty >= slot.completeAt ? "primary" : "soft", () =>
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

  if (slot.custom) {
    actions.append(
      btn("Remove from list", "ghost", () => {
        store.removeCustom(slot.id);
        store.setEntry(model.dateKey, slot.id, null);
      })
    );
  }

  el.append(actions);
  return el;
}

function btn(label, kind, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn ${kind}`;
  b.textContent = label;
  b.addEventListener("click", (event) => {
    if (b.type === "submit") return;
    event.preventDefault();
    onClick();
    render();
  });
  return b;
}

function footer(model) {
  const el = document.createElement("footer");
  el.className = "foot";
  el.innerHTML = `
    <p>Letters are profiles on this device. Nothing here asks for a name, date of birth, or address.</p>
    ${model.usingPreset ? `<p>${escapeHtml(HOLD_NOTE)}</p><p>Ice pack reminders are off.${model.postopScheduled ? "" : " Overnight doses are not pinged."}</p>` : ""}
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
