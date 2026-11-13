import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Replace,
  ArrowDown,
  ArrowUp,
  X,
  Sparkles,
  AlignLeft,
  Check,
  AlertTriangle,
  Code2,
  Sliders,
  Maximize2,
  WrapText,
} from 'lucide-react';
import type { CanvasFile, EditorProblem, EditorSettings } from './types';
import { cx } from '@/lib/cx';

interface CanvasCodeEditorProps {
  file: CanvasFile | undefined;
  onChangeContent: (content: string) => void;
  onFormatCode?: () => void;
  onRun?: () => void;
  problems?: EditorProblem[];
  isMobile?: boolean;
}

export function CanvasCodeEditor({
  file,
  onChangeContent,
  onFormatCode,
  onRun,
  problems = [],
  isMobile = false,
}: CanvasCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Editor configuration
  const [fontSize, setFontSize] = useState<number>(12);
  const [wordWrap, setWordWrap] = useState<boolean>(false);
  const [lineNumbers, setLineNumbers] = useState<boolean>(true);

  // Find & Replace State
  const [showFind, setShowFind] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchIndices, setMatchIndices] = useState<number[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);

  // Go to Line State
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [goToLineInput, setGoToLineInput] = useState('');

  // Cursor position
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const content = file?.content || '';
  const lines = useMemo(() => content.split('\n'), [content]);

  // Compute cursor position from textarea
  const updateCursorPos = useCallback(() => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart || 0;
    const textBefore = content.substring(0, pos);
    const lineNum = textBefore.split('\n').length;
    const lastNewline = textBefore.lastIndexOf('\n');
    const colNum = pos - lastNewline;
    setCursorPos({ line: lineNum, col: colNum });
  }, [content]);

  // Find matches computation
  useEffect(() => {
    if (!findQuery || !content) {
      setMatchIndices([]);
      setActiveMatchIndex(0);
      return;
    }
    try {
      const indices: number[] = [];
      const lowerContent = content.toLowerCase();
      const lowerQuery = findQuery.toLowerCase();
      let index = lowerContent.indexOf(lowerQuery);
      while (index !== -1) {
        indices.push(index);
        index = lowerContent.indexOf(lowerQuery, index + lowerQuery.length);
      }
      setMatchIndices(indices);
      setActiveMatchIndex(0);
    } catch {
      setMatchIndices([]);
    }
  }, [findQuery, content]);

  const selectMatch = (idx: number) => {
    if (!textareaRef.current || matchIndices.length === 0) return;
    const charIndex = matchIndices[idx];
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(charIndex, charIndex + findQuery.length);
    updateCursorPos();
  };

  const handleNextMatch = () => {
    if (matchIndices.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % matchIndices.length;
    setActiveMatchIndex(nextIdx);
    selectMatch(nextIdx);
  };

  const handlePrevMatch = () => {
    if (matchIndices.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + matchIndices.length) % matchIndices.length;
    setActiveMatchIndex(prevIdx);
    selectMatch(prevIdx);
  };

  const handleReplaceOne = () => {
    if (matchIndices.length === 0 || !findQuery) return;
    const charIndex = matchIndices[activeMatchIndex];
    const newContent =
      content.substring(0, charIndex) +
      replaceQuery +
      content.substring(charIndex + findQuery.length);
    onChangeContent(newContent);
  };

  const handleReplaceAll = () => {
    if (matchIndices.length === 0 || !findQuery) return;
    const regex = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const newContent = content.replace(regex, replaceQuery);
    onChangeContent(newContent);
  };

  const handleGoToLineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetLine = parseInt(goToLineInput, 10);
    if (isNaN(targetLine) || targetLine < 1 || !textareaRef.current) return;
    let charOffset = 0;
    for (let i = 0; i < Math.min(targetLine - 1, lines.length); i++) {
      charOffset += lines[i].length + 1; // +1 for newline
    }
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(charOffset, charOffset);
    updateCursorPos();
    setShowGoToLine(false);
    setGoToLineInput('');
  };

  // Keyboard shortcut listener
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const spaces = '  ';
      const updated = content.substring(0, start) + spaces + content.substring(end);
      onChangeContent(updated);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
          updateCursorPos();
        }
      }, 0);
      return;
    }

    // Ctrl+F / Cmd+F -> Find
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      setShowFind(true);
      setShowReplace(false);
      return;
    }

    // Ctrl+H / Cmd+H -> Replace
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      setShowFind(true);
      setShowReplace(true);
      return;
    }

    // Ctrl+G / Cmd+G -> Go to Line
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      setShowGoToLine(true);
      return;
    }

    // Ctrl+Enter -> Run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun?.();
      return;
    }
  };

  // Format Code Auto-Indentation Helper
  const handleFormat = () => {
    if (!content) return;
    try {
      const ext = file?.name.split('.').pop()?.toLowerCase();
      if (ext === 'json') {
        const parsed = JSON.parse(content);
        onChangeContent(JSON.stringify(parsed, null, 2));
        return;
      }
      if (onFormatCode) {
        onFormatCode();
        return;
      }
      // Simple generic beautifier indent
      const formatted = content
        .split('\n')
        .map((l) => l.trimEnd())
        .join('\n');
      onChangeContent(formatted);
    } catch {}
  };

  // Mobile quick characters insert
  const insertSymbol = (sym: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const updated = content.substring(0, start) + sym + content.substring(end);
    onChangeContent(updated);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + sym.length;
        updateCursorPos();
      }
    }, 0);
  };

  const fileProblems = useMemo(() => {
    return problems.filter((p) => p.fileId === file?.id || p.filePath === file?.name);
  }, [problems, file]);

  return (
    <div ref={containerRef} className="relative flex flex-1 flex-col min-h-0 bg-[#0e0d15] text-slate-200 overflow-hidden font-mono select-auto">
      {/* 1. FIND & REPLACE FLOATING BAR */}
      {showFind && (
        <div className="absolute top-2 right-4 z-30 flex flex-col gap-1.5 rounded-xl border border-violet-500/40 bg-[#161424]/95 p-2 shadow-2xl backdrop-blur-md text-xs">
          <div className="flex items-center gap-1.5">
            <Search size={14} className="text-violet-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              placeholder="Find…"
              className="w-40 sm:w-56 rounded bg-black/60 px-2 py-1 text-xs text-white border border-white/10 focus:outline-none focus:border-violet-500"
            />
            <span className="text-[11px] text-slate-400 min-w-14 text-center">
              {matchIndices.length > 0 ? `${activeMatchIndex + 1} of ${matchIndices.length}` : 'No results'}
            </span>
            <button
              type="button"
              onClick={handlePrevMatch}
              disabled={matchIndices.length === 0}
              className="p-1 rounded hover:bg-white/10 text-slate-300 disabled:opacity-30"
              title="Previous Match (Shift+F3)"
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              onClick={handleNextMatch}
              disabled={matchIndices.length === 0}
              className="p-1 rounded hover:bg-white/10 text-slate-300 disabled:opacity-30"
              title="Next Match (F3)"
            >
              <ArrowDown size={13} />
            </button>
            <button
              type="button"
              onClick={() => setShowReplace(!showReplace)}
              className={cx('p-1 rounded transition text-xs px-1.5 font-medium', showReplace ? 'bg-violet-600 text-white' : 'hover:bg-white/10 text-slate-400')}
              title="Toggle Replace"
            >
              <Replace size={13} />
            </button>
            <button
              type="button"
              onClick={() => setShowFind(false)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title="Close (Esc)"
            >
              <X size={13} />
            </button>
          </div>

          {showReplace && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-white/[.08]">
              <Replace size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder="Replace with…"
                className="w-40 sm:w-56 rounded bg-black/60 px-2 py-1 text-xs text-white border border-white/10 focus:outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={handleReplaceOne}
                disabled={matchIndices.length === 0}
                className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-white/20 disabled:opacity-30"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={matchIndices.length === 0}
                className="rounded bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-30"
              >
                All
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. GO TO LINE DIALOG */}
      {showGoToLine && (
        <form
          onSubmit={handleGoToLineSubmit}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl border border-violet-500/40 bg-[#161424]/95 p-2 shadow-2xl backdrop-blur-md text-xs"
        >
          <span className="text-violet-300 font-semibold">Go to Line:</span>
          <input
            autoFocus
            type="number"
            min={1}
            max={lines.length}
            value={goToLineInput}
            onChange={(e) => setGoToLineInput(e.target.value)}
            placeholder={`1 - ${lines.length}`}
            className="w-24 rounded bg-black/60 px-2 py-1 text-xs text-white border border-white/10 focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            className="rounded bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-500"
          >
            Go
          </button>
          <button
            type="button"
            onClick={() => setShowGoToLine(false)}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X size={13} />
          </button>
        </form>
      )}

      {/* 3. MAIN CODE SURFACE (LINE NUMBERS + TEXTAREA) */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {/* Line Numbers Gutter */}
        {lineNumbers && (
          <div
            className="shrink-0 w-12 bg-[#0a0910] py-3 text-right pr-3 select-none border-r border-white/[.06] text-slate-600 font-mono text-xs overflow-hidden"
            style={{ fontSize: `${fontSize}px`, lineHeight: `${Math.round(fontSize * 1.6)}px` }}
          >
            {lines.map((_, idx) => {
              const lineNum = idx + 1;
              const hasErr = fileProblems.some((p) => p.line === lineNum);
              const isActive = cursorPos.line === lineNum;
              return (
                <div
                  key={idx}
                  className={cx(
                    'flex items-center justify-end gap-1',
                    isActive ? 'text-violet-300 font-semibold' : '',
                    hasErr ? 'text-rose-400 font-bold' : ''
                  )}
                  style={{ height: `${Math.round(fontSize * 1.6)}px` }}
                >
                  {hasErr && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />}
                  <span>{lineNum}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Textarea Code Input */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            onChangeContent(e.target.value);
            updateCursorPos();
          }}
          onSelect={updateCursorPos}
          onClick={updateCursorPos}
          onKeyUp={updateCursorPos}
          onKeyDown={handleKeyDown}
          placeholder="Write code here..."
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          className={cx(
            'flex-1 resize-none bg-transparent p-3 text-slate-100 focus:outline-none font-mono overflow-auto',
            wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'
          )}
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: `${Math.round(fontSize * 1.6)}px`,
            tabSize: 2,
          }}
        />
      </div>

      {/* 4. MOBILE PROGRAMMING QUICK SYMBOLS BAR */}
      {isMobile && (
        <div className="flex h-9 shrink-0 items-center gap-1 border-t border-white/[.08] bg-[#12111c] px-2 overflow-x-auto scrollbar-none select-none">
          {['{', '}', '(', ')', '[', ']', '<', '>', '=', ';', ':', '"', "'", '`', '/', '+', '-', '*', '$', '!', '&', '|', '#'].map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => insertSymbol(sym)}
              className="h-7 min-w-7 rounded bg-white/[.06] text-xs font-mono font-bold text-violet-200 active:bg-violet-600 active:text-white transition shrink-0 flex items-center justify-center px-1.5"
            >
              {sym}
            </button>
          ))}
        </div>
      )}

      {/* 5. PROFESSIONAL EDITOR STATUS BAR */}
      <div className="flex h-7 shrink-0 items-center justify-between border-t border-white/[.07] bg-[#0c0b13] px-3 text-[11px] text-slate-400 select-none">
        <div className="flex items-center gap-3">
          {file?.name && (
            <span className="font-semibold text-slate-200 flex items-center gap-1">
              <Code2 size={12} className="text-violet-400" />
              {file.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="text-violet-400">Ln</span> {cursorPos.line}, <span className="text-violet-400">Col</span> {cursorPos.col}
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline">
            {lines.length} lines ({content.length} chars)
          </span>
          {fileProblems.length > 0 && (
            <span className="flex items-center gap-1 text-rose-400 font-semibold">
              <AlertTriangle size={12} />
              {fileProblems.length} issue{fileProblems.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Format Code */}
          <button
            type="button"
            onClick={handleFormat}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition px-1.5 py-0.5 rounded hover:bg-white/[.06]"
            title="Format Code (Alt+Shift+F)"
          >
            <AlignLeft size={12} />
            <span className="hidden sm:inline">Format</span>
          </button>

          {/* Word Wrap Toggle */}
          <button
            type="button"
            onClick={() => setWordWrap(!wordWrap)}
            className={cx(
              'px-1.5 py-0.5 rounded text-[10px] transition flex items-center gap-1',
              wordWrap ? 'text-violet-300 bg-violet-500/20' : 'text-slate-400 hover:text-white'
            )}
            title="Toggle Word Wrap"
          >
            <WrapText size={11} />
            <span className="hidden sm:inline">Wrap</span>
          </button>

          {/* Language Indicator */}
          <span className="rounded bg-white/[.06] px-1.5 py-0.5 text-[10px] uppercase font-semibold text-violet-300">
            {file?.language || 'plaintext'}
          </span>
          <span className="hidden sm:inline text-slate-500">UTF-8</span>
        </div>
      </div>
    </div>
  );
}
