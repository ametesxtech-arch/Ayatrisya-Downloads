import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateFallbackTitle, generateConversationTitle, scheduleAutoTitle } from '../ai/conversation-title';
import { LocalRepository } from '../storage/repository';
import { modelClient } from '../ai/client';

describe('Ayatrisya — Automatic AI Conversation Titles (ChatGPT-style)', () => {
  let repo: LocalRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new LocalRepository(`test-titles-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    repo.setOwner('test-user');
  });

  describe('Fallback Heuristic & Intent Understanding (Requirements 1, 2, 10, 11)', () => {
    it('accurately extracts "Portfolio Website" from "Build me a portfolio website"', () => {
      const title = generateFallbackTitle('Build me a portfolio website');
      expect(title).toBe('Portfolio Website');
    });

    it('accurately transforms "Explain photosynthesis" to "Understanding Photosynthesis"', () => {
      const title = generateFallbackTitle('Explain photosynthesis');
      expect(title).toBe('Understanding Photosynthesis');
    });

    it('accurately extracts "Three.js Horror Game" from "Create a horror game in Three.js"', () => {
      const title = generateFallbackTitle('Create a horror game in Three.js');
      expect(title).toBe('Three.js Horror Game');
    });

    it('accurately transforms "Help me plan my startup" to "Startup Planning"', () => {
      const title = generateFallbackTitle('Help me plan my startup');
      expect(title).toBe('Startup Planning');
    });

    it('handles empty prompts with image attachment sensibly as "Image Analysis"', () => {
      const title = generateFallbackTitle('', [{ name: 'screenshot.png', mimeType: 'image/png' }]);
      expect(title).toBe('Image Analysis');
    });

    it('handles empty prompts with PDF attachment sensibly as "Document Review"', () => {
      const title = generateFallbackTitle('', [{ name: 'quarterly_report.pdf', mimeType: 'application/pdf' }]);
      expect(title).toBe('Document Review');
    });

    it('handles empty prompts with code attachment sensibly as "Code Review"', () => {
      const title = generateFallbackTitle('', [{ name: 'engine.ts', mimeType: 'text/typescript' }]);
      expect(title).toBe('Code Review: engine.ts');
    });

    it('handles simple conversational greetings without generating weird titles', () => {
      expect(generateFallbackTitle('hello')).toBe('General Conversation');
      expect(generateFallbackTitle('Hi there!')).toBe('General Conversation');
      expect(generateFallbackTitle('Good morning')).toBe('General Conversation');
    });
  });

  describe('AI Model Gateway Integration with Graceful Fallback (Requirements 2, 3, 10, 13)', () => {
    it('uses modelClient to generate concise titles when available', async () => {
      vi.spyOn(modelClient, 'generateResponse').mockResolvedValueOnce('Three.js Horror Game');

      const title = await generateConversationTitle('Can you help me create a horror game using Three.js with scary lighting?');
      expect(title).toBe('Three.js Horror Game');
    });

    it('strips quotes, prefixes, and markdown asterisks returned by models', async () => {
      vi.spyOn(modelClient, 'generateResponse').mockResolvedValueOnce('Title: "Quantum Physics Overview"');

      const title = await generateConversationTitle('Explain quantum physics and wave particle duality');
      expect(title).toBe('Quantum Physics Overview');
    });

    it('falls back seamlessly to local heuristic when model gateway throws', async () => {
      vi.spyOn(modelClient, 'generateResponse').mockRejectedValueOnce(new Error('Network offline or rate limit'));

      const title = await generateConversationTitle('Build me a portfolio website');
      expect(title).toBe('Portfolio Website');
    });

    it('falls back to local heuristic if model returns degenerate or excessively long text', async () => {
      vi.spyOn(modelClient, 'generateResponse').mockResolvedValueOnce('Here is a very long paragraph that goes on and on and contains way more than seven words and has lots of unnecessary conversational fluff and explanations.');

      const title = await generateConversationTitle('Build me a portfolio website');
      expect(title).toBe('Portfolio Website');
    });
  });

  describe('Asynchronous Naming & Storage State Management (Requirements 3, 4, 5, 6, 7, 8, 9)', () => {
    it('assigns an automatic title on the first user message without blocking chat', async () => {
      const conv = await repo.createConversation('New conversation');
      expect(conv.title).toBe('New conversation');

      // User sends the first meaningful message
      await repo.addMessage(conv.id, 'Build me a portfolio website', 'user');

      // Check immediate fallback title in storage
      const immediate = await repo.getConversation(conv.id);
      expect(immediate?.title).toBe('Portfolio Website');

      // Trigger async title generation
      vi.spyOn(modelClient, 'generateResponse').mockResolvedValueOnce('Portfolio Website Showcase');
      await scheduleAutoTitle(conv.id, 'Build me a portfolio website', { customRepository: repo });

      // Wait for async tick
      await new Promise((r) => setTimeout(r, 20));

      const updated = await repo.getConversation(conv.id);
      expect(updated?.title).toBe('Portfolio Website Showcase');
      expect(updated?.autoTitled).toBe(true);
    });

    it('never derives the conversation title from the assistant response (Requirement 4)', async () => {
      const conv = await repo.createConversation('New conversation');
      await repo.addMessage(conv.id, 'Explain photosynthesis', 'user');

      const userTitled = await repo.getConversation(conv.id);
      expect(userTitled?.title).toBe('Understanding Photosynthesis');

      // Assistant responds with detailed information
      await repo.addMessage(conv.id, 'Photosynthesis is a biological process used by plants to convert light energy into chemical energy...', 'assistant');

      const afterAssistant = await repo.getConversation(conv.id);
      // Title remains based purely on user prompt, unaffected by assistant text
      expect(afterAssistant?.title).toBe('Understanding Photosynthesis');
    });

    it('does not change the title on subsequent user messages (Requirement 5)', async () => {
      const conv = await repo.createConversation('New conversation');
      await repo.addMessage(conv.id, 'Create a horror game in Three.js', 'user');
      await repo.updateConversation(conv.id, { autoTitled: true });

      // Second user message in same conversation
      await repo.addMessage(conv.id, 'Now change the lighting to red and add fog', 'user');

      const convAfterSecond = await repo.getConversation(conv.id);
      expect(convAfterSecond?.title).toBe('Three.js Horror Game');

      // Attempting to schedule title again on subsequent message is ignored
      vi.spyOn(modelClient, 'generateResponse').mockResolvedValueOnce('Foggy Red Lighting');
      await scheduleAutoTitle(conv.id, 'Now change the lighting to red and add fog', { customRepository: repo });
      await new Promise((r) => setTimeout(r, 20));

      const finalConv = await repo.getConversation(conv.id);
      expect(finalConv?.title).toBe('Three.js Horror Game');
    });

    it('preserves manual rename and prevents automatic title from overwriting user edits (Requirement 6)', async () => {
      const conv = await repo.createConversation('New conversation');
      await repo.addMessage(conv.id, 'Help me plan my startup', 'user');

      // User manually renames the conversation
      await repo.renameConversation(conv.id, 'My Secret Unicorn Pitch');
      const renamed = await repo.getConversation(conv.id);
      expect(renamed?.title).toBe('My Secret Unicorn Pitch');
      expect(renamed?.manualTitle).toBe(true);

      // Async title job tries to run after user manual rename
      vi.spyOn(modelClient, 'generateResponse').mockResolvedValueOnce('Startup Planning');
      await scheduleAutoTitle(conv.id, 'Help me plan my startup', { customRepository: repo });
      await new Promise((r) => setTimeout(r, 20));

      const preserved = await repo.getConversation(conv.id);
      // Manual rename must be preserved
      expect(preserved?.title).toBe('My Secret Unicorn Pitch');
    });

    it('persists titles across database reload (Requirement 7 & 8)', async () => {
      const conv = await repo.createConversation('New conversation');
      await repo.addMessage(conv.id, 'Build me a portfolio website', 'user');

      // Close and reopen repository with same database name
      const reopened = new LocalRepository(repo['name']);
      reopened.setOwner('test-user');

      const restored = await reopened.getConversation(conv.id);
      expect(restored?.title).toBe('Portfolio Website');
    });

    it('failure in AI title generation does not break chat or corrupt conversation (Requirement 10 & Acceptance Check)', async () => {
      const conv = await repo.createConversation('New conversation');

      // Simulate network crash during model title call
      vi.spyOn(modelClient, 'generateResponse').mockRejectedValue(new Error('Fatal 500 Model Gateway Crash'));

      // Chat proceeds normally
      await repo.addMessage(conv.id, 'Explain photosynthesis', 'user');
      await scheduleAutoTitle(conv.id, 'Explain photosynthesis', { customRepository: repo });
      await new Promise((r) => setTimeout(r, 20));

      // Conversation still has valid clean fallback title
      const safeConv = await repo.getConversation(conv.id);
      expect(safeConv?.title).toBe('Understanding Photosynthesis');

      // Assistant can continue chatting without error
      const msg = await repo.addMessage(conv.id, 'Chlorophyll absorbs sunlight...', 'assistant');
      expect(msg.content).toContain('Chlorophyll');
    });
  });
});
