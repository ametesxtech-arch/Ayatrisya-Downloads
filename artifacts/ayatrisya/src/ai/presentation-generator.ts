import { modelClient } from '@/ai/client';
import { repository } from '@/storage/repository';
import type { Slide, SlideLayout, SlideMetric, SlideTimelineStep, SlideTable } from '@/lib/pptx-export';
import { slidesToJson } from '@/components/ItemEditors';
import type { ProjectItem } from '@/storage/types';

export interface GeneratedPresentationResult {
  title: string;
  themeDescription: string;
  slides: Slide[];
  slidesJson: string;
  item?: ProjectItem;
}

export interface PresentationGenerationProgress {
  step: 'planning' | 'generating_slides' | 'assembling' | 'saving' | 'completed' | 'error';
  totalSlides: number;
  completedSlides: number;
  currentSlideTitle?: string;
  error?: string;
}

const VALID_LAYOUTS: SlideLayout[] = [
  'title',
  'section-header',
  'two-column',
  'metrics',
  'timeline',
  'process',
  'comparison',
  'table',
  'image-focus',
  'card-grid',
  'conclusion',
  'references',
  'bullets',
  'quote',
];

/**
 * Plans and writes structured multi-slide presentations using V1/V2 model routing.
 * Ensures balanced narrative progression: opening, explanatory, comparisons, metrics, and conclusion.
 */
export async function generatePresentationFromPrompt(
  prompt: string,
  options: {
    targetSlideCount?: number;
    model?: 'v1-fast' | 'v2-best';
    mode?: 'Normal' | 'Savage' | 'Joke';
    projectId?: string | null;
    tags?: string[];
    saveToWorkspace?: boolean;
    onProgress?: (progress: PresentationGenerationProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<GeneratedPresentationResult> {
  const {
    targetSlideCount = 8,
    model = 'v1-fast',
    mode = 'Normal',
    projectId = null,
    tags = ['ai-generated', 'presentation'],
    saveToWorkspace = true,
    onProgress,
    signal,
  } = options;

  onProgress?.({
    step: 'planning',
    totalSlides: targetSlideCount,
    completedSlides: 0,
  });

  const planPrompt = `You are the Ayatrisya Presentation Engine. A user wants to create an executive, modern presentation deck for:
"${prompt}"

Target slide count: ~${Math.max(4, Math.min(targetSlideCount, 15))} slides.

Design & Structure Requirements:
1. Diverse slide types from our 12 layout system:
   - "title": Deck title and subtitle.
   - "section-header": Chapter divider or milestone header.
   - "two-column": Two-column split comparing two perspectives or dimensions.
   - "metrics": KPI metrics (value, label, trend).
   - "timeline": Chronological sequence of milestones.
   - "process": Step-by-step workflow stages (01, 02, 03).
   - "comparison": Side-by-side comparison of conventional vs optimized approach.
   - "table": Structured table matrix.
   - "image-focus": Visual artifact layout.
   - "card-grid": SmartArt cards (3 distinct bullet points).
   - "conclusion": Executive summary and next steps.
   - "references": Citations, source data, or appendix notes.

2. Narrative Progression: Title -> Context/Problem -> Pillars -> Metrics -> Process -> Comparison -> Conclusion -> References.
3. Engaging, professional writing with zero fluff.

Return a clean, valid JSON object with this exact structure:
{
  "title": "Main Deck Title",
  "themeDescription": "Dark Cinematic presentation",
  "slides": [
    {
      "title": "Title Slide Headline",
      "body": "Presenter tagline or deck subtitle",
      "layout": "title"
    },
    {
      "title": "Core Architecture Pillars",
      "body": "• High-throughput decoupled engine\\n• Zero-dependency vector graphics\\n• Sub-second response latency",
      "layout": "card-grid"
    },
    {
      "title": "System Performance Metrics",
      "body": "Key quantitative performance indicators",
      "layout": "metrics",
      "metrics": [
        { "value": "99.98%", "label": "Availability", "trend": "+4.2% YoY" },
        { "value": "<12ms", "label": "Latency", "trend": "Sub-second" },
        { "value": "10x", "label": "Speed", "trend": "Accelerated" }
      ]
    },
    {
      "title": "Execution Roadmap",
      "body": "Three-phase delivery strategy",
      "layout": "timeline",
      "timeline": [
        { "step": "01", "title": "Foundation", "description": "Core model routing and security layer" },
        { "step": "02", "title": "Integration", "description": "OpenXML standard verification" },
        { "step": "03", "title": "Scale", "description": "Global edge deployment" }
      ]
    },
    {
      "title": "Executive Summary & Action Plan",
      "body": "Strategic recap and immediate deployment milestones for the team.",
      "layout": "conclusion"
    }
  ]
}
Output ONLY raw valid JSON. Do not wrap in markdown or add conversational filler.`;

  const responseText = await modelClient.generateResponse(
    [{ role: 'user', content: planPrompt }],
    { model, mode, signal }
  );

  let parsedData: {
    title: string;
    themeDescription: string;
    slides: Array<{
      title: string;
      body: string;
      layout?: SlideLayout;
      subtitle?: string;
      category?: string;
      metrics?: SlideMetric[];
      timeline?: SlideTimelineStep[];
      table?: SlideTable;
    }>;
  };

  try {
    const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    parsedData = JSON.parse(cleaned);
  } catch {
    parsedData = {
      title: prompt.slice(0, 50) || 'Ayatrisya Presentation',
      themeDescription: 'Modern dark presentation',
      slides: [
        { title: prompt.slice(0, 50), body: 'Executive Strategic Deck', layout: 'title' },
        { title: 'Core Objectives', body: '• Context and strategic background\n• Key architectural pillars\n• Operational boundaries', layout: 'card-grid' },
        {
          title: 'Target Performance Metrics',
          body: 'Measured quantitative improvements',
          layout: 'metrics',
          metrics: [
            { value: '99.99%', label: 'System Uptime', trend: 'Reliable' },
            { value: '<15ms', label: 'Response Latency', trend: 'Instant' },
            { value: '5x', label: 'Efficiency Gain', trend: 'Optimized' },
          ],
        },
        {
          title: 'Delivery Sequence',
          body: 'Implementation roadmap',
          layout: 'timeline',
          timeline: [
            { step: '01', title: 'Architecture', description: 'Domain model setup' },
            { step: '02', title: 'Verification', description: 'Testing & export checks' },
            { step: '03', title: 'Deployment', description: 'Global release' },
          ],
        },
        { title: 'Conclusion & Next Steps', body: 'Immediate milestones and operational sign-off.', layout: 'conclusion' },
      ],
    };
  }

  const slides: Slide[] = parsedData.slides.map((s) => ({
    id: crypto.randomUUID(),
    title: String(s.title || 'Untitled Slide'),
    subtitle: s.subtitle ? String(s.subtitle) : undefined,
    body: String(s.body || ''),
    layout: s.layout && VALID_LAYOUTS.includes(s.layout) ? s.layout : 'card-grid',
    category: s.category,
    metrics: s.metrics,
    timeline: s.timeline,
    table: s.table,
  }));

  const jsonContent = slidesToJson(slides);

  let savedItem: ProjectItem | undefined;
  if (saveToWorkspace) {
    onProgress?.({
      step: 'saving',
      totalSlides: slides.length,
      completedSlides: slides.length,
    });

    savedItem = await repository.saveItem({
      title: parsedData.title,
      kind: 'presentation',
      content: jsonContent,
      projectId,
      tags,
    });
  }

  onProgress?.({
    step: 'completed',
    totalSlides: slides.length,
    completedSlides: slides.length,
  });

  return {
    title: parsedData.title,
    themeDescription: parsedData.themeDescription || 'Standard Presentation',
    slides,
    slidesJson: jsonContent,
    item: savedItem,
  };
}

/**
 * Regenerates an individual slide's title, body, and layout without altering any other slide in the deck.
 */
export async function regenerateSlide(
  slide: Slide,
  userInstruction: string,
  deckTitle: string,
  options: {
    model?: 'v1-fast' | 'v2-best';
    mode?: 'Normal' | 'Savage' | 'Joke';
    signal?: AbortSignal;
  } = {}
): Promise<Slide> {
  const { model = 'v1-fast', mode = 'Normal', signal } = options;

  const prompt = `You are revising slide "${slide.title}" in presentation deck "${deckTitle}".
Current body:
"""
${slide.body}
"""
Current layout: ${slide.layout}

User instruction for updating this slide:
"${userInstruction}"

Allowed layouts: "title", "section-header", "two-column", "metrics", "timeline", "process", "comparison", "table", "image-focus", "card-grid", "conclusion", "references".

Return a clean JSON object with updated title, body, and layout:
{
  "title": "Updated Slide Title",
  "body": "Updated slide body text or points",
  "layout": "${slide.layout}"
}
Output ONLY raw valid JSON.`;

  const updated = await modelClient.generateResponse(
    [{ role: 'user', content: prompt }],
    { model, mode, signal }
  );

  try {
    const cleaned = updated.replace(/```json/gi, '').replace(/```/g, '').trim();
    const res = JSON.parse(cleaned);
    return {
      ...slide,
      title: res.title || slide.title,
      body: res.body || slide.body,
      layout: VALID_LAYOUTS.includes(res.layout) ? res.layout : slide.layout,
    };
  } catch {
    return {
      ...slide,
      body: updated.trim(),
    };
  }
}
