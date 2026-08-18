import { CARDS, CATEGORIES, RATES_AS_OF, categoriesForMode, getCard, searchCatalog } from "./data.js";
import { quarterInfo, rankWallet, resolveMerchant } from "./score.js";
import { createStore } from "./store.js";

const store = createStore();
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ui = {
  tab: "pay",
  mode: "everyday",
  category: "dining",
  store: "",
  catalogQuery: "",
  adding: false,
  redoSetup: false,
};

function state() {
  return store.load();
}

function save(patch) {
  const next = { ...state(), ...patch };
  store.save(next);
  return next;
}

function setTab(tab) {
  ui.tab = tab;
  $$(".tab").forEach((btn) => btn.classList.toggle("is-on", btn.dataset.tab === tab));
  ["pay", "cards", "help"].forEach((id) => {
    const el = $(`#view-${id}`);
    const on = id === tab;
    el.hidden = !on;
    el.classList.toggle("is-on", on);
  });
  render();
}

function fmtRate(row) {
  if (!row || row.blocked) return "—";
  const cash = row.card.currency === "cash" || row.card.currency === "Daily Cash";
  return cash ? `${row.rate}%` : `${row.rate}x`;
}

function resultsHtml(s, ranked) {
  if (!s.owned.length) {
    return `<div class="empty">Turn on the cards you own first. Open Cards — or redo the first-run picker from Help.</div>`;
  }
  return `<div class="results">${ranked
    .slice(0, 8)
    .map(
      (row, i) => `
          <article class="card-row ${i === 0 ? "is-win" : ""} ${row.blocked ? "blocked" : ""}" style="border-left-color:${cardColor(row.card)}">
            ${cardMark(row.card)}
            <div class="who">
              <strong>${i === 0 ? "Use " : ""}${escapeHtml(row.card.name)}</strong>
              <small>${escapeHtml(row.reason || "")}${s.favorites.includes(row.card.id) ? " · favorite" : ""}</small>
            </div>
            <div class="rate">${fmtRate(row)}</div>
          </article>`
    )
    .join("")}</div>`;
}

function payRanked(s) {
  if (!s.owned.length) return [];
  return rankWallet(s.owned, {
    category: ui.category,
    merchant: ui.store,
    mode: ui.mode,
    favorites: s.favorites,
    focusMap: s.focus,
    activated: s.activated,
  });
}

function refreshPayLive() {
  const s = state();
  const merchant = resolveMerchant(ui.store);
  const hint = $("#pay-hint");
  if (hint) {
    hint.textContent = merchant
      ? `Matched ${merchant.label} → ${merchant.category}. Tiles stay up.`
      : "Store is a hint, not a search page.";
  }
  $$(".tile", $("#view-pay")).forEach((btn) => btn.classList.toggle("is-on", btn.dataset.cat === ui.category));
  const slot = $("#pay-results");
  if (slot) slot.innerHTML = resultsHtml(s, payRanked(s));
}

function renderPay() {
  const s = state();
  const cats = categoriesForMode(ui.mode);
  const merchant = resolveMerchant(ui.store);
  const matched = merchant
    ? `Matched ${merchant.label} → ${merchant.category}. Tiles stay up.`
    : "Store is a hint, not a search page.";

  $("#view-pay").innerHTML = `
    <div class="pills" role="tablist" aria-label="Spend type">
      ${["everyday", "travel", "business"]
        .map(
          (mode) =>
            `<button type="button" class="pill ${ui.mode === mode ? "is-on" : ""}" data-mode="${mode}">${mode[0].toUpperCase() + mode.slice(1)}</button>`
        )
        .join("")}
    </div>
    <div class="fields">
      <label class="field">
        <span>Store (optional)</span>
        <input id="store" type="text" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="go" placeholder="Amazon, Hilton, Staples…" value="${escapeAttr(ui.store)}" />
      </label>
    </div>
    <p class="hint" id="pay-hint">${matched}</p>
    <div class="tiles" id="tiles">
      ${cats
        .map(
          (c) =>
            `<button type="button" class="tile ${c.id === ui.category ? "is-on" : ""}" data-cat="${c.id}"><span class="ico">${c.icon}</span><span class="lbl">${c.label}</span></button>`
        )
        .join("")}
    </div>
    <div id="pay-results">${resultsHtml(s, payRanked(s))}</div>
  `;

  $$(".pill", $("#view-pay")).forEach((btn) =>
    btn.addEventListener("click", () => {
      ui.mode = btn.dataset.mode;
      const still = categoriesForMode(ui.mode).some((c) => c.id === ui.category);
      if (!still) ui.category = categoriesForMode(ui.mode)[0]?.id || "other";
      save({ lastMode: ui.mode });
      renderPay();
    })
  );

  const storeInput = $("#store");
  storeInput.addEventListener("input", () => {
    ui.store = storeInput.value;
    const hit = resolveMerchant(ui.store);
    if (hit?.category) ui.category = hit.category;
    refreshPayLive();
  });
  $$(".tile", $("#view-pay")).forEach((btn) =>
    btn.addEventListener("click", () => {
      ui.category = btn.dataset.cat;
      refreshPayLive();
    })
  );
}

function renderCards() {
  const s = state();
  const owned = s.owned.map((id) => getCard(id)).filter(Boolean);
  const q = ui.catalogQuery;
  const catalog = searchCatalog(q).filter((c) => ui.adding || !s.setupComplete ? true : !s.owned.includes(c.id));

  const list = (ui.adding ? catalog : owned).length
    ? (ui.adding ? catalog : owned)
        .map((card) => {
          const on = s.owned.includes(card.id);
          const fav = s.favorites.includes(card.id);
          const focus = s.focus[card.id] || card.focusDefault || [];
          const focusUi = card.rotatingCategories
            ? `<div class="focus-box">${card.rotatingCategories
                .map((id) => {
                  const cat = CATEGORIES.find((c) => c.id === id);
                  const selected = focus.includes(id);
                  return `<button type="button" class="chip ${selected ? "is-on" : ""}" data-focus="${card.id}" data-cat="${id}">${cat?.label || id}</button>`;
                })
                .join("")}<small style="color:var(--muted)">Pick ${card.focusCount || 2}. Default is electronics + ads.</small></div>`
            : "";
          return `<article class="wallet-item" style="border-left-color:${cardColor(card)}">
            ${cardMark(card)}
            <div>
              <b>${escapeHtml(card.name)}</b>
              <span>${escapeHtml(card.issuer)} · ${card.network} · $${card.annualFee}/yr${card.flags.includes("no_fx_fee") ? " · no FX fee" : ""}</span>
            </div>
            <button type="button" class="icon-btn ${fav ? "is-on" : ""}" data-fav="${card.id}" aria-label="Favorite">★</button>
            <button type="button" class="toggle-btn ${on ? "is-on" : ""}" data-own="${card.id}">${on ? "Remove" : "I have this"}</button>
            ${focusUi}
          </article>`;
        })
        .join("")
    : `<div class="empty">${ui.adding ? "No cards match." : "Your wallet is empty. Add the cards you actually carry."}</div>`;

  $("#view-cards").innerHTML = `
    <p class="hint">${s.setupComplete && !ui.adding ? "Wallet only — the cards you said you have." : "Turn on cards you own. You never type 4x or 5%."}</p>
    ${ui.adding || !s.setupComplete ? `<input class="search" id="catalog-q" type="text" autocomplete="off" placeholder="Search catalog" value="${escapeAttr(q)}" />` : ""}
    <div class="wallet-list">${list}</div>
    <div class="help stack" style="margin-top:28px">
      ${
        s.setupComplete
          ? `<button type="button" class="primary" id="toggle-add">${ui.adding ? "Done adding" : "Add more cards"}</button>`
          : ""
      }
    </div>
  `;

  $("#toggle-add")?.addEventListener("click", () => {
    ui.adding = !ui.adding;
    ui.catalogQuery = "";
    renderCards();
  });
  const search = $("#catalog-q");
  search?.addEventListener("input", () => {
    ui.catalogQuery = search.value;
    renderCards();
    const next = $("#catalog-q");
    next?.focus();
    next?.setSelectionRange(ui.catalogQuery.length, ui.catalogQuery.length);
  });
  $$("[data-own]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.own;
      const ownedIds = new Set(state().owned);
      if (ownedIds.has(id)) ownedIds.delete(id);
      else ownedIds.add(id);
      const favorites = state().favorites.filter((f) => ownedIds.has(f));
      save({ owned: [...ownedIds], favorites });
      renderCards();
    })
  );
  $$("[data-fav]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.fav;
      const favorites = new Set(state().favorites);
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      if (!state().owned.includes(id)) save({ owned: [...state().owned, id], favorites: [...favorites] });
      else save({ favorites: [...favorites] });
      renderCards();
    })
  );
  $$("[data-focus]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.focus;
      const cat = btn.dataset.cat;
      const card = getCard(id);
      const current = [...(state().focus[id] || card.focusDefault || [])];
      const i = current.indexOf(cat);
      if (i >= 0) current.splice(i, 1);
      else {
        current.push(cat);
        while (current.length > (card.focusCount || 2)) current.shift();
      }
      save({ focus: { ...state().focus, [id]: current } });
      renderCards();
    })
  );
}

function renderHelp() {
  const q = quarterInfo();
  const chase = q.chase.length ? q.chase.join(", ") : "not published yet";
  const disc = q.discover.length ? q.discover.join(", ") : "not published yet";
  $("#view-help").innerHTML = `
    <div class="help">
      <h2>This quarter’s 5%</h2>
      <p><strong>${q.label}</strong>. Rates researched ${RATES_AS_OF}. Activate on the issuer site — this app does not spend-track.</p>
      <ul>
        <li>Chase Freedom / Flex: ${chase} (up to $1,500 combined)</li>
        <li>Discover it: ${disc} (up to $1,500 combined)</li>
      </ul>
      <h2>Add to Home Screen</h2>
      <p>iPhone: Share → Add to Home Screen. Android: menu → Install app. That keeps it out of Safari’s search-reload trap.</p>
      <h2>Backup</h2>
      <div class="stack">
        <button type="button" class="primary" id="backup">Download backup</button>
        <button type="button" class="text-btn" id="restore">Restore backup</button>
        <input id="restore-file" type="file" accept="application/json" hidden />
      </div>
      <h2>Rates &amp; wallet</h2>
      <div class="stack">
        <button type="button" class="text-btn" id="reload-rates">Reload rates</button>
        <button type="button" class="text-btn" id="redo-setup">Redo setup</button>
        <button type="button" class="text-btn" id="reset">Reset everything</button>
      </div>
      <p>${CARDS.length} cards in the catalog. Scoring is rewards + perks + merchant + dedicated + specialist + personal + favorite − fee haircut − cobrand haircut.</p>
    </div>
  `;
  $("#backup").addEventListener("click", () => {
    const blob = new Blob([store.exportBackup()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "which-card-backup.json";
    a.click();
  });
  $("#restore").addEventListener("click", () => $("#restore-file").click());
  $("#restore-file").addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    store.importBackup(await file.text());
    ui.adding = false;
    render();
    maybeSetup();
  });
  $("#reload-rates").addEventListener("click", async () => {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    location.reload();
  });
  $("#redo-setup").addEventListener("click", () => {
    ui.redoSetup = true;
    save({ setupComplete: false });
    maybeSetup();
  });
  $("#reset").addEventListener("click", () => {
    store.reset();
    ui.adding = false;
    render();
    maybeSetup();
  });
}

function renderSetup() {
  const s = state();
  const q = ui.catalogQuery;
  const hits = searchCatalog(q);
  const selected = [];
  const rest = [];
  for (const card of hits) {
    (s.owned.includes(card.id) ? selected : rest).push(card);
  }
  const ordered = [...selected, ...rest];
  $("#setup").hidden = false;
  $("#setup").innerHTML = `
    <div class="setup-card">
      <p class="eyebrow">First run</p>
      <h2>Which cards do you have?</h2>
      <p class="hint">${
        selected.length
          ? `${selected.length} saved in this phone’s wallet. Toggle more, then continue.`
          : "Toggle the ones in your wallet. Rates are already researched — do not type 4x or 5%."
      }</p>
      <input class="search" id="setup-q" type="text" autocomplete="off" placeholder="Search Gold, Flex, RedCard…" value="${escapeAttr(q)}" />
      <div class="catalog">
        ${ordered
          .map((card) => {
            const on = s.owned.includes(card.id);
            return `<article class="wallet-item ${on ? "is-picked" : ""}" style="border-left-color:${cardColor(card)}">
              ${cardMark(card)}
              <div>
                <b>${escapeHtml(card.name)}</b>
                <span>${escapeHtml(card.issuer)} · ${card.short}</span>
              </div>
              <button type="button" class="toggle-btn ${on ? "is-on" : ""}" data-own="${card.id}">${on ? "On" : "Add"}</button>
            </article>`;
          })
          .join("")}
      </div>
      <div class="help stack">
        <button type="button" class="primary" id="finish-setup" ${s.owned.length ? "" : "disabled"}>Continue with ${s.owned.length} card${s.owned.length === 1 ? "" : "s"}</button>
      </div>
    </div>
  `;
  $("#setup-q").addEventListener("input", (e) => {
    ui.catalogQuery = e.target.value;
    renderSetup();
    const next = $("#setup-q");
    next.focus();
    next.setSelectionRange(ui.catalogQuery.length, ui.catalogQuery.length);
  });
  $$("[data-own]", $("#setup")).forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.own;
      const owned = new Set(state().owned);
      if (owned.has(id)) owned.delete(id);
      else owned.add(id);
      save({ owned: [...owned] });
      renderSetup();
    })
  );
  $("#finish-setup").addEventListener("click", () => {
    if (!state().owned.length) return;
    ui.redoSetup = false;
    save({ setupComplete: true });
    ui.catalogQuery = "";
    ui.adding = false;
    $("#setup").hidden = true;
    setTab("pay");
  });
}

function maybeSetup() {
  const s = state();
  if (!s.setupComplete && s.owned.length && !ui.redoSetup) {
    save({ setupComplete: true });
    $("#setup").hidden = true;
    $("#setup").innerHTML = "";
    return;
  }
  if (!s.setupComplete) {
    ui.catalogQuery = "";
    renderSetup();
  } else {
    $("#setup").hidden = true;
    $("#setup").innerHTML = "";
  }
}

function render() {
  if (ui.tab === "pay") renderPay();
  if (ui.tab === "cards") renderCards();
  if (ui.tab === "help") renderHelp();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function cardColor(card) {
  const raw = String(card?.color || "#6e6a64");
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw) ? raw : "#6e6a64";
}

function cardMark(card) {
  const color = cardColor(card);
  return `<div class="card-mark" style="background-color:${color}" aria-hidden="true"></div>`;
}

function persistOnHide() {
  const s = state();
  if (s.owned.length && !s.setupComplete && !ui.redoSetup) save({ setupComplete: true });
  else if (s.owned.length) save(s);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persistOnHide();
});
window.addEventListener("pagehide", persistOnHide);

function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    persistOnHide();
    location.reload();
  });
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
}

async function boot() {
  if (store.ready) await store.ready;
  ui.mode = state().lastMode || "everyday";
  maybeSetup();
  render();
  registerSW();
}

$$(".tab").forEach((btn) => btn.addEventListener("click", () => setTab(btn.dataset.tab)));

boot();
