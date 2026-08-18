import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LEGACY_KEY, STORAGE_KEY, createStore, memoryStorage } from "../js/store.js";

describe("store", () => {
  it("uses perk-wallet-v2", () => {
    assert.equal(STORAGE_KEY, "perk-wallet-v2");
    assert.equal(LEGACY_KEY, "perk-wallet-v1");
  });

  it("round-trips v2 state", () => {
    const mem = memoryStorage();
    const s = createStore(mem);
    s.save({ setupComplete: true, owned: ["amex-gold", "bilt"], favorites: ["bilt"] });
    const loaded = s.load();
    assert.equal(loaded.version, 2);
    assert.deepEqual(loaded.owned, ["amex-gold", "bilt"]);
    assert.ok(mem.getItem(STORAGE_KEY).includes("amex-gold"));
  });

  it("migrates v1 wallet", () => {
    const mem = memoryStorage({
      [LEGACY_KEY]: JSON.stringify({
        owned: ["amazon-prime-visa"],
        favorites: ["amazon-prime-visa"],
        cards: [{ id: "target-redcard", owned: true, favorite: true }],
      }),
    });
    const s = createStore(mem);
    const loaded = s.load();
    assert.equal(loaded.version, 2);
    assert.ok(loaded.owned.includes("amazon-prime-visa"));
    assert.ok(loaded.setupComplete);
    assert.ok(mem.getItem(STORAGE_KEY));
  });

  it("exports and imports backup", () => {
    const mem = memoryStorage();
    const s = createStore(mem);
    s.save({ setupComplete: true, owned: ["amex-gold"] });
    const backup = s.exportBackup();
    s.reset();
    assert.equal(s.load().owned.length, 0);
    s.importBackup(backup);
    assert.deepEqual(s.load().owned, ["amex-gold"]);
  });
});
