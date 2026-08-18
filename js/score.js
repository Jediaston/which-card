import {
  CARDS,
  CATEGORIES,
  HOTEL_BRANDS,
  MERCHANTS,
  QUARTERLY_CALENDAR,
  RATES_AS_OF,
  getCard,
} from "./data.js";

export { RATES_AS_OF };

export function currentQuarter(date = new Date()) {
  const month = date.getUTCMonth();
  const q = Math.floor(month / 3) + 1;
  return { year: date.getUTCFullYear(), q };
}

export function quarterInfo(date = new Date()) {
  const { year, q } = currentQuarter(date);
  const labels = { 1: "Jan–Mar", 2: "Apr–Jun", 3: "Jul–Sep", 4: "Oct–Dec" };
  const calendar = QUARTERLY_CALENDAR[year]?.[q] || {};
  return {
    year,
    q,
    label: `Q${q} ${year} (${labels[q]})`,
    chase: calendar.chase || [],
    discover: calendar.discover || [],
    citiDividend: calendar.citiDividend || [],
    published: Boolean(calendar.chase || calendar.discover),
  };
}

export function normalizeRate(value) {
  if (value == null) return null;
  if (typeof value === "number") return { rate: value, cap: null };
  return { rate: value.rate, cap: value.cap ?? null, period: value.period || null };
}

export function getFocusCategories(card, focusMap = {}) {
  if (!card?.rotatingCategories) return [];
  const chosen = focusMap[card.id];
  if (Array.isArray(chosen) && chosen.length) {
    return chosen.filter((id) => card.rotatingCategories.includes(id)).slice(0, card.focusCount || 2);
  }
  return [...(card.focusDefault || [])];
}

export function resolveMerchant(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  if (!q) return null;
  if (MERCHANTS[q]) return { id: q, ...MERCHANTS[q] };
  for (const [id, meta] of Object.entries(MERCHANTS)) {
    if (id === q) return { id, ...meta };
    if (meta.aliases?.some((a) => q === a || q.includes(a) || a.includes(q))) {
      return { id, ...meta };
    }
    if (q.includes(id) || id.includes(q)) return { id, ...meta };
  }
  return null;
}

export function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

function quarterlyCats(card, quarter) {
  if (!card.rotating || card.rotating.type !== "quarterly") return [];
  const cal = QUARTERLY_CALENDAR[quarter.year]?.[quarter.q] || {};
  if (card.rotating.calendar === "chase") return cal.chase || [];
  if (card.rotating.calendar === "discover") return cal.discover || [];
  if (card.rotating.calendar === "citiDividend") return cal.citiDividend || [];
  return card.rotating.categories || [];
}

export function networkBlocked(card, merchantMeta) {
  if (!merchantMeta?.requiredNetwork) return false;
  return card.network !== merchantMeta.requiredNetwork;
}

export function effectiveRate(card, ctx = {}) {
  const category = ctx.category || "other";
  const merchantMeta = ctx.merchantMeta || resolveMerchant(ctx.merchant);
  const merchantId = merchantMeta?.id || null;
  const focusMap = ctx.focusMap || {};
  const quarter = ctx.quarter || currentQuarter();
  const activated = ctx.activated || {};

  if (networkBlocked(card, merchantMeta)) {
    return {
      rate: 0,
      source: "blocked",
      cap: null,
      blocked: true,
      reason: `${merchantMeta.label || merchantId} is ${merchantMeta.requiredNetwork}-only`,
    };
  }

  if (category === "rent" && !card.rentEligible) {
    return { rate: 0, source: "ineligible", cap: null, blocked: false, reason: "Rent usually is not eligible" };
  }

  let rate = card.base ?? 1;
  let source = "base";
  let cap = null;

  const catRate = normalizeRate(card.rates?.[category]);
  if (catRate && catRate.rate >= rate) {
    rate = catRate.rate;
    cap = catRate.cap;
    source = "category";
  }

  if (merchantId && card.merchants?.[merchantId] != null) {
    const m = normalizeRate(card.merchants[merchantId]);
    if (m && m.rate >= rate) {
      rate = m.rate;
      cap = m.cap;
      source = "merchant";
    }
  }

  if (card.rotatingCategories) {
    const focus = getFocusCategories(card, focusMap);
    if (focus.includes(category)) {
      const bonus = card.focusRate || 4;
      if (bonus >= rate) {
        rate = bonus;
        cap = card.focusCap || 150000;
        source = "focus";
      }
    }
  }

  if (card.cobrand && HOTEL_BRANDS.has(card.cobrand) && category === "hotels") {
    const otherBrand = merchantId && HOTEL_BRANDS.has(merchantId) && merchantId !== card.cobrand;
    if (!otherBrand) {
      const cobrandRate = normalizeRate(card.merchants?.[card.cobrand] || card.cobrandRate);
      if (cobrandRate && cobrandRate.rate >= rate) {
        rate = cobrandRate.rate;
        cap = cobrandRate.cap;
        source = "cobrand";
      }
    }
  }

  if (card.rotating?.type === "quarterly") {
    const cats = quarterlyCats(card, quarter);
    const isOn = activated[card.id] !== false;
    if (isOn && cats.includes(category)) {
      const qRate = card.rotating.rate || 5;
      if (qRate >= rate) {
        rate = qRate;
        cap = card.rotating.cap || 1500;
        source = "quarterly";
      }
    }
  }

  if (ctx.mode === "travel" && category === "overseas" && card.flags?.includes("no_fx_fee")) {
    // small scoring handled separately; rate unchanged
  }

  return { rate, source, cap, blocked: false, reason: null };
}

function isEverydayMode(mode) {
  return mode !== "business";
}

export function scoreCard(card, ctx = {}) {
  const mode = ctx.mode || "everyday";
  const category = ctx.category || "other";
  const merchantMeta = ctx.merchantMeta || resolveMerchant(ctx.merchant);
  const merchantId = merchantMeta?.id || null;
  const favorites = ctx.favorites || [];
  const focusMap = ctx.focusMap || {};
  const amount = Number(ctx.amount) || 0;

  const earned = effectiveRate(card, { ...ctx, merchantMeta });
  const cpp = card.cpp ?? 1;
  const breakdown = {
    rewards: 0,
    perks: 0,
    merchant: 0,
    dedicated: 0,
    specialist: 0,
    personal: 0,
    favorite: 0,
    feeHaircut: 0,
    cobrandHaircut: 0,
  };

  if (earned.blocked) {
    return {
      card,
      total: -100,
      breakdown,
      rate: 0,
      cpp,
      source: earned.source,
      cap: null,
      blocked: true,
      reason: earned.reason,
      amount,
    };
  }

  breakdown.rewards = earned.rate * cpp;

  if (category === "electronics" && card.perks?.includes("warranty")) {
    breakdown.perks += 2;
  }
  if (category === "electronics" && earned.source === "focus") {
    breakdown.perks += 0.6;
  }
  if (category === "overseas" && card.flags?.includes("no_fx_fee")) {
    breakdown.perks += 2.2;
  }
  if (category === "overseas" && !card.flags?.includes("no_fx_fee")) {
    breakdown.perks -= 2.5;
  }

  if (merchantId && card.merchants?.[merchantId] != null) {
    breakdown.merchant += 2.5;
  }

  const onHotelCobrand =
    Boolean(card.cobrand) &&
    HOTEL_BRANDS.has(card.cobrand) &&
    category === "hotels" &&
    (!merchantId || merchantId === card.cobrand);
  const dedicatedHit =
    (merchantId && card.dedicated?.includes(merchantId)) ||
    card.dedicated?.includes(category) ||
    (card.cobrand && merchantId === card.cobrand) ||
    onHotelCobrand;
  if (dedicatedHit) breakdown.dedicated += 3.5;

  const focus = getFocusCategories(card, focusMap);
  const specialistHit =
    card.specialist?.includes(category) ||
    (card.rotatingCategories && focus.includes(category));
  if (specialistHit) breakdown.specialist += 1.25;

  const businessFit = Boolean(specialistHit || dedicatedHit || earned.source === "focus" || earned.source === "merchant" || earned.source === "cobrand");
  if (isEverydayMode(mode) && card.kind === "personal") {
    breakdown.personal += 0.85;
  }
  if (isEverydayMode(mode) && card.kind === "business" && !businessFit) {
    breakdown.personal -= 2.0;
  }

  if (favorites.includes(card.id)) {
    breakdown.favorite += 0.3;
  }

  breakdown.feeHaircut = Math.min((card.annualFee || 0) / 500, 1.2);

  if (card.cobrand) {
    const onBrand = merchantId === card.cobrand || category === card.cobrand || onHotelCobrand;
    breakdown.cobrandHaircut = onBrand ? 0 : 1.8;
  }

  const total =
    breakdown.rewards +
    breakdown.perks +
    breakdown.merchant +
    breakdown.dedicated +
    breakdown.specialist +
    breakdown.personal +
    breakdown.favorite -
    breakdown.feeHaircut -
    breakdown.cobrandHaircut;

  return {
    card,
    total,
    breakdown,
    rate: earned.rate,
    cpp,
    source: earned.source,
    cap: earned.cap,
    blocked: false,
    reason: reasonFor(card, earned, category, merchantMeta, focus),
    amount,
  };
}

function reasonFor(card, earned, category, merchantMeta, focus) {
  if (earned.reason) return earned.reason;
  const catLabel = categoryById(category)?.label || category;
  const merchantLabel = merchantMeta?.label;
  if (earned.source === "merchant" && merchantLabel) {
    return `${fmtRate(card, earned.rate)} at ${merchantLabel}`;
  }
  if (earned.source === "cobrand") {
    return `${fmtRate(card, earned.rate)} at ${titleCase(card.cobrand)}`;
  }
  if (earned.source === "focus") {
    const extra = category === "electronics" && card.perks?.includes("warranty") ? " · extended warranty" : "";
    return `${fmtRate(card, earned.rate)} ${catLabel.toLowerCase()} (focus)${extra}`;
  }
  if (earned.source === "quarterly") {
    return `${fmtRate(card, earned.rate)} this quarter · $${earned.cap || 1500} cap`;
  }
  if (earned.source === "category") {
    const cap = earned.cap ? ` · first $${Number(earned.cap).toLocaleString()}` : "";
    return `${fmtRate(card, earned.rate)} ${catLabel.toLowerCase()}${cap}`;
  }
  if (card.rentEligible && category === "rent") {
    return `${fmtRate(card, earned.rate)} rent · no landlord fee`;
  }
  if (focus?.length && card.rotatingCategories?.includes(category) && !focus.includes(category)) {
    return `${fmtRate(card, earned.rate)} base · ${catLabel.toLowerCase()} is not a chosen focus`;
  }
  return `${fmtRate(card, earned.rate)} on ${catLabel.toLowerCase()}`;
}

function fmtRate(card, rate) {
  if (card.currency === "cash" || card.cpp === 1 && card.currency !== "MR" && card.currency !== "UR" && card.currency !== "TY") {
    if (card.currency === "cash" || card.currency === "Daily Cash") return `${rate}%`;
  }
  if (card.currency === "cash") return `${rate}%`;
  return `${rate}x`;
}

function titleCase(s) {
  return String(s).replace(/(^|-|\s)\w/g, (m) => m.toUpperCase());
}

export function rankCards(cards, ctx = {}) {
  return [...cards]
    .map((card) => scoreCard(card, ctx))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.rate !== a.rate) return b.rate - a.rate;
      return (a.card.annualFee || 0) - (b.card.annualFee || 0);
    });
}

export function rankWallet(ownedIds, ctx = {}, catalog = CARDS) {
  const cards = ownedIds.map((id) => getCard(id, catalog)).filter(Boolean);
  return rankCards(cards, ctx);
}

export function winner(ownedIds, ctx = {}, catalog = CARDS) {
  return rankWallet(ownedIds, ctx, catalog)[0] || null;
}

export function parseAmount(text) {
  if (text == null || text === "") return 0;
  const n = Number(String(text).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
