from pathlib import Path
from bs4 import BeautifulSoup
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
import html

ROOT = Path('/Users/walterelrafie/macro-workout-coach')
html_path = ROOT / 'PLANNER_PROMOTION_READINESS_AUDIT_PHASE_27A.html'
pdf_path = ROOT / 'PLANNER_PROMOTION_READINESS_AUDIT_PHASE_27A.pdf'

soup = BeautifulSoup(html_path.read_text(encoding='utf-8'), 'html.parser')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name='TitleCustom', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=22, leading=26,
    spaceAfter=14, textColor=colors.HexColor('#111827')
))
styles.add(ParagraphStyle(
    name='H2Custom', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=15, leading=19,
    spaceBefore=14, spaceAfter=6, textColor=colors.HexColor('#111827'), borderColor=colors.HexColor('#d1d5db'),
    borderWidth=0, borderPadding=0
))
styles.add(ParagraphStyle(
    name='H3Custom', parent=styles['Heading3'], fontName='Helvetica-Bold', fontSize=11.5, leading=14,
    spaceBefore=9, spaceAfter=4, textColor=colors.HexColor('#1f2937')
))
styles.add(ParagraphStyle(
    name='BodyCustom', parent=styles['BodyText'], fontName='Helvetica', fontSize=9, leading=12,
    spaceAfter=5, textColor=colors.HexColor('#111827')
))
styles.add(ParagraphStyle(
    name='BulletCustom', parent=styles['BodyText'], fontName='Helvetica', fontSize=8.8, leading=11.5,
    leftIndent=16, firstLineIndent=0, bulletIndent=6, spaceAfter=3, textColor=colors.HexColor('#111827')
))
styles.add(ParagraphStyle(
    name='CodeCustom', parent=styles['Code'], fontName='Courier', fontSize=8, leading=10,
    backColor=colors.HexColor('#f3f4f6'), borderPadding=6, spaceAfter=8
))
styles.add(ParagraphStyle(
    name='ScoreCustom', parent=styles['BodyText'], fontName='Helvetica-Bold', fontSize=14, leading=18,
    textColor=colors.HexColor('#991b1b'), spaceAfter=8
))
styles.add(ParagraphStyle(
    name='NoteCustom', parent=styles['BodyText'], fontName='Helvetica', fontSize=9, leading=12,
    backColor=colors.HexColor('#fef3c7'), borderColor=colors.HexColor('#f59e0b'), borderWidth=1,
    borderPadding=8, spaceBefore=6, spaceAfter=8
))

def clean_inline(tag):
    # Convert selected inline tags to ReportLab-friendly markup.
    text = ''.join(str(x) for x in tag.contents)
    text = text.replace('<strong>', '<b>').replace('</strong>', '</b>')
    text = text.replace('<em>', '<i>').replace('</em>', '</i>')
    text = text.replace('<code>', '<font name="Courier">').replace('</code>', '</font>')
    text = text.replace('&', '&amp;') if '<' not in text else text
    # BeautifulSoup string already contains entities; normalize unsupported tags by extracting text if parsing fails later.
    text = text.replace('\n', ' ')
    return text

def plain_text(tag):
    return ' '.join(tag.get_text(' ', strip=True).split())

story = []
body = soup.body
for el in body.find_all(['h1','h2','h3','p','li','pre','div'], recursive=True):
    # Avoid duplicating p elements inside note div: handle p normally; skip div container.
    if el.name == 'div':
        continue
    # Skip nested elements whose parent li will handle? We have only flat li text.
    if el.find_parent('li') and el.name != 'li':
        continue
    txt = plain_text(el)
    if not txt:
        continue
    safe = html.escape(txt)
    # restore arrows/code-ish remains as text
    if el.name == 'h1':
        story.append(Paragraph(safe, styles['TitleCustom']))
    elif el.name == 'h2':
        story.append(Paragraph(safe, styles['H2Custom']))
    elif el.name == 'h3':
        story.append(Paragraph(safe, styles['H3Custom']))
    elif el.name == 'pre':
        story.append(Paragraph(html.escape(el.get_text()), styles['CodeCustom']))
    elif el.name == 'li':
        story.append(Paragraph(safe, styles['BulletCustom'], bulletText='•'))
    else:
        cls = el.get('class') or []
        if 'score' in cls:
            story.append(Paragraph(safe, styles['ScoreCustom']))
        elif el.find_parent('div', class_='note'):
            story.append(Paragraph(safe, styles['NoteCustom']))
        else:
            story.append(Paragraph(safe, styles['BodyCustom']))

if not story:
    raise SystemExit('No content parsed')

def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor('#6b7280'))
    canvas.drawString(0.65*inch, 0.45*inch, 'Phase 27A — Planner Promotion Readiness Audit')
    canvas.drawRightString(7.85*inch, 0.45*inch, f'Page {doc.page}')
    canvas.restoreState()

pdf = SimpleDocTemplate(
    str(pdf_path), pagesize=letter,
    rightMargin=0.6*inch, leftMargin=0.6*inch,
    topMargin=0.65*inch, bottomMargin=0.65*inch,
    title='Phase 27A — Planner Promotion Readiness Audit',
    author='Hermes Agent'
)
pdf.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print(pdf_path)
print(pdf_path.stat().st_size)
