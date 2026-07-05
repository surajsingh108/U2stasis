# Technical Reference — Neuro-Cinematic Tracker v3

Complete architecture documentation.

---

## Version history

| Version | Architecture | Notes |
|---|---|---|
| v1 | Gemini API per frame | Slow, flaky |
| v2 | Flask server + Transformers CLIP | Required server |
| v3 (current) | Browser extension + deferred CLIP processing | No server, full local control |

---

## System architecture

### **Extension (real-time, in-browser)**

```
content.js  (YouTube page context)
├─ Polls video every 6s while playing
├─ Captures 224×224 JPEG frame (one per video, at end)
├─ Tracks: seeked, pause, play, ratechange, tab visibility
├─ Event buffer: drained each tick and sent to background
├─ Detects: SPA nav (video_id change), live streams, DRM videos
└─ On video end: sends frame_data + final progress to background

background.js  (service worker)
├─ Receives: telemetry ticks (6s interval) + video_ended messages
├─ Computes: engagement, seek_back_rate, tab_hidden_rate, long_pause_rate
├─ Computes: title_signal (keyword match to past videos)
├─ Feature vector: [title_signal, engagement, seek_back, tab_hidden, long_pause]
├─ Prediction: P(finish) = sigmoid(w · features + b)
├─ Training: SGD update after each video ends (if watched ≥60%)
├─ Storage: weights + last 200 sessions in chrome.storage.local
└─ No visual features (CLIP) — stored for offline processing

popup.html / popup.js
├─ Polls background every 6s for status
├─ Shows: live retention prediction %, engagement, timeline of events
├─ Button: Export & Save History → downloads session_history_YYYY-MM-DD.json
└─ Displays: trained sessions count, current weights
```

### **Notebook (offline analysis)**

```
ml_workbench.ipynb  (Jupyter)
├─ 1. Load session_history.jsonl (exported from extension)
├─ 2. Feature engineering: behavioral + title + temporal features
├─ 3. Train multiple models: LogisticRegression, GradientBoosting, XGBoost, etc.
├─ 4. Evaluate: AUC, F1, confusion matrix, feature importance
└─ 5. Compare: models with/without visual features

process_clip.py  (standalone CLIP processor)
├─ 1. Load session_history.jsonl
├─ 2. For each frame: decode base64 data URL
├─ 3. Run CLIP (openai/clip-vit-base-patch32, ~500MB download, cached)
├─ 4. Compute: alignment, novelty, drift from embeddings
└─ 5. Output: session_history_with_clip.jsonl (with visual features)

auto_merge.py  (utility)
└─ Auto-detects exported JSON files, merges into main JSONL
```

---

## Feature Engineering

### **Behavioral Features (computed in extension)**

Per-tick engagement score (0–1):
```
base: tab_hidden → 0.2, else → 0.8
rate: ≤1.0 → ×1.0, ≤1.5 → ×0.9, >1.5 → ×0.75
events: 
  seek_backward → +0.15 (interest)
  seek_forward  → -0.10 (skipping)
  pause >10s    → -0.15 (bored)
  tab_hide      → -0.20 (distracted)
  tab_show      → +0.10 (returned)

EMA (0.85 decay): behavior_twin = 0.85 * prev + 0.15 * current
```

Cumulative rates:
```
seek_back_rate  = count(rewind) / total_ticks
tab_hidden_rate = count(tab_hidden_ticks) / total_ticks
long_pause_rate = count(pause >10s) / total_ticks
```

### **Title-Based Signal (extension)**

```
Tokenize past finished vs abandoned video titles
For current title: what % of finished titles share keywords?
Signal = (finished_match% - abandoned_match%) / 2 + 0.5
Range: [0, 1], neutral = 0.5
```

### **Visual Features (notebook, optional)**

Only computed offline if you run process_clip.py:

```
frame_emb = CLIP_image_encoder(frame)  # 512-d vector

alignment = cosine_similarity(frame_emb, title_emb)
           Rescaled to [0, 1]: (sim + 1) / 2
           How well does the frame match the title/content?

novelty   = 1 - cosine_similarity(frame_emb, prev_frame_emb)
           How different is this frame from the last one?

drift     = 1 - cosine_similarity(frame_emb, session_avg)
           How much are we drifting from the video's visual theme?
```

### **Final Feature Vector (5 or 8 dimensional)**

**Without visual features (extension default):**
```
x = [title_signal, engagement, seek_back_rate, tab_hidden_rate, long_pause_rate]
```

**With visual features (notebook, if CLIP improves AUC):**
```
x = [title_signal, engagement, seek_back_rate, tab_hidden_rate, long_pause_rate,
     alignment, novelty, drift]
```

---

## Model

Online logistic regression:

```
P(watch_past_60%) = sigmoid(w · x + b)

Update after each video:
  prediction = sigmoid(w · x + b)
  error = prediction - label  (label ∈ {0, 1})
  w := w - lr * error * x
  b := b - lr * error
  lr = 0.1 (learning rate)
```

**Warm-up weights** (initial state, before training):
```
[w0=0, w1=0, w2=0, w3=0, w4=0, w5=0] + bias=0
```

Weights stored in `chrome.storage.local.lrWeights`.

---

## Data Storage

### **In Extension (chrome.storage.local)**

| Key | Type | Description |
|---|---|---|
| `lrWeights` | `number[6]` | Model weights [title_signal, engagement, seek_back, tab_hidden, long_pause, bias] |
| `sessionHistory` | `object[]` | Last 200 completed videos (local buffer) |
| `activeSession` | `object` | Current video (for popup display if service worker restarts) |

### **In JSONL File (session_history.jsonl)**

Append-only log on disk (exported from extension):

```json
{
  "timestamp": "2026-07-05T21:29:25.572Z",
  "video_id": "abc123xyz",
  "title": "Example video title",
  "final_progress_percent": 87.3,
  "user_stayed": 1,
  "title_signal": 0.62,
  "engagement": 0.74,
  "seek_back_rate": 0.08,
  "tab_hidden_rate": 0.02,
  "long_pause_rate": 0.00,
  "alignment": 0.5,
  "novelty": 0.5,
  "drift": 0.5,
  "predicted_retention_before_update": 63.4,
  "weights_after": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  "frame": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

**Note:** `alignment`, `novelty`, `drift` are 0.5 (neutral) in exported data. They're computed offline via `process_clip.py` if you want to test visual features.

---

## Workflow: Export → Merge → Process → Train

```
1. Watch videos in extension (frames auto-captured)
   ↓
2. Click "Export & Save History" → downloads session_history_YYYY-MM-DD.json
   ↓
3. python auto_merge.py → merges into session_history.jsonl
   ↓
4. (Optional) python process_clip.py → adds alignment, novelty, drift
   ↓
5. jupyter notebook ml_workbench.ipynb → train & evaluate models
   ↓
6. If visual features improve AUC → export weights back to extension
```

---

## Edge Cases

| Scenario | Handling |
|---|---|
| DRM video | Canvas throws SecurityError; frame capture disabled for session |
| Live stream | Duration is infinite; session skipped |
| SPA navigation | New `video_id` detected in interval; old session ended, new one started |
| Tab closed | `beforeunload` event → session ended, frame captured |
| Long idle (2+ min) | Idle timeout fires → session ended |
| Service worker killed | Checkpointed display state restored from `chrome.storage.local.activeSession` |
| Extension reloaded | In-memory sessions lost; weights and history preserved in storage |
| Multiple tabs | Each tab tracked independently by video_id |

---

## Why Deferred CLIP Processing?

Originally attempted to run CLIP in the browser (Transformers.js in service worker):
- ✗ Service workers can't use WebWorkers (Atomics.wait threading error)
- ✗ YouTube's CSP blocks external CDN downloads
- ✗ Model loading would delay telemetry collection

Current approach (deferred processing):
- ✓ No CSP conflicts (runs locally in Jupyter)
- ✓ No threading issues (pure Python)
- ✓ No browser overhead (telemetry stays responsive)
- ✓ Easy to experiment (swap models, batch sizes, etc.)
- ✗ Requires offline processing step (worth it for clarity + control)

---

## Future Enhancements

- **Lightweight visual features:** Instead of CLIP, compute frame brightness/motion/color to test visual signals without 500MB download
- **Cache visual features:** Once computed, store alongside weights in extension → instant predictions on repeat videos
- **Service worker checkpointing:** Periodically save in-memory sessions to storage → survive worker restarts
- **Weight export/import:** UI button in popup to deploy new weights from notebook without manual copy-paste
- **Multi-user support:** Track per-user patterns if shared device
