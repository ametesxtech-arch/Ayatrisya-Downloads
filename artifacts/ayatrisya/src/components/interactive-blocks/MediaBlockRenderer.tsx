import React from 'react';
import { Image as ImageIcon, Volume2, Box } from 'lucide-react';
import type { MediaBlock } from './types';

export function MediaBlockRenderer({ block }: { block: MediaBlock }) {
  return (
    <div
      className="interactive-media my-4 overflow-hidden rounded-xl border border-white/10 bg-[#12141a]/95 p-4 sm:p-5 shadow-lg backdrop-blur-sm"
      data-testid="interactive-media-block"
      role="region"
      aria-label={block.title || 'Media Preview'}
    >
      {block.title && (
        <div className="mb-3 flex items-center gap-2 border-b border-white/[.08] pb-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-pink-500/15 text-pink-300">
            <ImageIcon size={13} />
          </span>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-pink-300">
            {block.title}
          </h4>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {block.items.map((item, idx) => {
          const src = item.url || (item.dataBase64 ? `data:image/png;base64,${item.dataBase64}` : undefined);
          return (
            <div key={idx} className="overflow-hidden rounded-lg border border-white/10 bg-white/[.02]">
              {item.kind === 'image' && src && (
                <img
                  src={src}
                  alt={item.title || 'Preview'}
                  className="max-h-64 w-full object-contain bg-black/40"
                  loading="lazy"
                />
              )}
              {item.kind === 'audio' && (
                <div className="flex items-center gap-3 p-4">
                  <Volume2 size={24} className="text-pink-400" />
                  <span className="text-xs text-slate-300">{item.title || 'Audio snippet'}</span>
                </div>
              )}
              {item.kind === 'model3d' && (
                <div className="flex items-center gap-3 p-4">
                  <Box size={24} className="text-pink-400" />
                  <span className="text-xs text-slate-300">{item.title || '3D Asset preview'}</span>
                </div>
              )}
              {(item.title || item.caption) && (
                <div className="p-2.5 border-t border-white/[.06]">
                  {item.title && <p className="text-xs font-medium text-slate-200">{item.title}</p>}
                  {item.caption && <p className="mt-0.5 text-[11px] text-slate-400">{item.caption}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
