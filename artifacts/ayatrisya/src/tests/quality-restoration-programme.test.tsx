import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseMarkdownToAst } from '@/lib/document-engine/parser';
import { DocumentViewer } from '@/lib/document-engine/DocumentViewer';
import { generatePdfDocument } from '@/lib/pdf-export';
import { buildDocxArchive } from '@/lib/docx-export';
import {
  generatePptx,
  type Slide,
  type SlideLayout,
} from '@/lib/pptx-export';
import { regenerateSlide } from '@/ai/presentation-generator';
import { modelClient } from '@/ai/client';
import { parseSlides, slidesToJson } from '@/components/ItemEditors';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { CanvasProvider } from '@/components/canvas/CanvasContext';
import {
  normalizeMarkdown,
  stabilizeStreamingMarkdown,
  isSafeUrl,
} from '@/components/markdown/markdown-normalizer';

describe('AYATRISYA — COMPLETE QUALITY RESTORATION PROGRAMME', () => {
  describe('PART B & C: Unified Document Engine & AST Representation', () => {
    const sampleMarkdown = `# Strategic Application Audit Report
A comprehensive multi-section quality evaluation.

> [!NOTE]
> Executive sign-off required before staging release.

## System Architecture
This section details the unified client-side AST architecture.

| Component | Target Metric | Verified Status |
|---|---|---|
| Document AST | Zero Data Loss | Passed |
| Vector PDF | True Vector Text | Passed |
| OpenXML DOCX | Tables & Footers | Passed |
| 12-Layout PPTX | Full PresentationML | Passed |

### Key Execution Highlights
- Zero-dependency client-side ZIP packaging
- [x] Heading hierarchy preservation
- [x] Automatic Table of Contents extraction
- [ ] Staging cluster rollout

\`\`\`typescript
const ast = parseMarkdownToAst(markdown);
console.log('Parsed nodes:', ast.nodes.length);
\`\`\`

> "Architecture is the decisions that you wish you could get right early in a project." -- Ralph Johnson

---

## Conclusion & Recommendations
The system satisfies all quality and reliability criteria.
`;

    it('parses markdown into a structured, validated Document AST', () => {
      const ast = parseMarkdownToAst(sampleMarkdown, { fallbackTitle: 'Audit Report' });

      expect(ast.version).toBe(2);
      expect(ast.title).toBe('Strategic Application Audit Report');
      expect(ast.subtitle).toBe('A comprehensive multi-section quality evaluation.');
      expect(ast.includeToc).toBe(true);
      expect(ast.tocEntries.length).toBeGreaterThanOrEqual(2);
      expect(ast.tocEntries[0].text).toBe('System Architecture');

      // Verify node types
      const types = ast.nodes.map((n) => n.type);
      expect(types).toContain('callout');
      expect(types).toContain('heading');
      expect(types).toContain('paragraph');
      expect(types).toContain('table');
      expect(types).toContain('list');
      expect(types).toContain('code');
      expect(types).toContain('blockquote');
      expect(types).toContain('pageBreak');

      // Table validation
      const tableNode = ast.nodes.find((n) => n.type === 'table') as any;
      expect(tableNode).toBeDefined();
      expect(tableNode.headers).toEqual(['Component', 'Target Metric', 'Verified Status']);
      expect(tableNode.rows.length).toBe(4);
      expect(tableNode.rows[0][0]).toBe('Document AST');

      // Callout validation
      const calloutNode = ast.nodes.find((n) => n.type === 'callout') as any;
      expect(calloutNode).toBeDefined();
      expect(calloutNode.variant).toBe('note');
      expect(calloutNode.text).toContain('Executive sign-off');

      // List validation with checkbox
      const listNode = ast.nodes.find((n) => n.type === 'list') as any;
      expect(listNode).toBeDefined();
      expect(listNode.items.length).toBe(4);
      expect(listNode.items[1].checked).toBe(true);
    });

    it('renders Document AST cleanly in DocumentViewer without errors', () => {
      const ast = parseMarkdownToAst(sampleMarkdown);
      const html = renderToStaticMarkup(<DocumentViewer ast={ast} />);

      expect(html).toContain('data-testid="document-ast-viewer"');
      expect(html).toContain('data-testid="document-toc"');
      expect(html).toContain('Strategic Application Audit Report');
      expect(html).toContain('System Architecture');
      expect(html).toContain('Zero-dependency client-side ZIP packaging');
      expect(html).toContain('Table of Contents');
    });
  });

  describe('PART E: PDF and Export Parity', () => {
    it('generates a conforming PDF-1.4 binary document with headers and pagination', () => {
      const markdown = `# Architecture Document\n\nExecutive overview.\n\n## Section 1\nDetailed content for testing.\n\n| Item | Value |\n|---|---|\n| Latency | <10ms |\n\n- Point A\n- Point B\n`;
      const bytes = generatePdfDocument(markdown, { title: 'Architecture Document' });

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(500);

      const header = new TextDecoder().decode(bytes.slice(0, 8));
      expect(header).toContain('%PDF-1.4');

      const fullString = new TextDecoder().decode(bytes);
      expect(fullString).toContain('/Type /Catalog');
      expect(fullString).toContain('/Type /Pages');
      expect(fullString).toContain('/Type /Font');
      expect(fullString).toContain('xref');
      expect(fullString).toContain('trailer');
      expect(fullString).toContain('%%EOF');
      expect(fullString).toContain('Architecture Document');
      expect(fullString).toContain('Page 1 of');
    });

    it('generates a valid OpenXML (.docx) Word archive with tables and page numbers', () => {
      const markdown = `# Enterprise Strategy\n\nExecutive Summary.\n\n## Deliverables\n\n| Track | Deliverable |\n|---|---|\n| Track 1 | Core Model |\n| Track 2 | Mobile Shell |\n\n- Task 1\n- Task 2\n\n> [!NOTE]\n> Critical release path\n`;
      const docxBytes = buildDocxArchive('Enterprise Strategy', markdown);

      expect(docxBytes).toBeInstanceOf(Uint8Array);
      expect(docxBytes.length).toBeGreaterThan(1000);

      // Verify ZIP magic header PK\x03\x04
      expect(docxBytes[0]).toBe(0x50);
      expect(docxBytes[1]).toBe(0x4b);
      expect(docxBytes[2]).toBe(0x03);
      expect(docxBytes[3]).toBe(0x04);

      const docxString = new TextDecoder().decode(docxBytes);
      expect(docxString).toContain('word/document.xml');
      expect(docxString).toContain('word/footer1.xml');
      expect(docxString).toContain('[Content_Types].xml');
      expect(docxString).toContain('_rels/.rels');
      expect(docxString).toContain('Enterprise Strategy');
      expect(docxString).toContain('w:tbl');
      expect(docxString).toContain('w:fldSimple w:instr="PAGE"');
      expect(docxString).toContain('w:fldSimple w:instr="NUMPAGES"');
    });
  });

  describe('PART D: PowerPoint Generation Engine (12 Distinct Layouts)', () => {
    const all12LayoutSlides: Slide[] = [
      {
        id: 's1',
        title: 'Enterprise Technical Vision',
        body: '2026-2027 Strategic Architecture Overview',
        layout: 'title',
        category: 'KEYNOTE DECK',
      },
      {
        id: 's2',
        title: 'Core Architectural Challenge',
        body: 'Legacy developer tooling suffers from fragmented silos and unpredictable response latency.',
        layout: 'section-header',
        category: 'PROBLEM DEFINITION',
      },
      {
        id: 's3',
        title: 'Architectural Comparison',
        body: 'Conventional distributed cloud with high roundtrip latency\nAyatrisya decoupled client-side vector compiler with zero roundtrips',
        layout: 'two-column',
        columns: {
          leftTitle: 'Conventional Architecture',
          leftBody: 'Remote containers with 400ms roundtrips',
          rightTitle: 'Ayatrisya Kernel',
          rightBody: 'Zero-latency edge AST execution with full data privacy',
        },
      },
      {
        id: 's4',
        title: 'Quantitative Performance Metrics',
        body: 'Observed production telemetries',
        layout: 'metrics',
        metrics: [
          { value: '99.98%', label: 'Uptime', trend: '+4.2% YoY' },
          { value: '<12ms', label: 'AST Parse Time', trend: 'Sub-second' },
          { value: '10x', label: 'Build Velocity', trend: 'Measured' },
        ],
      },
      {
        id: 's5',
        title: 'Strategic Delivery Roadmap',
        body: 'Three milestone sequence',
        layout: 'timeline',
        timeline: [
          { step: '01', title: 'Phase 1: Foundation', description: 'Domain model and AST parser' },
          { step: '02', title: 'Phase 2: Validation', description: 'Strict OpenXML format compatibility' },
          { step: '03', title: 'Phase 3: Rollout', description: 'Universal edge availability' },
        ],
      },
      {
        id: 's6',
        title: 'Compilation Pipeline Flow',
        body: 'Stepwise token transformation',
        layout: 'process',
        timeline: [
          { step: '01', title: 'Ingestion', description: 'Streaming tokens from model gateway' },
          { step: '02', title: 'Normalization', description: 'Auto-closing fences and unescaping math' },
          { step: '03', title: 'Serialization', description: 'Binary OpenXML package synthesis' },
        ],
      },
      {
        id: 's7',
        title: 'Capability Comparison',
        body: 'Standard Approach\nAyatrisya Standard',
        layout: 'comparison',
      },
      {
        id: 's8',
        title: 'System Component Specifications',
        body: 'Detailed matrix of modules',
        layout: 'table',
        table: {
          headers: ['Module', 'Standard', 'Status'],
          rows: [
            ['Document Engine', 'ISO/IEC 29500-1', 'Active'],
            ['Slide Compiler', 'ECMA-376 PresentationML', 'Active'],
            ['Mobile Layout', '15 Viewport Certified', 'Enforced'],
          ],
        },
      },
      {
        id: 's9',
        title: 'Visual Architecture Overview',
        body: 'Decoupled presentation compiler generating valid PresentationML packages in memory.',
        layout: 'image-focus',
      },
      {
        id: 's10',
        title: 'Key Operational Pillars',
        body: '• Resilient Document Intelligence\n• True OpenXML Presentation Generation\n• Universal Mobile Viewport Integrity',
        layout: 'card-grid',
      },
      {
        id: 's11',
        title: 'Executive Conclusion',
        body: 'All engineering objectives have been achieved with verified format parity and zero data loss.',
        layout: 'conclusion',
      },
      {
        id: 's12',
        title: 'References & Citations',
        body: '• ECMA-376 5th Edition: Office Open XML File Formats\n• ISO/IEC 29500: Document Description and Processing Languages',
        layout: 'references',
      },
    ];

    it('generates a valid OpenXML (.pptx) presentation containing all 12 distinct slide layouts', () => {
      const pptxBytes = generatePptx('Comprehensive 12-Layout Deck', all12LayoutSlides, {
        theme: 'dark-cinematic',
      });

      expect(pptxBytes).toBeInstanceOf(Uint8Array);
      expect(pptxBytes.length).toBeGreaterThan(2000);

      // Verify ZIP magic header PK\x03\x04
      expect(pptxBytes[0]).toBe(0x50);
      expect(pptxBytes[1]).toBe(0x4b);
      expect(pptxBytes[2]).toBe(0x03);
      expect(pptxBytes[3]).toBe(0x04);

      const pptxString = new TextDecoder().decode(pptxBytes);

      // Package structure validation
      expect(pptxString).toContain('[Content_Types].xml');
      expect(pptxString).toContain('_rels/.rels');
      expect(pptxString).toContain('ppt/presentation.xml');
      expect(pptxString).toContain('ppt/_rels/presentation.xml.rels');
      expect(pptxString).toContain('ppt/slideMasters/slideMaster1.xml');
      expect(pptxString).toContain('ppt/slideLayouts/slideLayout1.xml');
      expect(pptxString).toContain('ppt/theme/theme1.xml');

      // Slide files validation (12 slides)
      for (let i = 1; i <= 12; i++) {
        expect(pptxString).toContain(`ppt/slides/slide${i}.xml`);
      }

      // Check specific OpenXML structures
      expect(pptxString).toContain('Comprehensive 12-Layout Deck');
      expect(pptxString).toContain('Enterprise Technical Vision');
      expect(pptxString).toContain('a:tbl'); // Table shape
      expect(pptxString).toContain('99.98%'); // Metric
      expect(pptxString).toContain('Uptime');
      expect(pptxString).toContain('Phase 1: Foundation'); // Timeline
      expect(pptxString).toContain('Ayatrisya Presentation Engine • Slide'); // Running footer
    });

    it('parses, serializes and migrates slides without data loss', () => {
      const json = slidesToJson(all12LayoutSlides);
      const parsed = parseSlides(json);

      expect(parsed.length).toBe(12);
      expect(parsed[0].layout).toBe('title');
      expect(parsed[3].layout).toBe('metrics');
      expect(parsed[3].metrics?.[0].value).toBe('99.98%');
      expect(parsed[7].layout).toBe('table');
      expect(parsed[7].table?.headers).toContain('Module');
    });

    it('regenerates a single slide without affecting other slides', async () => {
      const targetSlide = all12LayoutSlides[3]; // metrics slide

      vi.spyOn(modelClient, 'generateResponse').mockResolvedValueOnce(
        JSON.stringify({
          title: 'Live Production Telemetry',
          body: 'Real-time telemetry stream across 12 availability zones',
          layout: 'metrics',
        })
      );

      const updated = await regenerateSlide(
        targetSlide,
        'Change title to Live Production Telemetry',
        'Comprehensive 12-Layout Deck'
      );

      expect(updated.id).toBe(targetSlide.id);
      expect(updated.title).toBe('Live Production Telemetry');
      expect(all12LayoutSlides[0].title).toBe('Enterprise Technical Vision'); // Other slides preserved
    });
  });

  describe('PART F: Unified Markdown Rendering Acceptance Suite', () => {
    it('renders bold, italic, code blocks, lists, and tables without raw syntax leakage', () => {
      const md = `
# Main Header
This is **strong text** and *italicized emphasis*.

Here is \`inlineCode()\` snippet.

\`\`\`typescript
const greeting = "Hello Ayatrisya";
\`\`\`

| Key | Value |
|---|---|
| Latency | Sub-15ms |

- Item 1
- Item 2
`;
      const html = renderToStaticMarkup(
        <CanvasProvider>
          <MarkdownRenderer content={md} />
        </CanvasProvider>
      );

      expect(html).toContain('<strong');
      expect(html).toContain('strong text');
      expect(html).toContain('<em');
      expect(html).toContain('italicized emphasis');
      expect(html).toContain('<code');
      expect(html).toContain('inlineCode()');
      expect(html).toContain('Hello Ayatrisya');
      expect(html).toContain('<table');
      expect(html).toContain('Sub-15ms');
      expect(html).not.toContain('**strong text**'); // No raw leaked asterisks
    });

    it('recovers from incomplete streaming delimiters gracefully', () => {
      const incomplete = 'Streaming in progress with **bold prefix';
      const stabilized = stabilizeStreamingMarkdown(incomplete);
      expect(stabilized).toBe('Streaming in progress with **bold prefix**');
    });

    it('blocks dangerous JavaScript and malformed URLs', () => {
      expect(isSafeUrl('https://ayatrisya.ai')).toBe(true);
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });
});
