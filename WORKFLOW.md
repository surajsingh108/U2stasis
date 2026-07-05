# Neuro-Cinematic Tracker — Workflow Guide

## Overview
Watch YouTube videos → Extension collects data → Export & merge → Train model → Analyze results

## Step-by-Step

### 1. Watch Videos (Chrome Extension)
- Install extension (load unpacked folder from `chrome://extensions`)
- Play YouTube videos normally
- Extension tracks: progress, engagement, seeks, pauses, tab visibility
- Computes 8 features per video in background

### 2. Export History (Monthly or When Ready)
**In popup:**
- Click **"Export & Save History"** button
- Browser downloads: `session_history_YYYY-MM-DD.json`
- Shows success: "✓ Exported N sessions"

### 3. Auto-Merge into JSONL
**In this directory:**
```bash
python auto_merge.py --watch
```
Or one-time merge:
```bash
python auto_merge.py
```

**What happens:**
- Detects downloaded `session_history_*.json` files
- Merges into `session_history.jsonl` (one record per line)
- Deduplicates by (video_id, timestamp)
- Normalizes all fields
- Moves source file to `_merged` archive

### 4. Train Model (Jupyter Notebook)
**Option A: Interactive Jupyter**
```bash
jupyter notebook ml_workbench.ipynb
```
Then click "Run All Cells"

**Option B: Command-line (headless)**
```bash
jupyter nbconvert --to notebook --execute ml_workbench.ipynb
```

**Notebook does:**
- Reads `session_history.jsonl`
- Extracts 5 key features (engagement, seek_back_rate, title_signal, kw_education, hour_evening)
- Trains LogisticRegression + Gradient Boosting
- Reports: AUC, accuracy, feature coefficients
- Shows which features matter most

### 5. Analyze Results
In notebook output cells, see:
- **CV AUC**: Cross-validation score (0.5 = random, 1.0 = perfect)
- **Coefficients**: Positive = predicts "finished", Negative = predicts "abandoned"
- **Calibration plot**: How well predictions match reality

### 6. Iterate (Optional)
If AUC is low:
- Collect more watch data (100+ records is better)
- Swap features in notebook (edit `SELECTED_FEATURES` list)
- Try different keywords or time windows
- All 8 extension fields are preserved in JSONL for experimentation

## Data Fields in JSONL

Each record has:
```json
{
  "timestamp": "2026-07-05T04:38:54.242Z",
  "video_id": "xk48z8N-sl0",
  "title": "Brian Greene and Leonard Susskind: ...",
  "final_progress_percent": 99.9,
  "user_stayed": 1,
  
  "engagement": 0.5,
  "seek_back_rate": 0.0,
  "tab_hidden_rate": 0.0,
  "long_pause_rate": 0.0,
  "alignment": 0.5,
  "novelty": 0.5,
  "drift": 0.5,
  "title_signal": 0.5,
  
  "predicted_retention_before_update": 72.8,
  "weights_after": [0.245, 0.245, ...]
}
```

## Files

| File | Purpose |
|------|---------|
| `background.js` | Service worker: computes 8 features, trains model online |
| `content.js` | Content script: tracks user interactions, sends telemetry |
| `popup.html/js` | UI: shows live prediction, export button |
| `session_history.jsonl` | Main data store (append-only) |
| `auto_merge.py` | Auto-detects & merges downloaded JSON files |
| `ml_workbench.ipynb` | Batch analysis & model training |
| `WORKFLOW.md` | This file |

## Troubleshooting

**No data in JSONL?**
- Make sure to click "Export & Save History" in popup
- Check Downloads folder for `session_history_*.json` files
- Run `python auto_merge.py` in this directory

**Notebook won't train?**
- Check that `session_history.jsonl` exists and has records
- Run cell-1 to verify data loads: `85 sessions loaded`
- Run cell-2 to check features are computed

**AUC is 0.5 (random)?**
- Need more data (target 100+ records)
- Or features aren't predictive for your watch patterns
- Try swapping features in `SELECTED_FEATURES` list

**Extension shows 0% prediction?**
- Weights haven't been trained yet
- Default is 0.0 for all weights (warmup state)
- After enough videos, will improve
