import React, { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { InteractiveBlock } from './types';
import { McqBlockRenderer } from './McqBlockRenderer';
import { QuizBlockRenderer } from './QuizBlockRenderer';
import { PollBlockRenderer } from './PollBlockRenderer';
import { FlashcardBlockRenderer } from './FlashcardBlockRenderer';
import { MatchingBlockRenderer, SortingBlockRenderer } from './MatchingSortingBlockRenderer';
import { FillBlankBlockRenderer } from './FillBlankBlockRenderer';
import { DecisionTreeBlockRenderer } from './DecisionTreeBlockRenderer';
import { AccordionBlockRenderer } from './AccordionBlockRenderer';
import { StepsBlockRenderer } from './StepsBlockRenderer';
import { ChecklistBlockRenderer } from './ChecklistBlockRenderer';
import { KanbanBlockRenderer } from './KanbanBlockRenderer';
import { FormWizardBlockRenderer } from './FormWizardBlockRenderer';
import { CalculatorBlockRenderer } from './CalculatorBlockRenderer';
import { DiagramBlockRenderer } from './DiagramBlockRenderer';
import {
  JsonViewerBlockRenderer,
  RegexTesterBlockRenderer,
  ApiBuilderBlockRenderer,
} from './DeveloperToolsBlockRenderer';
import { ComparisonBlockRenderer } from './ComparisonBlockRenderer';
import { TableBlockRenderer } from './TableBlockRenderer';
import { InputControlsBlockRenderer } from './InputControlsBlockRenderer';
import { ProgressBlockRenderer, ChartBlockRenderer } from './ChartProgressBlockRenderer';
import {
  AudioPlayerBlockRenderer,
  MidiPreviewBlockRenderer,
  StoryboardBlockRenderer,
  ImageVariationBlockRenderer,
} from './CreativeMediaBlockRenderer';
import { MediaBlockRenderer } from './MediaBlockRenderer';
import { ScheduledTaskBlockRenderer } from './ScheduledTaskBlockRenderer';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackContent?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class InteractiveBlockErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('[InteractiveBlock] Error in block component:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="my-3 rounded-lg border border-rose-500/30 bg-rose-950/20 p-3.5 text-xs text-rose-200"
          data-testid="interactive-block-error"
        >
          <div className="flex items-center gap-2 font-semibold text-rose-300">
            <AlertTriangle size={14} />
            <span>Could not render interactive block</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          {this.props.fallbackContent && (
            <pre className="mt-2 max-h-40 overflow-x-auto rounded bg-black/40 p-2 font-mono text-[10px] text-slate-400">
              <code>{this.props.fallbackContent}</code>
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export function InteractiveBlockRenderer({
  block,
  blockId,
  fallbackRaw,
}: {
  block: InteractiveBlock;
  blockId?: string;
  fallbackRaw?: string;
}) {
  const resolvedId = block.id || blockId || `block-${block.type}-${Math.random().toString(36).slice(2, 9)}`;

  const renderContent = () => {
    switch (block.type) {
      case 'mcq':
        return <McqBlockRenderer block={block} blockId={resolvedId} />;
      case 'quiz':
        return <QuizBlockRenderer block={block} blockId={resolvedId} />;
      case 'poll':
        return <PollBlockRenderer block={block} blockId={resolvedId} />;
      case 'flashcard':
        return <FlashcardBlockRenderer block={block} blockId={resolvedId} />;
      case 'matching':
        return <MatchingBlockRenderer block={block} blockId={resolvedId} />;
      case 'sorting':
        return <SortingBlockRenderer block={block} blockId={resolvedId} />;
      case 'fill_blank':
        return <FillBlankBlockRenderer block={block} blockId={resolvedId} />;
      case 'decision_tree':
        return <DecisionTreeBlockRenderer block={block} blockId={resolvedId} />;
      case 'accordion':
        return <AccordionBlockRenderer block={block} blockId={resolvedId} />;
      case 'steps':
        return <StepsBlockRenderer block={block} blockId={resolvedId} />;
      case 'checklist':
        return <ChecklistBlockRenderer block={block} blockId={resolvedId} />;
      case 'kanban':
        return <KanbanBlockRenderer block={block} blockId={resolvedId} />;
      case 'form_wizard':
        return <FormWizardBlockRenderer block={block} blockId={resolvedId} />;
      case 'calculator':
        return <CalculatorBlockRenderer block={block} blockId={resolvedId} />;
      case 'diagram':
        return <DiagramBlockRenderer block={block} />;
      case 'json_viewer':
        return <JsonViewerBlockRenderer block={block} />;
      case 'regex_tester':
        return <RegexTesterBlockRenderer block={block} />;
      case 'api_builder':
        return <ApiBuilderBlockRenderer block={block} />;
      case 'comparison':
        return <ComparisonBlockRenderer block={block} />;
      case 'table':
        return <TableBlockRenderer block={block} />;
      case 'input_controls':
        return <InputControlsBlockRenderer block={block} blockId={resolvedId} />;
      case 'progress':
        return <ProgressBlockRenderer block={block} />;
      case 'chart':
        return <ChartBlockRenderer block={block} />;
      case 'audio_player':
        return <AudioPlayerBlockRenderer block={block} />;
      case 'midi_preview':
        return <MidiPreviewBlockRenderer block={block} />;
      case 'storyboard':
        return <StoryboardBlockRenderer block={block} />;
      case 'image_variation':
        return <ImageVariationBlockRenderer block={block} />;
      case 'media':
        return <MediaBlockRenderer block={block} />;
      case 'scheduled_task':
        return <ScheduledTaskBlockRenderer block={block} blockId={resolvedId} />;
      case 'code':
        return (
          <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0d0e12] p-4 text-xs">
            <div className="mb-2 font-mono text-[11px] font-semibold text-teal-300">{block.language}</div>
            <pre className="overflow-x-auto font-mono text-slate-200">
              <code>{block.code}</code>
            </pre>
            {block.output && (
              <div className="mt-2 border-t border-white/[.08] pt-2 font-mono text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Output: </span>
                {block.output}
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="my-3 rounded-lg border border-amber-500/20 bg-amber-500/[.05] p-3 text-xs text-amber-200">
            Unsupported block type: {(block as { type?: string }).type}
          </div>
        );
    }
  };

  return (
    <InteractiveBlockErrorBoundary fallbackContent={fallbackRaw}>
      {renderContent()}
    </InteractiveBlockErrorBoundary>
  );
}
