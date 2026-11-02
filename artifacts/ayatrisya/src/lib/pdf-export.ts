import { downloadBlob } from '@/storage/backup';

export interface PDFExportOptions {
  title: string;
  author?: string;
  subject?: string;
  fontSize?: number;
  lineHeight?: number;
  margin?: number;
}

/**
 * Escapes characters that have special meaning in PDF literal strings: (, ), \
 */
function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Wraps text into lines that do not exceed approx maxCharsPerLine.
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const rawLines = text.split('\n');
  const wrapped: string[] = [];

  for (const rawLine of rawLines) {
    if (rawLine.length <= maxCharsPerLine) {
      wrapped.push(rawLine);
      continue;
    }

    const words = rawLine.split(' ');
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) wrapped.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      wrapped.push(currentLine);
    }
  }

  return wrapped;
}

/**
 * Generates a standard conforming PDF document (PDF-1.4) directly without external dependencies.
 * Produces clean vector typography, header branding, pagination, and timestamps.
 */
export function generatePdfDocument(content: string, options: PDFExportOptions): Uint8Array {
  const {
    title,
    author = 'Ayatrisya Studio',
    subject = 'Exported Document',
  } = options;

  // Standard A4 dimensions in points (72 points per inch)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 54; // 0.75 in
  const marginTop = 60;
  const marginBottom = 50;

  const titleFontSize = 18;
  const headerFontSize = 9;
  const bodyFontSize = 10;
  const bodyLineHeight = 14;

  const printableHeight = pageHeight - marginTop - marginBottom;
  const linesPerPage = Math.max(10, Math.floor((printableHeight - 40) / bodyLineHeight));
  const maxCharsPerLine = Math.floor((pageWidth - marginX * 2) / 5.2);

  const lines = wrapText(content, maxCharsPerLine);
  const totalPages = Math.max(1, Math.ceil(lines.length / linesPerPage));

  // Objects to build:
  // 1: Catalog
  // 2: Outlines
  // 3: Pages
  // 4: Font Helvetica
  // 5: Font Helvetica-Bold
  // For each page:
  // Page object, Content stream object

  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  // Placeholder indices
  // Catalog = 1, Outlines = 2, Pages = 3, Font1 = 4, Font2 = 5
  // Page 1 = 6, Stream 1 = 7, etc.
  const baseObjCount = 5;

  for (let p = 0; p < totalPages; p++) {
    const pageObjId = baseObjCount + p * 2 + 1;
    pageObjectIds.push(pageObjId);
  }

  // Object 1: Catalog
  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj`;

  // Object 2: Outlines
  objects[2] = `2 0 obj\n<< /Type /Outlines /Count 0 >>\nendobj`;

  // Object 3: Pages tree
  const kidsStr = pageObjectIds.map((id) => `${id} 0 R`).join(' ');
  objects[3] = `3 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} >>\nendobj`;

  // Object 4: Font Helvetica
  objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`;

  // Object 5: Font Helvetica-Bold
  objects[5] = `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`;

  // Now create pages and streams
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  for (let p = 0; p < totalPages; p++) {
    const pageNum = p + 1;
    const pageObjId = baseObjCount + p * 2 + 1;
    const streamObjId = pageObjId + 1;

    // Slice content for this page
    const pageLines = lines.slice(p * linesPerPage, (p + 1) * linesPerPage);

    // Build PDF stream commands
    const streamCommands: string[] = [];

    // Header divider rule
    streamCommands.push(`0.75 w 0.85 0.85 0.90 RG`);
    streamCommands.push(`${marginX} ${pageHeight - marginTop + 10} m ${pageWidth - marginX} ${pageHeight - marginTop + 10} l S`);

    // Top Header Text (Ayatrisya Branding + Date)
    streamCommands.push(`BT`);
    streamCommands.push(`/F1 ${headerFontSize} Tf`);
    streamCommands.push(`0.45 0.45 0.50 rg`);
    streamCommands.push(`1 0 0 1 ${marginX} ${pageHeight - marginTop + 18} Tm`);
    streamCommands.push(`(${escapePdfText(title.slice(0, 40))} | Ayatrisya Workspace) Tj`);
    streamCommands.push(`ET`);

    streamCommands.push(`BT`);
    streamCommands.push(`/F1 ${headerFontSize} Tf`);
    streamCommands.push(`0.45 0.45 0.50 rg`);
    streamCommands.push(`1 0 0 1 ${pageWidth - marginX - 60} ${pageHeight - marginTop + 18} Tm`);
    streamCommands.push(`(${escapePdfText(dateStr)}) Tj`);
    streamCommands.push(`ET`);

    let currentY = pageHeight - marginTop - 20;

    // If first page, draw document title
    if (pageNum === 1) {
      streamCommands.push(`BT`);
      streamCommands.push(`/F2 ${titleFontSize} Tf`);
      streamCommands.push(`0.08 0.08 0.12 rg`);
      streamCommands.push(`1 0 0 1 ${marginX} ${currentY} Tm`);
      streamCommands.push(`(${escapePdfText(title)}) Tj`);
      streamCommands.push(`ET`);
      currentY -= 30;
    }

    // Body lines
    streamCommands.push(`BT`);
    streamCommands.push(`/F1 ${bodyFontSize} Tf`);
    streamCommands.push(`0.15 0.15 0.20 rg`);
    streamCommands.push(`1 0 0 1 ${marginX} ${currentY} Tm`);
    streamCommands.push(`${bodyLineHeight} TL`);

    for (let i = 0; i < pageLines.length; i++) {
      const line = pageLines[i];
      if (i === 0) {
        streamCommands.push(`(${escapePdfText(line)}) Tj`);
      } else {
        streamCommands.push(`T* (${escapePdfText(line)}) Tj`);
      }
    }
    streamCommands.push(`ET`);

    // Footer divider rule
    streamCommands.push(`0.5 w 0.88 0.88 0.90 RG`);
    streamCommands.push(`${marginX} ${marginBottom + 15} m ${pageWidth - marginX} ${marginBottom + 15} l S`);

    // Footer page number
    const footerText = `Page ${pageNum} of ${totalPages}`;
    streamCommands.push(`BT`);
    streamCommands.push(`/F1 ${headerFontSize} Tf`);
    streamCommands.push(`0.50 0.50 0.55 rg`);
    streamCommands.push(`1 0 0 1 ${pageWidth / 2 - 20} ${marginBottom} Tm`);
    streamCommands.push(`(${escapePdfText(footerText)}) Tj`);
    streamCommands.push(`ET`);

    const streamContent = streamCommands.join('\n');
    const streamLen = new TextEncoder().encode(streamContent).length;

    // Page Object
    objects[pageObjId] = `${pageObjId} 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObjId} 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>\nendobj`;

    // Stream Object
    objects[streamObjId] = `${streamObjId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj`;
  }

  // Info Object
  const infoObjId = baseObjCount + totalPages * 2 + 1;
  objects[infoObjId] = `${infoObjId} 0 obj\n<< /Title (${escapePdfText(title)}) /Author (${escapePdfText(author)}) /Subject (${escapePdfText(subject)}) /Producer (Ayatrisya PDF Engine) >>\nendobj`;

  // Assemble the entire PDF with Cross-Reference Table
  let pdf = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  const xrefOffsets: number[] = [0];

  for (let i = 1; i <= infoObjId; i++) {
    xrefOffsets[i] = new TextEncoder().encode(pdf).length;
    pdf += `${objects[i]}\n`;
  }

  const xrefStart = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${infoObjId + 1}\n`;
  pdf += `0000000000 65535 f \n`;

  for (let i = 1; i <= infoObjId; i++) {
    const offsetStr = String(xrefOffsets[i]).padStart(10, '0');
    pdf += `${offsetStr} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${infoObjId + 1} /Root 1 0 R /Info ${infoObjId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

/**
 * Downloads a generated PDF document in the user's browser.
 */
export function downloadPdf(content: string, filename: string, options: Partial<PDFExportOptions> = {}) {
  const title = options.title || filename.replace(/\.pdf$/i, '');
  const bytes = generatePdfDocument(content, { title, ...options });
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  downloadBlob(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
