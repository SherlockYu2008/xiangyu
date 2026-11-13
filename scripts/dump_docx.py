import sys
from docx import Document

path = sys.argv[1]
doc = Document(path)

for i, p in enumerate(doc.paragraphs):
    text = p.text.rstrip()
    if text:
        print(f"[P{i:03d}][{p.style.name}] {text}")

for ti, table in enumerate(doc.tables):
    print(f"\n=== TABLE {ti} ===")
    for row in table.rows:
        cells = [c.text.replace("\n", " / ").strip() for c in row.cells]
        print(" | ".join(cells))
