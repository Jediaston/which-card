import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARDS, CATEGORIES, RATES_AS_OF, getCard } from "../js/data.js";

describe("catalog", () => {
  it("has 100+ researched cards dated August 2026", () => {
    assert.ok(CARDS.length >= 100, `only ${CARDS.length} cards`);
    assert.match(RATES_AS_OF, /August 2026/);
  });

  it("every card has the scoring fields", () => {
    for (const card of CARDS) {
      assert.equal(typeof card.id, "string");
      assert.ok(card.name, card.id);
      assert.ok(["personal", "business"].includes(card.kind), card.id);
      assert.ok(card.network, card.id);
      assert.equal(typeof card.annualFee, "number");
      assert.equal(typeof card.cpp, "number");
      assert.ok(card.rates && typeof card.rates === "object", card.id);
      assert.ok(Array.isArray(card.flags), card.id);
    }
  });

  it("Business Gold rotatingCategories + focusDefault electronics/ads", () => {
    const card = getCard("amex-business-gold");
    assert.deepEqual(card.focusDefault, ["electronics", "ads"]);
    assert.equal(card.focusCount, 2);
    for (const cat of ["ads", "electronics", "dining", "gas", "transit", "wireless"]) {
      assert.ok(card.rotatingCategories.includes(cat), cat);
    }
    assert.ok(!card.rotatingCategories.includes("office"));
  });

  it("category tiles cover Pay modes", () => {
    assert.ok(CATEGORIES.some((c) => c.id === "electronics" && c.modes.includes("business")));
    assert.ok(CATEGORIES.some((c) => c.id === "dining" && c.modes.includes("everyday")));
    assert.ok(CATEGORIES.some((c) => c.id === "hotels" && c.modes.includes("travel")));
  });
});
