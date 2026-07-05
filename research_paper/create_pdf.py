#!/usr/bin/env python3
"""
Convert research paper markdown to PDF
"""

import subprocess
import sys
from pathlib import Path

def create_pdf_with_pandoc():
    """Try using pandoc if available"""
    try:
        input_file = Path('README.md')
        output_file = Path('Neuro_Cinematic_Tracker_Research_Paper.pdf')

        cmd = [
            'pandoc',
            str(input_file),
            '-o', str(output_file),
            '--pdf-engine=xelatex',
            '--toc',
            '--number-sections',
            '-V', 'geometry:margin=1in',
            '-V', 'mainfont=Times New Roman',
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            print(f'[OK] PDF created: {output_file}')
            return True
        else:
            print(f'[ERROR] Pandoc failed: {result.stderr}')
            return False
    except FileNotFoundError:
        print('[WARNING] Pandoc not found. Trying alternative method...')
        return False

def create_pdf_with_markdown_to_html():
    """Fallback: Use markdown + weasyprint"""
    try:
        import markdown
        from weasyprint import HTML, CSS

        # Read markdown
        with open('README.md', 'r', encoding='utf-8') as f:
            md_content = f.read()

        # Convert to HTML
        html_content = markdown.markdown(
            md_content,
            extensions=['extra', 'tables', 'toc']
        )

        # Wrap in HTML document
        full_html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Neuro-Cinematic Tracker: Predicting Video Viewing Completion</title>
    <style>
        body {{
            font-family: 'Times New Roman', Times, serif;
            line-height: 1.6;
            color: #000;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background-color: #fff;
        }}
        h1 {{
            color: #000;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            page-break-after: avoid;
            font-size: 24px;
        }}
        h2 {{
            color: #000;
            margin-top: 30px;
            page-break-after: avoid;
            font-size: 18px;
            font-weight: bold;
        }}
        h3 {{
            color: #000;
            page-break-after: avoid;
            font-size: 16px;
            font-weight: bold;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 15px 0;
            page-break-inside: avoid;
        }}
        th, td {{
            border: 1px solid #000;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background-color: #e0e0e0;
            color: #000;
            font-weight: bold;
        }}
        tr:nth-child(even) {{
            background-color: #f5f5f5;
        }}
        pre {{
            background-color: #f5f5f5;
            border: 1px solid #000;
            padding: 12px;
            overflow-x: auto;
            page-break-inside: avoid;
        }}
        code {{
            font-family: 'Courier New', monospace;
            background-color: #f5f5f5;
            padding: 2px 6px;
        }}
        img {{
            max-width: 100%;
            height: auto;
            page-break-inside: avoid;
        }}
        a {{
            color: #000;
            text-decoration: underline;
        }}
        blockquote {{
            border-left: 2px solid #000;
            padding-left: 15px;
            margin-left: 0;
            color: #000;
            page-break-inside: avoid;
            font-style: italic;
        }}
        .abstract {{
            background-color: #f5f5f5;
            padding: 15px;
            margin: 20px 0;
        }}
        hr {{
            border: 1px solid #000;
            margin: 20px 0;
        }}
        @media print {{
            body {{ background-color: white; }}
            h1, h2, h3 {{ page-break-after: avoid; }}
            table {{ page-break-inside: avoid; }}
            pre {{ page-break-inside: avoid; }}
        }}
    </style>
</head>
<body>
{html_content}
</body>
</html>'''

        # Save HTML
        html_file = Path('temp_research_paper.html')
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(full_html)

        # Convert to PDF
        output_file = Path('Neuro_Cinematic_Tracker_Research_Paper.pdf')
        HTML(string=full_html).write_pdf(str(output_file))

        # Clean up temp file
        html_file.unlink()

        print(f'[OK] PDF created: {output_file}')
        return True

    except ImportError as e:
        print(f'[ERROR] Missing library: {e}')
        print('[INFO] Install with: pip install markdown weasyprint')
        return False
    except Exception as e:
        print(f'[ERROR] {e}')
        return False

if __name__ == '__main__':
    print('Converting research paper to PDF...')
    print('='*60)

    # Try pandoc first (best results)
    if create_pdf_with_pandoc():
        sys.exit(0)

    # Fallback to weasyprint
    if create_pdf_with_markdown_to_html():
        sys.exit(0)

    # If both fail
    print('[ERROR] Could not create PDF. Try installing:')
    print('  Option 1: pandoc (https://pandoc.org/)')
    print('  Option 2: pip install markdown weasyprint')
    sys.exit(1)
