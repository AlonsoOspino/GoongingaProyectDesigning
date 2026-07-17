from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "mensajes_e_impacto_tfc.md"
TARGET = ROOT / "mensajes_e_impacto_tfc.pdf"


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def inline_markup(text: str) -> str:
    text = esc(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r"<font name='Courier'>\1</font>", text)
    return text


def split_table(lines, start):
    rows = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        raw = lines[i].strip().strip("|")
        cells = [c.strip() for c in raw.split("|")]
        rows.append(cells)
        i += 1
    if len(rows) >= 2 and all(set(c.replace(" ", "")) <= {"-", ":"} for c in rows[1]):
        rows.pop(1)
    return rows, i


def build_story(markdown: str):
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="DocTitle",
            parent=styles["Title"],
            fontSize=20,
            leading=24,
            spaceAfter=14,
            textColor=colors.HexColor("#8b1e4d"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1x",
            parent=styles["Heading1"],
            fontSize=15,
            leading=18,
            spaceBefore=14,
            spaceAfter=8,
            textColor=colors.HexColor("#8b1e4d"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2x",
            parent=styles["Heading2"],
            fontSize=12.5,
            leading=15,
            spaceBefore=10,
            spaceAfter=6,
            textColor=colors.HexColor("#333333"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Bodyx",
            parent=styles["BodyText"],
            fontSize=9,
            leading=12,
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Bulletx",
            parent=styles["BodyText"],
            fontSize=9,
            leading=12,
            leftIndent=14,
            firstLineIndent=-8,
            spaceAfter=3,
        )
    )

    story = []
    lines = markdown.splitlines()
    i = 0
    first_title = True
    paragraph_buffer = []

    def flush_paragraph():
        nonlocal paragraph_buffer
        if paragraph_buffer:
            text = " ".join(part.strip() for part in paragraph_buffer if part.strip())
            if text:
                story.append(Paragraph(inline_markup(text), styles["Bodyx"]))
            paragraph_buffer = []

    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()

        if not stripped:
            flush_paragraph()
            i += 1
            continue

        if stripped == "---":
            flush_paragraph()
            story.append(Spacer(1, 8))
            i += 1
            continue

        if stripped.startswith("|"):
            flush_paragraph()
            rows, i = split_table(lines, i)
            data = [[Paragraph(inline_markup(cell), styles["Bodyx"]) for cell in row] for row in rows]
            table = Table(data, repeatRows=1)
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f2d9e5")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#333333")),
                        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cccccc")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            story.append(table)
            story.append(Spacer(1, 7))
            continue

        if stripped.startswith("# "):
            flush_paragraph()
            if first_title:
                story.append(Paragraph(inline_markup(stripped[2:]), styles["DocTitle"]))
                first_title = False
            else:
                story.append(PageBreak())
                story.append(Paragraph(inline_markup(stripped[2:]), styles["H1x"]))
            i += 1
            continue

        if stripped.startswith("## "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(stripped[3:]), styles["H1x"]))
            i += 1
            continue

        if stripped.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(stripped[4:]), styles["H2x"]))
            i += 1
            continue

        if stripped.startswith("- "):
            flush_paragraph()
            story.append(Paragraph("- " + inline_markup(stripped[2:]), styles["Bulletx"]))
            i += 1
            continue

        if re.match(r"^\d+\. ", stripped):
            flush_paragraph()
            story.append(Paragraph(inline_markup(stripped), styles["Bulletx"]))
            i += 1
            continue

        paragraph_buffer.append(stripped)
        i += 1

    flush_paragraph()
    return story


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#777777"))
    canvas.drawRightString(A4[0] - 1.5 * cm, 1 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def main():
    markdown = SOURCE.read_text(encoding="utf-8")
    doc = SimpleDocTemplate(
        str(TARGET),
        pagesize=A4,
        rightMargin=1.4 * cm,
        leftMargin=1.4 * cm,
        topMargin=1.4 * cm,
        bottomMargin=1.5 * cm,
        title="Mensajes e impacto en decisiones - The Fresh Connection",
    )
    doc.build(build_story(markdown), onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(TARGET)


if __name__ == "__main__":
    main()
