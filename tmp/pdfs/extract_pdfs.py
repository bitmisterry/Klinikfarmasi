from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).parent
OUTPUT = ROOT / "extracted"
OUTPUT.mkdir(exist_ok=True)

for pdf_path in sorted(ROOT.rglob("*.pdf")):
    reader = PdfReader(str(pdf_path))
    page_texts = []
    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        page_texts.append(f"\n===== PAGE {page_number} =====\n{page_text}")

    text = "".join(page_texts)
    output_path = OUTPUT / f"{pdf_path.stem}.txt"
    output_path.write_text(text, encoding="utf-8")
    print(
        f"{pdf_path.name}\tpages={len(reader.pages)}\tchars={len(text)}\t"
        f"output={output_path}"
    )
