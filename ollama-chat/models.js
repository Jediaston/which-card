/** Pure helpers for the localhost Ollama chat UI. Safe to import from Node tests. */

export const OLLAMA_HOST = "http://127.0.0.1:11434";
export const LOCAL_SERVE_CMD = "python3 -m http.server 4173";
export const EXAMPLE_PULL = "ollama pull qwen2.5:32b";

/**
 * A 32B-class tag — the daily-driver size — not a 3.2B / llama3.2 lookalike.
 * Matches name tokens like `:32b` / `-32b` and Ollama `details.parameter_size` like `32B` / `32.8B`.
 */
export function is32BClass(model) {
  if (!model || typeof model !== "object") return false;
  const name = String(model.name || model.model || "").toLowerCase();
  if (/(^|[^\d.])32b\b/.test(name)) return true;
  const param = String(model.details?.parameter_size || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  return /^32(\.\d+)?b\b/.test(param);
}

export function modelName(model) {
  if (!model || typeof model !== "object") return "";
  return String(model.name || model.model || "");
}

/** Prefer a 32B-class model (most recently modified if several); else the first available. */
export function pickDefaultModel(models) {
  if (!Array.isArray(models) || models.length === 0) return null;
  const named = models.filter((m) => modelName(m));
  if (!named.length) return null;
  const hits = named.filter(is32BClass);
  const pool = hits.length ? hits : named;
  const ranked = [...pool].sort((a, b) => {
    const ta = Date.parse(a.modified_at || "") || 0;
    const tb = Date.parse(b.modified_at || "") || 0;
    return tb - ta;
  });
  return modelName(ranked[0]) || null;
}

export function isLocalHostname(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/**
 * GitHub Pages is HTTPS; the browser will block http://127.0.0.1:11434 (mixed content).
 * file:// also cannot talk to Ollama. Only a localhost http origin is in play.
 */
export function isUsableOrigin(loc = globalThis.location) {
  if (!loc) return false;
  if (loc.protocol === "file:") return false;
  return isLocalHostname(loc.hostname);
}

export function originBlockMessage(loc = globalThis.location) {
  const protocol = loc?.protocol || "";
  if (protocol === "file:") {
    return (
      "This page was opened as a file, so the browser will not let it talk to Ollama. " +
      `From the repo root run \`${LOCAL_SERVE_CMD}\`, then open http://127.0.0.1:4173/ollama-chat/`
    );
  }
  return (
    "This page is not on localhost. A GitHub Pages (HTTPS) tab cannot call Ollama on your Mac — " +
    "the browser blocks mixed content. Serve the repo locally with " +
    `\`${LOCAL_SERVE_CMD}\`, then open http://127.0.0.1:4173/ollama-chat/`
  );
}

export function ollamaDownMessage() {
  return (
    `Can't reach Ollama at ${OLLAMA_HOST}. Start it with \`ollama serve\` or open the Ollama app, then retry.`
  );
}

export function noModelsMessage() {
  return (
    `No local models found. Pull one first (example, not required): \`${EXAMPLE_PULL}\``
  );
}

/** Parse one NDJSON line from POST /api/chat. */
export function parseChatChunk(line) {
  const text = String(line || "").trim();
  if (!text) return null;
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "Ollama sent a response this page could not read." };
  }
  if (json.error) return { error: String(json.error) };
  return {
    token: json.message?.content ? String(json.message.content) : "",
    done: Boolean(json.done),
  };
}
