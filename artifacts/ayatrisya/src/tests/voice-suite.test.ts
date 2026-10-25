import { describe, it, expect } from 'vitest';
import {
  cleanTextForSpeech,
  speakText,
  createSpeechRecognizer,
} from '@/components/voice/voice-utils';

describe('Voice Utilities & Spoken Text Cleaning', () => {
  it('strips interactive blocks from spoken text', () => {
    const raw = `Here is your quiz:
\`\`\`interactive
{
  "version": "1.0",
  "type": "quiz",
  "title": "Quantum Physics Quiz",
  "questions": []
}
\`\`\`
Good luck on the quiz!`;

    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).not.toContain('```interactive');
    expect(cleaned).not.toContain('Quantum Physics Quiz');
    expect(cleaned).toContain('Here is your quiz:');
    expect(cleaned).toContain('Good luck on the quiz!');
  });

  it('replaces code blocks with natural verbal indicators', () => {
    const raw = `To define a function in TypeScript:
\`\`\`typescript
export function greet(name: string): string {
  return \`Hello \${name}\`;
}
\`\`\`
Then call greet("Ayatrisya").`;

    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).not.toContain('export function greet');
    expect(cleaned).toContain('[Code snippet]');
    expect(cleaned).toContain('Then call greet("Ayatrisya").');
  });

  it('strips markdown links, bold, italics, headers, and formulas', () => {
    const raw = `# Heading 1
Check out [Ayatrisya Docs](https://ayatrisya.ai/docs) for **great** insights.
The formula is $E = mc^2$ and $$\\int_0^1 x dx$$.
- Item A
- Item B`;

    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).not.toContain('#');
    expect(cleaned).not.toContain('**');
    expect(cleaned).not.toContain('https://ayatrisya.ai/docs');
    expect(cleaned).toContain('Ayatrisya Docs');
    expect(cleaned).toContain('great');
    expect(cleaned).toContain('[formula]');
    expect(cleaned).toContain('Item A');
  });

  it('handles empty or blank text gracefully', () => {
    expect(cleanTextForSpeech('')).toBe('');
    expect(cleanTextForSpeech('   ')).toBe('');
  });

  it('speakText handles empty string without throwing', () => {
    let ended = false;
    const handle = speakText('', {
      onEnd: () => {
        ended = true;
      },
    });
    expect(handle).toBeDefined();
    expect(typeof handle.stop).toBe('function');
  });

  it('createSpeechRecognizer gracefully reports support status in test env', () => {
    let errorReceived = '';
    const recognizer = createSpeechRecognizer({
      onResult: () => {},
      onError: (err) => {
        errorReceived = err;
      },
      onEnd: () => {},
    });

    expect(recognizer).toBeDefined();
    // In node/vitest, Web Speech API is absent
    if (!recognizer.isSupported) {
      recognizer.start();
      expect(errorReceived).toMatch(/not supported|outside browser/i);
    }
  });
});
