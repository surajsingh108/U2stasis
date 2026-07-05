#!/usr/bin/env python3
"""
Generate figures for research paper from session_history.jsonl
"""

import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pathlib import Path
from datetime import datetime

# Load data
history_file = Path('../session_history.jsonl')
records = []
with open(history_file) as f:
    for line in f:
        line = line.strip()
        if line:
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue

df = pd.DataFrame(records)
PROGRESS_THRESHOLD = 60
y = (df['final_progress_percent'] >= PROGRESS_THRESHOLD).astype(int)

print(f'Loaded {len(df)} sessions')

# ============================================================
# Figure 1: Class Distribution
# ============================================================
fig, ax = plt.subplots(figsize=(8, 5))
labels = ['Finished\n(≥60%)', 'Abandoned\n(<60%)']
sizes = [y.sum(), (1-y).sum()]
colors = ['#1e8e3e', '#c5221f']
explode = (0.05, 0.05)

wedges, texts, autotexts = ax.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%',
                                     startangle=90, explode=explode, textprops={'fontsize': 12})
for autotext in autotexts:
    autotext.set_color('white')
    autotext.set_fontweight('bold')
    autotext.set_fontsize(14)

ax.set_title('Video Completion Distribution\n(85 sessions)', fontsize=14, fontweight='bold', pad=20)
plt.tight_layout()
plt.savefig('figures/01_class_distribution.png', dpi=300, bbox_inches='tight')
print('[OK] Saved: 01_class_distribution.png')
plt.close()

# ============================================================
# Figure 2: Feature Importance (Logistic Regression Coefficients)
# ============================================================
features = ['Education\nKeyword', 'Evening\nTime', 'Engagement', 'Title\nSimilarity', 'Seek\nBack Rate']
coefficients = [0.8619, 0.4955, -0.0001, -0.0001, 0.0000]
colors_feat = ['#1e8e3e' if c > 0.2 else '#f9ab00' if c > 0 else '#999' for c in coefficients]

fig, ax = plt.subplots(figsize=(10, 6))
bars = ax.barh(features, coefficients, color=colors_feat)
ax.axvline(x=0, color='black', linestyle='-', linewidth=0.8)
ax.set_xlabel('Coefficient Value (Feature Importance)', fontsize=12, fontweight='bold')
ax.set_title('Which Features Predict Video Completion?\n(Logistic Regression Weights)',
             fontsize=13, fontweight='bold', pad=15)
ax.grid(axis='x', alpha=0.3)

# Add value labels
for i, (bar, val) in enumerate(zip(bars, coefficients)):
    ax.text(val + 0.03, i, f'{val:+.4f}', va='center', fontsize=11, fontweight='bold')

plt.tight_layout()
plt.savefig('figures/02_feature_importance.png', dpi=300, bbox_inches='tight')
print('[OK] Saved: 02_feature_importance.png')
plt.close()

# ============================================================
# Figure 3: Model Performance Comparison
# ============================================================
models = ['Baseline\n(Random)', 'Logistic\nRegression', 'Gradient\nBoosting', 'Random\nForest', 'XGBoost']
auc_scores = [0.500, 0.586, 0.585, 0.586, 0.586]
colors_models = ['#999', '#1a73e8', '#4285f4', '#5f9ea0', '#34a853']

fig, ax = plt.subplots(figsize=(10, 6))
bars = ax.bar(models, auc_scores, color=colors_models, edgecolor='black', linewidth=1.5)

# Add a "chance" line at 0.5
ax.axhline(y=0.5, color='red', linestyle='--', linewidth=2, label='Random Guess (AUC=0.5)', alpha=0.7)
ax.set_ylabel('AUC Score (0=worst, 1=best)', fontsize=12, fontweight='bold')
ax.set_ylim([0.45, 0.65])
ax.set_title('Model Performance: Can We Predict Video Completion?\n(5-Fold Cross-Validation)',
             fontsize=13, fontweight='bold', pad=15)
ax.legend(fontsize=11, loc='upper right')
ax.grid(axis='y', alpha=0.3)

# Add value labels on bars
for bar, score in zip(bars, auc_scores):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 0.005,
            f'{score:.3f}', ha='center', va='bottom', fontsize=11, fontweight='bold')

plt.tight_layout()
plt.savefig('figures/03_model_comparison.png', dpi=300, bbox_inches='tight')
print('[OK] Saved: 03_model_comparison.png')
plt.close()

# ============================================================
# Figure 4: Feature Behavior Analysis
# ============================================================
def extract_hour(timestamp_str):
    try:
        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        return dt.hour
    except:
        return 12

hours = [extract_hour(ts) for ts in df['timestamp']]
df_temp = pd.DataFrame({'hour': hours, 'stayed': y})

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Left: Time of day analysis
hour_bins = ['Morning\n(6-12)', 'Afternoon\n(12-18)', 'Evening\n(18-24)', 'Night\n(0-6)']
hour_ranges = [(6, 12), (12, 18), (18, 24), (0, 6)]
stay_rates = []
counts = []

for start, end in hour_ranges:
    if start < end:
        mask = (df_temp['hour'] >= start) & (df_temp['hour'] < end)
    else:
        mask = (df_temp['hour'] >= start) | (df_temp['hour'] < end)

    if mask.sum() > 0:
        stay_rates.append(df_temp[mask]['stayed'].mean() * 100)
        counts.append(mask.sum())
    else:
        stay_rates.append(0)
        counts.append(0)

bars1 = ax1.bar(hour_bins, stay_rates, color=['#f9ab00', '#f9ab00', '#1e8e3e', '#999'],
                edgecolor='black', linewidth=1.5)
ax1.set_ylabel('% of Videos Completed', fontsize=11, fontweight='bold')
ax1.set_title('Time of Day Effect\n(When do you finish videos?)', fontsize=12, fontweight='bold')
ax1.set_ylim([0, 100])
ax1.grid(axis='y', alpha=0.3)

for bar, rate, count in zip(bars1, stay_rates, counts):
    height = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2., height + 2,
            f'{rate:.0f}%\n(n={count})', ha='center', va='bottom', fontsize=10, fontweight='bold')

# Right: Education keyword analysis
education_keywords = ['tutorial', 'learn', 'course', 'lecture']
title_lower = df['title'].str.lower()
has_education = title_lower.str.contains('|'.join(education_keywords), na=False)

edu_data = []
for has_edu in [True, False]:
    if has_edu:
        mask = has_education
        label = 'Education\nVideo'
    else:
        mask = ~has_education
        label = 'Other\nVideo'

    if mask.sum() > 0:
        stay_rate = df[mask]['user_stayed'].mean() * 100
        edu_data.append((label, stay_rate, mask.sum()))

labels_edu = [x[0] for x in edu_data]
rates_edu = [x[1] for x in edu_data]
counts_edu = [x[2] for x in edu_data]

bars2 = ax2.bar(labels_edu, rates_edu, color=['#1e8e3e', '#f9ab00'],
                edgecolor='black', linewidth=1.5)
ax2.set_ylabel('% of Videos Completed', fontsize=11, fontweight='bold')
ax2.set_title('Content Type Effect\n(Does topic matter?)', fontsize=12, fontweight='bold')
ax2.set_ylim([0, 100])
ax2.grid(axis='y', alpha=0.3)

for bar, rate, count in zip(bars2, rates_edu, counts_edu):
    height = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2., height + 2,
            f'{rate:.0f}%\n(n={count})', ha='center', va='bottom', fontsize=10, fontweight='bold')

plt.tight_layout()
plt.savefig('figures/04_feature_analysis.png', dpi=300, bbox_inches='tight')
print('[OK] Saved: 04_feature_analysis.png')
plt.close()

# ============================================================
# Figure 5: Data Timeline
# ============================================================
df['date'] = pd.to_datetime(df['timestamp']).dt.date
date_counts = df.groupby('date').size()
date_cumulative = date_counts.cumsum()

fig, ax = plt.subplots(figsize=(12, 5))
ax.plot(date_cumulative.index, date_cumulative.values, marker='o', linewidth=2.5,
        markersize=8, color='#1a73e8')
ax.fill_between(range(len(date_cumulative)), date_cumulative.values, alpha=0.3, color='#1a73e8')

ax.set_xlabel('Date', fontsize=11, fontweight='bold')
ax.set_ylabel('Cumulative Sessions', fontsize=11, fontweight='bold')
ax.set_title('Data Collection Timeline\n(How much data do we have?)', fontsize=13, fontweight='bold', pad=15)
ax.grid(alpha=0.3)

# Rotate x-axis labels
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.savefig('figures/05_data_timeline.png', dpi=300, bbox_inches='tight')
print('[OK] Saved: 05_data_timeline.png')
plt.close()

# ============================================================
# Figure 6: Sample Predictions
# ============================================================
fig, ax = plt.subplots(figsize=(10, 6))

# Get predictions from the notebook
sample_preds = df['predicted_retention_before_update'].values[:20] / 100
sample_actual = df['user_stayed'].values[:20]
sample_titles = [t[:30] + '...' if len(t) > 30 else t for t in df['title'].values[:20]]

x = np.arange(len(sample_titles))
width = 0.35

bars1 = ax.bar(x - width/2, sample_preds, width, label='Model Predicted', color='#4285f4', alpha=0.8)
bars2 = ax.bar(x + width/2, sample_actual, width, label='Actually Finished', color='#34a853', alpha=0.8)

ax.set_ylabel('Probability of Finishing', fontsize=11, fontweight='bold')
ax.set_title('Sample Predictions vs Reality\n(First 20 videos)', fontsize=13, fontweight='bold', pad=15)
ax.set_xticks(x)
ax.set_xticklabels(sample_titles, rotation=45, ha='right', fontsize=8)
ax.legend(fontsize=11)
ax.set_ylim([0, 1.1])
ax.grid(axis='y', alpha=0.3)

plt.tight_layout()
plt.savefig('figures/06_sample_predictions.png', dpi=300, bbox_inches='tight')
print('[OK] Saved: 06_sample_predictions.png')
plt.close()

print('\n[OK] All figures generated successfully!')
