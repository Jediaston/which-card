import {
  OLLAMA_HOST,
  isUsableOrigin,
  originBlockMessage,
  ollamaDownMessage,
  noModelsMessage,
  pickDefaultModel,
  modelName,
  parseChatChunk,
} from "./models.js";

const $ = (id) => document.getElementById(id);

const els = {
  model: $("model"),
  status: $("status"),
  banner: $("banner"),
  bannerText: $("banner-text"),
  retry: $("retry"),
  thread: $("thread"),
  empty: $("empty"),
  input: $("input"),
  send: $("send"),
  stop: $("stop"),
  clear: $("clear"),
};

/** In-tab only. Never written to storage. */
const session = {
  models: [],
  selected: "",
  messages: [],
  abort: null,
};

function setStatus(kind, text) {
  els.status.className = `status is-${kind}`;
  els.status.querySelector(".label").textContent = text;
}

function showBanner(kind, text) {
  els.banner.hidden = false;
  els.banner.className = `banner is-${kind}`;
  els.bannerText.textContent = text + " ";
  els.retry.hidden = kind === "ok";
}

function hideBanner() {
  els.banner.hidden = true;
}

function setBusy(busy) {
  els.send.hidden = busy;
  els.stop.hidden = !busy;
  els.model.disabled = busy || session.models.length === 0;
  els.input.disabled = busy;
  els.clear.disabled = busy || session.messages.length === 0;
  els.send.disabled = busy || !canSend();
}

function canSend() {
  return Boolean(session.selected && els.input.value.trim() && !session.abort);
}

function syncSend() {
  els.send.disabled = !canSend();
  els.clear.disabled = Boolean(session.abort) || session.messages.length === 0;
}

function renderThread() {
  els.empty.hidden = session.messages.length > 0;
  for (const node of [...els.thread.querySelectorAll(".msg")]) node.remove();
  for (let i = 0; i < session.messages.length; i += 1) {
    const item = session.messages[i];
    const bubble = document.createElement("div");
    bubble.className = `msg ${item.role}`;
    bubble.dataset.idx = String(i);
    bubble.textContent = item.content;
    if (item.live) bubble.classList.add("is-live");
    els.thread.appendChild(bubble);
  }
  els.thread.scrollTop = els.thread.scrollHeight;
}

function fillModels(models, preferred) {
  session.models = models;
  els.model.replaceChildren();
  if (!models.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No models";
    els.model.appendChild(opt);
    session.selected = "";
    els.model.disabled = true;
    return;
  }
  for (const m of models) {
    const name = modelName(m);
    const opt = document.createElement("option");
    opt.value = name;
    const size = m.details?.parameter_size ? ` · ${m.details.parameter_size}` : "";
    opt.textContent = name + size;
    els.model.appendChild(opt);
  }
  session.selected = preferred && models.some((m) => modelName(m) === preferred)
    ? preferred
    : pickDefaultModel(models) || modelName(models[0]);
  els.model.value = session.selected;
  els.model.disabled = false;
}

function isAbort(err) {
  return err?.name === "AbortError" || /aborted/i.test(String(err?.message || ""));
}

function explainFail(err) {
  if (isAbort(err)) return "aborted";
  if (err instanceof TypeError) return ollamaDownMessage();
  const msg = String(err?.message || err || "").trim();
  return msg || ollamaDownMessage();
}

function readOllamaError(status, body) {
  try {
    const json = JSON.parse(body);
    if (json.error) return String(json.error);
  } catch {
    /* plain text */
  }
  return String(body || "").trim() || `Ollama returned HTTP ${status}`;
}

async function loadModels() {
  if (!isUsableOrigin()) {
    setStatus("err", "Not on localhost");
    showBanner("err", originBlockMessage());
    els.model.disabled = true;
    els.send.disabled = true;
    els.input.disabled = true;
    return;
  }

  setStatus("warn", "Checking Ollama…");
  hideBanner();

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const models = Array.isArray(data.models) ? data.models : [];
    if (!models.length) {
      fillModels([], "");
      setStatus("warn", "Ollama · no models");
      showBanner("warn", noModelsMessage());
      syncSend();
      return;
    }
    fillModels(models, session.selected);
    setStatus("ok", `Ollama · ${models.length} model${models.length === 1 ? "" : "s"}`);
    hideBanner();
    syncSend();
  } catch (err) {
    fillModels([], "");
    setStatus("err", "Ollama is off");
    showBanner("err", explainFail(err));
    syncSend();
  }
}

async function send() {
  const text = els.input.value.trim();
  if (!text || !session.selected || session.abort) return;

  session.messages.push({ role: "user", content: text });
  session.messages.push({ role: "assistant", content: "", live: true });
  els.input.value = "";
  resizeInput();
  renderThread();

  const controller = new AbortController();
  session.abort = controller;
  setBusy(true);

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: session.selected,
        messages: session.messages
          .filter((m) => !m.live && m.content)
          .map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        detail = await res.text();
      } catch {
        detail = "";
      }
      throw new Error(readOllamaError(res.status, detail));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const assistant = session.messages[session.messages.length - 1];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const chunk = parseChatChunk(line);
        if (!chunk) continue;
        if (chunk.error) throw new Error(chunk.error);
        if (chunk.token) {
          assistant.content += chunk.token;
          renderThread();
        }
      }
    }
    const tail = parseChatChunk(buf);
    if (tail?.token) {
      assistant.content += tail.token;
    }
    if (tail?.error) throw new Error(tail.error);
    if (!assistant.content) assistant.content = "(no reply)";
  } catch (err) {
    const assistant = session.messages[session.messages.length - 1];
    const message = explainFail(err);
    if (message === "aborted") {
      if (assistant && !assistant.content) assistant.content = "(stopped)";
    } else if (assistant && !assistant.content) {
      session.messages.pop();
      showBanner("err", message);
      setStatus("err", "Chat failed");
    } else {
      showBanner("err", message);
    }
  } finally {
    const last = session.messages[session.messages.length - 1];
    if (last) delete last.live;
    session.abort = null;
    renderThread();
    setBusy(false);
    els.input.focus();
  }
}

function stop() {
  session.abort?.abort();
}

function clearChat() {
  if (session.abort) return;
  session.messages = [];
  hideBanner();
  renderThread();
  syncSend();
  els.input.focus();
}

function resizeInput() {
  els.input.style.height = "auto";
  els.input.style.height = `${Math.min(els.input.scrollHeight, 180)}px`;
}

els.model.addEventListener("change", () => {
  session.selected = els.model.value;
  syncSend();
});

els.send.addEventListener("click", () => {
  send();
});

els.stop.addEventListener("click", () => {
  stop();
});

els.clear.addEventListener("click", () => {
  clearChat();
});

els.retry.addEventListener("click", () => {
  loadModels();
});

els.input.addEventListener("input", () => {
  resizeInput();
  syncSend();
});

els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (canSend()) send();
  }
});

setBusy(false);
renderThread();
loadModels();
