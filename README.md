# Neuro-Cinematic Tracker v3

> *A Chrome extension that learns your YouTube viewing patterns and predicts whether you'll finish a video.*

**[📄 Read the Research Paper →](research_paper/README.md)**

---

## Overview

This project combines a **real-time Chrome extension** with **machine learning** to predict video completion. The extension tracks viewing behavior, computes engagement signals, and trains an online learning model. A complementary **Jupyter notebook** provides offline analysis, feature engineering, and model evaluation.

**Key Finding:** Only 2 features predict completion: **educational content** (+0.86) and **evening viewing time** (+0.50). Behavioral signals (engagement, seeking, pausing) are surprisingly weak.

---

## Quick Start

### Install the Extension

1. Clone this repository
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select this folder
5. Open a YouTube video

**First run:** Everything runs locally immediately — no server, no account needed. Optional: run `python process_clip.py` offline to add visual features via CLIP (~500 MB download, one-time cache).

### Use It

- Click extension icon while watching YouTube
- See live prediction: "X% chance you finish"
- Extension trains automatically when you skip or complete videos
- Export history anytime via popup button

### Analyze Your Data

```bash
# Export from extension popup → session_history_2026-07-05.json
python auto_merge.py              # Merge into main JSONL
jupyter notebook ml_workbench.ipynb  # Train models, analyze features
```

---

## What Gets Tracked

**Per Video, Every ~1 Second:**
- Video metadata: ID, title, duration, timestamp
- Your behavior: pausing, seeking, tab switches, playback speed
- Computed features:
  - **Engagement:** tab visibility + playback speed + recent interactions
  - **Seek-back rate:** how often you rewind
  - **Tab-hidden rate:** fraction of time in another tab
  - **Pause frequency:** long pauses (>10s)
  - **Title signal:** semantic match to finished vs. abandoned videos
  - **Visual features (CLIP):** frame alignment, visual novelty, drift

**Outcome:** Video completion (≥60% watched = finished)

---

## Results

Trained on **85 video sessions** (June–July 2026):

| Model | AUC | Accuracy | Finding |
|-------|-----|----------|---------|
| Baseline (random) | 0.500 | 63.5% | — |
| Logistic Regression | **0.586** | 50.6% | ✓ Best for interpretability |
| Gradient Boosting | **0.585** | 63.5% | ✓ Competitive |
| XGBoost | **0.586** | 63.5% | ✓ Competitive |
| All 8 features | 0.500 | 36.5% | ✗ Overfitting |
| Neural Network | 0.498 | 63.5% | ✗ Too complex for 85 samples |

**Feature Importance (Top 2):**
1. **Education keyword** in title: +0.862 coefficient (85% completion)
2. **Evening viewing** (6 PM – midnight): +0.495 coefficient (80% completion)
3. Everything else: near-zero coefficient

---

## Project Structure

```
.
├── background.js              # Service worker: computes features, trains model
├── content.js                 # YouTube page script: tracks interactions
├── popup.html / popup.js       # Extension UI: live prediction + export button
├── manifest.json              # Chrome extension config
├── auto_merge.py              # Auto-merges exported JSON into JSONL
├── ml_workbench.ipynb         # Jupyter: feature engineering, training, analysis
├── WORKFLOW.md                # User guide: export → merge → train cycle
├── research_paper/
│   ├── README.md              # Full research paper (~12,000 words)
│   ├── *.html                 # Printable HTML (print to PDF)
│   └── figures/               # High-res plots (6 charts)
└── session_history.jsonl      # Main data store (NOT committed — personal data)
```

---

## Privacy

- ✓ **Nothing leaves your browser.** All data stored locally in extension storage.
- ✓ **No account, no tracking, no analytics** sent anywhere.
- ✓ **Uninstall = delete.** Removing the extension deletes all stored data.
- ✓ **Transparent.** All code is open source. No hidden network calls.

---

## For Researchers & Developers

### Offline Analysis

1. **Export from extension:** Click "Export & Save History" in popup
2. **Merge into JSONL:** `python auto_merge.py` (auto-detects new downloads)
3. **Analyze:** `jupyter notebook ml_workbench.ipynb`

### Available in Notebook

- **Feature engineering:** Behavioral, temporal, keyword-based features
- **Multiple models:** Logistic Regression, Gradient Boosting, XGBoost, Random Forest, Neural Networks
- **Evaluation:** AUC-ROC, F1-score, RMSE, confusion matrices
- **Ablation studies:** Impact of different feature combinations
- **Recommendations:** Which features to prioritize, how much data you need

### Next Steps

- Collect 100+ sessions → stronger signal
- Try different keywords → adjust feature importance
- Export improved weights → deploy back to extension
- Analyze temporal patterns → time-of-day effects
- Multi-user study → generalization beyond single viewer

---

## Research Paper

📄 **[Full Research Paper](research_paper/README.md)** — peer-review ready (June–July 2026)

- Abstract, introduction, methodology, results, discussion, conclusion
- 6 high-resolution figures (class distribution, feature importance, model comparison, etc.)
- Printable HTML (black & white) or PDF
- Written for non-technical audiences

---

## Technical Stack

- **Chrome Extension:** Manifest V3, JavaScript (ES6+)
- **ML:** Python, scikit-learn, pandas, NumPy
- **Vision:** Transformers.js (CLIP embeddings in browser)
- **Data Format:** JSONL (append-only watch history log)
- **Notebook:** Jupyter, cross-validation, stratified sampling

---

## Files NOT Committed (Personal Data)

- `session_history.jsonl` — your watch history
- `session_history_*.json` — exported JSON files
- `.env` — any secrets (if you use them)

See [`.gitignore`](.gitignore) for full list.

---

## License & Attribution

Personal project. Not affiliated with YouTube or Google. Code is provided as-is for educational and research purposes.

---

## Questions?

- **How do I use it?** → See [WORKFLOW.md](WORKFLOW.md)
- **How does it work?** → See [Research Paper](research_paper/README.md)
- **What data do you collect?** → See Privacy section above
- **Can I modify it?** → Yes, all code is open source

---

**Made with curiosity about how we watch videos.**
