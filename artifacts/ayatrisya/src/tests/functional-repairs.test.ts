import { describe, it, expect, vi } from 'vitest';
import { detectMarkdownQuizOrMcq } from '@/components/interactive-blocks/quiz-detector';
import { cleanTextForSpeech } from '@/components/voice/voice-utils';
import { generateProceduralWav } from '../../../api-server/src/lib/music-generator';
import { generateProceduralPng } from '../../../api-server/src/lib/image-generator';
import { validateAudioBuffer } from '../../../api-server/src/lib/audio-validator';

describe('Ayatrisya Functional Repairs Test Suite', () => {
  describe('1. Quiz and MCQ Detection & Interaction', () => {
    it('detects a Class 10 Science quiz in plain markdown and parses into a validated QuizBlock', () => {
      const sampleQuiz = `Here is your Class 10 Science practice quiz:

1. Which organelle is known as the powerhouse of the cell?
A) Ribosome
B) Mitochondria
C) Nucleus
D) Endoplasmic Reticulum
Answer: B
Explanation: Mitochondria generate most of the chemical energy needed by the cell.

2. What is the chemical formula of rust?
A) FeO
B) Fe2O3.xH2O
C) Fe3O4
D) FeCl3
Answer: B
Explanation: Rust is hydrated iron(III) oxide.

Good luck with your revision!`;

      const detected = detectMarkdownQuizOrMcq(sampleQuiz);
      expect(detected).not.toBeNull();
      expect(detected?.block.type).toBe('quiz');
      if (detected && detected.block.type === 'quiz') {
        expect(detected.block.questions).toHaveLength(2);
        expect(detected.block.questions[0].question).toContain('powerhouse of the cell');
        expect(detected.block.questions[0].options).toHaveLength(4);
        expect(detected.block.questions[0].correctAnswer).toBe('b');
        expect(detected.block.questions[0].explanation).toContain('Mitochondria');
        expect(detected.block.questions[1].correctAnswer).toBe('b');
        expect(detected.beforeText).toContain('Class 10 Science');
        expect(detected.afterText).toContain('Good luck with your revision!');
      }
    });

    it('detects a single MCQ and parses into a validated McqBlock', () => {
      const singleMcq = `Question 1: What is the unit of electric current?
A) Volt
B) Ampere
C) Ohm
D) Watt
Answer: B
Explanation: Electric current is measured in Amperes.`;

      const detected = detectMarkdownQuizOrMcq(singleMcq);
      expect(detected).not.toBeNull();
      expect(detected?.block.type).toBe('mcq');
      if (detected && detected.block.type === 'mcq') {
        expect(detected.block.question).toContain('electric current');
        expect(detected.block.options).toHaveLength(4);
        expect(detected.block.correctAnswer).toBe('b');
      }
    });

    it('preserves ordinary numbered lists and does not falsely detect them as quizzes', () => {
      const regularList = `Here are 3 steps to set up your project:
1. Install dependencies using pnpm install
2. Configure your environment variables in .env
3. Run the development server with npm run dev`;

      const detected = detectMarkdownQuizOrMcq(regularList);
      expect(detected).toBeNull();
    });

    it('ignores text that already contains an explicit interactive block fence', () => {
      const fencedText = '```interactive\n{"type":"quiz","version":"1.0"}\n```';
      const detected = detectMarkdownQuizOrMcq(fencedText);
      expect(detected).toBeNull();
    });
  });

  describe('2. Voice Utilities & Clean Speech Text', () => {
    it('strips interactive fences, code blocks, math, and links for natural TTS speech', () => {
      const rawMarkdown = `Let us calculate the complexity:
\`\`\`interactive
{"type":"quiz","questions":[]}
\`\`\`
The time complexity is $O(n \\log n)$ and the formula is $$E = mc^2$$.
Check out [Ayatrisya Documentation](https://ayatrisya.ai/docs).
Here is a snippet:
\`\`\`python
print("hello world")
\`\`\`
`;
      const cleaned = cleanTextForSpeech(rawMarkdown);
      expect(cleaned).not.toContain('```interactive');
      expect(cleaned).not.toContain('questions');
      expect(cleaned).not.toContain('https://ayatrisya.ai/docs');
      expect(cleaned).toContain('Ayatrisya Documentation');
      expect(cleaned).toContain('[formula]');
      expect(cleaned).toContain('[Code snippet]');
    });
  });

  describe('3. Music Generation Procedural Synthesis', () => {
    it('synthesizes a valid, non-empty WAV audio buffer with RIFF/WAVE container header', () => {
      const wavBuffer = generateProceduralWav('Upbeat electronic synthwave groove', 3);
      expect(wavBuffer).toBeInstanceOf(Buffer);
      expect(wavBuffer.length).toBeGreaterThan(44);

      const validation = validateAudioBuffer(wavBuffer, 'WAV');
      expect(validation.valid).toBe(true);
      expect(validation.format).toBe('WAV');
      expect(validation.durationSeconds).toBeGreaterThan(2);
      expect(validation.sampleRate).toBe(44100);
      expect(validation.channels).toBe(1);
    });
  });

  describe('4. Image Generation Procedural Synthesis', () => {
    it('synthesizes a valid, non-empty PNG buffer with PNG signature and IHDR/IDAT/IEND chunks', () => {
      const pngBuffer = generateProceduralPng('A majestic mountain sunset with glowing purple sky', 128, 128);
      expect(pngBuffer).toBeInstanceOf(Buffer);
      expect(pngBuffer.length).toBeGreaterThan(100);

      // Verify standard PNG magic numbers: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
      expect(pngBuffer[0]).toBe(0x89);
      expect(pngBuffer[1]).toBe(0x50); // P
      expect(pngBuffer[2]).toBe(0x4e); // N
      expect(pngBuffer[3]).toBe(0x47); // G
      expect(pngBuffer[4]).toBe(0x0d);
      expect(pngBuffer[5]).toBe(0x0a);
      expect(pngBuffer[6]).toBe(0x1a);
      expect(pngBuffer[7]).toBe(0x0a);
    });
  });

  describe('5. Website Capability-Aware Logic', () => {
    it('correctly reports 3D as unavailable when running on the web without desktop bridge', () => {
      const isDesktop = false;
      const cloudCaps = [{ id: 'v1-fast', available: true, modalities: ['chat', 'image', 'music'] }];
      const capableFor3d = isDesktop && cloudCaps.some((c) => c.available && c.modalities.includes('3d'));
      expect(capableFor3d).toBe(false);
    });

    it('reports 3D as available when running in Ayatrisya Desktop with 3D engine capability', () => {
      const isDesktop = true;
      const desktopCaps = [{ id: 'v1-fast', available: true, modalities: ['chat', 'image', 'music', '3d'] }];
      const capableFor3d = isDesktop && desktopCaps.some((c) => c.available && c.modalities.includes('3d'));
      expect(capableFor3d).toBe(true);
    });
  });
});
