# Research Paper - File Index

## Overview

This folder contains a comprehensive research paper analyzing the Neuro-Cinematic Tracker project findings.

### What's Here

**`README.md`** — **START HERE**
- Full research paper (12,000+ words)
- Written for public/academic audiences
- Non-technical language with clear explanations
- Includes methodology, results, discussion, limitations, future work
- ~30 minute read

**`figures/`** — All visualizations
- `01_class_distribution.png` — How many videos were completed vs. abandoned
- `02_feature_importance.png` — Which factors predict completion (bar chart)
- `03_model_comparison.png` — Performance of different ML models
- `04_feature_analysis.png` — Time-of-day and content-type effects
- `05_data_timeline.png` — When data was collected (cumulative over time)
- `06_sample_predictions.png` — Example predictions vs. actual outcomes

**`generate_figures.py`** — Code to regenerate all plots
- Reads from `../session_history.jsonl`
- Produces all PNG figures
- Can be re-run if data is updated

---

## Key Findings (TL;DR)

### Can We Predict Video Completion?
**Yes, but weakly.** Model achieves 58.6% accuracy (baseline is 50%).

### What Predicts Completion?

1. **Educational Content** (+0.86 coefficient) — Strongest predictor
2. **Evening Viewing** (+0.50 coefficient) — Moderate predictor
3. **Engagement Signals** (Near zero coefficient) — Surprising: NOT predictive

### Main Insight
Simple signals (topic + time) beat complex behavioral tracking. **User intent** matters more than **moment-to-moment engagement**.

---

## Who Should Read This?

✓ **Researchers** interested in video recommendation, user behavior, ML applications  
✓ **Content creators** wanting to understand viewer retention  
✓ **Product managers** at video platforms  
✓ **Students** learning about ML methodology and limitations  
✓ **The general public** interested in how AI predicts human behavior  

**No ML background required.** Technical concepts are explained in plain language.

---

## Paper Sections

1. **Abstract** — 1-page summary
2. **Introduction** — Why this problem matters
3. **Related Work** — What others have researched
4. **Methodology** — How we collected data & trained models
5. **Results** — What we found (with charts)
6. **Discussion** — What results mean
7. **Conclusion** — Summary & future directions
8. **Appendix** — Technical details for specialists
9. **References** — Citations

---

## Replicating Results

To regenerate figures from updated data:

```bash
cd research_paper
python generate_figures.py
```

The script expects `session_history.jsonl` to be in the parent directory.

---

## Citation

If you use this research:

```
Neuro-Cinematic Tracker: Predicting Video Viewing Completion
Author: Suraj Singh
Date: July 2026
Source: https://github.com/surajsingh108/U2stasis
```

---

## Questions?

- **Technical questions:** Check the README.md Appendix
- **Methodology questions:** See Section 3 (Methodology)
- **Results interpretation:** See Section 4 (Results) and Section 5 (Discussion)

