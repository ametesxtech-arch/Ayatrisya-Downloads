import React from 'react';
import { Emblem, Wordmark } from '@/components/Brand';
import { FractalGlass } from '@/components/fractal-glass';

export function FractalGlassLoading({
  message = 'Loading Ayatrisya…',
  compact = false,
}: {
  message?: string;
  compact?: boolean;
}) {
  return (
    <div
      className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#101116] p-4 text-slate-100 select-none"
      role="status"
      aria-label={message}
    >
      {/* Background Fractal Glass Card */}
      <div className="relative w-full max-w-[760px] overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
        <FractalGlass
          src="/assets/fractal-glass/mountain.webp"
          alt="Snow-covered Himalayan mountains"
          animateEntrance={true}
          mode="default"
          stripes={26}
          distortion={24}
          refractionBias={-0.1}
          blur={20}
          grain={0.005}
          smoothness={7.3}
          textureScale={103}
          blackPoint={0}
          whitePoint={232}
          gamma={0.78}
          edgeWidth={0}
          coverage={0.55}
          coverageMode="stripes"
          side="left"
          direction="vertical"
          hoverEffect={true}
          hoverPreset="reveal-on-hover"
          recoveryDirection="same"
          hoverAnimation="procedural"
          hoverDuration={880}
          hoverRadius={120}
          hoverFeather={16}
          transitionBlend={0.5}
          duration={570}
          ease="power4.out"
          disabled={false}
          height={compact ? 360 : 480}
          borderRadius={16}
          className="w-full object-cover"
        />

        {/* Foreground Glass Overlay with Ambient Glow */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-[#101116]/85 via-black/45 to-[#101116]/80 p-6 backdrop-blur-[2px]">
          <div className="relative flex flex-col items-center text-center">
            {/* Ambient Backlight Glow */}
            <div className="absolute -inset-4 rounded-full bg-violet-500/20 blur-2xl pointer-events-none" />

            <div className="relative mb-4 flex size-16 items-center justify-center rounded-2xl border border-white/15 bg-black/40 p-3 shadow-2xl backdrop-blur-md">
              <Emblem size={44} mode="loading" />
            </div>

            <div className="text-2xl font-bold tracking-tight text-white drop-shadow-md">
              <Wordmark />
            </div>

            <p className="mt-2 text-xs font-medium tracking-wide text-violet-200/90 drop-shadow">
              {message}
            </p>

            {/* Glowing animated loading progress pill */}
            <div className="mt-5 h-1.5 w-36 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-full origin-left animate-[loading-bar_1.6s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-violet-400 via-indigo-300 to-teal-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
