# Neuro-Cinematic Homeostasis Engine

> *A Chrome extension that learns how you watch YouTube — and predicts whether you'll finish.*

---

## What it does

The extension watches alongside you. Every few seconds it silently analyses the video you're playing — not what you click, not your history, not your account — just the raw visual and semantic content on screen right now.

From that it builds a live prediction: **how likely are you to watch this video to the end?**

The longer you use it, the more it knows about you. It trains itself on every video you finish or abandon, updating its understanding of your attention patterns in real time.

---

## How to install

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle, top right)
4. Click **Load unpacked** → select the project folder
5. Open any YouTube video

That's it. No account. No server. No API key.

> On first use, the extension downloads its AI model (~45 MB, one time only). After that everything runs locally in your browser.

---

## What you see

Click the extension icon while a video is playing:

```
┌─────────────────────────────────────────┐
│  🎬 How to Build a Startup from Scratch  │
│                                         │
│  73% chance you finish                  │
│                                         │
│  Alignment  ████████░░  78              │
│  Novelty    ███░░░░░░░  32              │
│  Drift      ████░░░░░░  41              │
│                                         │
│  14 videos trained on so far            │
└─────────────────────────────────────────┘
```

The prediction updates live every 6 seconds. The model retrains the moment you leave or finish a video.

---

## Privacy

- **Nothing leaves your browser.** Frames, embeddings, watch history — all stored locally in your browser's extension storage.
- No account required. No tracking. No analytics.
- Uninstalling the extension deletes all stored data.

---

## For researchers and developers

A Python notebook (`ml_workbench.ipynb`) is included for offline analysis. You can export your local watch history, run experiments, and deploy improved model weights back into the extension — without touching any external service.

The legacy Python backend (`app.py`) is included as a reference implementation for server-side deployment.

---

## Tech

Built with [Transformers.js](https://huggingface.co/docs/transformers.js/en/index) · Chrome Extensions Manifest V3 · Online learning

---

*Personal project. Not affiliated with YouTube or Google.*
