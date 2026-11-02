import { modelClient } from '@/ai/client';
import { repository } from '@/storage/repository';
import type { ProjectItem } from '@/storage/types';

export interface GeneratedDocumentSection {
  title: string;
  content: string;
  level: number;
}

export interface GeneratedDocumentResult {
  title: string;
  summary: string;
  sections: GeneratedDocumentSection[];
  fullMarkdown: string;
  item?: ProjectItem;
}

export interface DocumentGenerationProgress {
  step: 'planning' | 'generating_sections' | 'assembling' | 'saving' | 'completed' | 'error';
  totalSections: number;
  completedSections: number;
  currentSectionTitle?: string;
  error?: string;
}

/**
 * Plans and writes structured documents section-by-section to prevent truncation
 * and ensure complete depth across headings, paragraphs, lists, and tables.
 */
export async function generateDocumentFromPrompt(
  prompt: string,
  options: {
    model?: 'v1-fast' | 'v2-best';
    mode?: 'Normal' | 'Savage' | 'Joke';
    projectId?: string | null;
    tags?: string[];
    saveToWorkspace?: boolean;
    onProgress?: (progress: DocumentGenerationProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<GeneratedDocumentResult> {
  const {
    model = 'v1-fast',
    mode = 'Normal',
    projectId = null,
    tags = ['ai-generated', 'document'],
    saveToWorkspace = true,
    onProgress,
    signal,
  } = options;

  onProgress?.({
    step: 'planning',
    totalSections: 0,
    completedSections: 0,
  });

  // Step 1: Structural Planning Prompt
  const planPrompt = `You are the Ayatrisya Document Engine. The user wants to generate a complete, structured document based on this request:
"${prompt}"

Plan the document architecture. Return a clean JSON object with this exact structure:
{
  "title": "A descriptive, professional title for the document",
  "summary": "A 1-2 sentence executive overview of what this document covers",
  "sections": [
    { "title": "Executive Summary", "level": 1, "guidance": "Key takeaways, high-level findings, and context" },
    { "title": "Section Title", "level": 2, "guidance": "Detailed bullet points, analysis, data or tables needed" },
    { "title": "Conclusion & Next Steps", "level": 2, "guidance": "Summary of findings and recommended actions" }
  ]
}
Include between 4 and 8 well-structured sections appropriate for the requested scope. Output ONLY raw valid JSON.`;

  const planResponse = await modelClient.generateResponse(
    [{ role: 'user', content: planPrompt }],
    { model, mode, signal }
  );

  let planJson: { title: string; summary: string; sections: Array<{ title: string; level: number; guidance: string }> };
  try {
    const cleaned = planResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
    planJson = JSON.parse(cleaned);
  } catch {
    // Fallback plan if JSON parser fails
    planJson = {
      title: prompt.slice(0, 60),
      summary: `Comprehensive document covering: ${prompt}`,
      sections: [
        { title: 'Executive Summary', level: 1, guidance: 'Overview and core purpose' },
        { title: 'In-Depth Analysis', level: 2, guidance: 'Detailed findings and evidence' },
        { title: 'Strategic Recommendations', level: 2, guidance: 'Actionable steps and insights' },
        { title: 'Conclusion', level: 2, guidance: 'Wrap up and reference list' },
      ],
    };
  }

  const generatedSections: GeneratedDocumentSection[] = [];
  const total = planJson.sections.length;

  // Step 2: Generate Each Section Iteratively (Controlled generation prevents truncation)
  for (let i = 0; i < total; i++) {
    const s = planJson.sections[i];
    if (signal?.aborted) throw new DOMException('Document generation was cancelled.', 'AbortError');

    onProgress?.({
      step: 'generating_sections',
      totalSections: total,
      completedSections: i,
      currentSectionTitle: s.title,
    });

    const sectionPrompt = `Write the full, detailed text for section "${s.title}" of the document "${planJson.title}".
Context & Overall Goal: "${prompt}"
Guidance for this section: "${s.guidance}"
Previous sections covered: ${generatedSections.map((g) => g.title).join(', ') || 'None (this is the first section)'}

Rules:
- Write substantial, thorough paragraphs with complete depth.
- Use Markdown formatting: bullet points, bold key terms, tables where comparative data is relevant.
- Do NOT output document header (# ${planJson.title}), as that is handled by the document wrapper.
- Do NOT truncate. Write the full text.`;

    const sectionText = await modelClient.generateResponse(
      [{ role: 'user', content: sectionPrompt }],
      { model, mode, signal }
    );

    generatedSections.push({
      title: s.title,
      content: sectionText.trim(),
      level: s.level || 2,
    });
  }

  onProgress?.({
    step: 'assembling',
    totalSections: total,
    completedSections: total,
  });

  // Step 3: Assemble Full Markdown Document
  let fullMarkdown = `# ${planJson.title}\n\n*${planJson.summary}*\n\n---\n\n`;
  for (const sec of generatedSections) {
    const headingHashes = '#'.repeat(Math.max(2, Math.min(sec.level + 1, 4)));
    fullMarkdown += `${headingHashes} ${sec.title}\n\n${sec.content}\n\n`;
  }

  // Step 4: Save into Workspace Repository
  let savedItem: ProjectItem | undefined;
  if (saveToWorkspace) {
    onProgress?.({
      step: 'saving',
      totalSections: total,
      completedSections: total,
    });

    savedItem = await repository.saveItem({
      title: planJson.title,
      kind: 'document',
      content: fullMarkdown,
      projectId,
      tags,
    });
  }

  onProgress?.({
    step: 'completed',
    totalSections: total,
    completedSections: total,
  });

  return {
    title: planJson.title,
    summary: planJson.summary,
    sections: generatedSections,
    fullMarkdown,
    item: savedItem,
  };
}

/**
 * Regenerates an individual section of a document without modifying other sections.
 */
export async function regenerateDocumentSection(
  docTitle: string,
  sectionTitle: string,
  existingContent: string,
  userInstruction: string,
  options: {
    model?: 'v1-fast' | 'v2-best';
    mode?: 'Normal' | 'Savage' | 'Joke';
    signal?: AbortSignal;
  } = {}
): Promise<string> {
  const { model = 'v1-fast', mode = 'Normal', signal } = options;

  const prompt = `You are editing section "${sectionTitle}" of document "${docTitle}".
Current section content:
"""
${existingContent}
"""

User instruction for updating this section:
"${userInstruction}"

Output the complete, revised section content in clean Markdown without conversational preamble.`;

  const updated = await modelClient.generateResponse(
    [{ role: 'user', content: prompt }],
    { model, mode, signal }
  );

  return updated.trim();
}

