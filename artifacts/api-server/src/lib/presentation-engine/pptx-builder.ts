import { SimpleZip } from "./zip-writer";
import type { PresentationDeck, PresentationSlide } from "./types";
import { getTheme } from "./theme-system";

/**
 * Escapes special XML characters.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Builds a standards-compliant OpenXML PowerPoint (.pptx) file
 * with widescreen 16:9 layout, slide master, slide layouts, theme colors, cards, bullets, and speaker notes.
 */
export function buildPptxBuffer(deck: PresentationDeck): Buffer {
  const zip = new SimpleZip();
  const theme = getTheme(deck.theme);
  const slideCount = deck.slides.length;

  // 1. [Content_Types].xml
  let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`;

  for (let i = 1; i <= slideCount; i++) {
    contentTypesXml += `\n  <Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    contentTypesXml += `\n  <Override PartName="/ppt/notesSlides/notesSlide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`;
  }
  contentTypesXml += `\n</Types>`;
  zip.addFile("[Content_Types].xml", contentTypesXml);

  // 2. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
  zip.addFile("_rels/.rels", rootRelsXml);

  // 3. docProps/core.xml
  const corePropsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(deck.title)}</dc:title>
  <dc:creator>Ayatrisya Presentation Engine</dc:creator>
  <cp:lastModifiedBy>Ayatrisya AI</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${deck.createdAt}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${deck.updatedAt}</dcterms:modified>
</cp:coreProperties>`;
  zip.addFile("docProps/core.xml", corePropsXml);

  // 4. docProps/app.xml
  const appPropsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Ayatrisya Presentation Intelligence</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${slideCount}</Slides>
  <Company>Ayatrisya AI</Company>
</Properties>`;
  zip.addFile("docProps/app.xml", appPropsXml);

  // 5. ppt/theme/theme1.xml
  const themeXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${escapeXml(theme.name)}">
  <a:themeElements>
    <a:clrScheme name="${escapeXml(theme.id)}">
      <a:dk1><a:srgbClr val="${theme.isDark ? theme.background : theme.textPrimary}"/></a:dk1>
      <a:lt1><a:srgbClr val="${theme.isDark ? theme.textPrimary : theme.background}"/></a:lt1>
      <a:dk2><a:srgbClr val="${theme.surface}"/></a:dk2>
      <a:lt2><a:srgbClr val="${theme.surface}"/></a:lt2>
      <a:accent1><a:srgbClr val="${theme.accent}"/></a:accent1>
      <a:accent2><a:srgbClr val="${theme.highlight}"/></a:accent2>
      <a:accent3><a:srgbClr val="${theme.textSecondary}"/></a:accent3>
      <a:accent4><a:srgbClr val="38BDF8"/></a:accent4>
      <a:accent5><a:srgbClr val="F59E0B"/></a:accent5>
      <a:accent6><a:srgbClr val="EC4899"/></a:accent6>
      <a:hlink><a:srgbClr val="${theme.highlight}"/></a:hlink>
      <a:folHlink><a:srgbClr val="${theme.accent}"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Modern">
      <a:majorFont><a:latin typeface="${escapeXml(theme.headerFont)}"/></a:majorFont>
      <a:minorFont><a:latin typeface="${escapeXml(theme.bodyFont)}"/></a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>`;
  zip.addFile("ppt/theme/theme1.xml", themeXml);

  // 6. ppt/slideMasters/slideMaster1.xml & relationships
  const slideMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="${theme.background}"/></a:solidFill>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>
      </p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rIdLayout1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;
  zip.addFile("ppt/slideMasters/slideMaster1.xml", slideMasterXml);

  const slideMasterRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdTheme1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
  zip.addFile("ppt/slideMasters/_rels/slideMaster1.xml.rels", slideMasterRelsXml);

  // 7. ppt/slideLayouts/slideLayout1.xml & relationships
  const slideLayoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>
      </p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
  zip.addFile("ppt/slideLayouts/slideLayout1.xml", slideLayoutXml);

  const slideLayoutRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdMaster1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
  zip.addFile("ppt/slideLayouts/_rels/slideLayout1.xml.rels", slideLayoutRelsXml);

  // 8. ppt/presentation.xml (16:9 widescreen = 12192000 x 6858000 EMU)
  let presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rIdMaster1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>`;

  for (let i = 1; i <= slideCount; i++) {
    presentationXml += `\n    <p:sldId id="${255 + i}" r:id="rIdSlide${i}"/>`;
  }

  presentationXml += `\n  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="12192000"/>
</p:presentation>`;
  zip.addFile("ppt/presentation.xml", presentationXml);

  // 9. ppt/_rels/presentation.xml.rels
  let presRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdTheme1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  <Relationship Id="rIdMaster1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`;

  for (let i = 1; i <= slideCount; i++) {
    presRelsXml += `\n  <Relationship Id="rIdSlide${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
  }
  presRelsXml += `\n</Relationships>`;
  zip.addFile("ppt/_rels/presentation.xml.rels", presRelsXml);

  // 10. Generate each slide and notesSlide
  deck.slides.forEach((slide, idx) => {
    const slideNum = idx + 1;
    const slideXml = generateSlideXml(slide, theme);
    zip.addFile(`ppt/slides/slide${slideNum}.xml`, slideXml);

    const slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLayout1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rIdNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${slideNum}.xml"/>
</Relationships>`;
    zip.addFile(`ppt/slides/_rels/slide${slideNum}.xml.rels`, slideRelsXml);

    const notesXml = generateNotesSlideXml(slide, slideNum, theme);
    zip.addFile(`ppt/notesSlides/notesSlide${slideNum}.xml`, notesXml);

    const notesRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdSlide" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${slideNum}.xml"/>
</Relationships>`;
    zip.addFile(`ppt/notesSlides/_rels/notesSlide${slideNum}.xml.rels`, notesRelsXml);
  });

  return zip.generate();
}

/**
 * Builds slide OpenXML drawing shapes, texts, cards, and styling.
 */
function generateSlideXml(slide: PresentationSlide, theme: ReturnType<typeof getTheme>): string {
  const isTitleSlide = slide.archetype === "title";

  let bodyContentXml = "";

  if (isTitleSlide) {
    // Title Slide Layout
    bodyContentXml = `
      <!-- Subtitle badge -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Subtitle Badge"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="1000000" y="2000000"/>
            <a:ext cx="10192000" cy="500000"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr sz="1800" b="1">
                <a:solidFill><a:srgbClr val="${theme.accent}"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(slide.subtitle || "EXECUTIVE OVERVIEW")}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Main Title -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Deck Title"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="1000000" y="2600000"/>
            <a:ext cx="10192000" cy="1800000"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="top"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr sz="4400" b="1">
                <a:solidFill><a:srgbClr val="${theme.textPrimary}"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(slide.title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Editorial Summary -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="4" name="Editorial Summary"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="1000000" y="4600000"/>
            <a:ext cx="9000000" cy="1200000"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="top"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr sz="1600">
                <a:solidFill><a:srgbClr val="${theme.textSecondary}"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(slide.editorialContent || "")}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    `;
  } else {
    // Content Slide Layout
    // 1. Header (Category & Title)
    bodyContentXml = `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Slide Header"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="800000" y="600000"/>
            <a:ext cx="10592000" cy="1100000"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="top"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr sz="1300" b="1">
                <a:solidFill><a:srgbClr val="${theme.accent}"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml((slide.subtitle || "SECTION").toUpperCase())}</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:rPr sz="3000" b="1">
                <a:solidFill><a:srgbClr val="${theme.textPrimary}"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(slide.title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    `;

    // 2. Archetype-specific content shapes
    if (slide.archetype === "kpi_metrics" && slide.metrics && slide.metrics.length > 0) {
      const cardWidth = 2400000;
      const cardGap = 260000;
      slide.metrics.slice(0, 4).forEach((metric, mIdx) => {
        const xPos = 800000 + mIdx * (cardWidth + cardGap);
        bodyContentXml += `
          <!-- Metric Card ${mIdx + 1} -->
          <p:sp>
            <p:nvSpPr>
              <p:cNvPr id="${10 + mIdx}" name="Card Background ${mIdx + 1}"/>
              <p:cNvSpPr/>
              <p:nvPr/>
            </p:nvSpPr>
            <p:spPr>
              <a:xfrm>
                <a:off x="${xPos}" y="2000000"/>
                <a:ext cx="${cardWidth}" cy="3600000"/>
              </a:xfrm>
              <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
              <a:solidFill><a:srgbClr val="${theme.surface}"/></a:solidFill>
            </p:spPr>
            <p:txBody>
              <a:bodyPr anchor="ctr"/>
              <a:lstStyle/>
              <a:p>
                <a:pPr algn="ctr"/>
                <a:r>
                  <a:rPr sz="3800" b="1">
                    <a:solidFill><a:srgbClr val="${theme.highlight}"/></a:solidFill>
                  </a:rPr>
                  <a:t>${escapeXml(metric.value)}</a:t>
                </a:r>
              </a:p>
              <a:p>
                <a:pPr algn="ctr"/>
                <a:r>
                  <a:rPr sz="1500" b="1">
                    <a:solidFill><a:srgbClr val="${theme.textPrimary}"/></a:solidFill>
                  </a:rPr>
                  <a:t>${escapeXml(metric.label)}</a:t>
                </a:r>
              </a:p>
              ${metric.delta ? `
              <a:p>
                <a:pPr algn="ctr"/>
                <a:r>
                  <a:rPr sz="1200">
                    <a:solidFill><a:srgbClr val="${theme.accent}"/></a:solidFill>
                  </a:rPr>
                  <a:t>${escapeXml(metric.delta)}</a:t>
                </a:r>
              </a:p>` : ""}
            </p:txBody>
          </p:sp>
        `;
      });
    } else if (slide.archetype === "split_columns" && slide.columns && slide.columns.length > 0) {
      const colWidth = 3200000;
      const colGap = 400000;
      slide.columns.slice(0, 3).forEach((col, cIdx) => {
        const xPos = 800000 + cIdx * (colWidth + colGap);
        bodyContentXml += `
          <!-- Column Card ${cIdx + 1} -->
          <p:sp>
            <p:nvSpPr>
              <p:cNvPr id="${20 + cIdx}" name="Column ${cIdx + 1}"/>
              <p:cNvSpPr/>
              <p:nvPr/>
            </p:nvSpPr>
            <p:spPr>
              <a:xfrm>
                <a:off x="${xPos}" y="2000000"/>
                <a:ext cx="${colWidth}" cy="3800000"/>
              </a:xfrm>
              <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
              <a:solidFill><a:srgbClr val="${theme.surface}"/></a:solidFill>
            </p:spPr>
            <p:txBody>
              <a:bodyPr anchor="top" lIns="200000" rIns="200000" tIns="200000"/>
              <a:lstStyle/>
              <a:p>
                <a:r>
                  <a:rPr sz="2000" b="1">
                    <a:solidFill><a:srgbClr val="${theme.accent}"/></a:solidFill>
                  </a:rPr>
                  <a:t>${escapeXml(col.title)}</a:t>
                </a:r>
              </a:p>
              <a:p>
                <a:r>
                  <a:rPr sz="1300">
                    <a:solidFill><a:srgbClr val="${theme.textSecondary}"/></a:solidFill>
                  </a:rPr>
                  <a:t>${escapeXml(col.content)}</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        `;
      });
    } else {
      // Default Editorial Content & Bullets Layout (strictly max 4 bullets)
      bodyContentXml += `
        <!-- Main Content Area -->
        <p:sp>
          <p:nvSpPr>
            <p:cNvPr id="5" name="Content Prose"/>
            <p:cNvSpPr/>
            <p:nvPr/>
          </p:nvSpPr>
          <p:spPr>
            <a:xfrm>
              <a:off x="800000" y="2000000"/>
              <a:ext cx="10592000" cy="1100000"/>
            </a:xfrm>
            <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          </p:spPr>
          <p:txBody>
            <a:bodyPr anchor="top"/>
            <a:lstStyle/>
            <a:p>
              <a:r>
                <a:rPr sz="1600">
                  <a:solidFill><a:srgbClr val="${theme.textSecondary}"/></a:solidFill>
                </a:rPr>
                <a:t>${escapeXml(slide.editorialContent || "")}</a:t>
              </a:r>
            </a:p>
          </p:txBody>
        </p:sp>
      `;

      if (slide.bullets && slide.bullets.length > 0) {
        bodyContentXml += `
          <!-- Bullets Box (Card style) -->
          <p:sp>
            <p:nvSpPr>
              <p:cNvPr id="6" name="Bullets Box"/>
              <p:cNvSpPr/>
              <p:nvPr/>
            </p:nvSpPr>
            <p:spPr>
              <a:xfrm>
                <a:off x="800000" y="3200000"/>
                <a:ext cx="10592000" cy="2800000"/>
              </a:xfrm>
              <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
              <a:solidFill><a:srgbClr val="${theme.surface}"/></a:solidFill>
            </p:spPr>
            <p:txBody>
              <a:bodyPr anchor="top" lIns="300000" rIns="300000" tIns="250000"/>
              <a:lstStyle/>
              ${slide.bullets.slice(0, 4).map((b) => `
              <a:p>
                <a:pPr lvl="0" marL="285750" indent="-285750">
                  <a:buChar char="•"/>
                </a:pPr>
                <a:r>
                  <a:rPr sz="1500" b="1">
                    <a:solidFill><a:srgbClr val="${theme.textPrimary}"/></a:solidFill>
                  </a:rPr>
                  <a:t>${escapeXml(b)}</a:t>
                </a:r>
              </a:p>`).join("")}
            </p:txBody>
          </p:sp>
        `;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="${theme.background}"/></a:solidFill>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${bodyContentXml}
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

/**
 * Builds speaker notes OpenXML slide representation.
 */
function generateNotesSlideXml(slide: PresentationSlide, slideNum: number, theme: ReturnType<typeof getTheme>): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <!-- Notes Text Box -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Notes Text"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="685800" y="4572000"/>
            <a:ext cx="5486400" cy="4572000"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="top"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr sz="1400">
                <a:solidFill><a:srgbClr val="000000"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(slide.speakerNotes || "No speaker notes recorded for this slide.")}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`;
}
