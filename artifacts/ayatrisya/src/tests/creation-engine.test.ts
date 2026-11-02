import { describe, it, expect } from 'vitest';
import { generatePdfDocument } from '@/lib/pdf-export';
import { generatePptx } from '@/lib/pptx-export';
import { CREATION_CAPABILITIES, listCreationCapabilities, isCapabilityAvailable } from '@/ai/creation-engine';

describe('Phase 5 Multimodal & Creation Engines', () => {
  describe('Document & PDF Engine', () => {
    it('generates a valid conforming PDF document with headers, pages, and cross-reference table', () => {
      const content = 'This is a test paragraph inside Ayatrisya.\nIt contains multiple lines.\nExport test content.';
      const pdfBytes = generatePdfDocument(content, {
        title: 'Ayatrisya Test Document',
        author: 'Ayatrisya Suite',
      });

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(200);

      const raw = new TextDecoder().decode(pdfBytes);
      // Valid PDF signature
      expect(raw.startsWith('%PDF-1.4')).toBe(true);
      // Catalog and Pages dictionary
      expect(raw).toContain('/Type /Catalog');
      expect(raw).toContain('/Type /Pages');
      expect(raw).toContain('/Type /Page');
      // Contains title
      expect(raw).toContain('Ayatrisya Test Document');
      // Cross-reference table and EOF
      expect(raw).toContain('xref');
      expect(raw).toContain('trailer');
      expect(raw).toContain('%%EOF');
    });

    it('handles multi-page pagination for lengthy documents without errors', () => {
      const longContent = Array.from({ length: 150 }, (_, i) => `Paragraph line ${i + 1} with some descriptive sentences to fill up content.`).join('\n');
      const pdfBytes = generatePdfDocument(longContent, {
        title: 'Multi-page Test',
      });

      const raw = new TextDecoder().decode(pdfBytes);
      expect(raw).toContain('/Count');
      expect(raw).toContain('Page 1 of');
      expect(raw).toContain('Page 2 of');
    });
  });

  describe('Presentation Engine (PPTX Export)', () => {
    it('assembles a genuine Office OpenXML .pptx archive with standard PK zip container and slides', () => {
      const slides = [
        { id: '1', title: 'Welcome to Ayatrisya', body: 'The autonomous AI agent studio', layout: 'title' as const },
        { id: '2', title: 'Key Features', body: '• Zero Paid APIs\n• In-browser Privacy\n• Open Standards', layout: 'bullets' as const },
      ];

      const pptxBytes = generatePptx('Ayatrisya Pitch Deck', slides);

      expect(pptxBytes).toBeInstanceOf(Uint8Array);
      expect(pptxBytes.length).toBeGreaterThan(500);

      // Verify ZIP container magic header: 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
      expect(pptxBytes[0]).toBe(0x50);
      expect(pptxBytes[1]).toBe(0x4B);
      expect(pptxBytes[2]).toBe(0x03);
      expect(pptxBytes[3]).toBe(0x04);

      const rawZip = new TextDecoder('latin1').decode(pptxBytes);
      // Must contain presentation XML entries
      expect(rawZip).toContain('[Content_Types].xml');
      expect(rawZip).toContain('ppt/presentation.xml');
      expect(rawZip).toContain('ppt/slides/slide1.xml');
      expect(rawZip).toContain('ppt/slides/slide2.xml');
      expect(rawZip).toContain('Ayatrisya Pitch Deck');
      expect(rawZip).toContain('The autonomous AI agent studio');
    });
  });

  describe('Capability Registry & Operational Honesty', () => {
    it('correctly registers all creation domains and reports honest availability', () => {
      const caps = listCreationCapabilities();
      expect(caps.length).toBe(7);

      expect(isCapabilityAvailable('document')).toBe(true);
      expect(isCapabilityAvailable('presentation')).toBe(true);
      expect(isCapabilityAvailable('music')).toBe(true);
      expect(isCapabilityAvailable('code')).toBe(true);
      expect(isCapabilityAvailable('image')).toBe(true);

      // Desktop-only capabilities are strictly false in Cloud/Web
      expect(isCapabilityAvailable('model3d')).toBe(false);
      expect(isCapabilityAvailable('video')).toBe(false);
      expect(CREATION_CAPABILITIES.model3d.provider).toBe('unsupported');
      expect(CREATION_CAPABILITIES.video.provider).toBe('unsupported');
    });
  });
});

