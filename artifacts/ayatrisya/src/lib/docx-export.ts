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
 * Generates an OpenXML (.docx) document from Markdown / text content.
 */
export function buildDocxArchive(title: string, markdownContent: string): Uint8Array {
  const lines = markdownContent.split('\n');
  const paragraphsXml: string[] = [];

  // Title paragraph
  paragraphsXml.push(`
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Title"/>
        <w:spacing w:before="240" w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="52"/>
          <w:color w:val="111827"/>
        </w:rPr>
        <w:t>${escapeXml(title || 'Document')}</w:t>
      </w:r>
    </w:p>`);

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) {
      paragraphsXml.push('<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>');
      continue;
    }

    if (line.startsWith('# ')) {
      paragraphsXml.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="360" w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:b/>
              <w:sz w:val="40"/>
              <w:color w:val="0F172A"/>
            </w:rPr>
            <w:t>${escapeXml(line.slice(2).trim())}</w:t>
          </w:r>
        </w:p>`);
    } else if (line.startsWith('## ')) {
      paragraphsXml.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="240" w:after="100"/>
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
      paragraphsXml.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="180" w:after="80"/>
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
      paragraphsXml.push(`
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
    } else {
      paragraphsXml.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
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
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphsXml.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const packageRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const entries: ZipFileEntry[] = [
    { path: '[Content_Types].xml', data: contentTypesXml },
    { path: '_rels/.rels', data: packageRelsXml },
    { path: 'word/document.xml', data: documentXml },
  ];

  return buildZipArchive(entries);
}

export function downloadDocx(title: string, markdownContent: string, filename?: string): void {
  const bytes = buildDocxArchive(title, markdownContent);
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const name = filename || `${title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}.docx`;
  downloadBlob(blob, name.endsWith('.docx') ? name : `${name}.docx`);
}
