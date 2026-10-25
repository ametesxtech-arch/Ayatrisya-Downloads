import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlashcardBlockRenderer } from '@/components/interactive-blocks/FlashcardBlockRenderer';
import { FillBlankBlockRenderer } from '@/components/interactive-blocks/FillBlankBlockRenderer';
import { DecisionTreeBlockRenderer } from '@/components/interactive-blocks/DecisionTreeBlockRenderer';
import { CalculatorBlockRenderer } from '@/components/interactive-blocks/CalculatorBlockRenderer';
import {
  JsonViewerBlockRenderer,
  RegexTesterBlockRenderer,
  ApiBuilderBlockRenderer,
} from '@/components/interactive-blocks/DeveloperToolsBlockRenderer';
import {
  AudioPlayerBlockRenderer,
  StoryboardBlockRenderer,
  ImageVariationBlockRenderer,
} from '@/components/interactive-blocks/CreativeMediaBlockRenderer';
import { ChecklistBlockRenderer } from '@/components/interactive-blocks/ChecklistBlockRenderer';
import { KanbanBlockRenderer } from '@/components/interactive-blocks/KanbanBlockRenderer';
import { FormWizardBlockRenderer } from '@/components/interactive-blocks/FormWizardBlockRenderer';
import { DiagramBlockRenderer } from '@/components/interactive-blocks/DiagramBlockRenderer';
import { clearAllInteractiveBlockStates } from '@/components/interactive-blocks/state';

describe('Expanded Interactive Block Renderers Suite', () => {
  beforeEach(() => {
    clearAllInteractiveBlockStates();
  });

  it('renders Flashcards with front and back review prompts', () => {
    const html = renderToStaticMarkup(
      <FlashcardBlockRenderer
        block={{
          version: '1.0',
          type: 'flashcards',
          title: 'Vocabulary Deck',
          cards: [
            { id: 'c1', front: 'Ephemeral', back: 'Lasting for a very short time' },
            { id: 'c2', front: 'Ubiquitous', back: 'Present, appearing, or found everywhere' },
          ],
        }}
        blockId="test-flashcards"
      />
    );

    expect(html).toContain('Vocabulary Deck');
    expect(html).toContain('Ephemeral');
    expect(html).toContain('Click or Space to flip');
  });

  it('renders Fill-in-the-Blank with inline inputs', () => {
    const html = renderToStaticMarkup(
      <FillBlankBlockRenderer
        block={{
          version: '1.0',
          type: 'fill_blank',
          textWithBlanks: 'The capital of France is {{b1}} and the currency is {{b2}}.',
          blanks: [
            { id: 'b1', answer: 'Paris' },
            { id: 'b2', answer: 'Euro' },
          ],
        }}
        blockId="test-fill-blank"
      />
    );

    expect(html).toContain('The capital of France is');
    expect(html).toContain('and the currency is');
    expect(html).toContain('Check Answers');
  });

  it('renders Decision Tree with branching choices', () => {
    const html = renderToStaticMarkup(
      <DecisionTreeBlockRenderer
        block={{
          version: '1.0',
          type: 'decision_tree',
          title: 'Database Selector',
          rootNodeId: 'node-1',
          nodes: {
            'node-1': {
              id: 'node-1',
              question: 'Relational or Document?',
              description: 'Do you need strict ACID schemas?',
              options: [
                { label: 'Yes, strict relational', nextNodeId: 'node-2' },
                { label: 'No, flexible documents', outcome: 'MongoDB or Cloud Firestore' },
              ],
            },
            'node-2': {
              id: 'node-2',
              question: 'PostgreSQL recommended',
              options: [],
            },
          },
        }}
        blockId="test-decision-tree"
      />
    );

    expect(html).toContain('Database Selector');
    expect(html).toContain('Relational or Document?');
    expect(html).toContain('Yes, strict relational');
    expect(html).toContain('No, flexible documents');
  });

  it('renders What-If Calculator with sliders and formula output', () => {
    const html = renderToStaticMarkup(
      <CalculatorBlockRenderer
        block={{
          version: '1.0',
          type: 'calculator',
          title: 'ROI Estimator',
          formula: 'users * arpu',
          formulaType: 'product',
          variables: [
            { id: 'users', label: 'Monthly Active Users', min: 100, max: 10000, step: 100, defaultValue: 1000 },
            { id: 'arpu', label: 'Average Revenue per User ($)', min: 1, max: 100, step: 1, defaultValue: 10 },
          ],
          resultLabel: 'Estimated Monthly Revenue ($)',
        }}
        blockId="test-calculator"
      />
    );

    expect(html).toContain('ROI Estimator');
    expect(html).toContain('Monthly Active Users');
    expect(html).toContain('Average Revenue per User ($)');
    expect(html).toContain('Estimated Monthly Revenue ($)');
    expect(html).toContain('10000');
  });

  it('renders Developer Tools: Regex Tester, JSON Viewer, and API Builder', () => {
    const regexHtml = renderToStaticMarkup(
      <RegexTesterBlockRenderer
        block={{
          version: '1.0',
          type: 'regex_tester',
          pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,7}\\b',
          flags: 'gi',
          testString: 'Contact support@ayatrisya.ai or info@example.com for help.',
        }}
      />
    );
    expect(regexHtml).toContain('Interactive Regex Tester');
    expect(regexHtml).toContain('2 matches');

    const jsonHtml = renderToStaticMarkup(
      <JsonViewerBlockRenderer
        block={{
          version: '1.0',
          type: 'json_viewer',
          title: 'User Profile',
          data: { name: 'Ayatrisya', version: '2.0', features: ['canvas', 'voice', 'blocks'] },
        }}
      />
    );
    expect(jsonHtml).toContain('User Profile');
    expect(jsonHtml).toContain('Ayatrisya');
    expect(jsonHtml).toContain('features');

    const apiHtml = renderToStaticMarkup(
      <ApiBuilderBlockRenderer
        block={{
          version: '1.0',
          type: 'api_builder',
          title: 'Health Check API',
          url: 'https://api.ayatrisya.ai/health',
          method: 'GET',
        }}
      />
    );
    expect(apiHtml).toContain('Health Check API');
    expect(apiHtml).toContain('https://api.ayatrisya.ai/health');
    expect(apiHtml).toContain('curl -X GET');
  });

  it('renders Kanban Board, Form Wizard, and Mermaid Diagram', () => {
    const kanbanHtml = renderToStaticMarkup(
      <KanbanBlockRenderer
        block={{
          version: '1.0',
          type: 'kanban',
          title: 'Sprint Tasks',
          columns: [
            { id: 'todo', title: 'To Do', cards: [{ id: 'k1', title: 'Design Schema' }] },
            { id: 'done', title: 'Done', cards: [{ id: 'k2', title: 'Deploy API' }] },
          ],
        }}
        blockId="test-kanban"
      />
    );
    expect(kanbanHtml).toContain('Sprint Tasks');
    expect(kanbanHtml).toContain('Design Schema');
    expect(kanbanHtml).toContain('Deploy API');

    const formHtml = renderToStaticMarkup(
      <FormWizardBlockRenderer
        block={{
          version: '1.0',
          type: 'form_wizard',
          title: 'Project Onboarding',
          steps: [
            {
              title: 'Project Info',
              fields: [{ id: 'pname', label: 'Project Name', type: 'text', required: true }],
            },
          ],
        }}
        blockId="test-form-wizard"
      />
    );
    expect(formHtml).toContain('Project Onboarding');
    expect(formHtml).toContain('Project Name');

    const diagramHtml = renderToStaticMarkup(
      <DiagramBlockRenderer
        block={{
          version: '1.0',
          type: 'diagram',
          diagramType: 'mermaid',
          caption: 'System Architecture',
          code: 'graph TD; Client-->API; API-->Cloudflare; API-->GeminiFallback;',
        }}
      />
    );
    expect(diagramHtml).toContain('System Architecture');
    expect(diagramHtml).toContain('Client');
    expect(diagramHtml).toContain('Cloudflare');
  });

  it('renders Creative Media Blocks: Audio, Storyboard, and Image Variations', () => {
    const audioHtml = renderToStaticMarkup(
      <AudioPlayerBlockRenderer
        block={{
          version: '1.0',
          type: 'audio_player',
          title: 'Ambient Synth Pad',
          audioUrl: 'https://example.com/audio.mp3',
          duration: 120,
        }}
      />
    );
    expect(audioHtml).toContain('Ambient Synth Pad');

    const storyboardHtml = renderToStaticMarkup(
      <StoryboardBlockRenderer
        block={{
          version: '1.0',
          type: 'storyboard',
          title: 'Sci-Fi Scene Sequence',
          scenes: [
            {
              sceneNumber: 1,
              title: 'Skyline',
              description: 'A futuristic city skyline with neon lights',
              duration: '4s',
            },
            {
              sceneNumber: 2,
              title: 'Transit',
              description: 'Camera zooms into high-speed transit pod',
              duration: '3s',
            },
          ],
        }}
      />
    );
    expect(storyboardHtml).toContain('Sci-Fi Scene Sequence');
    expect(storyboardHtml).toContain('A futuristic city skyline');

    const variationHtml = renderToStaticMarkup(
      <ImageVariationBlockRenderer
        block={{
          version: '1.0',
          type: 'image_variation',
          title: 'Logo Concept Variations',
          prompt: 'Ayatrisya brand logo',
          variations: [
            { label: 'Minimalist Monogram', promptAdjustment: 'Geometric A logo with teal gradient' },
            { label: 'Cyberpunk Emblem', promptAdjustment: 'Neon circuit board emblem' },
          ],
        }}
      />
    );
    expect(variationHtml).toContain('Logo Concept Variations');
    expect(variationHtml).toContain('Minimalist Monogram');
    expect(variationHtml).toContain('Cyberpunk Emblem');
  });

  it('renders Checklist with item list', () => {
    const checkHtml = renderToStaticMarkup(
      <ChecklistBlockRenderer
        block={{
          version: '1.0',
          type: 'checklist',
          items: [
            { id: 't1', label: 'Run unit test suite', checked: true },
            { id: 't2', label: 'Verify Render environment variables', checked: false },
          ],
        }}
        blockId="test-checklist"
      />
    );

    expect(checkHtml).toContain('Run unit test suite');
    expect(checkHtml).toContain('Verify Render environment variables');
    expect(checkHtml).toContain('1 of 2 done');
  });
});
