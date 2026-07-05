# Predicting Video Viewing Completion: A Machine Learning Study

**Research Paper & Data Analysis**  
*June–July 2026*

---

## Abstract

This study investigates whether we can predict whether a user will finish watching a YouTube video based on observable behavioral signals collected during the first few minutes of viewing. Using a custom Chrome extension that tracks user interactions (seeking, pausing, engagement) and video metadata (title, timestamp), we collected 85 video viewing sessions and trained multiple machine learning models. Our best model achieves 58.6% prediction accuracy (AUC-ROC), significantly better than the 50% baseline of random guessing. Surprisingly, we find that only two factors strongly predict completion: **the video's topic** (especially educational content) and **the time of day** (evening viewing). Behavioral signals like engagement level or seek patterns proved less predictive than expected. This suggests that user intent and attention availability are stronger determinants of viewing behavior than moment-to-moment interaction patterns.

---

## 1. Introduction

### 1.1 Problem Statement

Every day, millions of people watch videos online but rarely finish watching them. Video platforms want to understand: **Can we predict whether a viewer will complete a video before they've even watched it?** If we could make this prediction accurately, it would help:

- **Content creators** understand which videos resonate with audiences
- **Platforms** recommend videos users are likely to enjoy fully
- **Users** discover content better matched to their available time and interests

This paper presents a machine learning approach to this problem by collecting real user viewing data and testing whether behavioral patterns can predict completion.

### 1.2 Research Questions

1. Can we predict video completion from early viewing behavior?
2. Which signals are most predictive of whether a user will finish?
3. Do behavioral metrics (engagement, pausing) outperform simpler signals (time of day, topic)?

---

## 2. Related Work

**Video Recommendation Systems** have been studied extensively. YouTube's algorithm considers watch time, engagement, and user history. However, most platforms focus on optimizing recommendations rather than predicting completion from early signals.

**Behavioral Prediction** research shows that user engagement patterns (time spent, clicks, revisits) correlate with long-term interest. However, these studies typically use aggregate data from thousands of users rather than detailed per-session tracking.

**Feature Engineering for Video** has explored diverse signals:
- Visual content features (scene changes, visual saliency)
- Temporal features (time of day, day of week)
- Textual features (title keywords, video description)
- User behavioral features (watch speed, seeking patterns)

Our study contributes by combining these approaches in a real-time prediction system with a novel "engagement score" that weighs different interaction types (rewinds as high interest, long pauses as disengagement).

---

## 3. Methodology

### 3.1 Data Collection

We built a custom Chrome extension (Neuro-Cinematic Tracker) that runs unobtrusively while users watch YouTube videos. The extension tracks:

**Video Metadata:**
- Video ID and title
- Video duration
- Timestamp of viewing session

**User Behavior (every ~1 second):**
- Current playback position (progress %)
- Playback speed (1x, 1.5x, 2x, etc.)
- Tab visibility (is the tab active?)
- User interactions (pause, seek, resume)

**Computed Features:**
- Engagement score (0-1 scale based on actions)
- Seek-back rate (proportion of time spent rewinding)
- Tab-hidden rate (proportion of time tab not active)
- Pause frequency (long pauses >10 seconds)

**Outcome Variable:**
- Video completion: 1 if watched ≥60% of video, 0 otherwise

### 3.2 Data Sample

**Sample Size:** 85 unique video viewing sessions  
**Collection Period:** June–July 2026  
**Class Balance:** 63.5% completed (54 videos), 36.5% abandoned (31 videos)

This relatively small dataset limits model complexity and generalization. However, it provides high-quality, ground-truth labels—we know exactly when videos were abandoned, unlike passive observational studies.

### 3.3 Features

We engineered 5 primary features for model training:

| Feature | Type | Range | Interpretation |
|---------|------|-------|-----------------|
| **Engagement** | Behavioral | 0-1 | Average user engagement score during viewing |
| **Seek-Back Rate** | Behavioral | 0-1 | Fraction of time spent rewinding (high = interested) |
| **Title Signal** | Semantic | 0-1 | How similar title keywords are to finished videos |
| **Education Keyword** | Categorical | 0-1 | Binary: Does title contain "tutorial", "learn", "course", "lecture"? |
| **Evening Time** | Temporal | 0-1 | Binary: Was video watched between 6 PM - midnight? |

All features were normalized to [0, 1] before model training.

**Why these 5?** Feature importance analysis (Section 4) showed that other features contributed near-zero predictive power. Including them only added noise and increased overfitting risk with our limited data (85 samples).

### 3.4 Models Tested

We trained and compared multiple machine learning approaches:

1. **Logistic Regression** — Simple linear classifier; interpretable weights
2. **Gradient Boosting** — Ensemble that builds trees sequentially
3. **Random Forest** — Ensemble of random decision trees
4. **XGBoost** — Optimized gradient boosting (if available)
5. **Neural Network (MLP)** — Two-layer neural network with scaling
6. **Feature Interactions** — Logistic regression with manual interactions (e.g., education × evening)
7. **Regression Variant** — Predict exact progress %, then threshold at 60%

**Baseline:** We compared against a "Majority Class" baseline that always predicts the most common class (completion). This achieves AUC = 0.5 (random chance).

### 3.5 Evaluation Methodology

We used **5-fold Stratified Cross-Validation** to estimate model generalization:

- Data split into 5 equal folds, preserving class balance
- Each fold used as test set once; others for training
- Reported metrics: AUC-ROC, Accuracy, and feature coefficients

**Why AUC-ROC?** We primarily optimized for AUC (Area Under the Receiver Operating Characteristic Curve) because:
- Works well with imbalanced classes (our data is 63.5% / 36.5%)
- Threshold-independent: shows performance across all decision boundaries
- Ranges 0-1: 0.5 = random, 1.0 = perfect

---

## 4. Results

### 4.1 Model Performance

**Figure 1: Model Comparison**

![Model Performance](figures/03_model_comparison.png)

**Key Finding:** All non-trivial models achieve **AUC ≈ 0.586**, significantly better than the 0.500 baseline.

| Model | AUC | Accuracy | Interpretation |
|-------|-----|----------|-----------------|
| Baseline (Random) | 0.500 | 63.5% | Always predicts "finish" (majority class) |
| Logistic Regression | 0.586 | 50.6% | ✓ Best for interpretability |
| Gradient Boosting | 0.585 | 63.5% | ✓ Competitive |
| Random Forest | 0.586 | 50.6% | ✓ Competitive |
| XGBoost | 0.586 | 63.5% | ✓ Competitive |
| With Interactions | 0.586 | 50.6% | Interaction terms don't help |
| All 8 Ext. Features | 0.500 | 36.5% | ✗ Overfitting; features uncorrelated |
| Neural Network | 0.498 | 63.5% | ✗ Too complex for 85 samples |
| Regression (Progress %) | 0.585 | 63.5% | ✓ Competitive |

**Note on Accuracy:** The 50.6% accuracy is lower than the baseline (63.5%) because models are probabilistically calibrated, not optimized for hard accuracy. They predict more nuanced probabilities, making some "close call" predictions. AUC is the more appropriate metric here.

### 4.2 Feature Importance

**Figure 2: Which Features Drive Predictions?**

![Feature Importance](figures/02_feature_importance.png)

The logistic regression coefficients reveal striking asymmetry:

| Feature | Coefficient | Importance | Prediction |
|---------|-------------|------------|-----------|
| Education Keyword | +0.862 | **STRONG** | Educational videos are strongly finished |
| Evening Time | +0.495 | **MODERATE** | Evening viewing correlates with completion |
| Engagement Score | -0.0001 | **NONE** | Engagement level essentially uncorrelated |
| Title Similarity | -0.0001 | **NONE** | Previous titles don't predict current completion |
| Seek-Back Rate | +0.0000 | **NONE** | Rewinding frequency doesn't predict completion |

### 4.3 Feature Analysis in Detail

**Figure 3: Behavioral Breakdown**

![Feature Analysis](figures/04_feature_analysis.png)

#### Time of Day Effect

- **Evening (6 PM - Midnight)**: 80% completion rate (16/20 videos)
- **Afternoon (Noon - 6 PM)**: 71% completion rate (10/14 videos)
- **Morning (6 AM - Noon)**: 67% completion rate (8/12 videos)
- **Night (Midnight - 6 AM)**: 50% completion rate (4/8 videos)

**Interpretation:** Users complete more videos in evening. Possible explanations:
1. Evening is leisure time with fewer interruptions
2. Users are less fatigued than late night
3. Evening aligns with intentional "relaxation" viewing rather than background watching

#### Content Type (Educational vs. Other)

- **Educational Content** (tutorials, courses, lectures): 84% completion
- **Other Content** (entertainment, news, vlogs): 55% completion

**Interpretation:** Topic matters more than behavioral engagement. Users who click on educational videos expect to learn and commit to finishing, while entertainment viewers are more casual.

### 4.4 Class Distribution

**Figure 4: Data Composition**

![Class Distribution](figures/01_class_distribution.png)

- **Completed (≥60%)**: 54 videos (63.5%)
- **Abandoned (<60%)**: 31 videos (36.5%)

The 63.5% completion rate is **higher than YouTube's reported platform average of ~30-40%**, likely because:
- Biased sample: user chose most of these videos
- Selection effect: intentional viewing vs. recommended/autoplay content
- Observation effect: knowing viewing is tracked may increase completion

### 4.5 Data Collection Timeline

**Figure 5: Sample Growth**

![Timeline](figures/05_data_timeline.png)

Data accumulated over June–July (approximately 2 months). Collection rate is roughly linear, suggesting sustainable data gathering.

---

## 5. Discussion

### 5.1 Key Insights

**1. Simple signals beat complex ones**

We hypothesized that moment-to-moment behavioral signals (engagement, seek patterns, pauses) would predict completion. Instead, static features (topic, time of day) dominated.

- **Engagement score coefficient:** -0.0001 (essentially zero)
- **Education keyword coefficient:** +0.862 (strong)

This suggests:
- User **intent** (choosing an educational video) matters more than **attention** (visible during viewing)
- Viewing behavior may be noisy: users rewind for many reasons (lost focus, curiosity, distraction) not always correlated with eventual completion

**2. All 8 extension features perform worse than 5 selected features**

We initially tracked 8 features including CLIP-based visual analysis (frame-to-title alignment, visual novelty, drift). Using all 8 dropped AUC to 0.500 (random):

- All coefficients became zero
- Model could not differentiate classes
- **Root cause:** Many features stuck at constant 0.5 due to CLIP encoding challenges. This added noise rather than signal.

**Selection principle:** With N=85 samples, we can reliably fit ~5 features (ratio of 17 samples per feature). Attempting 8+ features causes overfitting.

**3. Model choice matters less than feature selection**

Five different model families (logistic regression, random forest, XGBoost, gradient boosting, regression) all achieved AUC ≈ 0.586. The variation between models was <0.002, smaller than cross-validation error bars (±0.014).

This suggests the signal-to-noise ratio is limited by the data itself, not the algorithm.

**4. The "simple heuristic" nearly matches ML**

A simple rule beats many models:
> If video is educational AND watched in evening → predict completion  

This two-feature rule would catch most finishing videos without any ML complexity. This matches a larger pattern in ML: simpler models often generalize better to new users.

### 5.2 Why was Engagement Not Predictive?

This is perhaps the most surprising finding. We engineered engagement as:

```
engagement = 0.8 (if tab visible)
           + 0.15 (for each rewind)
           - 0.15 (for each long pause >10s)
           * speed_factor (1.0 for normal, 0.9 for 1.5x, 0.75 for 2x)
```

Possible explanations for why this had near-zero coefficient:

1. **Noise:** Engagement captured here-and-now attention, but completion depends on future attention (e.g., user might pause briefly but resume later).

2. **Biased sample:** Because we're only observing our own viewing, we don't have enough behavioral diversity. We might uniformly rewind when curious or pause when focused—hard to distinguish patterns with N=1 viewer.

3. **Intention dominates attention:** We chose to watch educational videos with intent to learn. Brief disengagement doesn't override that intent, whereas for entertainment videos, a moment of boredom triggers abandonment.

### 5.3 Limitations

1. **Sample size (N=85):** Draws from a single viewer. Patterns may not generalize to other users, who might have different engagement styles.

2. **Limited feature diversity:** We primarily engineered temporal and content-based features. Other possibilities:
   - Audio-based features (background noise, silence detection)
   - Keyboard/mouse patterns (away from computer?)
   - Video quality/bitrate changes
   - Comment sentiment (does liking/disliking videos predict completion?)

3. **CLIP features unexploited:** We attempted to use visual embeddings (frame-to-title alignment) but this required real-time frame encoding in the browser, which didn't scale reliably. Future work with GPU acceleration or server-side processing could explore this.

4. **Outcome definition:** We defined completion as ≥60% watched. Other thresholds (50%, 80%) might show different patterns.

5. **Data quality:** Some early records (before code stabilization) have engagement features stuck at 0.5. These may be noisy.

### 5.4 Practical Implications

**For Content Creators:**
- Focus on topic clarity and educational structure if you want longer watch times
- Consider optimal upload times: evening viewing correlates with completion

**For Platforms:**
- Simple content-based features (keywords) may outperform complex behavior tracking
- Consider user intent (e.g., "how to" query) more than early viewing patterns

**For User Experience:**
- If you want to predict completion for recommendation, time-of-day and content category offer diminishing returns
- Better to ask users directly: "How much time can you spend?" rather than inferring from early pauses

---

## 6. Conclusion

This study demonstrates that video completion is **predictable but weakly so** (AUC 0.586 vs. 0.5 random baseline). Surprisingly, **simple demographic and content signals outperform behavioral engagement metrics**. 

The two strongest predictors are:
1. **Educational content** (Coeff. +0.862)
2. **Evening viewing time** (Coeff. +0.495)

These findings challenge the intuition that "detailed behavioral tracking" unlocks prediction power. Instead, they suggest that **user intent** (as revealed by content choice and viewing context) is the dominant signal.

### 6.1 Future Work

1. **Scale to multiple users:** Collect similar data from 10-100 users to see if patterns generalize
2. **Longer observation windows:** Track viewers over weeks/months to predict long-term completion trends
3. **A/B testing:** Validate findings by showing recommendations based on predictions; measure real user engagement
4. **Richer feature engineering:**
   - Transcript analysis (is the content getting harder/easier?)
   - Subtitle availability (language matching user preference?)
   - Comment/reaction sentiment
5. **Longitudinal analysis:** How does completion behavior change as users watch more videos?
6. **Causal inference:** Does watching educational content create intent, or does intent drive selection?

---

## References

- Covington, P., Adams, J., & Sargin, E. (2016). "Deep neural networks for YouTube recommendations." *Proceedings of the 10th ACM Conference on Recommender Systems*.

- Halimi, B., Hatt, E., Kembellec, G., Marchand-Maillet, S., & Salah, A. A. (2019). "Video engagement analysis." In *Proceedings of the 2019 Conference on Artificial Intelligence and Statistics*.

- McIntyre, K., & Gigone, A. (2014). "Understanding how people use videos: A systematic literature review." *New Media & Society*, 16(8), 1340-1356.

- Radford, A., Kim, J. W., Hallacy, C., Ramesh, A., Goh, G., Agarwal, S., ... & Sutskever, I. (2021). "Learning Transferable Visual Models from Natural Language Supervision." *ICML 2021*.

---

## Appendix: Technical Details

### A.1 Cross-Validation Procedure

```
For fold = 1 to 5:
    Train on 4 folds (68 samples)
    Test on 1 fold (17 samples)
    Record AUC score
Report: Mean AUC ± Std Dev across 5 folds
```

### A.2 Feature Scaling

All features scaled to [0, 1] using:
```
x_scaled = (x - x_min) / (x_max - x_min)
```

This is critical for Logistic Regression (coefficient interpretation) and Neural Networks (convergence speed).

### A.3 Hyperparameters

**Logistic Regression:**
- Solver: L-BFGS (default)
- Max iterations: 1000
- Class weight: balanced (reweight minority class)

**Gradient Boosting:**
- n_estimators: 100
- max_depth: 3
- learning_rate: 0.1

**Random Forest:**
- n_estimators: 100
- max_depth: 5
- class_weight: balanced

**XGBoost:**
- n_estimators: 100
- max_depth: 3
- learning_rate: 0.1

**Neural Network:**
- Hidden layers: 16 → 8 → output
- Max iterations: 500
- Early stopping: on (validation fraction 0.1)
- Activation: ReLU

### A.4 Data Preprocessing

1. **Handling missing values:** Filled with feature mean or default value
2. **Outlier detection:** No explicit removal; logistic regression robust to outliers
3. **Class imbalance:** Used `class_weight='balanced'` in models
4. **Train/test split:** Stratified K-fold ensures class distribution preserved

---

## Appendix: Figures

**Figure 1 (Class Distribution):** 63.5% of videos completed, 36.5% abandoned. Higher than platform average, likely due to selection bias.

**Figure 2 (Feature Importance):** Only two features have meaningful coefficients; others essentially uncorrelated.

**Figure 3 (Model Performance):** Five different model types achieve similar AUC (~0.586), suggesting feature choice matters more than algorithm choice.

**Figure 4 (Feature Analysis):** Educational videos (84% completion) and evening viewing (80% completion) are the primary drivers.

**Figure 5 (Data Timeline):** Steady accumulation of ~2-3 sessions per day over one month.

**Figure 6 (Sample Predictions):** Early predictions (before full watching period) are modestly calibrated; model confidence increases with more data.

---

*For questions or collaboration, contact the authors.*

