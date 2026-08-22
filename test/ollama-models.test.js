import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  EXAMPLE_PULL,
  LOCAL_CHAT_URL,
  LOCAL_SERVE_CMD,
  OLLAMA_HOST,
  is32BClass,
  isLocalHostname,
  isUsableOrigin,
  noModelsMessage,
  ollamaDownMessage,
  originBlockMessage,
  parseChatChunk,
  pickDefaultModel,
} from "../ollama-chat/models.js";

describe("is32BClass", () => {
  it("matches :32b and -32b tags, not llama3.2", () => {
    assert.equal(is32BClass({ name: "qwen2.5:32b" }), true);
    assert.equal(is32BClass({ name: "deepseek-r1:32b-q4_K_M" }), true);
    assert.equal(is32BClass({ name: "llama3.2:3b" }), false);
    assert.equal(is32BClass({ name: "llama3.2:latest" }), false);
    assert.equal(is32BClass({ name: "qwen2.5:7b" }), false);
    assert.equal(is32BClass({ name: "llama3.1:70b" }), false);
  });

  it("matches Ollama parameter_size 32B / 32.8B only", () => {
    assert.equal(is32BClass({ name: "custom", details: { parameter_size: "32.8B" } }), true);
    assert.equal(is32BClass({ name: "custom", details: { parameter_size: "32B" } }), true);
    assert.equal(is32BClass({ name: "custom", details: { parameter_size: "3.2B" } }), false);
    assert.equal(is32BClass({ name: "custom", details: { parameter_size: "70B" } }), false);
  });
});

describe("pickDefaultModel", () => {
  it("prefers a 32B-class tag over a 70B or 7B", () => {
    const name = pickDefaultModel([
      { name: "llama3.1:70b", modified_at: "2026-08-01T00:00:00Z" },
      { name: "qwen2.5:32b", modified_at: "2026-07-01T00:00:00Z" },
      { name: "qwen2.5:7b", modified_at: "2026-08-20T00:00:00Z" },
    ]);
    assert.equal(name, "qwen2.5:32b");
  });

  it("among several 32B tags, prefers the most recently modified", () => {
    const name = pickDefaultModel([
      { name: "qwen2.5:32b", modified_at: "2026-01-01T00:00:00Z" },
      { name: "deepseek-r1:32b", modified_at: "2026-08-01T00:00:00Z" },
    ]);
    assert.equal(name, "deepseek-r1:32b");
  });

  it("falls back to the first named model when nothing is 32B", () => {
    assert.equal(
      pickDefaultModel([{ name: "gemma2:27b" }, { name: "llama3.1:70b" }]),
      "gemma2:27b"
    );
  });

  it("returns null for an empty list", () => {
    assert.equal(pickDefaultModel([]), null);
    assert.equal(pickDefaultModel(null), null);
  });
});

describe("origin + copy", () => {
  it("treats only loopback hostnames as local", () => {
    assert.equal(isLocalHostname("localhost"), true);
    assert.equal(isLocalHostname("127.0.0.1"), true);
    assert.equal(isLocalHostname("[::1]"), true);
    assert.equal(isLocalHostname("jediaston.github.io"), false);
    assert.equal(isUsableOrigin({ protocol: "https:", hostname: "jediaston.github.io" }), false);
    assert.equal(isUsableOrigin({ protocol: "file:", hostname: "" }), false);
    assert.equal(isUsableOrigin({ protocol: "http:", hostname: "127.0.0.1" }), true);
  });

  it("points at native Ollama, a local serve, and an example pull — not a required model", () => {
    assert.equal(OLLAMA_HOST, "http://127.0.0.1:11434");
    assert.match(LOCAL_SERVE_CMD, /python3 -m http\.server/);
    assert.equal(LOCAL_CHAT_URL, "http://127.0.0.1:4173/ollama-chat/");
    assert.match(EXAMPLE_PULL, /ollama pull /);
    assert.match(ollamaDownMessage(), /ollama serve/);
    assert.match(noModelsMessage(), /qwen2\.5:32b/);
    assert.match(originBlockMessage({ protocol: "https:", hostname: "jediaston.github.io" }), /GitHub Pages/);
  });
});

describe("parseChatChunk", () => {
  it("reads streamed assistant tokens and terminal errors", () => {
    assert.equal(parseChatChunk(""), null);
    assert.deepEqual(parseChatChunk('{"message":{"content":"Hi"},"done":false}'), {
      token: "Hi",
      done: false,
    });
    assert.equal(parseChatChunk("not-json").error.length > 0, true);
    assert.equal(parseChatChunk('{"error":"model not found"}').error, "model not found");
  });
});

describe("chrome tokens + earthy people strip", () => {
  it("keeps cream paper and a 1px #1F3854 rule", () => {
    const css = readFileSync(new URL("../ollama-chat/styles.css", import.meta.url), "utf8");
    const html = readFileSync(new URL("../ollama-chat/index.html", import.meta.url), "utf8");
    const icon = readFileSync(new URL("../ollama-chat/icons/icon.svg", import.meta.url), "utf8");
    const blob = [css, html, icon].join("\n");

    assert.match(css, /--canvas:\s*#faf9f5/i);
    assert.match(css, /--ink:\s*#141413/i);
    assert.match(css, /--navy:\s*#1f3854/i);
    assert.match(css, /border-bottom:\s*1px solid var\(--navy\)/);
    assert.doesNotMatch(css, /--navy:\s*#(2f5a8a|244870|1e3a5f)/i);
    assert.doesNotMatch(blob, /#2F5A8A|#244870|#1E3A5F/i);
  });

  it("shows Mira's earthy Humaaans strip on the empty state only", () => {
    const html = readFileSync(new URL("../ollama-chat/index.html", import.meta.url), "utf8");
    const svg = readFileSync(new URL("../ollama-chat/people-strip.svg", import.meta.url));
    const text = svg.toString("utf8");

    assert.match(html, /<img class="people-strip" src="\.\/people-strip\.svg" alt="" width="720">/);
    assert.match(html, /id="setup"/);
    assert.doesNotMatch(html, /id="setup"[\s\S]*people-strip/);
    assert.equal(text.startsWith("<?xml"), true);
    assert.ok(svg.length > 32000);
    for (const fill of ["#D97757", "#D4A27F", "#788C5D", "#F0D5B8", "#E8C4A2", "#D4A181"]) {
      assert.match(text, new RegExp(fill, "i"));
    }
    assert.doesNotMatch(text, /#1F3854|#C4A35A|#C6A15B|#8FCBB3|#E3F3EC/i);
    assert.doesNotMatch(text, /<rect[^>]+(?:width|height)="(?:1200|360|320)"/);
  });
});

describe("privacy + no containers in the app", () => {
  it("does not persist transcripts or mention Docker / cloud LLM APIs", () => {
    const files = [
      "ollama-chat/index.html",
      "ollama-chat/app.js",
      "ollama-chat/models.js",
      "ollama-chat/README.md",
    ].map((p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
    const html = files[0];
    const app = files[1];
    assert.match(html, /Open this on your Mac/);
    assert.match(app, /showLocalSetup/);
    assert.match(app, /LOCAL_CHAT_URL/);
    const blob = files.join("\n");
    assert.doesNotMatch(blob, /localStorage|sessionStorage|indexedDB/);
    assert.doesNotMatch(blob, /docker-compose|orbstack|FROM ubuntu/i);
    assert.doesNotMatch(blob, /api\.openai|api\.anthropic/i);
    assert.doesNotMatch(files[0], /name="(patient|resident|member)/i);
  });
});
