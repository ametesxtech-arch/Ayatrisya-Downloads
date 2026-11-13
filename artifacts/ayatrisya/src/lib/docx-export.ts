import { downloadBlob } from '@/storage/backup';
import { buildZipArchive, type ZipFileEntry } from './zip-export';

/**
 * Escapes special XML characters for WordprocessingML.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a valid OpenXML (.docx) document from Markdown or structured document text.
 * Supports headings (H1-H4), tables, lists, code blocks, callouts, and footer page numbering.
 */
export function buildDocxArchive(title: string, markdownContent: string): Uint8Array {
  const lines = markdownContent.split(/\r?\n/);
  const bodyXml: string[] = [];

  // Title paragraph
  bodyXml.push(`
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
        <w:spacing w:before="360" w:after="200"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="56"/>
          <w:color w:val="0F172A"/>
        </w:rPr>
        <w:t>${escapeXml(title || 'Document')}</w:t>
      </w:r>
    </w:p>`);

  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const colCount = Math.max(...tableRows.map((r) => r.length), 1);
    const colWidth = Math.floor(9360 / colCount); // 9360 twips printable width

    let tblXml = `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="9360" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="none"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="none"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>`;

    for (let c = 0; c < colCount; c++) {
      tblXml += `<w:gridCol w:w="${colWidth}"/>`;
    }
    tblXml += `</w:tblGrid>`;

    tableRows.forEach((row, rIdx) => {
      const isHeader = rIdx === 0;
      tblXml += `<w:tr><w:trPr>${isHeader ? '<w:tblHeader/>' : ''}</w:trPr>`;

      for (let c = 0; c < colCount; c++) {
        const text = row[c] || '';
        tblXml += `
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="${colWidth}" w:type="dxa"/>
              ${isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>' : ''}
              <w:tcMar>
                <w:top w:w="120" w:type="dxa"/>
                <w:bottom w:w="120" w:type="dxa"/>
                <w:left w:w="140" w:type="dxa"/>
                <w:right w:w="140" w:type="dxa"/>
              </w:tcMar>
            </w:tcPr>
            <w:p>
              <w:pPr><w:spacing w:after="0"/></w:pPr>
              <w:r>
                <w:rPr>
                  ${isHeader ? '<w:b/><w:color w:val="0F172A"/>' : '<w:color w:val="334155"/>'}
                  <w:sz w:val="${isHeader ? '22' : '20'}"/>
                </w:rPr>
                <w:t>${escapeXml(text)}</w:t>
              </w:r>
            </w:p>
          </w:tc>`;
      }
      tblXml += `</w:tr>`;
    });

    tblXml += `</w:tbl><w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>`;
    bodyXml.push(tblXml);
    tableRows = [];
  };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Check table row
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) inTable = true;
      // Skip separator |---|---|
      if (line.replace(/[\s|:-]/g, '').length > 0) {
        const cells = line
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        tableRows.push(cells);
      }
      i++;
      continue;
    } else if (inTable) {
      inTable = false;
      flushTable();
    }

    if (!line) {
      bodyXml.push('<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>');
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) i++;

      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:pBdr>
              <w:left w:val="single" w:sz="12" w:space="10" w:color="7C3AED"/>
            </w:pBdr>
            <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
            <w:spacing w:before="120" w:after="120"/>
            <w:ind w:left="240" w:right="240"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>
              <w:sz w:val="19"/>
              <w:color w:val="334155"/>
            </w:rPr>
            <w:t xml:space="preserve">${escapeXml(codeLines.join('\n'))}</w:t>
          </w:r>
        </w:p>`);
      continue;
    }

    // Callout
    if (/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT)\]/i.test(line)) {
      const calloutText: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        calloutText.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:pBdr>
              <w:left w:val="single" w:sz="24" w:space="12" w:color="6366F1"/>
            </w:pBdr>
            <w:shd w:val="clear" w:color="auto" w:fill="EEF2FF"/>
            <w:spacing w:before="140" w:after="140"/>
            <w:ind w:left="280" w:right="200"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="21"/>
              <w:color w:val="312E81"/>
            </w:rPr>
            <w:t>${escapeXml(calloutText.join(' '))}</w:t>
          </w:r>
        </w:p>`);
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="360" w:after="140"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="44"/>
              <w:color w:val="0F172A"/>
            </w:rPr>
            <w:t>${escapeXml(line.slice(2).trim())}</w:t>
          </w:r>
        </w:p>`);
    } else if (line.startsWith('## ')) {
      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="280" w:after="100"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="32"/>
              <w:color w:val="1E293B"/>
            </w:rPr>
            <w:t>${escapeXml(line.slice(3).trim())}</w:t>
          </w:r>
        </w:p>`);
    } else if (line.startsWith('### ')) {
      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="200" w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="26"/>
              <w:color w:val="334155"/>
            </w:rPr>
            <w:t>${escapeXml(line.slice(4).trim())}</w:t>
          </w:r>
        </w:p>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:ind w:left="480" w:hanging="240"/>
            <w:spacing w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr>
            <w:t>• ${escapeXml(line.slice(2).trim())}</w:t>
          </w:r>
        </w:p>`);
    } else if (/^\d+\.\s+/.test(line)) {
      const match = line.match(/^(\d+)\.\s+(.+)$/);
      const num = match ? match[1] : '1';
      const text = match ? match[2] : line;
      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:ind w:left="480" w:hanging="240"/>
            <w:spacing w:after="80"/>
          </w:pPr>
          <w:r>
            <w:rPr><w:sz w:val="22"/><w:color w:val="334155"/><w:b/></w:rPr>
            <w:t>${num}. </w:t>
          </w:r>
          <w:r>
            <w:rPr><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr>
            <w:t>${escapeXml(text)}</w:t>
          </w:r>
        </w:p>`);
    } else if (line === '---' || line === '\\pagebreak') {
      bodyXml.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    } else {
      bodyXml.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:after="140" w:line="276" w:lineRule="auto"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
              <w:sz w:val="22"/>
              <w:color w:val="334155"/>
            </w:rPr>
            <w:t xml:space="preserve">${escapeXml(line)}</w:t>
          </w:r>
        </w:p>`);
    }

    i++;
  }

  if (inTable) flushTable();

  // WordprocessingML document structure with section properties and footer reference
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyXml.join('\n')}
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rId2"/>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:pBdr>
        <w:top w:val="single" w:sz="4" w:space="10" w:color="E2E8F0"/>
      </w:pBdr>
      <w:jc w:val="right"/>
      <w:spacing w:before="120" w:after="0"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr>
      <w:t xml:space="preserve">Ayatrisya Document Intelligence  •  Page </w:t>
    </w:r>
    <w:fldSimple w:instr="PAGE"/>
    <w:r>
      <w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr>
      <w:t xml:space="preserve"> of </w:t>
    </w:r>
    <w:fldSimple w:instr="NUMPAGES"/>
  </w:p>
</w:ftr>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;

  const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

  const packageRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const entries: ZipFileEntry[] = [
    { path: '[Content_Types].xml', data: contentTypesXml },
    { path: '_rels/.rels', data: packageRelsXml },
    { path: 'word/document.xml', data: documentXml },
    { path: 'word/footer1.xml', data: footerXml },
    { path: 'word/_rels/document.xml.rels', data: documentRelsXml },
  ];

  return buildZipArchive(entries);
}

/**
 * Downloads a generated DOCX document in the user's browser.
 */
export function downloadDocx(content: string, filename: string, title?: string) {
  const bytes = buildDocxArchive(title || filename.replace(/\.docx$/i, ''), content);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  downloadBlob(blob, filename.endsWith('.docx') ? filename : `${filename}.docx`);
}
