import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const html = readFileSync(new URL("../chart-assist/index.html", import.meta.url), "utf8");

const MUST_HAVE = [
  ["T1006", "Alcohol/substance abuse services, family/couple counseling"],
  ["T1007", "Alcohol/substance abuse services, treatment plan development/modification"],
  ["T1012", "Alcohol/substance abuse services, skills development"],
  ["T1013", "Sign language or oral interpretive services, per 15 min"],
  ["T1015", "Clinic visit/encounter, all-inclusive"],
  ["T1016", "Case management, each 15 min"],
  ["T1017", "Targeted case management, each 15 min"],
  ["T1018", "School-based IEP services, bundled"],
  ["T1023", "Screening for program/protocol appropriateness, per encounter"],
  ["T1024", "Integrated specialty team eval/treatment, multiple or severely handicapped children, per encounter"],
  ["T1025", "Intensive extended multidisciplinary clinic services, children with complex impairments, per diem"],
  ["T1026", "Same, per hour (also used in some state ABA/wrap manuals)"],
  ["T1027", "Family training and counseling for child development, per 15 min"],
  ["T1028", "Assessment of home, physical, and family environment"],
  ["T1040", "Medicaid CCBHC services, per diem"],
  ["T1041", "Medicaid CCBHC services, per month"],
  ["T2010", "PASRR Level I identification screening"],
  ["T2011", "PASRR Level II evaluation"],
  ["T2022", "Case management, per month"],
  ["T2023", "Targeted case management, per month"],
  ["T2024", "Service assessment / plan of care development, waiver"],
  ["T2034", "Crisis intervention, waiver, per diem"],
  ["T2048", "Behavioral health long-term care residential (typically >30 days), with room and board, per diem"],
];

const FORBIDDEN = [
  "T1005",
  ...Array.from({ length: 10 }, (_, i) => `T${2012 + i}`),
  "T2025",
  "T2047",
  ...Array.from({ length: 25 }, (_, i) => `T${4521 + i}`),
  "T2042", "T2043", "T2044", "T2045", "T2046",
  "T2001", "T2002", "T2003", "T2004", "T2005", "T2006", "T2007", "T2049",
  "T2101",
  "T1032", "T1033",
];

function listedCodes() {
  const block = html.match(/const HCPCS_T_CODES = \[([\s\S]*?)\];/);
  assert.ok(block, "HCPCS_T_CODES array missing");
  return [...block[1].matchAll(/code:"(T\d+)"/g)].map((m) => m[1]);
}

describe("Chart Assist HCPCS T-codes", () => {
  it("ships every must-have code with the exact descriptor", () => {
    for (const [code, desc] of MUST_HAVE) {
      const row = new RegExp(`code:"${code}", desc:"${desc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
      assert.match(html, row, `${code} descriptor mismatch`);
    }
    assert.equal(listedCodes().length, MUST_HAVE.length);
  });

  it("does not add I/DD-HCBS extras, incontinence, hospice, transport, doula, or breast-milk codes", () => {
    const codes = new Set(listedCodes());
    for (const code of FORBIDDEN) {
      assert.equal(codes.has(code), false, `should not include ${code}`);
    }
  });

  it("does not present T1026 as an ABA / 97153 substitute", () => {
    assert.match(html, /T1026 is not a replacement for 97153/);
    assert.match(html, /ABA medical stays 97151–97158/);
  });
});

describe("Chart Assist product constraints", () => {
  it("keeps the personal-demo banner and nothing-saved copy", () => {
    assert.match(html, /Personal demo — not a coverage determination/);
    assert.match(html, /Do not enter real member, patient, or claim data/);
    assert.match(html, /Nothing is saved/);
  });

  it("does not persist notes or collect identifiers", () => {
    assert.doesNotMatch(html, /localStorage|sessionStorage/);
    assert.match(html, /No resident name, room, or staff identifiers/);
  });

  it("keeps narrative / SBAR toggle", () => {
    assert.match(html, /data-format="narrative"/);
    assert.match(html, /data-format="sbar"/);
    assert.match(html, /function composeSbar/);
  });
});

describe("Chart Assist keeps original chrome", () => {
  it("restores live paper / navy / teal tokens and does not add a restyle", () => {
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    assert.match(css, /--paper:#F6F3EA/);
    assert.match(css, /--navy:#1F3854/);
    assert.match(css, /--navy-soft:#3C5878/);
    assert.match(css, /--teal:#2C7A67/);
    assert.match(html, /family=Inter|['"]Inter['"]/);
    assert.doesNotMatch(css, /#8FCBB3|#C6A15B|#1E3A5F|#FAF9F5|#D97757/);
    assert.doesNotMatch(html, /peopleSceneSvg|people-wash|people-strip/);
  });
});
