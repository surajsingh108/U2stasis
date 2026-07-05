#!/usr/bin/env python3
"""
Auto-merge downloaded session history into main JSONL.

Usage:
  python auto_merge.py              # One-time merge (reads all *.json)
  python auto_merge.py --watch      # Watch mode (auto-detects new files)
"""

import json
import sys
from pathlib import Path
from datetime import datetime

def merge_history(json_file, main_file='session_history.jsonl'):
    """Merge a downloaded JSON file into the main JSONL."""

    print(f"Reading {json_file}...")
    with open(json_file) as f:
        new_records = json.load(f)

    print(f"  {len(new_records)} records found")

    # Read existing
    existing = []
    if Path(main_file).exists():
        with open(main_file) as f:
            for line in f:
                if line.strip():
                    try:
                        existing.append(json.loads(line.strip()))
                    except json.JSONDecodeError:
                        pass

    print(f"  {len(existing)} existing records")

    # Merge and deduplicate by (video_id, timestamp)
    all_records = existing + new_records
    seen = set()
    final = []
    for rec in all_records:
        key = (rec.get('video_id'), rec.get('timestamp'))
        if key not in seen:
            seen.add(key)
            final.append(rec)

    duplicates = len(all_records) - len(final)
    if duplicates > 0:
        print(f"  {duplicates} duplicates removed")

    # Normalize and write
    with open(main_file, 'w') as f:
        for rec in final:
            clean = {
                'timestamp': rec.get('timestamp', ''),
                'video_id': rec.get('video_id', ''),
                'title': rec.get('title', ''),
                'final_progress_percent': rec.get('final_progress_percent', 0),
                'user_stayed': rec.get('user_stayed', 0),
                'alignment': rec.get('alignment', 0.5),
                'novelty': rec.get('novelty', 0.5),
                'drift': rec.get('drift', 0.5),
                'title_signal': rec.get('title_signal', 0.5),
                'engagement': rec.get('engagement', 0.5),
                'seek_back_rate': rec.get('seek_back_rate', 0.0),
                'tab_hidden_rate': rec.get('tab_hidden_rate', 0.0),
                'long_pause_rate': rec.get('long_pause_rate', 0.0),
                'predicted_retention_before_update': rec.get('predicted_retention_before_update'),
                'weights_after': rec.get('weights_after'),
            }
            f.write(json.dumps(clean, separators=(',', ':')) + '\n')

    print(f"✓ Merged to {main_file} ({len(final)} total records)")

    # Move source file to archive
    archive_file = json_file.with_stem(f"{json_file.stem}_merged")
    json_file.rename(archive_file)
    print(f"  Source moved to {archive_file.name}")

    return len(final)

def main():
    watch_mode = '--watch' in sys.argv

    if watch_mode:
        print("Watch mode: monitoring for new *.json files...")
        try:
            while True:
                json_files = list(Path('.').glob('session_history_*.json'))
                if json_files:
                    for json_file in json_files:
                        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Detected {json_file.name}")
                        try:
                            merge_history(json_file)
                        except Exception as e:
                            print(f"  ERROR: {e}")

                import time
                time.sleep(2)  # Check every 2 seconds
        except KeyboardInterrupt:
            print("\n✓ Watch mode stopped")
    else:
        # One-time merge
        json_files = list(Path('.').glob('session_history_*.json'))
        if not json_files:
            print("No session_history_*.json files found in current directory.")
            print("\nWorkflow:")
            print("  1. In extension popup, click 'Export & Save History'")
            print("  2. Browser will download session_history_YYYY-MM-DD.json")
            print("  3. Move/save file to this directory")
            print("  4. Run: python auto_merge.py")
            return

        total = 0
        for json_file in sorted(json_files):
            try:
                total = merge_history(json_file)
            except Exception as e:
                print(f"ERROR merging {json_file}: {e}")

        print(f"\nDone! History is ready for notebook.")
        print("Next: jupyter nbconvert --to notebook --execute ml_workbench.ipynb")

if __name__ == '__main__':
    main()
