import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownRenderer, normalizeMathInMarkdown } from '../components/MarkdownRenderer';
import { ArtifactBlockRenderer } from '../components/interactive-blocks/ArtifactBlockRenderer';
import { LocalRepository } from '../storage/repository';
import { IntelligentMemoryContextManager } from '../storage/intelligent-memory-context-manager';
import { MemoryEngine } from '../storage/memory-engine';

describe('Chance 2: Final Conversational Experience Suite', () => {
  describe('1. Typography, Markdown & Math Normalization', () => {
    it('normalizes bracketed math into valid LaTeX syntax without breaking code blocks', () => {
      const raw = 'The equation is \\[ E = mc^2 \\] and inline \\( a^2 + b^2 = c^2 \\) with code `\\[ not math \\]`.';
      const normalized = normalizeMathInMarkdown(raw);
      expect(normalized).toContain('$$\nE = mc^2\n$$');
      expect(normalized).toContain('$a^2 + b^2 = c^2$');
      expect(normalized).toContain('`\\[ not math \\]`');
    });

    it('renders rich markdown with headings, lists, and code blocks', () => {
      const markdown = `
# System Architecture
Here is the core pipeline:
- Step 1: Pre-process tokens
- Step 2: Stream inference

\`\`\`typescript
const status = "active";
console.log(status);
\`\`\`
      `;
      const html = renderToStaticMarkup(<MarkdownRenderer content={markdown} messageId="msg-1" />);
      expect(html).toContain('System Architecture');
      expect(html).toContain('Step 1: Pre-process tokens');
      expect(html).toContain('TYPESCRIPT');
      expect(html).toContain('data-testid="code-block"');
    });
  });

  describe('2. Artifact Previews (Website, Spreadsheet, Presentation, Document)', () => {
    it('renders website preview with sandboxed iframe and action controls', () => {
      const html = renderToStaticMarkup(
        <ArtifactBlockRenderer
          block={{
            type: 'artifact',
            artifactKind: 'website',
            title: 'Landing Page Prototype',
            content: '<div class="hero"><h1>Welcome to Ayatrisya</h1></div>',
          }}
        />
      );
      expect(html).toContain('Landing Page Prototype');
      expect(html).toContain('Website Preview');
      expect(html).toContain('iframe');
      expect(html).toContain('data-testid="artifact-website"');
    });

    it('renders spreadsheet preview with table rows and column headers', () => {
      const csvContent = 'Item,Price,Quantity\nMacBook Pro,$2499,3\nStudio Display,$1599,2';
      const html = renderToStaticMarkup(
        <ArtifactBlockRenderer
          block={{
            type: 'artifact',
            artifactKind: 'spreadsheet',
            title: 'Q4 Hardware Procurement',
            content: csvContent,
          }}
        />
      );
      expect(html).toContain('Q4 Hardware Procurement');
      expect(html).toContain('MacBook Pro');
      expect(html).toContain('Studio Display');
      expect(html).toContain('data-testid="artifact-spreadsheet"');
    });

    it('renders presentation deck preview with slide information', () => {
      const slidesJson = JSON.stringify({
        slides: [
          { title: 'Executive Summary', bullets: ['Record growth in Q3', 'New generative features launched'] },
          { title: 'Roadmap', bullets: ['Intelligent Memory 2.0', 'Universal Artifact Previews'] },
        ],
      });
      const html = renderToStaticMarkup(
        <ArtifactBlockRenderer
          block={{
            type: 'artifact',
            artifactKind: 'presentation',
            title: 'Investor Deck 2026',
            content: slidesJson,
          }}
        />
      );
      expect(html).toContain('Investor Deck 2026');
      expect(html).toContain('Deck (2 slides)');
      expect(html).toContain('Executive Summary');
      expect(html).toContain('data-testid="artifact-presentation"');
      expect(html).toContain('.PPTX');
      expect(html).toContain('.PDF');
    });

    it('renders presentation deck with SmartArt KPI cards and curated pictures', () => {
      const slidesWithSmartArtAndImage = JSON.stringify({
        slides: [
          {
            title: 'Q3 Financial Highlights',
            subtitle: 'Market Performance',
            content: 'Strong enterprise ARR acceleration driven by our agentic platform adoption.',
            bullets: ['Sub-35ms p99 response times', 'Zero reported security incidents'],
            smartArt: {
              type: 'kpi',
              items: [
                { label: 'Revenue Growth', value: '+340%', badge: 'Verified' },
                { label: 'Enterprise Customers', value: '1,200+' },
              ],
            },
            image: {
              url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
              caption: 'Executive Dashboard Analytics',
              source: 'Unsplash',
            },
            speakerNotes: 'Highlight the +340% YoY expansion during discussion.',
          },
        ],
      });
      const html = renderToStaticMarkup(
        <ArtifactBlockRenderer
          block={{
            type: 'artifact',
            artifactKind: 'presentation',
            title: 'Q3 Financial Deck',
            content: slidesWithSmartArtAndImage,
          }}
        />
      );
      expect(html).toContain('Q3 Financial Highlights');
      expect(html).toContain('+340%');
      expect(html).toContain('Revenue Growth');
      expect(html).toContain('Executive Dashboard Analytics');
      expect(html).toContain('Unsplash');
      expect(html).toContain('.PPTX');
      expect(html).toContain('.PDF');
    });

    it('renders structured document preview with markdown styling, SmartArt, and download actions', () => {
      const docMarkdown = '# Engineering Manifesto\n\nQuality and reliability are first-order metrics.\n\n![Global Topology](https://images.unsplash.com/photo-1451187580459-43490279c0fa)\n*Figure 1: Global network topology*';
      const html = renderToStaticMarkup(
        <ArtifactBlockRenderer
          block={{
            type: 'artifact',
            artifactKind: 'document',
            title: 'Engineering Manifesto',
            content: docMarkdown,
          }}
        />
      );
      expect(html).toContain('Engineering Manifesto');
      expect(html).toContain('Quality and reliability are first-order metrics.');
      expect(html).toContain('data-testid="artifact-document"');
      expect(html).toContain('.PDF');
      expect(html).toContain('.DOCX');
    });
  });

  describe('3. Intelligent Memory 2.0 Integration & Resilience', () => {
    it('manages write recovery queue on network/storage faults and flushes safely', async () => {
      const repo = new LocalRepository(`test-db-${Date.now()}-${Math.random()}`);
      repo.setOwner('user-recovery-test');
      const manager = new IntelligentMemoryContextManager(repo);

      // Mock localStorage for test environment
      const storage: Record<string, string> = {};
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => storage[k] || null,
        setItem: (k: string, v: string) => { storage[k] = v; },
        removeItem: (k: string) => { delete storage[k]; },
      });

      // Enqueue recovery items
      (manager as any).queueWriteRecovery({
        category: 'user_preference',
        content: 'User prefers Rust over Go for systems programming',
        tags: ['rust'],
      });

      // Flush queue
      const flushed = await manager.flushRecoveryQueue();
      expect(flushed).toBe(1);

      // Retrieve memories and verify stored
      const allMemories = await manager.retrieveAndRankMemories('Rust over Go');
      expect(allMemories.length).toBeGreaterThanOrEqual(1);
      const foundPref = allMemories.some((m) => m.content.includes('Rust over Go'));
      expect(foundPref).toBe(true);
      await repo.close();
    });

    it('ranks relevant memories within bounded token budget and generates prompt context', async () => {
      const repo = new LocalRepository(`test-db-${Date.now()}-${Math.random()}`);
      repo.setOwner('user-budget-test');
      const memEngine = new MemoryEngine(repo);

      await memEngine.createMemory({
        content: 'Working on React performance optimization with useMemo and memo',
        category: 'project_context',
        pinned: true,
      });
      await memEngine.createMemory({
        content: 'Enjoys espresso with oat milk in the morning',
        category: 'user_preference',
      });

      const manager = new IntelligentMemoryContextManager(repo);
      const pkg = await manager.buildContextPackage('How do I optimize React component renders?', {
        maxTotalTokens: 1500,
      });

      expect(pkg.rankedMemories.length).toBeGreaterThan(0);
      expect(pkg.rankedMemories[0].content).toContain('React performance optimization');
      expect(pkg.totalEstimatedTokens).toBeLessThanOrEqual(1500);
      await repo.close();
    });
  });
});
