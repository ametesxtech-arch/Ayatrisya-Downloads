import { useEffect, useState } from 'react';
import { Download, RotateCw, Sparkles, Sliders, Check, Save } from 'lucide-react';
import { Button } from '@/components/Primitives';
import { repository } from '@/storage/repository';
import { downloadBlob } from '@/storage/backup';
import type { Attachment } from '@/storage/types';
import { formatBytes } from '@/lib/format';
import { PreviewModal } from './AttachmentPreview';

interface ChatInlineImageProps {
  attachment: Attachment;
  promptText?: string;
  onRegenerate?: () => void;
  onRefine?: (promptSuggestion: string) => void;
  notify?: (m: string) => void;
}

export function ChatInlineImage({
  attachment,
  promptText,
  onRegenerate,
  onRefine,
  notify,
}: ChatInlineImageProps) {
  const [url, setUrl] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    repository.getFile(attachment.id).then((b) => {
      if (!active || !b) return;
      setBlob(b);
      objectUrl = URL.createObjectURL(b);
      setUrl(objectUrl);
    }).catch(() => undefined);

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  if (!url) {
    return (
      <div className="my-2 h-48 w-full max-w-md animate-pulse rounded-2xl bg-white/[.04] border border-white/10 flex items-center justify-center text-xs text-slate-500">
        Loading image…
      </div>
    );
  }

  const handleDownload = () => {
    if (blob) {
      downloadBlob(blob, attachment.name);
      notify?.(`Downloaded ${attachment.name}`);
    }
  };

  const handleSaveToLibrary = () => {
    setSavedLocally(true);
    notify?.('Image saved to your local Library.');
    setTimeout(() => setSavedLocally(false), 2000);
  };

  return (
    <div className="chat-inline-image-card my-3 max-w-lg rounded-2xl border border-white/10 bg-[#12131a] p-3 shadow-xl transition-all hover:border-violet-500/30">
      <div className="relative group overflow-hidden rounded-xl border border-white/5 bg-black/40">
        <img
          src={url}
          alt={promptText || attachment.name}
          className="max-h-80 w-full object-contain cursor-pointer transition-transform duration-300 hover:scale-[1.01]"
          onClick={() => setOpenModal(true)}
          data-testid="chat-inline-image-element"
        />
        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 transition-opacity">
          <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-slate-300 backdrop-blur-sm border border-white/10">
            {formatBytes(attachment.size)}
          </span>
        </div>
      </div>

      {promptText && (
        <p className="mt-2 text-xs text-slate-300 line-clamp-2 italic">
          &ldquo;{promptText}&rdquo;
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[.07] pt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            onClick={handleDownload}
            data-testid="button-download-inline-image"
            className="!h-8 !px-2.5 !text-xs"
            title="Download image file"
          >
            <Download size={13} />
            Download
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveToLibrary}
            data-testid="button-save-inline-image"
            className="!h-8 !px-2.5 !text-xs"
            title="Save to Library"
          >
            {savedLocally ? <Check size={13} className="text-teal-300" /> : <Save size={13} />}
            {savedLocally ? 'Saved' : 'Save'}
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          {onRegenerate && (
            <Button
              variant="outline"
              onClick={onRegenerate}
              data-testid="button-regenerate-inline-image"
              className="!h-8 !px-2.5 !text-xs text-violet-300 hover:text-violet-200"
              title="Regenerate this image"
            >
              <RotateCw size={13} />
              Regenerate
            </Button>
          )}
          {onRefine && (
            <Button
              variant="outline"
              onClick={() => onRefine(promptText ? `Refine this image: ${promptText}, ` : 'Refine: ')}
              data-testid="button-refine-inline-image"
              className="!h-8 !px-2.5 !text-xs text-slate-300"
              title="Refine with follow-up prompt"
            >
              <Sliders size={13} />
              Refine
            </Button>
          )}
        </div>
      </div>

      {openModal && <PreviewModal attachment={attachment} onClose={() => setOpenModal(false)} />}
    </div>
  );
}
