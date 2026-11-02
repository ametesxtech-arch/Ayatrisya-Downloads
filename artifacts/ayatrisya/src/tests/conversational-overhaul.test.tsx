import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { CanvasProvider } from '../components/canvas/CanvasContext';
import { detectUniversalInteractiveContent } from '../components/interactive-blocks/interactive-detector';
import { parseInteractiveBlock } from '../components/interactive-blocks/schema';

describe('Ayatrisya Conversational Experience Overhaul - Suite', () => {
  // Test 1: Normal formatted response with math and inline code
  it('renders normal formatted response with markdown formatting, math and code', () => {
    const content = `Welcome to Ayatrisya! Here is the explanation of time complexity:

The binary search algorithm runs in $O(\\log n)$ time complexity, whereas linear scan takes $O(n)$ time.

\`\`\`python
def binary_search(arr, target):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
\`\`\`

Feel free to test it with any sorted list.`;

    const html = renderToStaticMarkup(
      React.createElement(
        CanvasProvider,
        null,
        React.createElement(MarkdownRenderer, { content })
      )
    );
    expect(html).toContain('binary search algorithm');
    expect(html).toContain('binary_search');
    expect(html).toContain('chat-code');
    expect(html).toContain('PYTHON');
    expect(html).toContain('Canvas IDE');
    expect(html).toContain('.ZIP');
  });

  // Test 2: Request comparison and receive a readable interactive table
  it('converts markdown table comparison into an interactive sortable & filterable table', () => {
    const tableMd = `### Cloud Models Comparison

| Model | Provider | Speed | Reasoning |
| --- | --- | --- | --- |
| Llama 3.1 8B | Cloudflare Workers AI | High (<2s) | Strong |
| Gemini 1.5 Flash | Google Cloud AI | Fast (<3s) | Exceptional |
| Qwen 2.5 7B | Local Desktop / Seed | Hardware Dependent | Specialized |

Comparison complete.`;

    const detected = detectUniversalInteractiveContent(tableMd);
    expect(detected).not.toBeNull();
    expect(detected?.block.type).toBe('table');
    expect((detected?.block as any).headers).toHaveLength(4);
    expect((detected?.block as any).rows).toHaveLength(3);

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: tableMd }));
    expect(html).toContain('interactive-table');
    expect(html).toContain('Cloud Models Comparison');
    expect(html).toContain('Llama 3.1 8B');
    expect(html).toContain('Gemini 1.5 Flash');
    expect(html).toContain('Search rows...');
  });

  // Test 3: Request a graph/chart and parse/render it
  it('parses and renders interactive chart blocks with metrics', () => {
    const chartJson = JSON.stringify({
      version: '1.0',
      type: 'chart',
      title: 'Global Energy Transition by Source',
      chartType: 'bar',
      data: [
        { label: 'Solar PV', value: 38 },
        { label: 'Wind Power', value: 29 },
        { label: 'Hydroelectric', value: 21 },
        { label: 'Geothermal', value: 12 },
      ],
      metricLabel: 'Total Renewable Share',
      metricValue: '48.2%',
    });

    const parsed = parseInteractiveBlock(chartJson);
    expect(parsed.status).toBe('valid');
    if (parsed.status === 'valid') {
      expect(parsed.block.type).toBe('chart');
      expect((parsed.block as any).data).toHaveLength(4);
    }

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: chartJson }));
    expect(html).toContain('interactive-chart');
    expect(html).toContain('Global Energy Transition by Source');
    expect(html).toContain('Solar PV');
    expect(html).toContain('Wind Power');
    expect(html).toContain('Total Renewable Share');
    expect(html).toContain('48.2%');
  });

  // Test 4: Request a quiz and submit answers
  it('detects and renders interactive quiz from standard markdown text', () => {
    const quizText = `Here is your science quiz:

1. What is the powerhouse of the cell?
A) Nucleus
B) Mitochondria
C) Ribosome
D) Endoplasmic Reticulum
Answer: B
Explanation: Mitochondria generate most of the chemical energy needed by the cell.

2. Which organelle is responsible for photosynthesis in plants?
A) Chloroplast
B) Vacuole
C) Cell Wall
D) Golgi apparatus
Answer: A
Explanation: Chloroplasts absorb sunlight to synthesize nutrients.

Good luck!`;

    const detected = detectUniversalInteractiveContent(quizText);
    expect(detected).not.toBeNull();
    expect(detected?.block.type).toBe('quiz');
    expect((detected?.block as any).questions).toHaveLength(2);

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: quizText }));
    expect(html).toContain('interactive-quiz');
    expect(html).toContain('What is the powerhouse of the cell?');
    expect(html).toContain('Mitochondria');
  });

  // Test 5: Form wizard interactive block validation
  it('validates interactive form wizard block structures', () => {
    const wizardJson = JSON.stringify({
      version: '1.0',
      type: 'form_wizard',
      title: 'Project Onboarding Questionnaire',
      steps: [
        {
          title: 'Basic Info',
          fields: [
            { id: 'projectName', label: 'Project Name', type: 'text', required: true },
            { id: 'adminEmail', label: 'Admin Email', type: 'email', required: true },
          ],
        },
      ],
    });

    const parsed = parseInteractiveBlock(wizardJson);
    expect(parsed.status).toBe('valid');

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: wizardJson }));
    expect(html).toContain('interactive-form-wizard');
    expect(html).toContain('Project Onboarding Questionnaire');
    expect(html).toContain('Basic Info');
  });

  // Test 6: Responsive viewports & graceful error degradation
  it('gracefully degrades invalid interactive JSON to standard code blocks without throwing', () => {
    const brokenContent = `\`\`\`interactive
{
  "type": "chart",
  "missing_version": true,
  "broken_syntax": [
\`\`\``;

    const html = renderToStaticMarkup(React.createElement(MarkdownRenderer, { content: brokenContent }));
    expect(html).toContain('chat-code');
    expect(html).toContain('INTERACTIVE');
    expect(html).toContain('broken_syntax');
  });
});
