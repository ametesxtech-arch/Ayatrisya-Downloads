import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Music, Film, Images, RotateCcw } from 'lucide-react';
import type { AudioPlayerBlock, MidiPreviewBlock, StoryboardBlock, ImageVariationBlock } from './types';

export function AudioPlayerBlockRenderer({ block }: { block: AudioPlayerBlock }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(block.duration || 30);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const src = block.audioUrl || (block.dataBase64 ? `data:audio/wav;base64,${block.dataBase64}` : undefined);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => undefined);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setProgress(audioRef.current.currentTime);
    if (audioRef.current.duration) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="interactive-audio-player my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-audio-block"
      role="region"
      aria-label={block.title || 'Audio Player'}
    >
      {src && (
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors shadow-md"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-white truncate">{block.title}</span>
            <span className="font-mono text-[11px] text-slate-400">
              {formatTime(progress)} / {formatTime(duration)}
            </span>
          </div>
          {block.artist && <p className="text-[11px] text-slate-400 truncate mb-1.5">{block.artist}</p>}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={progress}
            onChange={handleSeek}
            className="w-full accent-teal-400 h-1 bg-white/[.08] rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

export function MidiPreviewBlockRenderer({ block }: { block: MidiPreviewBlock }) {
  const [playing, setPlaying] = useState(false);

  // Play synthesized web audio tones for notes
  const playMidiNotes = () => {
    if (typeof window === 'undefined' || !window.AudioContext) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setPlaying(true);
      const noteFreqs: Record<string, number> = {
        C4: 261.63,
        D4: 293.66,
        E4: 329.63,
        F4: 349.23,
        G4: 392.0,
        A4: 440.0,
        B4: 493.88,
        C5: 523.25,
      };

      const bpm = block.bpm || 120;
      const beatSec = 60 / bpm;

      block.notes.slice(0, 32).forEach((n) => {
        const freq = noteFreqs[n.pitch.toUpperCase()] || 440;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + n.time * beatSec);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + n.time * beatSec);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (n.time + n.duration) * beatSec);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + n.time * beatSec);
        osc.stop(ctx.currentTime + (n.time + n.duration) * beatSec);
      });

      const totalDuration = Math.max(...block.notes.map((n) => n.time + n.duration), 2) * beatSec;
      window.setTimeout(() => setPlaying(false), totalDuration * 1000);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div
      className="interactive-midi my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-midi-block"
      role="region"
      aria-label={block.title || 'MIDI Preview'}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[.08] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-pink-500/15 text-pink-300">
            <Music size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-pink-300">
            {block.title || 'MIDI Sequence'}
          </h4>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          {block.bpm && <span>{block.bpm} BPM</span>}
          <button
            type="button"
            disabled={playing}
            onClick={playMidiNotes}
            className="inline-flex items-center gap-1 rounded bg-pink-500/20 px-2.5 py-1 text-xs font-semibold text-pink-300 hover:bg-pink-500/30 transition-colors disabled:opacity-40"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
            <span>{playing ? 'Playing Synth…' : 'Play MIDI'}</span>
          </button>
        </div>
      </div>

      {/* Note Grid Sequencer View */}
      <div className="flex flex-wrap gap-1.5 py-2">
        {block.notes.slice(0, 32).map((note, idx) => (
          <span
            key={idx}
            className="rounded border border-pink-500/30 bg-pink-500/10 px-2 py-1 font-mono text-[11px] font-medium text-pink-200"
          >
            {note.pitch}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StoryboardBlockRenderer({ block }: { block: StoryboardBlock }) {
  return (
    <div
      className="interactive-storyboard my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-storyboard-block"
      role="region"
      aria-label={block.title || 'Video Storyboard'}
    >
      <div className="mb-3 flex items-center gap-2 border-b border-white/[.08] pb-2.5">
        <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-300">
          <Film size={13} />
        </span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
          {block.title || 'Video Storyboard Sequence'}
        </h4>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {block.scenes.map((scene) => (
          <div
            key={scene.sceneNumber}
            className="rounded-lg border border-white/10 bg-white/[.02] p-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-white/[.06] pb-1.5 mb-2">
                <span className="font-bold text-amber-300">Scene {scene.sceneNumber}</span>
                {scene.duration && <span>{scene.duration}</span>}
              </div>
              <h5 className="text-xs font-semibold text-white mb-1">{scene.title}</h5>
              <p className="text-[11px] leading-relaxed text-slate-300">{scene.description}</p>
            </div>
            {scene.visualPrompt && (
              <div className="mt-2.5 rounded bg-black/40 p-2 font-mono text-[10px] text-slate-400">
                <span className="text-slate-500 block mb-0.5">Visual Prompt:</span>
                {scene.visualPrompt}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ImageVariationBlockRenderer({ block }: { block: ImageVariationBlock }) {
  return (
    <div
      className="interactive-image-variations my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-image-variation-block"
      role="region"
      aria-label={block.title || 'Image Variations'}
    >
      <div className="mb-3 flex items-center gap-2 border-b border-white/[.08] pb-2.5">
        <span className="flex size-6 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-300">
          <Images size={13} />
        </span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
          {block.title || 'Image Prompt Variations'}
        </h4>
      </div>

      <p className="text-xs text-slate-400 mb-3">Base Prompt: {block.prompt}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {block.variations.map((v, i) => {
          const src = v.url || (v.dataBase64 ? `data:image/png;base64,${v.dataBase64}` : undefined);
          return (
            <div key={i} className="rounded-lg border border-white/10 bg-white/[.02] p-3 text-center">
              {src ? (
                <img
                  src={src}
                  alt={v.label}
                  className="max-h-48 w-full object-contain rounded mb-2 bg-black/40"
                  loading="lazy"
                />
              ) : (
                <div className="h-32 w-full rounded bg-white/[.04] flex items-center justify-center text-xs text-slate-500 mb-2">
                  Variation Preview
                </div>
              )}
              <span className="text-xs font-semibold text-white block">{v.label}</span>
              {v.promptAdjustment && (
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Adjustment: {v.promptAdjustment}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
