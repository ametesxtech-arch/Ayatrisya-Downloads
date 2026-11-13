import { ItemCollection } from '@/components/ItemCollection';
import { slidesToJson } from '@/components/ItemEditors';
import type { Slide } from '@/lib/pptx-export';

export function PresentationsPage({ notify }: { notify: (m: string) => void }) {
  const pitchSlides: Slide[] = [
    {
      id: crypto.randomUUID(),
      title: 'Ayatrisya Intelligence',
      body: 'Autonomous Cloud Workspace & Next-Generation Engine',
      layout: 'title',
      category: 'EXECUTIVE BRIEFING',
    },
    {
      id: crypto.randomUUID(),
      title: 'The Core Challenge',
      body: 'Conventional developer tools are fragmented across disconnected apps, resulting in context loss and operational overhead.',
      layout: 'section-header',
      category: 'PROBLEM STATEMENT',
    },
    {
      id: crypto.randomUUID(),
      title: 'Architectural Comparison',
      body: 'Fragmented SaaS stack with multiple subscription silos\nUnified obsidian workspace with zero-latency local compilation',
      layout: 'comparison',
    },
    {
      id: crypto.randomUUID(),
      title: 'Performance & Latency Metrics',
      body: 'Verified production telemetry benchmarks',
      layout: 'metrics',
      metrics: [
        { value: '99.98%', label: 'System Reliability', trend: '+4.2% YoY' },
        { value: '<12ms', label: 'AST Render Time', trend: 'Sub-second' },
        { value: '10x', label: 'Velocity Gain', trend: 'Measured' },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'Execution Roadmap',
      body: 'Three-stage rollout schedule',
      layout: 'timeline',
      timeline: [
        { step: '01', title: 'Phase 1: AST Foundation', description: 'Unified document & presentation model' },
        { step: '02', title: 'Phase 2: OpenXML Engines', description: 'Zero-dependency DOCX & PPTX builders' },
        { step: '03', title: 'Phase 3: Edge Distribution', description: 'Mobile responsive release' },
      ],
    },
    {
      id: crypto.randomUUID(),
      title: 'Executive Conclusion',
      body: 'Immediate operational release with verified OpenXML package validity and responsive mobile shell.',
      layout: 'conclusion',
    },
  ];

  const strategySlides: Slide[] = [
    {
      id: crypto.randomUUID(),
      title: 'Enterprise Technical Strategy',
      body: '2026-2027 Strategic Architecture & Technology Roadmap',
      layout: 'title',
      category: 'TECHNICAL STRATEGY',
    },
    {
      id: crypto.randomUUID(),
      title: 'Three Pillars of Modern Quality',
      body: '• Resilient Document Intelligence\n• True OpenXML PresentationML Generation\n• Universal Mobile Viewport Integrity',
      layout: 'card-grid',
    },
    {
      id: crypto.randomUUID(),
      title: 'Subsystem Evaluation Matrix',
      body: 'Structured audit across all workspace modules',
      layout: 'table',
      table: {
        headers: ['Subsystem', 'Engine Architecture', 'Verification'],
        rows: [
          ['Documents', 'AST Parser + PDF/DOCX', 'Passed'],
          ['Presentations', '12-Layout PPTX Compiler', 'Passed'],
          ['Canvas IDE', 'Sandboxed Multi-file Runner', 'Passed'],
          ['Mobile Shell', '15-Viewport Adaptive CSS', 'Passed'],
        ],
      },
    },
    {
      id: crypto.randomUUID(),
      title: 'Action Milestones & Deliverables',
      body: 'Immediate verification and client handoff complete with zero defect regressions.',
      layout: 'conclusion',
    },
  ];

  return (
    <ItemCollection
      kind="presentation"
      noun="presentation"
      eyebrow="Presentation Suite"
      heading="Plan, Preview & Export Slide Decks"
      description="Design presentations slide by slide with 12 distinct layout engines. Export genuine Microsoft PowerPoint (.pptx) decks, inspect live visual previews, and polish individual slides with AI."
      notify={notify}
      templates={[
        {
          name: 'Executive Pitch Deck (6 Slides)',
          description: 'Title, problem statement, comparison, metrics, timeline, and executive conclusion.',
          content: slidesToJson(pitchSlides),
        },
        {
          name: 'Technical Architecture Strategy (4 Slides)',
          description: 'Title, pillars card grid, audit table matrix, and action milestones.',
          content: slidesToJson(strategySlides),
        },
        {
          name: 'Blank 12-Layout Deck',
          description: 'Minimal starter deck with Title and SmartArt cards.',
          content: slidesToJson([
            {
              id: crypto.randomUUID(),
              title: 'Executive Presentation',
              body: 'Subtitle and Presenter Information',
              layout: 'title',
              category: 'AYATRISYA',
            },
            {
              id: crypto.randomUUID(),
              title: 'Strategic Priorities',
              body: '• Primary operational milestone\n• Secondary performance objective\n• Tertiary security requirement',
              layout: 'card-grid',
            },
          ]),
        },
      ]}
    />
  );
}
