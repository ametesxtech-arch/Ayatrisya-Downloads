import { downloadBlob } from '@/storage/backup';
import type { Slide } from '@/components/ItemEditors';

/**
 * Basic CRC32 table & calculator for ZIP checksums.
 */
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  path: string;
  data: Uint8Array;
}

/**
 * Assembles an uncompressed ZIP archive (STORE mode) from entries in memory.
 * Produces genuine, standard Office OpenXML (.pptx) packages viewable in PowerPoint, Keynote, Google Slides & LibreOffice.
 */
function createZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const fileHeaders: Uint8Array[] = [];
  const fileRecords: Uint8Array[] = [];

  let currentOffset = 0;

  for (const entry of entries) {
    const filenameBytes = encoder.encode(entry.path);
    const uncompressedSize = entry.data.length;
    const fileCrc = crc32(entry.data);

    // Local file header (30 bytes + name)
    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, fileCrc, true);
    lv.setUint32(18, uncompressedSize, true);
    lv.setUint32(22, uncompressedSize, true);
    lv.setUint16(26, filenameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(filenameBytes, 30);

    const record = new Uint8Array(localHeader.length + entry.data.length);
    record.set(localHeader, 0);
    record.set(entry.data, localHeader.length);
    fileRecords.push(record);

    // Central directory header (46 bytes + name)
    const cdHeader = new Uint8Array(46 + filenameBytes.length);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, fileCrc, true);
    cv.setUint32(20, uncompressedSize, true);
    cv.setUint32(24, uncompressedSize, true);
    cv.setUint16(28, filenameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, currentOffset, true);
    cdHeader.set(filenameBytes, 46);

    fileHeaders.push(cdHeader);
    currentOffset += record.length;
  }

  const centralDirOffset = currentOffset;
  const centralDirSize = fileHeaders.reduce((sum, h) => sum + h.length, 0);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirOffset, true);
  ev.setUint16(20, 0, true);

  const totalBytes = currentOffset + centralDirSize + eocd.length;
  const out = new Uint8Array(totalBytes);
  let pos = 0;

  for (const r of fileRecords) {
    out.set(r, pos);
    pos += r.length;
  }
  for (const h of fileHeaders) {
    out.set(h, pos);
    pos += h.length;
  }
  out.set(eocd, pos);

  return out;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export type PresentationTheme = 'dark-cinematic' | 'clean-light' | 'emerald-minimal' | 'cyber-neon';

interface ThemeDef {
  bg: string;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
  bodyColor: string;
  accent: string;
  badgeBg: string;
  badgeColor: string;
  font: string;
}

const THEMES: Record<PresentationTheme, ThemeDef> = {
  'dark-cinematic': {
    bg: '0B0F19',
    cardBg: '161F30',
    cardBorder: '24334C',
    titleColor: 'F8FAFC',
    bodyColor: 'CBD5E1',
    accent: '8B5CF6',
    badgeBg: '7C3AED',
    badgeColor: 'FFFFFF',
    font: 'Segoe UI',
  },
  'clean-light': {
    bg: 'F8FAFC',
    cardBg: 'FFFFFF',
    cardBorder: 'E2E8F0',
    titleColor: '0F172A',
    bodyColor: '334155',
    accent: '2563EB',
    badgeBg: 'DBEAFE',
    badgeColor: '1E40AF',
    font: 'Calibri',
  },
  'emerald-minimal': {
    bg: '061A14',
    cardBg: '0D281E',
    cardBorder: '154030',
    titleColor: 'ECFDF5',
    bodyColor: 'A7F3D0',
    accent: '10B981',
    badgeBg: '059669',
    badgeColor: 'FFFFFF',
    font: 'Segoe UI',
  },
  'cyber-neon': {
    bg: '0F051D',
    cardBg: '1B0B33',
    cardBorder: '2D1254',
    titleColor: 'FDF4FF',
    bodyColor: 'E879F9',
    accent: '06B6D4',
    badgeBg: 'C026D3',
    badgeColor: 'FFFFFF',
    font: 'Trebuchet MS',
  },
};

/**
 * Builds a PowerPoint presentation (.pptx) adhering to Microsoft Office OpenXML PresentationML specifications.
 * Supports SmartArt cards, multi-column metric blocks, quotes, and diverse modern palettes.
 */
export function generatePptx(
  title: string,
  slides: Slide[],
  options: { theme?: PresentationTheme } = {}
): Uint8Array {
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];
  const theme = THEMES[options.theme || 'dark-cinematic'];

  const addXml = (path: string, content: string) => {
    entries.push({ path, data: encoder.encode(content.trim()) });
  };

  // 1. [Content_Types].xml
  let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`;

  slides.forEach((_, i) => {
    contentTypes += `\n  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  });
  contentTypes += `\n</Types>`;
  addXml('[Content_Types].xml', contentTypes);

  // 2. _rels/.rels
  addXml('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

  // 3. docProps/core.xml & app.xml
  const dateIso = new Date().toISOString();
  addXml('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>Ayatrisya Presentation Suite</dc:creator>
  <cp:lastModifiedBy>Ayatrisya AI</cp:lastModifiedBy>
  <dcterms:created>${dateIso}</dcterms:created>
  <dcterms:modified>${dateIso}</dcterms:modified>
</cp:coreProperties>`);

  addXml('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <TotalTime>0</TotalTime>
  <Words>0</Words>
  <Application>Ayatrisya AI Presentation Engine</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${slides.length}</Slides>
</Properties>`);

  // 4. ppt/presentation.xml & ppt/_rels/presentation.xml.rels
  let sldIdList = '';
  let presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`;

  slides.forEach((_, i) => {
    const rId = `rId${i + 2}`;
    sldIdList += `\n    <p:sldId id="${256 + i}" r:id="${rId}"/>`;
    presRels += `\n  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`;
  });
  presRels += `\n</Relationships>`;

  addXml('ppt/_rels/presentation.xml.rels', presRels);

  addXml('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>${sldIdList}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);

  // 5. Theme
  addXml('ppt/theme/theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Ayatrisya ${options.theme || 'Dark'}">
  <a:themeElements>
    <a:clrScheme name="AyatrisyaPalette">
      <a:dk1><a:srgbClr val="${theme.bg}"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="${theme.cardBg}"/></a:dk2>
      <a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>
      <a:accent1><a:srgbClr val="${theme.accent}"/></a:accent1>
      <a:accent2><a:srgbClr val="38BDF8"/></a:accent2>
      <a:accent3><a:srgbClr val="10B981"/></a:accent3>
      <a:accent4><a:srgbClr val="F59E0B"/></a:accent4>
      <a:accent5><a:srgbClr val="EC4899"/></a:accent5>
      <a:accent6><a:srgbClr val="6366F1"/></a:accent6>
      <a:hlink><a:srgbClr val="${theme.accent}"/></a:hlink>
      <a:folHlink><a:srgbClr val="${theme.accent}"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="ModernHierarchy">
      <a:majorFont><a:latin typeface="${theme.font}"/></a:majorFont>
      <a:minorFont><a:latin typeface="${theme.font}"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>
  </a:themeElements>
</a:theme>`);

  // 6. SlideMaster & SlideLayout
  addXml('ppt/slideMasters/_rels/slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

  addXml('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`);

  addXml('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

  addXml('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`);

  // 7. Individual slides with SmartArt card styling
  slides.forEach((slide, idx) => {
    const slideNum = idx + 1;
    addXml(`ppt/slides/_rels/slide${slideNum}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);

    const isTitleSlide = slide.layout === 'title' || idx === 0;
    const isQuoteSlide = slide.layout === 'quote';

    let shapesXml: string;

    if (isTitleSlide) {
      // Gamma / Keynote Style Title Deck
      shapesXml = `
      <!-- Accent Category Pill Badge -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Badge"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="1600000"/><a:ext cx="2600000" cy="420000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 25000"/></a:avLst></a:prstGeom>
          <a:solidFill><a:srgbClr val="${theme.badgeBg}"/></a:solidFill>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="1300" b="1">
                <a:solidFill><a:srgbClr val="${theme.badgeColor}"/></a:solidFill>
              </a:rPr>
              <a:t>AYATRISYA DECK</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Main Deck Headline -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="DeckTitle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="2200000"/><a:ext cx="10200000" cy="1800000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="t"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="4400" b="1">
                <a:solidFill><a:srgbClr val="${theme.titleColor}"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(slide.title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Subtitle Body Tagline -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Subtitle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="4200000"/><a:ext cx="10200000" cy="1400000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="2000">
                <a:solidFill><a:srgbClr val="${theme.bodyColor}"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(slide.body)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;
    } else if (isQuoteSlide) {
      // Big Callout Quote Layout
      shapesXml = `
      <!-- Accent Top Border -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="AccentLine"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="1000000" cy="60000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="${theme.accent}"/></a:solidFill>
        </p:spPr>
      </p:sp>

      <!-- Section Title -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="QuoteTitle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="1200000"/><a:ext cx="10200000" cy="800000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="2800" b="1">
                <a:solidFill><a:srgbClr val="${theme.titleColor}"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(slide.title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Card container for Quote -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="QuoteCard"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="2200000"/><a:ext cx="10200000" cy="3600000"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 15000"/></a:avLst></a:prstGeom>
          <a:solidFill><a:srgbClr val="${theme.cardBg}"/></a:solidFill>
          <a:ln w="19050"><a:solidFill><a:srgbClr val="${theme.cardBorder}"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US" sz="2600" i="1" b="1">
                <a:solidFill><a:srgbClr val="${theme.titleColor}"/></a:solidFill>
              </a:rPr>
              <a:t>“${escapeXml(slide.body.replace(/^"|"$/g, ''))}”</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;
    } else {
      // SmartArt Multi-Card Layout
      const rawPoints = slide.body
        .split('\n')
        .map((p) => p.replace(/^[•\-*]\s*/, '').trim())
        .filter(Boolean);

      const points = rawPoints.length > 0 ? rawPoints : ['Key insight and structured analysis.'];
      const cardCount = Math.min(points.length, 3);
      const totalWidth = 10200000;
      const gap = 300000;
      const cardWidth = Math.floor((totalWidth - (cardCount - 1) * gap) / cardCount);

      const cardsXml = points.slice(0, cardCount).map((pt, pIdx) => {
        const xPos = 1000000 + pIdx * (cardWidth + gap);
        return `
        <!-- SmartArt Item Card ${pIdx + 1} -->
        <p:sp>
          <p:nvSpPr><p:cNvPr id="${10 + pIdx}" name="Card_${pIdx + 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
          <p:spPr>
            <a:xfrm><a:off x="${xPos}" y="2400000"/><a:ext cx="${cardWidth}" cy="3400000"/></a:xfrm>
            <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 15000"/></a:avLst></a:prstGeom>
            <a:solidFill><a:srgbClr val="${theme.cardBg}"/></a:solidFill>
            <a:ln w="19050"><a:solidFill><a:srgbClr val="${theme.cardBorder}"/></a:solidFill></a:ln>
          </p:spPr>
          <p:txBody>
            <a:bodyPr anchor="t"/>
            <a:lstStyle/>
            <a:p>
              <a:r>
                <a:rPr lang="en-US" sz="1400" b="1">
                  <a:solidFill><a:srgbClr val="${theme.accent}"/></a:solidFill>
                </a:rPr>
                <a:t>POINT 0${pIdx + 1}</a:t>
              </a:r>
            </a:p>
            <a:p>
              <a:pPr><a:spcBfr><a:spcPts val="1200"/></a:spcBfr></a:pPr>
              <a:r>
                <a:rPr lang="en-US" sz="1800">
                  <a:solidFill><a:srgbClr val="${theme.titleColor}"/></a:solidFill>
                </a:rPr>
                <a:t>${escapeXml(pt)}</a:t>
              </a:r>
            </a:p>
          </p:txBody>
        </p:sp>`;
      }).join('\n');

      shapesXml = `
      <!-- Slide Category Accent -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="AccentLine"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="800000"/><a:ext cx="800000" cy="50000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="${theme.accent}"/></a:solidFill>
        </p:spPr>
      </p:sp>

      <!-- Slide Title Headline -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="10200000" cy="1100000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="3000" b="1">
                <a:solidFill><a:srgbClr val="${theme.titleColor}"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(slide.title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      ${cardsXml}`;
    }

    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill>
          <a:srgbClr val="${theme.bg}"/>
        </a:solidFill>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      
      ${shapesXml}

      <!-- Ayatrisya Professional Deck Footer -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="99" name="Footer"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="6200000"/><a:ext cx="10200000" cy="300000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1000">
                <a:solidFill><a:srgbClr val="64748B"/></a:solidFill>
              </a:rPr>
              <a:t>Ayatrisya Presentation Engine • Slide ${slideNum} of ${slides.length}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

    </p:spTree>
  </p:cSld>
</p:sld>`;

    addXml(`ppt/slides/slide${slideNum}.xml`, slideXml);
  });

  return createZip(entries);
}

/**
 * Downloads a generated PPTX presentation file in the user's browser.
 */
export function downloadPptx(
  title: string,
  slides: Slide[],
  filename?: string,
  options: { theme?: PresentationTheme } = {}
) {
  const bytes = generatePptx(title, slides, options);
  const fname = filename ?? (title.trim() ? `${title.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-')}.pptx` : 'presentation.pptx');
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  downloadBlob(blob, fname.endsWith('.pptx') ? fname : `${fname}.pptx`);
}
