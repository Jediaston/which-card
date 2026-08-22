import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  ASPIRIN_THROUGH,
  HOLD_NOTE,
  MIN_8AM,
  MIN_8PM,
  POSTOP_THROUGH,
  addPrnLog,
  buildDay,
  catalog,
  customSlotFromInput,
  hasSedationCombo,
  isQuietHours,
  scheduledIdsThrough,
  shouldPing,
  slotsForDate,
  slotsForProfile,
  takeEntry,
} from "../household-meds/schedule.js";
import { LEGACY_KEY, STORAGE_KEY, createStore, memoryStorage } from "../household-meds/store.js";

const html = readFileSync(new URL("../household-meds/index.html", import.meta.url), "utf8");
const pages = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const hub = readFileSync(new URL("../ai-build/index.html", import.meta.url), "utf8");
const qr = readFileSync(new URL("../ai-build/qr/index.html", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const chart = readFileSync(new URL("../chart-assist/index.html", import.meta.url), "utf8");

const banned = [
  ["Jona", "than"].join(""),
  ["Harl", "and"].join(""),
  [1965, "04", 20].join("-"),
  ["Bellev", "ue"].join(""),
];

function walkTextFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTextFiles(path));
    else if (/\.(js|html|md|webmanifest|svg|css)$/.test(entry.name)) out.push(path);
  }
  return out;
}

function ids(dateKey) {
  return slotsForDate(dateKey).map((s) => s.id);
}

function names(dateKey) {
  return slotsForDate(dateKey).map((s) => s.name);
}

describe("household meds privacy surface", () => {
  it("is not linked from public demo hubs or marketing copy", () => {
    for (const surface of [hub, qr, readme]) {
      assert.doesNotMatch(surface, /household-meds/);
      for (const token of banned) assert.equal(surface.includes(token), false, token);
    }
  });

  it("keeps Chart Assist as the public nursing-note demo", () => {
    assert.match(chart, /Personal demo — not a coverage determination/);
    assert.doesNotMatch(chart, /household-meds/);
  });

  it("stays off the GitHub Pages artifact", () => {
    assert.match(pages, /rm -rf household-meds/);
  });

  it("ships no identity fields and no third-party analytics", () => {
    assert.match(html, /<title>Household meds<\/title>/);
    assert.match(html, /noindex, nofollow/);
    assert.doesNotMatch(html, /google-analytics|gtag\(|mixpanel|segment\./i);
    assert.doesNotMatch(html, /fonts\.googleapis|cdnjs|googletagmanager/);
    assert.doesNotMatch(html, /\bDOB\b|date of birth|patient/i);
  });

  it("contains no banned identity strings in the tracker source", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "household-meds");
    for (const file of walkTextFiles(root)) {
      const text = readFileSync(file, "utf8");
      for (const token of banned) {
        assert.equal(text.includes(token), false, `${file} ${token}`);
      }
    }
  });
});

describe("quiet hours and last check", () => {
  it("is quiet before 8:00 AM and after 8:00 PM, not at 8:00 PM", () => {
    assert.equal(isQuietHours(MIN_8AM - 1), true);
    assert.equal(isQuietHours(MIN_8AM), false);
    assert.equal(isQuietHours(MIN_8PM), false);
    assert.equal(isQuietHours(MIN_8PM + 1), true);
  });

  it("does not ping after the 8pm last check", () => {
    const day = buildDay("2026-08-22", MIN_8PM + 15, {});
    assert.equal(day.quiet, true);
    assert.equal(day.pingsAllowed, false);
    assert.equal(day.slots.every((row) => row.ping === false), true);
    assert.ok(day.groups.due.some((row) => row.slot.id === "serax"));
  });

  it("never schedules Serax at 10pm", () => {
    const tenPm = slotsForDate("2026-08-22").filter((s) => s.family === "serax");
    assert.equal(tenPm.length, 1);
    assert.equal(tenPm[0].dueMin, MIN_8PM);
    assert.equal(tenPm[0].timeLabel, "8:00 PM");
  });
});

describe("holds and non-scheduled items", () => {
  it("keeps tadalafil on hold and out of due/ping lists", () => {
    assert.ok(catalog().some((s) => s.id === "tadalafil" && s.hold && !s.ping));
    assert.equal(names("2026-08-22").some((n) => /tadalafil|cialis/i.test(n)), false);
    const late = buildDay("2026-08-22", MIN_8AM, {});
    assert.equal(late.groups.due.some((row) => row.slot.family === "tadalafil"), false);
    assert.match(HOLD_NOTE, /on hold/i);
  });

  it("does not schedule ice pack reminders", () => {
    const ice = slotsForDate("2026-08-22").find((s) => s.id === "ice");
    assert.equal(ice.kind, "optional");
    assert.equal(ice.ping, false);
    assert.equal(shouldPing(ice, null, MIN_8AM), false);
  });

  it("keeps Benadryl PRN-only", () => {
    const ben = slotsForDate("2026-08-22").find((s) => s.id === "benadryl");
    assert.equal(ben.kind, "prn");
    assert.equal(ben.ping, false);
    const day = buildDay("2026-08-22", MIN_8AM, {});
    assert.equal(day.groups.due.some((row) => row.slot.id === "benadryl"), false);
    assert.equal(day.groups.optional.some((row) => row.slot.id === "benadryl"), true);
  });
});

describe("daily lists", () => {
  it("lists morning dailies at 8:00 AM", () => {
    const morning = slotsForDate("2026-08-22").filter((s) => s.section === "morning" && !s.until);
    const namesSet = new Set(morning.map((s) => s.name));
    for (const name of [
      "Meloxicam",
      "Esomeprazole",
      "Jet-Alert",
      "Fiber",
      "Nature's Bounty Super B-Complex",
      "Solaray Buffered Super Bio Vitamin C",
      "Losartan Potassium",
      "Amlodipine Besylate",
    ]) {
      assert.ok(namesSet.has(name), name);
    }
    assert.ok(ids("2026-08-22").includes("aspirin-am"));
  });

  it("opens evening dailies at 6pm and Serax at 8pm", () => {
    const beforeEvening = buildDay("2026-08-22", 17 * 60 + 59, {});
    assert.equal(beforeEvening.groups.later.some((row) => row.slot.id === "meloxicam-pm"), true);
    assert.equal(beforeEvening.groups.due.some((row) => row.slot.id === "meloxicam-pm"), false);

    const evening = buildDay("2026-08-22", 18 * 60, {});
    const eveningIds = evening.groups.due.map((row) => row.slot.id);
    for (const id of ["meloxicam-pm", "aspirin-pm", "centrum", "d3", "melatonin"]) {
      assert.ok(eveningIds.includes(id), id);
    }
    assert.equal(evening.groups.later.some((row) => row.slot.id === "serax"), true);

    const lastCheck = buildDay("2026-08-22", MIN_8PM, {});
    assert.ok(lastCheck.groups.due.some((row) => row.slot.id === "serax"));
  });
});

describe("aspirin stop date", () => {
  it("shows aspirin through 2026-09-16 and hides it after", () => {
    assert.equal(ASPIRIN_THROUGH, "2026-09-16");
    assert.ok(ids("2026-09-16").includes("aspirin-am"));
    assert.ok(ids("2026-09-16").includes("aspirin-pm"));
    assert.equal(ids("2026-09-17").includes("aspirin-am"), false);
    assert.equal(ids("2026-09-17").includes("aspirin-pm"), false);
    const day = buildDay("2026-08-22", MIN_8AM, {});
    assert.equal(day.aspirinActive, true);
    const am = day.slots.find((row) => row.slot.id === "aspirin-am");
    assert.match(am.slot.note, /Sep 16, 2026/);
  });
});

describe("post-op schedule through 2026-08-26", () => {
  it("schedules daytime slots and not overnight extras", () => {
    assert.equal(POSTOP_THROUGH, "2026-08-26");
    assert.deepEqual(scheduledIdsThrough("2026-08-26", "cyclo"), ["cyclo-8am", "cyclo-8pm"]);
    assert.deepEqual(scheduledIdsThrough("2026-08-26", "ondansetron"), ["ondansetron-8am", "ondansetron-4pm"]);
    assert.deepEqual(scheduledIdsThrough("2026-08-26", "oxy"), ["oxy-8am", "oxy-12pm", "oxy-4pm", "oxy-8pm"]);
    assert.deepEqual(scheduledIdsThrough("2026-08-26", "acetaminophen"), [
      "acetaminophen-8am",
      "acetaminophen-8pm",
    ]);
    assert.equal(ids("2026-08-26").some((id) => /10pm|2am|overnight/i.test(id)), false);
  });

  it("hides post-op scheduled slots after Aug 26 and leaves four optional logs", () => {
    const after = slotsForDate("2026-08-27");
    const families = after.filter((s) => ["cyclo", "ondansetron", "oxy", "acetaminophen"].includes(s.family));
    assert.deepEqual(
      families.map((s) => [s.family, s.kind, s.ping]),
      [
        ["cyclo", "log-only", false],
        ["ondansetron", "log-only", false],
        ["oxy", "photo-only", false],
        ["acetaminophen", "log-only", false],
      ]
    );
    assert.equal(after.some((s) => s.id === "oxy-8am"), false);
    const day = buildDay("2026-08-27", MIN_8AM, {});
    assert.equal(day.postopScheduled, false);
    assert.equal(day.groups.due.some((row) => row.slot.family === "oxy"), false);
  });
});

describe("oxycodone partial slots", () => {
  it("keeps a slot open after 1 of 2 and does not close later slots", () => {
    const dayState = {
      "oxy-8am": takeEntry(null, 1, "2026-08-22T15:10:00.000Z"),
    };
    const noon = buildDay("2026-08-22", 12 * 60, dayState);
    const am = noon.slots.find((row) => row.slot.id === "oxy-8am");
    const midday = noon.slots.find((row) => row.slot.id === "oxy-12pm");
    assert.equal(am.status, "partial");
    assert.equal(am.qty, 1);
    assert.equal(midday.status, "due");
    assert.equal(midday.qty, 0);
    const closed = buildDay("2026-08-22", 12 * 60, {
      "oxy-8am": takeEntry(null, 2, "2026-08-22T15:10:00.000Z"),
    });
    assert.equal(closed.slots.find((row) => row.slot.id === "oxy-8am").status, "taken");
    assert.equal(closed.slots.find((row) => row.slot.id === "oxy-12pm").status, "due");
  });
});

describe("sedation combo", () => {
  it("flags Serax and Benadryl on the same day only when both were given", () => {
    assert.equal(hasSedationCombo({}), false);
    assert.equal(hasSedationCombo({ serax: takeEntry(null, 1, "t") }), false);
    assert.equal(hasSedationCombo({ benadryl: addPrnLog(null, 1, "t") }), false);
    assert.equal(
      hasSedationCombo({
        serax: takeEntry(null, 1, "t"),
        benadryl: addPrnLog(null, 1, "t"),
      }),
      true
    );
    const flagged = buildDay("2026-08-22", MIN_8PM, {
      serax: takeEntry(null, 1, "t"),
      benadryl: addPrnLog(null, 1, "t"),
    });
    assert.equal(flagged.sedationCombo, true);
  });
});

describe("multi-profile store", () => {
  it("starts with lettered profiles A (preset) and B (own list)", () => {
    const s = createStore(memoryStorage());
    const letters = s.listProfiles().map((p) => [p.letter, p.pack]);
    assert.deepEqual(letters, [
      ["A", "preset"],
      ["B", "custom"],
    ]);
    assert.equal(s.getActive().letter, "A");
    assert.equal(STORAGE_KEY, "household-meds-v2");
  });

  it("keeps logs isolated per letter", () => {
    const s = createStore(memoryStorage());
    s.setEntry("2026-08-22", "meloxicam-am", takeEntry(null, 1, "t"));
    assert.equal(s.getDay("2026-08-22")["meloxicam-am"].qty, 1);
    s.setActive("b");
    assert.equal(s.getDay("2026-08-22")["meloxicam-am"], undefined);
    s.setEntry("2026-08-22", "c-1", takeEntry(null, 1, "t"));
    s.setActive("a");
    assert.equal(s.getDay("2026-08-22")["c-1"], undefined);
    assert.equal(s.getDay("2026-08-22")["meloxicam-am"].qty, 1);
  });

  it("lets an own-list profile add doses without changing the preset catalog", () => {
    const custom = { id: "c-iron", label: "Iron", timeKey: "8am", qtyMax: 1 };
    const empty = slotsForProfile("2026-08-22", { pack: "custom", custom: [] });
    const own = slotsForProfile("2026-08-22", { pack: "custom", custom: [custom] });
    assert.equal(empty.length, 0);
    assert.equal(own.length, 1);
    assert.equal(own[0].name, "Iron");
    assert.equal(own[0].dueMin, MIN_8AM);
    assert.ok(slotsForDate("2026-08-22").length > 1);
    const slot = customSlotFromInput({ id: "c-2", label: "Dose", timeKey: "prn", qtyMax: 1 });
    assert.equal(slot.kind, "prn");
    assert.equal(slot.ping, false);
  });

  it("migrates a v1 single-log blob onto profile A", () => {
    const mem = memoryStorage({
      [LEGACY_KEY]: JSON.stringify({
        version: 1,
        days: { "2026-08-22": { "meloxicam-am": takeEntry(null, 1, "t") } },
      }),
    });
    const s = createStore(mem);
    assert.equal(s.getActive().letter, "A");
    assert.equal(s.getDay("2026-08-22")["meloxicam-am"].qty, 1);
    assert.ok(mem.getItem(STORAGE_KEY));
  });
});
