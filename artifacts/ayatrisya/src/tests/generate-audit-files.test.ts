import { describe, it } from 'vitest';
import { generatePdfDocument } from '@/lib/pdf-export';
import { generatePptx } from '@/lib/pptx-export';
import fs from 'node:fs';
import path from 'node:path';

describe('Generate Real Files for Inspection', () => {
  it('writes real test PDF and PPTX files to disk', () => {
    // 1. Generate multi-page PDF with headings, paragraphs, long text, Unicode, page numbers
    const multiPageContent = `1. Introduction & Executive Summary
Ayatrisya is an autonomous intelligence workspace operating with local-first privacy, zero paid API requirements, and open standards.

2. Comprehensive Analysis & Findings
During Phase 5 validation, we evaluate the real-world fidelity of client-side vector document generation.
This text is designed to span multiple lines and pages to test wrapping, pagination, header rules, and footer metadata.
Special Unicode characters: © 2026 Ayatrisya • En-dash – Em-dash — Bullet • Math ≈ ≠ ± • Greek α β γ • Symbols ★ ⚡ 🚀.

3. Detailed Technical Architecture
The document engine produces conforming PDF-1.4 documents directly from the user's browser without requiring cloud services or external servers.
All stream commands specify explicit transformation matrices (Tm), text leading (TL), and font selectors (/F1, /F2).
` + Array.from({ length: 90 }, (_, i) => `Section 4.${i + 1}: Paragraph content detailing system specification entry ${i + 1} with extended commentary to evaluate line-height, margin boundaries, and page breaking logic.`).join('\n\n');

    const pdfBytes = generatePdfDocument(multiPageContent, {
      title: 'Ayatrisya System Specification & Architectural Audit',
      author: 'Ayatrisya QA Suite',
      subject: 'Phase 5 Real-World Document Validation',
    });

    const outDir = path.resolve(process.cwd(), '../../generated-artifacts');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const pdfPath = path.join(outDir, 'audit_validation_doc.pdf');
    fs.writeFileSync(pdfPath, pdfBytes);

    // 2. Generate a 5-slide presentation with diverse layouts
    const slides = [
      { id: '1', title: 'Ayatrisya Cloud Upgrade', body: 'Phase 5: Creation, Canvas & Multimodal Engines\nVerified with Zero Paid Subscriptions', layout: 'title' as const },
      { id: '2', title: 'Core Architectural Pillars', body: '• 100% Free & Open Source Foundations\n• Local-first IndexedDB User Privacy\n• No Silent Fallbacks or Simulated Generations\n• Explicit User Attribution & Consent', layout: 'bullets' as const },
      { id: '3', title: 'Engineering Philosophy', body: '"Simplicity, transparency, and absolute user sovereignty over their models and data."', layout: 'quote' as const },
      { id: '4', title: 'Multimodal Generation Suite', body: '• Vector PDF-1.4 Document Synthesis\n• Microsoft PowerPoint (.pptx) Deck Engine\n• 16-bit 44.1kHz Procedural Audio Synthesizer\n• Procedural glTF 2.0 Binary Mesh Engine\n• Syntax-Aware Multi-Tab Code Canvas', layout: 'bullets' as const },
      { id: '5', title: 'Conclusion & Next Steps', body: 'Rigorous multi-layer verification complete.\nReady for deployment evaluation and Phase 6 governance.', layout: 'bullets' as const },
    ];

    const pptxBytes = generatePptx('Ayatrisya Executive Presentation', slides);
    const pptxPath = path.join(outDir, 'audit_validation_deck.pptx');
    fs.writeFileSync(pptxPath, pptxBytes);
  });
});

