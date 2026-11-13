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

interface PageItem {
  type: 'title' | 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'bullet' | 'callout' | 'table-row' | 'table-sep' | 'spacer';
  text?: string;
  cells?: string[];
  isHeader?: boolean;
  height: number;
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
  const printableHeight = pageHeight - marginTop - marginBottom;
  const contentWidth = pageWidth - marginX * 2;
  const maxCharsPerLine = Math.floor(contentWidth / 5.2);

  // Convert markdown content into printable layout items with measured heights
  const rawLines = content.split(/\r?\n/);
  const layoutItems: PageItem[] = [];

  let inTable = false;
  let tableHeaderCols: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const line = rawLine.trim();

    // Table parsing
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHeaderCols = line.slice(1, -1).split('|').map((c) => c.trim());
        layoutItems.push({
          type: 'table-row',
          cells: tableHeaderCols,
          isHeader: true,
          height: 22,
        });
      } else if (line.replace(/[\s|:-]/g, '').length === 0) {
        // Table separator row
        layoutItems.push({
          type: 'table-sep',
          height: 4,
        });
      } else {
        const cells = line.slice(1, -1).split('|').map((c) => c.trim());
        layoutItems.push({
          type: 'table-row',
          cells,
          isHeader: false,
          height: 18,
        });
      }
      continue;
    } else if (inTable) {
      inTable = false;
      layoutItems.push({ type: 'spacer', height: 8 });
    }

    if (!line) {
      layoutItems.push({ type: 'spacer', height: 10 });
      continue;
    }

    // Callout
    if (/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT)\]/i.test(line)) {
      const match = line.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*(.*)$/i);
      const tag = match ? match[1].toUpperCase() : 'NOTE';
      const text = match && match[2] ? match[2] : '';
      const wrapped = wrapText(`[${tag}] ${text}`, maxCharsPerLine - 4);
      for (const w of wrapped) {
        layoutItems.push({
          type: 'callout',
          text: w,
          height: 15,
        });
      }
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      layoutItems.push({
        type: 'heading1',
        text: line.slice(2).trim(),
        height: 28,
      });
    } else if (line.startsWith('## ')) {
      layoutItems.push({
        type: 'heading2',
        text: line.slice(3).trim(),
        height: 22,
      });
    } else if (line.startsWith('### ')) {
      layoutItems.push({
        type: 'heading3',
        text: line.slice(4).trim(),
        height: 18,
      });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const wrapped = wrapText(line.slice(2).trim(), maxCharsPerLine - 4);
      for (let j = 0; j < wrapped.length; j++) {
        layoutItems.push({
          type: 'bullet',
          text: (j === 0 ? '• ' : '  ') + wrapped[j],
          height: 14,
        });
      }
    } else {
      const wrapped = wrapText(line, maxCharsPerLine);
      for (const w of wrapped) {
        layoutItems.push({
          type: 'paragraph',
          text: w,
          height: 14,
        });
      }
    }
  }

  // Paginate layoutItems into pages
  const pages: PageItem[][] = [];
  let currentPage: PageItem[] = [];
  let currentYUsed = 0;

  // Page 1 header title takes ~45pt
  currentYUsed += 45;

  for (const item of layoutItems) {
    if (currentYUsed + item.height > printableHeight - 20) {
      pages.push(currentPage);
      currentPage = [];
      currentYUsed = 0;
    }
    currentPage.push(item);
    currentYUsed += item.height;
  }
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }
  if (pages.length === 0) {
    pages.push([]);
  }

  const totalPages = pages.length;

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
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

  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  for (let p = 0; p < totalPages; p++) {
    const pageNum = p + 1;
    const pageObjId = baseObjCount + p * 2 + 1;
    const streamObjId = pageObjId + 1;
    const pageItems = pages[p];

    const streamCommands: string[] = [];

    // Header divider rule
    streamCommands.push(`0.75 w 0.85 0.85 0.90 RG`);
    streamCommands.push(`${marginX} ${pageHeight - marginTop + 10} m ${pageWidth - marginX} ${pageHeight - marginTop + 10} l S`);

    // Top Header Text (Ayatrisya Branding + Date)
    streamCommands.push(`BT`);
    streamCommands.push(`/F1 9 Tf`);
    streamCommands.push(`0.45 0.45 0.50 rg`);
    streamCommands.push(`1 0 0 1 ${marginX} ${pageHeight - marginTop + 18} Tm`);
    streamCommands.push(`(${escapePdfText(title.slice(0, 45))} | Ayatrisya Workspace) Tj`);
    streamCommands.push(`ET`);

    streamCommands.push(`BT`);
    streamCommands.push(`/F1 9 Tf`);
    streamCommands.push(`0.45 0.45 0.50 rg`);
    streamCommands.push(`1 0 0 1 ${pageWidth - marginX - 60} ${pageHeight - marginTop + 18} Tm`);
    streamCommands.push(`(${escapePdfText(dateStr)}) Tj`);
    streamCommands.push(`ET`);

    let currentY = pageHeight - marginTop - 15;

    // First page document title
    if (pageNum === 1) {
      streamCommands.push(`BT`);
      streamCommands.push(`/F2 20 Tf`);
      streamCommands.push(`0.08 0.08 0.12 rg`);
      streamCommands.push(`1 0 0 1 ${marginX} ${currentY} Tm`);
      streamCommands.push(`(${escapePdfText(title)}) Tj`);
      streamCommands.push(`ET`);
      currentY -= 35;
    }

    // Render items on this page
    for (const item of pageItems) {
      if (item.type === 'spacer') {
        currentY -= item.height;
        continue;
      }

      if (item.type === 'heading1') {
        currentY -= 6;
        streamCommands.push(`BT`);
        streamCommands.push(`/F2 15 Tf`);
        streamCommands.push(`0.08 0.08 0.15 rg`);
        streamCommands.push(`1 0 0 1 ${marginX} ${currentY} Tm`);
        streamCommands.push(`(${escapePdfText(item.text || '')}) Tj`);
        streamCommands.push(`ET`);
        currentY -= item.height;
      } else if (item.type === 'heading2') {
        currentY -= 4;
        streamCommands.push(`BT`);
        streamCommands.push(`/F2 12 Tf`);
        streamCommands.push(`0.15 0.18 0.25 rg`);
        streamCommands.push(`1 0 0 1 ${marginX} ${currentY} Tm`);
        streamCommands.push(`(${escapePdfText(item.text || '')}) Tj`);
        streamCommands.push(`ET`);
        currentY -= item.height;
      } else if (item.type === 'heading3') {
        streamCommands.push(`BT`);
        streamCommands.push(`/F2 10.5 Tf`);
        streamCommands.push(`0.20 0.22 0.30 rg`);
        streamCommands.push(`1 0 0 1 ${marginX} ${currentY} Tm`);
        streamCommands.push(`(${escapePdfText(item.text || '')}) Tj`);
        streamCommands.push(`ET`);
        currentY -= item.height;
      } else if (item.type === 'callout') {
        // Draw light background and left border
        streamCommands.push(`0.93 0.94 0.98 rg`);
        streamCommands.push(`${marginX} ${currentY - 3} ${contentWidth} 16 re f`);
        streamCommands.push(`0.40 0.35 0.85 RG 2 w`);
        streamCommands.push(`${marginX} ${currentY - 3} m ${marginX} ${currentY + 13} l S`);

        streamCommands.push(`BT`);
        streamCommands.push(`/F1 9.5 Tf`);
        streamCommands.push(`0.20 0.20 0.40 rg`);
        streamCommands.push(`1 0 0 1 ${marginX + 8} ${currentY} Tm`);
        streamCommands.push(`(${escapePdfText(item.text || '')}) Tj`);
        streamCommands.push(`ET`);
        currentY -= item.height;
      } else if (item.type === 'table-row') {
        const cells = item.cells || [];
        const colWidth = contentWidth / Math.max(cells.length, 1);

        if (item.isHeader) {
          streamCommands.push(`0.95 0.95 0.97 rg`);
          streamCommands.push(`${marginX} ${currentY - 3} ${contentWidth} 18 re f`);
        }

        for (let c = 0; c < cells.length; c++) {
          const cellX = marginX + c * colWidth + 4;
          streamCommands.push(`BT`);
          streamCommands.push(`/${item.isHeader ? 'F2' : 'F1'} 9.5 Tf`);
          streamCommands.push(`${item.isHeader ? '0.10 0.12 0.18' : '0.25 0.25 0.30'} rg`);
          streamCommands.push(`1 0 0 1 ${cellX} ${currentY} Tm`);
          streamCommands.push(`(${escapePdfText(cells[c].slice(0, 30))}) Tj`);
          streamCommands.push(`ET`);
        }
        currentY -= item.height;
      } else if (item.type === 'table-sep') {
        streamCommands.push(`0.5 w 0.80 0.80 0.85 RG`);
        streamCommands.push(`${marginX} ${currentY} m ${pageWidth - marginX} ${currentY} l S`);
        currentY -= item.height;
      } else if (item.type === 'bullet') {
        streamCommands.push(`BT`);
        streamCommands.push(`/F1 10 Tf`);
        streamCommands.push(`0.20 0.20 0.25 rg`);
        streamCommands.push(`1 0 0 1 ${marginX + 6} ${currentY} Tm`);
        streamCommands.push(`(${escapePdfText(item.text || '')}) Tj`);
        streamCommands.push(`ET`);
        currentY -= item.height;
      } else {
        streamCommands.push(`BT`);
        streamCommands.push(`/F1 10 Tf`);
        streamCommands.push(`0.20 0.20 0.25 rg`);
        streamCommands.push(`1 0 0 1 ${marginX} ${currentY} Tm`);
        streamCommands.push(`(${escapePdfText(item.text || '')}) Tj`);
        streamCommands.push(`ET`);
        currentY -= item.height;
      }
    }

    // Footer divider rule
    streamCommands.push(`0.5 w 0.88 0.88 0.90 RG`);
    streamCommands.push(`${marginX} ${marginBottom + 15} m ${pageWidth - marginX} ${marginBottom + 15} l S`);

    // Footer page number
    const footerText = `Page ${pageNum} of ${totalPages}`;
    streamCommands.push(`BT`);
    streamCommands.push(`/F1 9 Tf`);
    streamCommands.push(`0.50 0.50 0.55 rg`);
    streamCommands.push(`1 0 0 1 ${pageWidth / 2 - 25} ${marginBottom} Tm`);
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
