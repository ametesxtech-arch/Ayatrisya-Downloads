import React, { useState, useMemo } from 'react';
import { Code2, Check, Copy, Terminal, Send, Search, ChevronRight, ChevronDown } from 'lucide-react';
import type { JsonViewerBlock, RegexTesterBlock, ApiBuilderBlock } from './types';

export function JsonViewerBlockRenderer({ block }: { block: JsonViewerBlock }) {
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(true);

  const jsonString = useMemo(() => {
    try {
      return JSON.stringify(block.data, null, 2);
    } catch {
      return String(block.data);
    }
  }, [block.data]);

  const copy = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  };

  return (
    <div
      className="interactive-json my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0d0e12] p-4 shadow-lg"
      data-testid="interactive-json-block"
      role="region"
      aria-label={block.title || 'JSON Inspector'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex size-5 items-center justify-center text-slate-400 hover:text-white"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <span className="font-mono text-xs font-semibold text-teal-300">
            {block.title || 'JSON Inspector'}
          </span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-400 hover:bg-white/[.08] hover:text-white"
        >
          {copied ? <Check size={11} className="text-teal-300" /> : <Copy size={11} />}
          <span>{copied ? 'Copied' : 'Copy JSON'}</span>
        </button>
      </div>

      {expanded && (
        <pre className="max-h-96 overflow-x-auto overflow-y-auto font-mono text-xs leading-relaxed text-slate-200">
          <code>{jsonString}</code>
        </pre>
      )}
    </div>
  );
}

export function RegexTesterBlockRenderer({ block }: { block: RegexTesterBlock }) {
  const [pattern, setPattern] = useState(block.pattern);
  const [flags, setFlags] = useState(block.flags || 'g');
  const [testString, setTestString] = useState(block.testString);

  const { matches, error } = useMemo(() => {
    try {
      const reg = new RegExp(pattern, flags);
      const matchesArr: string[] = [];
      let m: RegExpExecArray | null;
      if (flags.includes('g')) {
        while ((m = reg.exec(testString)) !== null) {
          matchesArr.push(m[0]);
          if (!m[0]) break; // avoid infinite loop on empty match
        }
      } else {
        const single = reg.exec(testString);
        if (single) matchesArr.push(single[0]);
      }
      return { matches: matchesArr, error: null };
    } catch (err) {
      return { matches: [], error: err instanceof Error ? err.message : 'Invalid regex' };
    }
  }, [pattern, flags, testString]);

  return (
    <div
      className="interactive-regex my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-regex-block"
      role="region"
      aria-label="Regex Tester"
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-300">
            <Code2 size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
            {block.title || 'Interactive Regex Tester'}
          </h4>
        </div>
        <span className="font-mono text-xs text-slate-400">
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </span>
      </div>

      <div className="space-y-3">
        {/* Pattern & Flags Input */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] text-slate-400 mb-1">Regular Expression</label>
            <div className="flex items-center rounded-md border border-white/10 bg-black/40 px-2 font-mono text-xs">
              <span className="text-slate-500">/</span>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="flex-1 bg-transparent px-1.5 py-1 text-amber-200 focus:outline-none"
              />
              <span className="text-slate-500">/</span>
            </div>
          </div>
          <div className="w-20">
            <label className="block text-[11px] text-slate-400 mb-1">Flags</label>
            <input
              type="text"
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              className="h-[30px] w-full rounded-md border border-white/10 bg-black/40 px-2 font-mono text-xs text-amber-200 focus:outline-none"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-300 font-mono">{error}</p>}

        {/* Test String */}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Test String</label>
          <textarea
            rows={3}
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-black/40 p-2 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Matches Breakdown */}
        {matches.length > 0 && (
          <div className="rounded-lg border border-teal-500/30 bg-teal-950/20 p-3">
            <span className="text-[11px] font-semibold text-teal-300 block mb-1.5">Captured Matches:</span>
            <div className="flex flex-wrap gap-1.5">
              {matches.map((m, i) => (
                <span
                  key={i}
                  className="rounded border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 font-mono text-xs text-teal-200"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ApiBuilderBlockRenderer({ block }: { block: ApiBuilderBlock }) {
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState(block.method);
  const [url, setUrl] = useState(block.url);
  const [body, setBody] = useState(block.body || '');

  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    POST: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    PUT: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    DELETE: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    PATCH: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  };

  const curlCommand = useMemo(() => {
    let cmd = `curl -X ${method} "${url}"`;
    if (block.headers) {
      for (const [k, v] of Object.entries(block.headers)) {
        cmd += ` \\\n  -H "${k}: ${v}"`;
      }
    }
    if (body && method !== 'GET') {
      cmd += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`;
    }
    return cmd;
  }, [method, url, body, block.headers]);

  const copyCurl = () => {
    navigator.clipboard.writeText(curlCommand).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  };

  return (
    <div
      className="interactive-api my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-api-block"
      role="region"
      aria-label={block.title || 'API Request Builder'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
            <Terminal size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-sky-300">
            {block.title || 'API Request Builder'}
          </h4>
        </div>
        <button
          type="button"
          onClick={copyCurl}
          className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[.04] px-2.5 py-1 text-xs text-slate-300 hover:text-white"
        >
          {copied ? <Check size={11} className="text-teal-300" /> : <Copy size={11} />}
          <span>{copied ? 'Copied cURL' : 'Copy cURL'}</span>
        </button>
      </div>

      <div className="space-y-3">
        {/* Method + URL Input */}
        <div className="flex gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className={`h-9 rounded-lg border px-2.5 font-mono text-xs font-bold focus:outline-none ${
              methodColors[method] || 'border-white/10 bg-[#0d0e12] text-white'
            }`}
          >
            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
              <option key={m} value={m} className="bg-[#0d0e12] text-white font-normal">
                {m}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 font-mono text-xs text-slate-200 focus:border-sky-400 focus:outline-none"
          />
        </div>

        {/* cURL Preview */}
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#0d0e12] p-3 font-mono text-[11px] leading-relaxed text-slate-300">
          <code>{curlCommand}</code>
        </pre>
      </div>
    </div>
  );
}
