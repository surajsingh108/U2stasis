#!/usr/bin/env python3
"""
Convert research paper markdown to printable HTML
(can be printed to PDF from any browser)
"""

import markdown
from pathlib import Path

def create_html_from_markdown():
    """Convert markdown to HTML"""

    # Read markdown
    with open('README.md', 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Convert to HTML
    html_content = markdown.markdown(
        md_content,
        extensions=['extra', 'tables', 'toc']
    )

    # Create full HTML document with print-friendly styling
    full_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neuro-Cinematic Tracker: Predicting Video Viewing Completion</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        html {{
            font-size: 14px;
        }}

        body {{
            font-family: 'Times New Roman', Times, serif;
            line-height: 1.6;
            color: #000;
            background-color: #fff;
            padding: 0;
        }}

        .container {{
            max-width: 8.5in;
            margin: 0 auto;
            padding: 0.5in;
        }}

        h1 {{
            color: #000;
            border-bottom: 2px solid #000;
            padding: 15px 0 10px 0;
            margin: 30px 0 20px 0;
            font-size: 28px;
            font-weight: bold;
            page-break-after: avoid;
        }}

        h2 {{
            color: #000;
            margin: 25px 0 15px 0;
            padding-top: 10px;
            font-size: 20px;
            font-weight: bold;
            page-break-after: avoid;
            border-top: 1px solid #ccc;
        }}

        h3 {{
            color: #000;
            margin: 15px 0 10px 0;
            font-size: 16px;
            font-weight: bold;
            page-break-after: avoid;
        }}

        h4 {{
            color: #000;
            margin: 12px 0 8px 0;
            font-size: 15px;
            font-weight: bold;
            page-break-after: avoid;
        }}

        p {{
            margin: 0 0 12px 0;
            text-align: justify;
        }}

        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 15px 0;
            page-break-inside: avoid;
            font-size: 13px;
        }}

        th, td {{
            border: 1px solid #000;
            padding: 10px;
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
            font-family: 'Courier New', monospace;
            font-size: 12px;
            margin: 10px 0;
        }}

        code {{
            font-family: 'Courier New', monospace;
            background-color: #f5f5f5;
            padding: 2px 6px;
            font-size: 13px;
        }}

        pre code {{
            background-color: transparent;
            padding: 0;
        }}

        img {{
            max-width: 100%;
            height: auto;
            page-break-inside: avoid;
            margin: 15px 0;
        }}

        a {{
            color: #000;
            text-decoration: underline;
        }}

        blockquote {{
            border-left: 3px solid #000;
            padding-left: 15px;
            margin: 15px 0;
            color: #000;
            page-break-inside: avoid;
        }}

        li {{
            margin: 5px 0;
            margin-left: 20px;
        }}

        ul, ol {{
            margin: 10px 0;
        }}

        hr {{
            border: none;
            border-top: 1px solid #000;
            margin: 20px 0;
        }}

        strong {{
            font-weight: bold;
        }}

        em {{
            font-style: italic;
        }}

        .toc {{
            page-break-after: always;
        }}

        @page {{
            size: 8.5in 11in;
            margin: 0.5in;
        }}

        @media print {{
            body {{
                background-color: white;
            }}
            .container {{
                max-width: 100%;
                padding: 0;
            }}
            h1, h2, h3 {{
                page-break-after: avoid;
            }}
            table {{
                page-break-inside: avoid;
            }}
            pre {{
                page-break-inside: avoid;
            }}
            img {{
                page-break-inside: avoid;
            }}
            a {{
                color: #000;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
{html_content}
    </div>
</body>
</html>'''

    # Save HTML
    output_file = Path('Neuro_Cinematic_Tracker_Research_Paper.html')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(full_html)

    print(f'[OK] HTML created: {output_file}')
    print()
    print('To create PDF:')
    print('  1. Open in your browser: Neuro_Cinematic_Tracker_Research_Paper.html')
    print('  2. Press Ctrl+P (or Cmd+P on Mac)')
    print('  3. Select "Save as PDF"')
    print('  4. Save as: Neuro_Cinematic_Tracker_Research_Paper.pdf')

if __name__ == '__main__':
    print('Converting research paper to HTML (print-to-PDF ready)...')
    print('='*60)
    try:
        create_html_from_markdown()
    except Exception as e:
        print(f'[ERROR] {e}')
        exit(1)
