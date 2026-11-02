import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDocumentFromPrompt, regenerateDocumentSection } from '@/ai/document-generator';
import { generatePresentationFromPrompt, regenerateSlide } from '@/ai/presentation-generator';
import { generateProjectFromPrompt, regenerateProjectFile } from '@/ai/project-generator';
import { modelClient } from '@/ai/client';

describe('Prompt-to-Creation Engines (Document, Presentation, Multi-file Project)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Prompt-to-Document Engine', () => {
    it('plans sections and generates multi-section structured markdown document', async () => {
      // Mock modelClient.generateResponse: first call is plan, subsequent are sections
      let callCount = 0;
      vi.spyOn(modelClient, 'generateResponse').mockImplementation(async (messages) => {
        callCount++;
        const content = messages[0].content;
        if (content.includes('Plan the document architecture')) {
          return JSON.stringify({
            title: 'Market Research: Renewable Energy Trends',
            summary: 'Comprehensive analysis of global renewable energy markets.',
            sections: [
              { title: 'Executive Summary', level: 1, guidance: 'High level findings' },
              { title: 'Global Capacity & Growth', level: 2, guidance: 'Solar and wind metrics' },
              { title: 'Conclusion & Outlook', level: 2, guidance: 'Final takeaways' },
            ],
          });
        }
        return `Detailed content generated for section ${callCount} with extensive factual depth and analysis.`;
      });

      const progressSteps: string[] = [];
      const result = await generateDocumentFromPrompt('Create a detailed market research report about renewable energy.', {
        saveToWorkspace: false,
        onProgress: (p) => progressSteps.push(p.step),
      });

      expect(result.title).toBe('Market Research: Renewable Energy Trends');
      expect(result.summary).toContain('Comprehensive analysis');
      expect(result.sections.length).toBe(3);
      expect(result.fullMarkdown).toContain('# Market Research: Renewable Energy Trends');
      expect(result.fullMarkdown).toContain('## Executive Summary');
      expect(result.fullMarkdown).toContain('## Global Capacity & Growth');
      expect(progressSteps).toContain('planning');
      expect(progressSteps).toContain('generating_sections');
      expect(progressSteps).toContain('assembling');
      expect(progressSteps).toContain('completed');
    });

    it('regenerates an individual section cleanly without touching other text', async () => {
      vi.spyOn(modelClient, 'generateResponse').mockResolvedValue(
        'Updated section content with fresh analysis and data table.'
      );

      const updated = await regenerateDocumentSection(
        'Renewable Energy',
        'Executive Summary',
        'Old summary text.',
        'Add quantitative percentages.'
      );

      expect(updated).toBe('Updated section content with fresh analysis and data table.');
    });
  });

  describe('Prompt-to-Presentation Engine', () => {
    it('plans and creates structured multi-slide presentation', async () => {
      vi.spyOn(modelClient, 'generateResponse').mockResolvedValue(
        JSON.stringify({
          title: 'The Future of Artificial Intelligence',
          themeDescription: 'Futuristic technical keynote',
          slides: [
            { title: 'The Future of AI', body: 'Autonomous intelligence in 2026 and beyond', layout: 'title' },
            { title: 'Technological Shifts', body: '• Local edge compute\n• Private memory architectures\n• Multimodal agents', layout: 'bullets' },
            { title: 'Guiding Quote', body: '"Intelligence is not merely computation; it is autonomy with responsibility."', layout: 'quote' },
            { title: 'Roadmap & Milestones', body: '• Q1: Cloud integration\n• Q2: Edge models', layout: 'bullets' },
          ],
        })
      );

      const result = await generatePresentationFromPrompt('Create a presentation about AI', {
        targetSlideCount: 4,
        saveToWorkspace: false,
      });

      expect(result.title).toBe('The Future of Artificial Intelligence');
      expect(result.slides.length).toBe(4);
      expect(result.slides[0].layout).toBe('title');
      expect(result.slides[1].layout).toBe('bullets');
      expect(result.slides[2].layout).toBe('quote');
      expect(result.slidesJson).toContain('The Future of AI');
    });

    it('regenerates a single slide with user feedback', async () => {
      vi.spyOn(modelClient, 'generateResponse').mockResolvedValue(
        JSON.stringify({
          title: 'Updated AI Trends',
          body: '• New trend 1\n• New trend 2',
          layout: 'bullets',
        })
      );

      const initialSlide = { id: 's1', title: 'Old Title', body: 'Old Body', layout: 'bullets' as const };
      const updated = await regenerateSlide(initialSlide, 'Make it more punchy', 'AI Deck');

      expect(updated.title).toBe('Updated AI Trends');
      expect(updated.body).toContain('New trend 1');
    });
  });

  describe('Code & Multi-File Project Engine', () => {
    it('plans architecture and generates multi-file projects with source code', async () => {
      let step = 0;
      vi.spyOn(modelClient, 'generateResponse').mockImplementation(async (messages) => {
        step++;
        const content = messages[0].content;
        if (content.includes('Plan the project architecture')) {
          return JSON.stringify({
            projectName: 'rate-limiter-service',
            summary: 'Token bucket rate limiter module',
            architecture: 'Modular in-memory limiter',
            dependencies: { zod: '^3.23.0' },
            filePlan: [
              { path: 'src/limiter.ts', description: 'Core token bucket logic', language: 'typescript' },
              { path: 'src/types.ts', description: 'Type definitions', language: 'typescript' },
              { path: 'README.md', description: 'Docs', language: 'markdown' },
            ],
          });
        }
        return `// Generated file content for step ${step}\nexport const active = true;`;
      });

      const project = await generateProjectFromPrompt('Build a token bucket rate limiter in TypeScript');

      expect(project.projectName).toBe('rate-limiter-service');
      expect(project.files.length).toBe(3);
      expect(project.files[0].path).toBe('src/limiter.ts');
      expect(project.files[0].content).toContain('export const active = true;');
      expect(project.files[1].path).toBe('src/types.ts');
    });

    it('regenerates individual project file', async () => {
      vi.spyOn(modelClient, 'generateResponse').mockResolvedValue(
        'export function calculateTokens() { return 100; }'
      );

      const updated = await regenerateProjectFile(
        'my-project',
        'src/limiter.ts',
        'export function calculateTokens() { return 0; }',
        'Return 100 instead'
      );

      expect(updated).toBe('export function calculateTokens() { return 100; }');
    });
  });
});

