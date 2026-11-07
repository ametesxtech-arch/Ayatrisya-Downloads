import 'fake-indexeddb/auto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssessmentContainer } from '../components/interactive-blocks/assessment/AssessmentContainer';
import { SingleChoiceQuestion } from '../components/interactive-blocks/assessment/SingleChoiceQuestion';
import { MultipleChoiceQuestion } from '../components/interactive-blocks/assessment/MultipleChoiceQuestion';
import { AssertionReasonQuestion } from '../components/interactive-blocks/assessment/AssertionReasonQuestion';
import { MatchQuestion } from '../components/interactive-blocks/assessment/MatchQuestion';
import { CaseStudyQuestion } from '../components/interactive-blocks/assessment/CaseStudyQuestion';
import { AssessmentResults } from '../components/interactive-blocks/assessment/AssessmentResults';
import { AssessmentPalette } from '../components/interactive-blocks/assessment/AssessmentPalette';
import { detectMarkdownQuizOrMcq } from '../components/interactive-blocks/quiz-detector';
import type { AssessmentBlockData, AssessmentQuestion } from '../components/interactive-blocks/assessment/assessment-types';

describe('Ayatrisya Interactive Conversation Engine — Assessments & MCQs', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
    });
  });

  describe('1. Universal Question Types & Rendering', () => {
    it('renders single-choice MCQ with option labels and feedback states', () => {
      const q: AssessmentQuestion = {
        id: 'q1',
        type: 'single_choice',
        question: 'What is the primary function of mitochondria?',
        options: [
          { id: 'a', label: 'Cellular respiration and ATP synthesis' },
          { id: 'b', label: 'Protein synthesis' },
          { id: 'c', label: 'Photosynthesis' },
          { id: 'd', label: 'Lipid transport' },
        ],
        correctAnswer: 'a',
        explanation: 'Mitochondria generate most of the chemical energy needed to power the cell.',
      };

      const html = renderToStaticMarkup(
        <SingleChoiceQuestion
          question={q}
          selectedAnswer="a"
          onSelect={vi.fn()}
          showFeedback={true}
        />
      );

      expect(html).toContain('Cellular respiration and ATP synthesis');
      expect(html).toContain('Protein synthesis');
      expect(html).toContain('border-emerald-500'); // Green border for correct answer
    });

    it('renders multiple-choice questions with select all that apply', () => {
      const q: AssessmentQuestion = {
        id: 'q2',
        type: 'multiple_choice',
        question: 'Which of the following are prime numbers?',
        options: [
          { id: 'a', label: '2' },
          { id: 'b', label: '4' },
          { id: 'c', label: '7' },
          { id: 'd', label: '9' },
        ],
        correctAnswer: ['a', 'c'],
      };

      const html = renderToStaticMarkup(
        <MultipleChoiceQuestion
          question={q}
          selectedAnswers={['a', 'c']}
          onToggle={vi.fn()}
        />
      );

      expect(html).toContain('Select all that apply');
      expect(html).toContain('2');
      expect(html).toContain('7');
    });

    it('renders Assertion & Reasoning questions with distinct A & R sections', () => {
      const q: AssessmentQuestion = {
        id: 'ar1',
        type: 'assertion_reason',
        question: 'Assertion and Reasoning on Photosynthesis',
        assertion: 'Plants appear green to the human eye.',
        reason: 'Chlorophyll pigments absorb green wavelengths and reflect red/blue.',
        correctAnswer: 'c', // A is true, R is false
        explanation: 'Chlorophyll absorbs blue and red wavelengths and reflects green light.',
      };

      const html = renderToStaticMarkup(
        <AssertionReasonQuestion
          question={q}
          selectedAnswer="c"
          onSelect={vi.fn()}
        />
      );

      expect(html).toContain('Assertion (A)');
      expect(html).toContain('Plants appear green to the human eye.');
      expect(html).toContain('Reason (R)');
      expect(html).toContain('Chlorophyll pigments absorb green wavelengths');
      expect(html).toContain('Assertion (A) is true, but Reason (R) is false.');
    });

    it('renders Match the Following questions connecting Column A and Column B', () => {
      const q: AssessmentQuestion = {
        id: 'm1',
        type: 'match_following',
        question: 'Match the scientist with their discovery',
        matchPairs: [
          { id: '1', left: 'Alexander Fleming', right: 'Penicillin' },
          { id: '2', left: 'Edward Jenner', right: 'Smallpox Vaccine' },
          { id: '3', left: 'Louis Pasteur', right: 'Rabies Vaccine' },
        ],
        correctAnswer: { '1': '1', '2': '2', '3': '3' },
      };

      const html = renderToStaticMarkup(
        <MatchQuestion
          question={q}
          selectedMatches={{ '1': '1' }}
          onMatch={vi.fn()}
        />
      );

      expect(html).toContain('Alexander Fleming');
      expect(html).toContain('Edward Jenner');
      expect(html).toContain('Penicillin');
      expect(html).toContain('Smallpox Vaccine');
    });

    it('renders Case Study questions with readable passage scenario and attached question', () => {
      const q: AssessmentQuestion = {
        id: 'cs1',
        type: 'case_based',
        question: 'Based on the experimental data, what was the optimal pH for enzyme activity?',
        caseTitle: 'Case Study: Catalase Reaction Kinetics',
        casePassage: 'A laboratory investigated the breakdown of hydrogen peroxide by catalase across pH levels 4 to 9...',
        options: [
          { id: 'a', label: 'pH 4.0' },
          { id: 'b', label: 'pH 7.0' },
          { id: 'c', label: 'pH 9.0' },
        ],
        correctAnswer: 'b',
      };

      const html = renderToStaticMarkup(
        <CaseStudyQuestion
          question={q}
          selectedAnswer="b"
          onSelect={vi.fn()}
        />
      );

      expect(html).toContain('Case Study: Catalase Reaction Kinetics');
      expect(html).toContain('hydrogen peroxide by catalase');
      expect(html).toContain('pH 7.0');
    });
  });

  describe('2. Assessment Container, Modes & Lifecycle', () => {
    const mockAssessment: AssessmentBlockData = {
      version: '1.0',
      type: 'assessment',
      title: 'CBSE Class 12 Physics: Electrostatics Mock Exam',
      description: 'Comprehensive test covering Gauss Law and Capacitance',
      timeLimitMinutes: 15,
      mode: 'practice',
      passingScore: 70,
      questions: [
        {
          id: 'q1',
          type: 'single_choice',
          question: 'What is the SI unit of electric flux?',
          options: [
            { id: 'a', label: 'N m^2 C^-1' },
            { id: 'b', label: 'N m C^-1' },
            { id: 'c', label: 'N C^-1' },
            { id: 'd', label: 'J C^-1' },
          ],
          correctAnswer: 'a',
          topic: 'Electric Flux',
          isPyq: true,
          pyqSource: 'CBSE 2023',
        },
        {
          id: 'q2',
          type: 'single_choice',
          question: 'The capacitance of a parallel plate capacitor increases when:',
          options: [
            { id: 'a', label: 'Plate area decreases' },
            { id: 'b', label: 'Plate separation decreases' },
            { id: 'c', label: 'Dielectric is removed' },
            { id: 'd', label: 'Voltage decreases' },
          ],
          correctAnswer: 'b',
          topic: 'Capacitance',
        },
      ],
    };

    it('renders assessment container with practice mode, timer, and progress tracker', () => {
      const html = renderToStaticMarkup(
        <AssessmentContainer block={mockAssessment} blockId="test-assessment-1" />
      );

      expect(html).toContain('CBSE Class 12 Physics: Electrostatics Mock Exam');
      expect(html).toContain('practice mode');
      expect(html).toContain('Instant Feedback &amp; Explanations');
      expect(html).toContain('Question 1 of 2');
      expect(html).toContain('PYQ: CBSE 2023');
      expect(html).toContain('What is the SI unit of electric flux?');
    });

    it('renders Question Palette with question jump numbers and color legend', () => {
      const html = renderToStaticMarkup(
        <AssessmentPalette
          questions={mockAssessment.questions}
          currentIndex={0}
          answers={{ q1: 'a' }}
          markedForReview={{ q2: true }}
          onSelectQuestion={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('Question Palette');
      expect(html).toContain('Answered');
      expect(html).toContain('Review');
      expect(html).toContain('Unanswered');
    });

    it('renders Assessment Results with score, pass/fail status, and topic breakdown', () => {
      const html = renderToStaticMarkup(
        <AssessmentResults
          questions={mockAssessment.questions}
          answers={{ q1: 'a', q2: 'c' }} // 1 correct, 1 incorrect (50%)
          passingScore={70}
          totalTimeSpentSeconds={142}
          reviewFilter="all"
          onFilterChange={vi.fn()}
          onRetake={vi.fn()}
        />
      );

      expect(html).toContain('NEEDS PRACTICE');
      expect(html).toContain('50%');
      expect(html).toContain('Correct');
      expect(html).toContain('Incorrect');
      expect(html).toContain('2m 22s');
      expect(html).toContain('Review Mistakes (1)');
      expect(html).toContain('Retake Assessment');
    });
  });

  describe('3. Universal Interactive Markdown Quiz & PYQ Detection', () => {
    it('automatically detects standard markdown quizzes and extracts PYQ metadata', () => {
      const markdown = `
Here are practice questions for your revision:

### Question 1: [CBSE 2023] Which of the following is an amphoteric oxide?
A) Na2O
B) Al2O3
C) SO2
D) CaO
Answer: B
Explanation: Al2O3 reacts with both acids and bases, making it amphoteric.

### Question 2: Which gas is liberated when zinc reacts with dilute sulfuric acid?
A) Oxygen
B) Nitrogen
C) Hydrogen
D) Carbon dioxide
Answer: C
Explanation: Zn + H2SO4 -> ZnSO4 + H2.

Good luck with your exam!
      `;

      const detected = detectMarkdownQuizOrMcq(markdown);
      expect(detected).not.toBeNull();
      expect(detected?.block.type).toBe('quiz');

      const quizBlock = detected?.block as any;
      expect(quizBlock.questions.length).toBe(2);
      expect(quizBlock.questions[0].isPyq).toBe(true);
      expect(quizBlock.questions[0].pyqSource).toBe('CBSE 2023');
      expect(quizBlock.questions[0].correctAnswer).toBe('b');
      expect(quizBlock.questions[1].correctAnswer).toBe('c');
      expect(detected?.beforeText).toContain('Here are practice questions');
      expect(detected?.afterText).toContain('Good luck with your exam!');
    });

    it('automatically detects Assertion & Reasoning markdown questions', () => {
      const markdown = `
Question 1:
Assertion (A): Electric field lines never cross each other.
Reason (R): If they cross, there would be two directions of electric field at that single point, which is impossible.
A) Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation.
B) Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation.
C) Assertion (A) is true but Reason (R) is false.
D) Assertion (A) is false but Reason (R) is true.
Answer: A
Explanation: Electric field at any point has a unique direction defined by the tangent.
      `;

      const detected = detectMarkdownQuizOrMcq(markdown);
      expect(detected).not.toBeNull();
      const quizBlock = detected?.block as any;
      expect(quizBlock.questions.length).toBe(1);
      expect(quizBlock.questions[0].type).toBe('assertion_reason');
      expect(quizBlock.questions[0].assertion).toContain('Electric field lines never cross');
      expect(quizBlock.questions[0].reason).toContain('two directions of electric field');
      expect(quizBlock.questions[0].correctAnswer).toBe('a');
    });
  });
});
