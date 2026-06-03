import {
  PDFDocument,
  StandardFonts,
  rgb,
  type Color,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

// Pure waiver renderer: (template text + signer details) -> PDF bytes.
// No I/O, no clients, no Supabase, no Blob — its only job is layout, so it
// is trivially unit-testable and has a single reason to change (the look
// of the document). The caller (Phase 3 record-signature) supplies the
// already-resolved template text, the typed name, a preformatted date
// label, and the audit lines; this module never reaches for them itself.
//
// The PDF deliberately does NOT embed its own SHA-256 — the hash is taken
// of the finished bytes and stored in waiver_documents.pdf_sha256, so a
// stored hash can be re-verified against the stored bytes at any time.

export interface WaiverRenderInput {
  title: string;
  body: string;
  signedName: string;
  signedDateLabel: string;
  auditLines: ReadonlyArray<string>;
}

// US Letter at 72dpi, ~0.85" margins.
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 61;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const TITLE_SIZE = 16;
const BODY_SIZE = 11;
const BODY_LEADING = 16;
const SIGNATURE_SIZE = 15;
const FOOTER_SIZE = 8.5;

const INK: Color = rgb(0.1, 0.1, 0.12);
const MUTED: Color = rgb(0.42, 0.42, 0.46);

export async function renderWaiverPdf(
  input: WaiverRenderInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const body = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const writer = createPageWriter(pdf);

  writer.drawParagraph(input.title, bold, TITLE_SIZE, TITLE_SIZE + 6);
  writer.advance(BODY_LEADING);

  for (const paragraph of splitParagraphs(input.body)) {
    writer.drawParagraph(paragraph, body, BODY_SIZE, BODY_LEADING);
    writer.advance(BODY_LEADING * 0.6);
  }

  // Keep the whole signature block on one page.
  writer.advance(BODY_LEADING);
  writer.ensureRoom(BODY_LEADING * 5);
  writer.drawRule(MUTED);
  writer.advance(BODY_LEADING * 0.4);
  writer.drawSignature(input.signedName, italic, bold);
  writer.drawField("Printed name", input.signedName, bold, body);
  writer.drawField("Date", input.signedDateLabel, bold, body);

  writer.drawFooter(input.auditLines, body, FOOTER_SIZE, MUTED);

  return pdf.save();
}

// ---- pagination writer ---------------------------------------------------
// Holds the current page + a top-down y cursor and spills onto a new page
// when content would cross the bottom margin.

interface PageWriter {
  advance(points: number): void;
  ensureRoom(points: number): void;
  drawParagraph(
    text: string,
    font: PDFFont,
    size: number,
    leading: number,
  ): void;
  drawRule(color: Color): void;
  drawSignature(name: string, valueFont: PDFFont, labelFont: PDFFont): void;
  drawField(
    label: string,
    value: string,
    labelFont: PDFFont,
    valueFont: PDFFont,
  ): void;
  drawFooter(
    lines: ReadonlyArray<string>,
    font: PDFFont,
    size: number,
    color: Color,
  ): void;
}

function createPageWriter(pdf: PDFDocument): PageWriter {
  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  function newPage(): void {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - MARGIN;
  }

  function ensureRoom(points: number): void {
    if (cursorY - points < MARGIN) newPage();
  }

  function advance(points: number): void {
    cursorY -= points;
  }

  function drawField(
    label: string,
    value: string,
    labelFont: PDFFont,
    valueFont: PDFFont,
  ): void {
    ensureRoom(BODY_LEADING);
    const baseline = cursorY - BODY_SIZE;
    const tag = `${label}:  `;
    page.drawText(tag, {
      x: MARGIN,
      y: baseline,
      size: BODY_SIZE,
      font: labelFont,
      color: INK,
    });
    page.drawText(value, {
      x: MARGIN + labelFont.widthOfTextAtSize(tag, BODY_SIZE),
      y: baseline,
      size: BODY_SIZE,
      font: valueFont,
      color: INK,
    });
    cursorY -= BODY_LEADING;
  }

  return {
    advance,
    ensureRoom,

    drawParagraph(text, font, size, leading) {
      for (const line of wrapText(text, font, size, CONTENT_WIDTH)) {
        ensureRoom(leading);
        page.drawText(line, {
          x: MARGIN,
          y: cursorY - size,
          size,
          font,
          color: INK,
        });
        cursorY -= leading;
      }
    },

    drawRule(color) {
      ensureRoom(8);
      page.drawLine({
        start: { x: MARGIN, y: cursorY },
        end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
        thickness: 0.5,
        color,
      });
      cursorY -= 8;
    },

    drawSignature(name, valueFont, labelFont) {
      ensureRoom(SIGNATURE_SIZE + 8);
      const baseline = cursorY - SIGNATURE_SIZE;
      const tag = "Signature:  ";
      page.drawText(tag, {
        x: MARGIN,
        y: baseline,
        size: BODY_SIZE,
        font: labelFont,
        color: INK,
      });
      page.drawText(name, {
        x: MARGIN + labelFont.widthOfTextAtSize(tag, BODY_SIZE),
        y: baseline,
        size: SIGNATURE_SIZE,
        font: valueFont,
        color: INK,
      });
      cursorY -= SIGNATURE_SIZE + 8;
    },

    drawField,

    drawFooter(lines, font, size, color) {
      // Footer is pinned to the bottom of whatever the last page is.
      lines.forEach((line, index) => {
        const y = MARGIN - 14 + (lines.length - 1 - index) * (size + 2);
        page.drawText(line, { x: MARGIN, y, size, font, color });
      });
    },
  };
}

// ---- text helpers --------------------------------------------------------

// Paragraphs are blank-line separated; single newlines inside a paragraph
// collapse to spaces (wrapText re-splits on whitespace anyway).
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

// Greedy word wrap to a pixel width. Falls back to a hard character break
// for any single token longer than the content width (rare in legal text,
// but it prevents overflow off the right margin).
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
    } else {
      // Token wider than the page: emit full chunks as their own lines and
      // carry the remainder forward as the running line.
      const chunks = breakLongWord(word, font, size, maxWidth);
      for (let i = 0; i < chunks.length - 1; i += 1) {
        lines.push(chunks[i]);
      }
      current = chunks[chunks.length - 1] ?? "";
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function breakLongWord(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const char of word) {
    const candidate = current + char;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = char;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
