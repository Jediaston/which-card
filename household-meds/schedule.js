/** Household dose schedule. America/Los_Angeles. No clinic booking. */

export const TIMEZONE = "America/Los_Angeles";
export const POSTOP_THROUGH = "2026-08-26";
export const ASPIRIN_THROUGH = "2026-09-16";

export const MIN_8AM = 8 * 60;
export const MIN_12PM = 12 * 60;
export const MIN_4PM = 16 * 60;
export const MIN_6PM = 18 * 60;
export const MIN_8PM = 20 * 60;

const pad = (n) => String(n).padStart(2, "0");

export function zonedParts(date = new Date(), timeZone = TIMEZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute,
    second: Number(parts.second),
    minutes: hour * 60 + minute,
  };
}

export function formatDateLabel(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 18, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(utc);
}

export function formatClock(minutes) {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

/** Quiet after the 8:00 PM last check; pings resume 8:00 AM. 8:00 PM itself is the last check. */
export function isQuietHours(minutes) {
  return minutes > MIN_8PM || minutes < MIN_8AM;
}

export function canPing(minutes) {
  return !isQuietHours(minutes);
}

function slot({
  id,
  family,
  name,
  strength,
  dose,
  timeLabel,
  dueMin,
  section,
  qtyMax = 1,
  completeAt = 1,
  qtyUnit = "tab",
  until = null,
  afterUntil = "hide",
  ping = true,
  hold = false,
  kind = "scheduled",
  note = "",
  combo = null,
  qtyChoices = null,
}) {
  return {
    id,
    family,
    name,
    strength,
    dose,
    timeLabel,
    dueMin,
    section,
    qtyMax,
    completeAt,
    qtyUnit,
    until,
    afterUntil,
    ping,
    hold,
    kind,
    note,
    combo,
    qtyChoices,
  };
}

/** Full catalog. Tadalafil is on hold and never emitted as due. Ice is optional/silent only. */
export function catalog() {
  return [
    slot({
      id: "meloxicam-am",
      family: "meloxicam",
      name: "Meloxicam",
      strength: "7.5mg",
      dose: "1 tab · morning BID",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
    }),
    slot({
      id: "esomeprazole",
      family: "esomeprazole",
      name: "Esomeprazole",
      strength: "20mg",
      dose: "1 cap",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
    }),
    slot({
      id: "jet-alert",
      family: "jet-alert",
      name: "Jet-Alert",
      strength: "100mg",
      dose: "1–2 tabs AM",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
      qtyMax: 2,
      completeAt: 1,
      qtyChoices: [
        { qty: 1, label: "1 tab" },
        { qty: 2, label: "2 tabs" },
      ],
    }),
    slot({
      id: "aspirin-am",
      family: "aspirin",
      name: "Aspirin EC",
      strength: "81mg",
      dose: "1 tab · morning BID",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
      until: ASPIRIN_THROUGH,
      afterUntil: "hide",
      note: "Through Sep 16, 2026",
    }),
    slot({
      id: "fiber",
      family: "fiber",
      name: "Fiber",
      strength: "",
      dose: "Citrucel and/or Yerba Prima psyllium",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
    }),
    slot({
      id: "b-complex",
      family: "b-complex",
      name: "Nature's Bounty Super B-Complex",
      strength: "",
      dose: "1 tab",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
    }),
    slot({
      id: "vitamin-c",
      family: "vitamin-c",
      name: "Solaray Buffered Super Bio Vitamin C",
      strength: "1000 mg",
      dose: "1 tab",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
    }),
    slot({
      id: "losartan",
      family: "losartan",
      name: "Losartan Potassium",
      strength: "100 mg",
      dose: "1 tab",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
    }),
    slot({
      id: "amlodipine",
      family: "amlodipine",
      name: "Amlodipine Besylate",
      strength: "5 mg",
      dose: "1 tab",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
    }),
    slot({
      id: "cyclo-8am",
      family: "cyclo",
      name: "Cyclobenzaprine",
      strength: "10mg",
      dose: "1 tab",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
      until: POSTOP_THROUGH,
      afterUntil: "log-only",
    }),
    slot({
      id: "ondansetron-8am",
      family: "ondansetron",
      name: "Ondansetron",
      strength: "4mg",
      dose: "1 tab",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
      until: POSTOP_THROUGH,
      afterUntil: "log-only",
    }),
    slot({
      id: "oxy-8am",
      family: "oxy",
      name: "Oxycodone IR",
      strength: "5mg",
      dose: "2 tablets this slot",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
      qtyMax: 2,
      completeAt: 2,
      until: POSTOP_THROUGH,
      afterUntil: "photo-only",
      qtyChoices: [
        { qty: 1, label: "1 of 2" },
        { qty: 2, label: "Both" },
      ],
    }),
    slot({
      id: "acetaminophen-8am",
      family: "acetaminophen",
      name: "Acetaminophen",
      strength: "500mg",
      dose: "1–2 tabs (1000mg = 2×500)",
      timeLabel: "8:00 AM",
      dueMin: MIN_8AM,
      section: "morning",
      qtyMax: 2,
      completeAt: 1,
      until: POSTOP_THROUGH,
      afterUntil: "log-only",
      qtyChoices: [
        { qty: 1, label: "500mg" },
        { qty: 2, label: "1000mg" },
      ],
    }),
    slot({
      id: "oxy-12pm",
      family: "oxy",
      name: "Oxycodone IR",
      strength: "5mg",
      dose: "2 tablets this slot",
      timeLabel: "12:00 PM",
      dueMin: MIN_12PM,
      section: "midday",
      qtyMax: 2,
      completeAt: 2,
      until: POSTOP_THROUGH,
      afterUntil: "photo-only",
      qtyChoices: [
        { qty: 1, label: "1 of 2" },
        { qty: 2, label: "Both" },
      ],
    }),
    slot({
      id: "ondansetron-4pm",
      family: "ondansetron",
      name: "Ondansetron",
      strength: "4mg",
      dose: "1 tab",
      timeLabel: "4:00 PM",
      dueMin: MIN_4PM,
      section: "afternoon",
      until: POSTOP_THROUGH,
      afterUntil: "log-only",
    }),
    slot({
      id: "oxy-4pm",
      family: "oxy",
      name: "Oxycodone IR",
      strength: "5mg",
      dose: "2 tablets this slot",
      timeLabel: "4:00 PM",
      dueMin: MIN_4PM,
      section: "afternoon",
      qtyMax: 2,
      completeAt: 2,
      until: POSTOP_THROUGH,
      afterUntil: "photo-only",
      qtyChoices: [
        { qty: 1, label: "1 of 2" },
        { qty: 2, label: "Both" },
      ],
    }),
    slot({
      id: "meloxicam-pm",
      family: "meloxicam",
      name: "Meloxicam",
      strength: "7.5mg",
      dose: "1 tab · evening BID",
      timeLabel: "6:00 PM",
      dueMin: MIN_6PM,
      section: "evening",
    }),
    slot({
      id: "aspirin-pm",
      family: "aspirin",
      name: "Aspirin EC",
      strength: "81mg",
      dose: "1 tab · evening BID",
      timeLabel: "6:00 PM",
      dueMin: MIN_6PM,
      section: "evening",
      until: ASPIRIN_THROUGH,
      afterUntil: "hide",
      note: "Through Sep 16, 2026",
    }),
    slot({
      id: "centrum",
      family: "centrum",
      name: "Centrum Silver Adults 50+",
      strength: "",
      dose: "1 tab",
      timeLabel: "6:00 PM",
      dueMin: MIN_6PM,
      section: "evening",
    }),
    slot({
      id: "d3",
      family: "d3",
      name: "Nature Made D3",
      strength: "1000 IU",
      dose: "1 softgel",
      timeLabel: "6:00 PM",
      dueMin: MIN_6PM,
      section: "evening",
    }),
    slot({
      id: "melatonin",
      family: "melatonin",
      name: "Melatonin",
      strength: "10 mg",
      dose: "1 tab at night",
      timeLabel: "6:00 PM",
      dueMin: MIN_6PM,
      section: "evening",
    }),
    slot({
      id: "serax",
      family: "serax",
      name: "Serax (oxazepam)",
      strength: "15mg",
      dose: "1 cap · 8pm check only — never 10pm",
      timeLabel: "8:00 PM",
      dueMin: MIN_8PM,
      section: "last-check",
      combo: "sedation",
    }),
    slot({
      id: "cyclo-8pm",
      family: "cyclo",
      name: "Cyclobenzaprine",
      strength: "10mg",
      dose: "1 tab",
      timeLabel: "8:00 PM",
      dueMin: MIN_8PM,
      section: "last-check",
      until: POSTOP_THROUGH,
      afterUntil: "log-only",
    }),
    slot({
      id: "oxy-8pm",
      family: "oxy",
      name: "Oxycodone IR",
      strength: "5mg",
      dose: "2 tablets this slot",
      timeLabel: "8:00 PM",
      dueMin: MIN_8PM,
      section: "last-check",
      qtyMax: 2,
      completeAt: 2,
      until: POSTOP_THROUGH,
      afterUntil: "photo-only",
      qtyChoices: [
        { qty: 1, label: "1 of 2" },
        { qty: 2, label: "Both" },
      ],
    }),
    slot({
      id: "acetaminophen-8pm",
      family: "acetaminophen",
      name: "Acetaminophen",
      strength: "500mg",
      dose: "1–2 tabs (1000mg = 2×500)",
      timeLabel: "8:00 PM",
      dueMin: MIN_8PM,
      section: "last-check",
      qtyMax: 2,
      completeAt: 1,
      until: POSTOP_THROUGH,
      afterUntil: "log-only",
      qtyChoices: [
        { qty: 1, label: "500mg" },
        { qty: 2, label: "1000mg" },
      ],
    }),
    slot({
      id: "benadryl",
      family: "benadryl",
      name: "Benadryl (diphenhydramine)",
      strength: "25mg",
      dose: "PRN only · log when given",
      timeLabel: "PRN",
      dueMin: null,
      section: "optional",
      ping: false,
      kind: "prn",
      combo: "sedation",
    }),
    slot({
      id: "ice",
      family: "ice",
      name: "Ice pack",
      strength: "",
      dose: "Not scheduled · silent optional log",
      timeLabel: "optional",
      dueMin: null,
      section: "optional",
      ping: false,
      kind: "optional",
    }),
    slot({
      id: "tadalafil",
      family: "tadalafil",
      name: "Tadalafil (Cialis)",
      strength: "",
      dose: "On hold",
      timeLabel: "",
      dueMin: null,
      section: "hold",
      ping: false,
      hold: true,
      kind: "hold",
    }),
  ];
}

function optionalAfter(template) {
  const mode = template.afterUntil;
  return {
    ...template,
    id: `${template.family}-log`,
    timeLabel: mode === "photo-only" ? "photo-only" : "log-only",
    dueMin: null,
    section: "optional",
    ping: false,
    kind: mode,
    dose:
      mode === "photo-only"
        ? "Photo-only · log if given"
        : "Optional log · not scheduled today",
    note: `Scheduled slots ended ${POSTOP_THROUGH}`,
  };
}

export function slotsForDate(dateKey) {
  const seenFamily = new Set();
  const out = [];
  for (const template of catalog()) {
    if (template.hold) continue;
    if (template.until && dateKey > template.until) {
      if (template.afterUntil === "hide") continue;
      if (template.afterUntil === "log-only" || template.afterUntil === "photo-only") {
        if (seenFamily.has(template.family)) continue;
        seenFamily.add(template.family);
        out.push(optionalAfter(template));
        continue;
      }
    }
    out.push({ ...template });
  }
  return out;
}

export function entryQty(entry) {
  if (!entry) return 0;
  if (Array.isArray(entry.logs) && entry.logs.length) {
    return entry.logs.reduce((sum, log) => sum + (Number(log.qty) || 1), 0);
  }
  return Number(entry.qty) || 0;
}

export function isComplete(slot, entry) {
  if (!entry) return false;
  if (entry.status === "skipped") return true;
  if (slot.kind === "prn" || slot.kind === "optional" || slot.kind === "log-only" || slot.kind === "photo-only") {
    return false;
  }
  return entryQty(entry) >= slot.completeAt;
}

export function isPartial(slot, entry) {
  if (!entry || entry.status === "skipped") return false;
  const qty = entryQty(entry);
  return qty > 0 && qty < slot.completeAt;
}

export function displayStatus(slot, entry, minutes) {
  if (entry?.status === "skipped") return "skipped";
  if (isComplete(slot, entry)) return "taken";
  if (isPartial(slot, entry)) return "partial";
  if (slot.kind !== "scheduled") return "optional";
  if (minutes < slot.dueMin) return "later";
  return "due";
}

export function shouldPing(slot, entry, minutes) {
  if (!slot.ping || slot.hold || slot.kind !== "scheduled") return false;
  if (!canPing(minutes)) return false;
  if (isComplete(slot, entry)) return false;
  if (minutes < slot.dueMin) return false;
  return true;
}

export function hasSedationCombo(dayState = {}) {
  const serax = dayState.serax;
  const benadryl = dayState.benadryl;
  const seraxTaken = serax && serax.status !== "skipped" && entryQty(serax) > 0;
  const benadrylGiven = benadryl && (entryQty(benadryl) > 0 || (benadryl.logs && benadryl.logs.length));
  return Boolean(seraxTaken && benadrylGiven);
}

export function buildDay(dateKey, minutes, dayState = {}) {
  const slots = slotsForDate(dateKey).map((slot) => {
    const entry = dayState[slot.id] || null;
    const status = displayStatus(slot, entry, minutes);
    return {
      slot,
      entry,
      status,
      qty: entryQty(entry),
      ping: shouldPing(slot, entry, minutes),
    };
  });

  const groups = {
    due: slots.filter((row) => row.status === "due" || row.status === "partial"),
    taken: slots.filter((row) => row.status === "taken"),
    skipped: slots.filter((row) => row.status === "skipped"),
    later: slots.filter((row) => row.status === "later"),
    optional: slots.filter((row) => row.status === "optional"),
  };

  return {
    dateKey,
    minutes,
    quiet: isQuietHours(minutes),
    lastCheck: minutes >= MIN_8PM,
    pingsAllowed: canPing(minutes),
    sedationCombo: hasSedationCombo(dayState),
    aspirinActive: dateKey <= ASPIRIN_THROUGH,
    postopScheduled: dateKey <= POSTOP_THROUGH,
    groups,
    slots,
  };
}

export function takeEntry(existing, qty, at) {
  const nextQty = Math.max(Number(qty) || 1, 0);
  return {
    status: "taken",
    qty: nextQty,
    at,
  };
}

export function skipEntry(at) {
  return { status: "skipped", qty: 0, at };
}

export function addPrnLog(existing, qty, at) {
  const logs = existing?.logs ? [...existing.logs] : [];
  logs.push({ qty: Number(qty) || 1, at });
  return {
    status: "taken",
    qty: logs.reduce((sum, log) => sum + (Number(log.qty) || 1), 0),
    logs,
    at,
  };
}

export function scheduledIdsThrough(dateKey, family) {
  return slotsForDate(dateKey)
    .filter((s) => s.family === family && s.kind === "scheduled")
    .map((s) => s.id);
}

export const HOLD_NOTE = "Tadalafil (Cialis) is on hold — not listed as due and not pinged.";
export const NO_CLINIC_NOTE = "This page does not book appointments or contact clinics.";
export const QUIET_NOTE = "Quiet hours after 8:00 PM PT. Last check is 8:00 PM. Pings resume 8:00 AM PT.";
export const PATIENT = {
  given: "Jonathan",
  family: "Harland",
  dob: "1965-04-20",
  city: "Bellevue WA",
};
