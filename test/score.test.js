import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CARDS, aliasCard, getCard } from "../js/data.js";
import { effectiveRate, getFocusCategories, rankWallet, winner } from "../js/score.js";

const WALLET = [
  "amex-gold",
  "amex-business-gold",
  "chase-sapphire-reserve",
  "amazon-prime-visa",
  "chase-ink-cash",
  "target-redcard",
  "citi-costco-anywhere",
  "amex-hilton-surpass",
  "bilt",
  "amex-blue-business-plus",
  "amex-blue-business-cash",
  "amex-business-green",
  "apple-card",
  "chase-freedom-flex",
  "citi-double-cash",
  "wells-fargo-active-cash",
];

function pick(category, extra = {}) {
  return winner(WALLET, { category, mode: extra.mode || "everyday", ...extra });
}

describe("must-keep rankings", () => {
  it("electronics → Amex Business Gold (default focus includes electronics)", () => {
    const row = pick("electronics", { mode: "business" });
    assert.equal(row.card.id, "amex-business-gold");
    assert.equal(row.rate, 4);
    assert.match(row.reason, /electronics|warranty|focus/i);
    const focus = getFocusCategories(getCard("amex-business-gold"), {});
    assert.ok(focus.includes("electronics"));
    assert.ok(focus.includes("ads"));
    assert.ok(getCard("amex-business-gold").perks.includes("warranty"));
  });

  it("electronics still prefers Business Gold on the everyday pill", () => {
    assert.equal(pick("electronics", { mode: "everyday" }).card.id, "amex-business-gold");
  });

  it("dining → personal Gold or CSR, not Business Gold with default focus", () => {
    const row = pick("dining");
    assert.ok(["amex-gold", "chase-sapphire-reserve"].includes(row.card.id), row.card.id);
    assert.notEqual(row.card.id, "amex-business-gold");
    const biz = effectiveRate(getCard("amex-business-gold"), { category: "dining" });
    assert.equal(biz.rate, 1);
    assert.equal(biz.source, "base");
  });

  it("Business Gold dining is 4x only when dining is a chosen focus", () => {
    const focused = effectiveRate(getCard("amex-business-gold"), {
      category: "dining",
      focusMap: { "amex-business-gold": ["dining", "electronics"] },
    });
    assert.equal(focused.rate, 4);
    assert.equal(focused.source, "focus");
  });

  it("Amazon → Prime Visa 5%", () => {
    const row = pick("amazon", { merchant: "amazon" });
    assert.equal(row.card.id, "amazon-prime-visa");
    assert.equal(row.rate, 5);
  });

  it("office → Ink Business Cash", () => {
    const row = pick("office", { mode: "business", merchant: "staples" });
    assert.equal(row.card.id, "chase-ink-cash");
    assert.equal(row.rate, 5);
  });

  it("Target → Target RedCard", () => {
    const row = pick("target", { merchant: "target" });
    assert.equal(row.card.id, "target-redcard");
    assert.equal(row.rate, 5);
  });

  it("Costco → Costco Anywhere Visa", () => {
    const row = pick("costco", { merchant: "costco" });
    assert.equal(row.card.id, "citi-costco-anywhere");
    const amex = rankWallet(WALLET, { category: "costco", merchant: "costco" }).find((r) => r.card.id === "amex-gold");
    assert.equal(amex.blocked, true);
  });

  it("hotels → Hilton cobrand can beat personal Gold", () => {
    const ranked = rankWallet(WALLET, { category: "hotels", merchant: "hilton", mode: "travel" });
    const hilton = ranked.find((r) => r.card.id === "amex-hilton-surpass");
    const gold = ranked.find((r) => r.card.id === "amex-gold");
    assert.ok(hilton.total > gold.total, `${hilton.total} vs ${gold.total}`);
    assert.equal(ranked[0].card.cobrand, "hilton");
  });

  it("rent → Bilt", () => {
    assert.equal(pick("rent").card.id, "bilt");
  });

  it("personal cards rank above business on everyday spend", () => {
    const ranked = rankWallet(WALLET, { category: "other", mode: "everyday" });
    const topPersonal = ranked.find((r) => r.card.kind === "personal" && !r.blocked);
    const topBiz = ranked.find((r) => r.card.kind === "business" && !r.blocked);
    assert.ok(topPersonal);
    assert.ok(topBiz);
    assert.ok(ranked.indexOf(topPersonal) < ranked.indexOf(topBiz));
    assert.equal(topPersonal.card.kind, "personal");
  });

  it("favorites win close calls only", () => {
    const close = rankWallet(["citi-double-cash", "wells-fargo-active-cash"], {
      category: "other",
      favorites: ["citi-double-cash"],
    });
    assert.equal(close[0].card.id, "citi-double-cash");

    const notClose = rankWallet(["citi-double-cash", "amazon-prime-visa"], {
      category: "amazon",
      merchant: "amazon",
      favorites: ["citi-double-cash"],
    });
    assert.equal(notClose[0].card.id, "amazon-prime-visa");
  });
});

describe("flags and aliases", () => {
  it("Blue Business Plus/Cash and Business Green have FX fees", () => {
    for (const id of ["amex-blue-business-plus", "amex-blue-business-cash", "amex-business-green"]) {
      assert.ok(!getCard(id).flags.includes("no_fx_fee"), id);
    }
  });

  it("Gold / Business Gold / Business Platinum / Apple Card have no_fx_fee", () => {
    for (const id of ["amex-gold", "amex-business-gold", "amex-business-platinum", "apple-card"]) {
      assert.ok(getCard(id).flags.includes("no_fx_fee"), id);
    }
  });

  it("rose gold alias → Amex Gold (Personal)", () => {
    assert.equal(aliasCard("rose gold").id, "amex-gold");
    assert.equal(aliasCard("amex rose gold").id, "amex-gold");
  });

  it("second Citi Strata uses citi-strata-nofee", () => {
    assert.ok(getCard("citi-strata-nofee"));
    assert.ok(getCard("citi-strata-premier"));
    assert.ok(getCard("citi-strata-elite"));
    const ids = CARDS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("markup traps", () => {
  it("Pay store is plain text, not type=search, not inside a form; no Amount field", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
    assert.doesNotMatch(html, /<form/i);
    assert.doesNotMatch(app, /type=["']search["']/);
    assert.match(app, /id="store" type="text"/);
    assert.doesNotMatch(app, /id="amount"/);
    assert.match(app, /class="tiles"/);
    assert.doesNotMatch(app, /<select/);
  });
});
