# Neuro-Cinematic Homeostasis Engine

> *A Chrome extension that learns how you watch YouTube — and predicts whether you'll finish.*

---

## What it does

The extension watches alongside you. Every 6 seconds it samples the video you're playing and observes how you're interacting with it — not your account, not your history, not what you click on recommendations. Just the raw visual content on screen and your real-time behaviour.

From that it builds a live prediction: **how likely are you to watch this video to the end?**

The longer you use it, the more it knows about you. It trains itself on every video you finish or abandon, updating its model of your attention in real time.

---

## How to install

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle, top right)
4. Click **Load unpacked** → select the project folder
5. Open any YouTube video

No account. No server. No API key.

> On first use, the extension downloads its AI model (~45 MB, one time only, cached in your browser). After that everything runs locally.

---

## What you see

Click the extension icon while a video is playing:

```
┌──────────────────────────────────────────────────┐
│  How to Build a Startup from Scratch             │
│                                                  │
│  73%  chance you finish                          │
│                                                  │
│  ● watching   ● engagement 81   ⏩ 1×   📐 align 64  │
│                                                  │
│  0:00 ────●────────[↩]──────[⏸]────────── 28:10  │
│  ● rewind  ● pause  ● tab away  ● speed change   │
│                                                  │
│  14 videos trained on so far                     │
│  align:1.02 eng:0.48 seek:-0.31 hidden:-0.50 …  │
└──────────────────────────────────────────────────┘
```

**The prediction updates live every 6 seconds.** The model retrains the moment you leave or finish a video. Events on the timeline — rewinds, pauses, tab switches, speed changes — appear as coloured dots as they happen.

---

## Signals tracked

**Visual (CLIP):**
- **Alignment** — does the current frame visually match the video's title? Low alignment often predicts early dropout.

**Behavioural:**
- **Engagement** — composite score per tick: tab visibility, playback speed, recent events
- **Seek-back rate** — how often you rewind (strong positive engagement signal)
- **Tab-hidden rate** — fraction of time you were in another tab
- **Long-pause rate** — fraction of ticks with a pause longer than 10 seconds

The model learns your personal weights for each signal — someone who habitually rewinds lectures will have a different learned profile than someone who speed-watches vlogs.

---

## Privacy

- **Nothing leaves your browser.** Frames, embeddings, watch history — stored locally in your browser's extension storage only.
- No account required. No tracking. No analytics sent anywhere.
- Uninstalling the extension deletes all stored data.

---

## For researchers and developers

A Python notebook (`ml_workbench.ipynb`) is included for offline analysis. Export your local watch history, run experiments, and deploy improved model weights back into the extension — without touching any external service.

The legacy Python backend (`app.py`) is included as a reference implementation for server-side deployment with Gemini-powered diagnostics.

---

## Tech

Built with [Transformers.js](https://huggingface.co/docs/transformers.js/en/index) · Chrome Extensions Manifest V3 · Online logistic regression

---

*Personal project. Not affiliated with YouTube or Google.*
