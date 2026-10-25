import { describe, expect, it } from 'vitest';
import { parseInteractiveBlock } from '../components/interactive-blocks/schema';

describe('Ayatrisya Interactive Chat Blocks - Schema & Parsing Suite', () => {
  // 1. Multiple Choice Question (Single Select)
  it('validates and parses a single-select MCQ block', () => {
    const payload = JSON.stringify({
      version: '1.0',
      type: 'mcq',
      question: 'Which HTTP status code represents "Not Found"?',
      options: [
        { id: 'a', label: '200 OK' },
        { id: 'b', label: '404 Not Found' },
        { id: 'c', label: '500 Internal Server Error' },
      ],
      correctAnswer: 'b',
      explanation: '404 indicates the requested resource was not found on the server.',
    });

    const result = parseInteractiveBlock(payload);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.block.type).toBe('mcq');
      expect(result.block.question).toContain('Not Found');
      expect(result.block.options).toHaveLength(3);
    }
  });

  // 2. Multiple Choice Question (Multi Select)
  it('validates and parses a multi-select MCQ block with array of correct answers', () => {
    const payload = JSON.stringify({
      version: '1.0',
      type: 'mcq',
      question: 'Which of the following are primary colors of light?',
      multiSelect: true,
      options: [
        { id: 'red', label: 'Red' },
        { id: 'green', label: 'Green' },
        { id: 'blue', label: 'Blue' },
        { id: 'yellow', label: 'Yellow' },
      ],
      correctAnswer: ['red', 'green', 'blue'],
      explanation: 'Red, green, and blue (RGB) are additive primary colors of light.',
    });

    const result = parseInteractiveBlock(payload);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.block.type).toBe('mcq');
      expect(result.block.multiSelect).toBe(true);
      expect(result.block.correctAnswer).toEqual(['red', 'green', 'blue']);
    }
  });

  // 3. Multi-Question Quiz Block
  it('validates and parses a multi-question Quiz block', () => {
    const payload = JSON.stringify({
      version: '1.0',
      type: 'quiz',
      title: 'TypeScript Foundations Quiz',
      description: 'Test your understanding of core TypeScript concepts.',
      passingScore: 75,
      questions: [
        {
          id: 'q1',
          question: 'What keyword defines an immutable binding in JavaScript?',
          options: [
            { id: 'var', label: 'var' },
            { id: 'const', label: 'const' },
            { id: 'let', label: 'let' },
          ],
          correctAnswer: 'const',
          explanation: 'const creates a block-scoped binding that cannot be reassigned.',
        },
        {
          id: 'q2',
          question: 'Which type represents a value that is never returned from a function?',
          options: [
            { id: 'void', label: 'void' },
            { id: 'never', label: 'never' },
            { id: 'null', label: 'null' },
          ],
          correctAnswer: 'never',
          explanation: 'never is the return type for a function that throws an error or never returns.',
        },
      ],
    });

    const result = parseInteractiveBlock(payload);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.block.type).toBe('quiz');
      expect(result.block.questions).toHaveLength(2);
      expect(result.block.passingScore).toBe(75);
    }
  });

  // 4. Poll Block
  it('validates and parses an interactive Poll block', () => {
    const payload = JSON.stringify({
      version: '1.0',
      type: 'poll',
      title: 'Developer Tooling Preference',
      question: 'Which build tool do you prefer for modern web projects?',
      options: [
        { id: 'vite', label: 'Vite', votes: 142 },
        { id: 'webpack', label: 'Webpack', votes: 45 },
        { id: 'turbopack', label: 'Turbopack', votes: 31 },
      ],
    });

    const result = parseInteractiveBlock(payload);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.block.type).toBe('poll');
      expect(result.block.options[0].votes).toBe(142);
    }
  });

  // 5. Checklist Block
  it('validates and parses an interactive Checklist block', () => {
    const payload = JSON.stringify({
      version: '1.0',
      type: 'checklist',
      title: 'Pre-Deployment Verification',
      items: [
        { id: '1', label: 'Run unit test suite', checked: true },
        { id: '2', label: 'Validate production build', checked: true },
        { id: '3', label: 'Check security headers', checked: false },
      ],
    });

    const result = parseInteractiveBlock(payload);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.block.type).toBe('checklist');
      expect(result.block.items).toHaveLength(3);
    }
  });

  // 6. Accordion Block
  it('validates and parses an Accordion block', () => {
    const payload = JSON.stringify({
      version: '1.0',
      type: 'accordion',
      title: 'Authentication Architecture FAQ',
      items: [
        {
          id: 'q1',
          title: 'How does PKCE prevent code interception?',
          content: 'PKCE requires the client to prove possession of a secret verifier corresponding to the challenge.',
          defaultExpanded: true,
        },
      ],
    });

    const result = parseInteractiveBlock(payload);
    expect(result.status).toBe('valid');
  });

  // 7. Comparison Block
  it('validates and parses a Comparison matrix block', () => {
    const payload = JSON.stringify({
      version: '1.0',
      type: 'comparison',
      title: 'Client Storage Options',
      entities: ['IndexedDB', 'localStorage'],
      criteria: [
        {
          criterion: 'Storage Capacity',
          values: { IndexedDB: 'Hundreds of MBs / GBs', localStorage: '~5-10 MB' },
          winner: 'IndexedDB',
        },
        {
          criterion: 'Asynchronous API',
          values: { IndexedDB: true, localStorage: false },
          winner: 'IndexedDB',
        },
      ],
    });

    const result = parseInteractiveBlock(payload);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.block.type).toBe('comparison');
      expect(result.block.entities).toHaveLength(2);
      expect(result.block.criteria).toHaveLength(2);
    }
  });

  // 8. Sliders / Input Controls Block
  it('validates and parses an Input Controls block', () => {
    const payload = JSON.stringify({
      version: '1.0',
      type: 'input_controls',
      title: 'Sampling Parameters',
      controls: [
        {
          type: 'slider',
          id: 'temperature',
          label: 'Temperature',
          min: 0,
          max: 2,
          step: 0.1,
          defaultValue: 0.7,
        },
        {
          type: 'toggle',
          id: 'stream',
          label: 'Stream Responses',
          defaultValue: true,
        },
      ],
    });

    const result = parseInteractiveBlock(payload);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.block.type).toBe('input_controls');
      expect(result.block.controls).toHaveLength(2);
    }
  });

  // 9. Charts and Progress
  it('validates and parses Chart and Progress blocks', () => {
    const chartPayload = JSON.stringify({
      version: '1.0',
      type: 'chart',
      title: 'Latency Breakdown',
      chartType: 'bar',
      data: [
        { label: 'DNS', value: 12 },
        { label: 'TLS', value: 24 },
        { label: 'TTFB', value: 150 },
      ],
    });

    const progressPayload = JSON.stringify({
      version: '1.0',
      type: 'progress',
      title: 'Storage Quota',
      items: [{ label: 'Local Cache', value: 45, max: 100, details: '45MB used of 100MB' }],
    });

    expect(parseInteractiveBlock(chartPayload).status).toBe('valid');
    expect(parseInteractiveBlock(progressPayload).status).toBe('valid');
  });

  // 10. Stripping Markdown Code Fences
  it('strips fenced code blocks (```interactive ... ```)', () => {
    const raw = `\`\`\`interactive
{
  "version": "1.0",
  "type": "mcq",
  "question": "What is the capital of France?",
  "options": [
    { "id": "1", "label": "Paris" },
    { "id": "2", "label": "Lyon" }
  ],
  "correctAnswer": "1"
}
\`\`\``;

    const result = parseInteractiveBlock(raw);
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.block.type).toBe('mcq');
      expect(result.block.question).toContain('France');
    }
  });

  // 11. Malformed JSON Handling
  it('gracefully reports invalid status when given malformed JSON', () => {
    const malformed = '{"version": "1.0", "type": "mcq", "question": incomplete';
    const result = parseInteractiveBlock(malformed);
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.error).toContain('Malformed JSON');
    }
  });

  // 12. Streaming Incomplete Handling
  it('reports streaming_incomplete when isStreaming is true and JSON is partial', () => {
    const partial = '{"version": "1.0", "type": "mcq", "question": "What is';
    const result = parseInteractiveBlock(partial, { isStreaming: true });
    expect(result.status).toBe('streaming_incomplete');
  });

  // 13. Schema Violation Handling (Missing required fields)
  it('rejects payloads missing essential schema properties', () => {
    const invalidSchema = JSON.stringify({
      version: '1.0',
      type: 'mcq',
      // missing question and options
    });

    const result = parseInteractiveBlock(invalidSchema);
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.error).toContain('Schema validation failed');
    }
  });

  // 14. Unknown Block Type
  it('rejects unsupported block types', () => {
    const unknown = JSON.stringify({
      version: '1.0',
      type: 'malicious_eval',
      script: 'alert(1)',
    });

    const result = parseInteractiveBlock(unknown);
    expect(result.status).toBe('invalid');
  });
});
