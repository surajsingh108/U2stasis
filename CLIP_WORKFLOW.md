# Deferred CLIP Processing Workflow

This project now uses **deferred CLIP processing**: the Chrome extension captures frames while you watch, and you process them with CLIP later in the notebook. This avoids browser CSP/threading issues entirely.

## Workflow

### 1. Watch Videos (Extension runs normally)
- Install extension from `chrome://extensions` → Load unpacked
- Watch YouTube videos normally
- Extension tracks: behavior (pauses, seeks), title, **and captures one frame per video when it ends**
- Frames stored as base64 data URLs in local storage

### 2. Export from Extension
1. Click extension icon on YouTube
2. Click **Export & Save History**
3. A JSON file (`session_history_2026-07-DD.json`) is downloaded

### 3. Auto-merge into JSONL
```bash
python auto_merge.py
```
This auto-detects new downloads and merges them into `session_history.jsonl`.

Frames are included in the JSONL as base64 data URLs (they make the file large ~50-100KB per video, but manageable).

### 4. Process CLIP in Notebook

Option A: **Standalone script** (recommended)
```bash
python process_clip.py
```
- Loads session_history.jsonl
- Runs CLIP on each frame
- Saves session_history_with_clip.jsonl

Option B: **In Jupyter notebook**
```python
from process_clip import add_clip_features
import pandas as pd

df = pd.read_json('session_history.jsonl', lines=True)
df = add_clip_features(df)
# Now df has alignment, novelty, drift columns
```

### 5. Train Model with Visual Features

In the notebook, use the expanded feature set:

```python
# After running add_clip_features(df), you now have:
# - alignment: frame-to-title match (currently 0.5, can enhance)
# - novelty: frame-to-frame change (visual diversity)
# - drift: distance from session baseline (visual consistency)

SELECTED_FEATURES = [
    'title_signal',       # behavioral: title keyword match
    'engagement',         # behavioral: from seeking/pausing
    'seek_back_rate',     # behavioral: interest (rewinding)
    'kw_education',       # semantic: education keyword
    'hour_evening',       # temporal: evening viewing
    'alignment',          # visual: frame-to-title match ← NEW
    'novelty',            # visual: visual change ← NEW
    'drift',              # visual: consistency ← NEW
]

# Train logistic regression or any classifier
from sklearn.linear_model import LogisticRegression
lr = LogisticRegression(max_iter=1000, class_weight='balanced')
lr.fit(X, y)

# Compare AUC with vs without visual features
```

## Files in This Workflow

```
├── content.js                  # Captures 1 frame per video (sent at video end)
├── background.js               # Receives frames, stores in history
├── popup.html / popup.js        # Export button
├── auto_merge.py                # Merges downloaded JSON → JSONL
├── process_clip.py              # ← NEW: Runs CLIP offline, adds visual features
├── ml_workbench.ipynb           # ← Import and use add_clip_features() here
│
├── session_history.jsonl        # Main data store (includes frame base64)
├── session_history_with_clip.jsonl  # ← Output after CLIP processing
└── CLIP_WORKFLOW.md (this file)
```

## Why Deferred CLIP?

### Problems with Browser CLIP (solved by deferring):
1. ✗ CSP blocking HuggingFace downloads (YouTube's strict CSP)
2. ✗ Service worker threading issues (Atomics.wait)
3. ✗ Large model download delays (100MB → blocks video telemetry)
4. ✗ Memory pressure (encoding every 6 seconds)

### Benefits of Deferred CLIP:
1. ✓ No CSP issues (notebook runs in your environment)
2. ✓ No threading issues (Python handles parallelization)
3. ✓ No delays (frames captured asynchronously, processing happens later)
4. ✓ Full control (can experiment with different models, batching, etc.)
5. ✓ Simplicity (extension code is 100 lines lighter)

## Example: First Run

```bash
# 1. Export from extension (UI button)
#    → Downloads session_history_2026-07-05.json

# 2. Auto-merge
python auto_merge.py
# Output: Merged 23 new records into session_history.jsonl

# 3. Process CLIP
python process_clip.py
# Output: Loaded 98 records
#         Processing frames...
#         [10/98] 0.512, 0.486, 0.501
#         [20/98] 0.498, 0.514, 0.493
#         ...
#         ✓ Processed 82 frames (16 had no frame data)
#         alignment: 0.508 ± 0.081
#         novelty:   0.492 ± 0.092
#         drift:     0.505 ± 0.078
#         Saved to session_history_with_clip.jsonl

# 4. Train in notebook
jupyter notebook ml_workbench.ipynb
# Load session_history_with_clip.jsonl
# Train with 8 features (5 behavioral + 3 visual)
# Check: does AUC improve vs 5-feature baseline?
```

## Next Steps

1. **Watch 10-20 more videos** to get richer data
2. **Run process_clip.py** once a week to update embeddings
3. **In notebook:** Compare models with/without visual features
   - If AUC improves: visual signals matter → can invest in refinement
   - If AUC same: visual signals don't help → focus on other features

## Customization

### Add Title Embeddings (Enhancement)
Currently `alignment` is hardcoded to 0.5. To compute real alignment:

```python
# In process_clip.py, add this:
# 1. Encode title with CLIP when you first load it
# 2. Compute alignment as cosine_sim(frame_emb, title_emb)
# 3. Scale to [0, 1]

# This requires caching title embeddings somewhere (could be in JSONL)
```

### Use Different Models
Swap `Xenova/clip-vit-base-patch32` for other models:
- `Xenova/clip-vit-large-patch14` (larger, slower)
- `Xenova/clip-vit-base-patch16` (variant)
- Or use OpenAI's CLIP directly

Just change the model name in `process_clip.py` line 73.

### Batch Processing
For large datasets (100+ videos), add batching:
```python
# Process 10 frames at once instead of 1
clips_batch = clip_pipeline([img1, img2, ..., img10])
```

---

**Questions?** Check the notebook (`ml_workbench.ipynb`) for training and evaluation code.
