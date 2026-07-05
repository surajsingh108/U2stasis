"""
CLIP-based visual feature extraction for Neuro-Cinematic Tracker.

This script processes frame data from session history and computes:
- alignment: frame-to-title similarity (uses title as reference)
- novelty: frame-to-frame change (how different is this frame from the last one)
- drift: distance from session baseline (how much are we drifting?)

Usage:
    from process_clip import add_clip_features
    df = add_clip_features(df)  # df must have 'frame' column with base64 data URLs
"""

import numpy as np
import pandas as pd
import base64
import io
from pathlib import Path


def cos_sim(a, b):
    """Cosine similarity between two vectors."""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a) + 1e-8
    norm_b = np.linalg.norm(b) + 1e-8
    return dot / (norm_a * norm_b)


def decode_frame(frame_data):
    """Decode base64 frame data URL to PIL Image."""
    from PIL import Image

    if isinstance(frame_data, str) and frame_data.startswith('data:'):
        # Data URL format: "data:image/jpeg;base64,<base64data>"
        header, data = frame_data.split(',', 1)
        image_bytes = base64.b64decode(data)
    else:
        # Assume it's already base64
        image_bytes = base64.b64decode(frame_data)

    return Image.open(io.BytesIO(image_bytes))


def add_clip_features(df):
    """
    Add visual features (alignment, novelty, drift) to dataframe by processing frames with CLIP.

    Parameters
    ----------
    df : pd.DataFrame
        Must have 'frame' column with base64 data URLs (or None for missing frames).

    Returns
    -------
    pd.DataFrame
        Original dataframe with added columns: alignment, novelty, drift (0-1 scale).
    """

    print('Checking for frame data...')
    frames_available = 'frame' in df.columns and df['frame'].notna().sum() > 0

    if not frames_available:
        print(f'No frames found. Setting visual features to 0.5 (neutral).')
        df['alignment'] = 0.5
        df['novelty'] = 0.5
        df['drift'] = 0.5
        return df

    print(f'{df["frame"].notna().sum()} videos have frame data. Loading CLIP...')

    # Try to import required packages
    try:
        from transformers import pipeline
        from PIL import Image
    except ImportError:
        print('Installing transformers and pillow...')
        import subprocess
        subprocess.check_call(['pip', 'install', 'transformers', 'pillow', '-q'])
        from transformers import pipeline
        from PIL import Image

    # Load CLIP pipeline
    print('Loading CLIP pipeline (openai/clip-vit-base-patch32)...')
    print('  First time: downloads ~500MB (one-time cache)')
    try:
        clip_pipeline = pipeline('feature-extraction', model='openai/clip-vit-base-patch32')
        print('✓ CLIP loaded successfully')
    except Exception as e:
        print(f'✗ Failed to load CLIP: {e}')
        df['alignment'] = 0.5
        df['novelty'] = 0.5
        df['drift'] = 0.5
        return df

    # Process frames
    alignments = []
    novelties = []
    drifts = []

    prev_frame = None
    session_avg = None
    prev_session_id = None

    print('Processing frames...')
    for idx, row in df.iterrows():
        frame_data = row.get('frame')
        video_id = row.get('video_id')

        # Reset session state on new video
        if video_id != prev_session_id:
            prev_frame = None
            session_avg = None
            prev_session_id = video_id

        if pd.isna(frame_data) or not frame_data:
            alignments.append(0.5)
            novelties.append(0.5)
            drifts.append(0.5)
            continue

        try:
            # Decode and process frame
            image = decode_frame(frame_data)
            embedding = clip_pipeline(image)
            frame_emb = np.array(embedding[0])

            # Alignment: frame-to-title similarity
            # (Skipped here since we don't have title embeddings; set to neutral)
            alignment = 0.5

            # Novelty: frame-to-frame change
            if prev_frame is None:
                novelty = 0.5
                prev_frame = frame_emb
            else:
                novelty_raw = cos_sim(frame_emb, prev_frame)
                novelty = (1 - novelty_raw) / 2
                prev_frame = frame_emb

            # Drift: distance from session baseline
            if session_avg is None:
                drift = 0.5
                session_avg = frame_emb.copy()
            else:
                drift_raw = cos_sim(frame_emb, session_avg)
                drift = (1 - drift_raw) / 2
                session_avg = 0.9 * session_avg + 0.1 * frame_emb

            alignments.append(alignment)
            novelties.append(novelty)
            drifts.append(drift)

            if (idx + 1) % max(1, len(df) // 10) == 0:
                print(f'  [{idx+1:3d}/{len(df)}] {alignment:.3f}, {novelty:.3f}, {drift:.3f}')

        except Exception as e:
            print(f'  [{idx+1:3d}] ✗ Frame error: {e}')
            alignments.append(0.5)
            novelties.append(0.5)
            drifts.append(0.5)

    df['alignment'] = alignments
    df['novelty'] = novelties
    df['drift'] = drifts

    frames_processed = sum(1 for a in alignments if a != 0.5)
    print(f'\n✓ Processed {frames_processed} frames')
    if frames_processed > 0:
        valid_align = [a for a in alignments if a != 0.5]
        valid_nov = [n for n in novelties if n != 0.5]
        valid_drift = [d for d in drifts if d != 0.5]
        print(f'  alignment: {np.mean(valid_align):.3f} ± {np.std(valid_align):.3f}')
        print(f'  novelty:   {np.mean(valid_nov):.3f} ± {np.std(valid_nov):.3f}')
        print(f'  drift:     {np.mean(valid_drift):.3f} ± {np.std(valid_drift):.3f}')

    return df


if __name__ == '__main__':
    # Example: load JSONL and add CLIP features
    import sys

    history_file = Path('session_history.jsonl')
    if not history_file.exists():
        history_file = Path('session_history.json')

    if not history_file.exists():
        print(f'Error: {history_file} not found')
        sys.exit(1)

    records = []
    content = history_file.read_text(encoding='utf-8')
    for line in content.strip().split('\n'):
        line = line.strip()
        if line:
            try:
                import json
                obj = json.loads(line)
                if isinstance(obj, list):
                    records.extend(obj)
                elif isinstance(obj, dict):
                    records.append(obj)
            except json.JSONDecodeError:
                continue

    df = pd.DataFrame(records)
    print(f'Loaded {len(df)} records')

    df = add_clip_features(df)

    # Save back
    df.to_json('session_history_with_clip.jsonl', orient='records', lines=True)
    print(f'\nSaved to session_history_with_clip.jsonl')
