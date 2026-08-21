# Ollama Chat

A thin chat UI for a **native Ollama install on this Mac**. No backend, no Docker, no cloud LLM calls. Messages stay in the tab and are never written to disk.

GitHub Pages is HTTPS, so the live hub **cannot** talk to Ollama on `127.0.0.1` (mixed content). Open this folder from a local origin.

## Run it

From the repo root, with Ollama already installed:

```bash
python3 -m http.server 4173
```

Then open [http://127.0.0.1:4173/ollama-chat/](http://127.0.0.1:4173/ollama-chat/).

Start the model host if it is not already running (`ollama serve`, or open the Ollama app). The page lists whatever you have locally via `/api/tags` and chats through `/api/chat`. It prefers a 32B-class tag when one exists; otherwise it uses the first available model. You can switch at any time.

If you have no models yet, pull one — this is an example, not a required name:

```bash
ollama pull qwen2.5:32b
```

## Privacy

On-device only. No chat history, no export, no resident/patient/member fields. Not a clinical tool — do not enter personal health information.
