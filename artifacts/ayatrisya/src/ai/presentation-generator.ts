import { modelClient } from '@/ai/client';
import { repository } from '@/storage/repository';
import type { Slide } from '@/components/ItemEditors';
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

/**
 * Plans and writes structured multi-slide presentations using V1/V2 model routing.
 * Ensures balanced narrative progression: opening, explanatory, comparisons, and conclusion.
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
    targetSlideCount = 6,
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

  const planPrompt = `You are the Ayatrisya Presentation Engine. A user wants to create a super high-quality, modern, Gamma/Keynote-style presentation deck for:
"${prompt}"

Target slide count: ~${Math.max(4, Math.min(targetSlideCount, 15))} slides.

Design & Structure Requirements:
1. Diverse slide types:
   - "title": Impactful headline + punchy subtitle tagline.
   - "bullets": Structured SmartArt cards with 3 clear, distinct points (formatted as bullet points).
   - "quote": Big bold thesis statement, manifesto, or visionary quote.
2. Narrative Progression: Title -> Context/Problem -> Core Pillars/Architecture -> Data/Metrics -> Vision/Action.
3. Engaging, professional writing with zero fluff.

Return a clean, valid JSON object with this exact structure:
{
  "title": "Main Deck Title",
  "themeDescription": "Description of aesthetic and tone (e.g. Dark Cinematic, Clean Light, Emerald Minimal, Cyber Neon)",
  "slides": [
    {
      "title": "Title Slide Headline",
      "body": "Subtitle or presenter tagline",
      "layout": "title"
    },
    {
      "title": "Core Architecture / Key Pillars",
      "body": "• High-throughput decoupled engine\\n• Zero-dependency vector graphics\\n• Sub-second response latency",
      "layout": "bullets"
    },
    {
      "title": "Key Vision Quote",
      "body": "\\"The next leap in computing will be defined not by complexity, but by instantaneous execution.\\"",
      "layout": "quote"
    },
    {
      "title": "Action Plan & Next Steps",
      "body": "• Production verification\\n• Multi-region deployment\\n• Continuous telemetry",
      "layout": "bullets"
    }
  ]
}
Allowed layout values: "title", "bullets", "quote".
Output ONLY raw valid JSON. Do not wrap in markdown or add conversational filler.`;

  const responseText = await modelClient.generateResponse(
    [{ role: 'user', content: planPrompt }],
    { model, mode, signal }
  );

  let parsedData: {
    title: string;
    themeDescription: string;
    slides: Array<{ title: string; body: string; layout?: 'title' | 'bullets' | 'quote' }>;
  };

  try {
    const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    parsedData = JSON.parse(cleaned);
  } catch {
    parsedData = {
      title: prompt.slice(0, 50) || 'Ayatrisya Presentation',
      themeDescription: 'Modern dark presentation',
      slides: [
        { title: prompt.slice(0, 50), body: 'Comprehensive Strategy Deck', layout: 'title' },
        { title: 'Executive Overview', body: '• Context and background\n• Key objectives\n• Scope of analysis', layout: 'bullets' },
        { title: 'Core Insights', body: '• Emerging market trends\n• Strategic advantages\n• Operational considerations', layout: 'bullets' },
        { title: 'Conclusion & Next Steps', body: '• Final recommendations\n• Immediate milestones\n• Contact details', layout: 'bullets' },
      ],
    };
  }

  const slides: Slide[] = parsedData.slides.map((s) => ({
    id: crypto.randomUUID(),
    title: String(s.title || 'Untitled Slide'),
    body: String(s.body || ''),
    layout: (['title', 'bullets', 'quote'] as const).includes(s.layout as any)
      ? (s.layout as 'title' | 'bullets' | 'quote')
      : 'bullets',
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
 * Regenerates a single slide's title and contents based on custom instructions.
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

  const prompt = `You are revising slide "${slide.title}" in deck "${deckTitle}".
Current body:
"""
${slide.body}
"""
Current layout: ${slide.layout}

User instruction for updating this slide:
"${userInstruction}"

Return a clean JSON object with updated title, body, and layout:
{
  "title": "Updated Slide Title",
  "body": "Updated slide body text or bullets",
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
      id: slide.id,
      title: res.title || slide.title,
      body: res.body || slide.body,
      layout: (['title', 'bullets', 'quote'] as const).includes(res.layout)
        ? res.layout
        : slide.layout,
    };
  } catch {
    return {
      ...slide,
      body: updated.trim(),
    };
  }
}

