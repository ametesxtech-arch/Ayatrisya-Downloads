import { useEffect, useState } from 'react';
import { Download, Paperclip } from 'lucide-react';
import { Button, Modal } from '@/components/Primitives';
import { repository } from '@/storage/repository';
import { downloadBlob } from '@/storage/backup';
import type { Attachment } from '@/storage/types';
import { errMsg, formatBytes } from '@/lib/format';

export function AttachmentChip({ attachment }: { attachment: Attachment }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/10 bg-white/[.04] px-2 py-1 text-[11px] text-slate-300 hover:bg-white/[.08]"><Paperclip size={12} /><span className="truncate">{attachment.name}</span><span className="text-slate-500">{formatBytes(attachment.size)}</span></button>
    {open && <PreviewModal attachment={attachment} onClose={() => setOpen(false)} />}
  </>;
}

export function PreviewModal({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null | undefined>(undefined);
  const [url, setUrl] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let dead = false, made = '';
    repository.getFile(attachment.id).then(async (b) => {
      if (dead) return;
      if (!b) { setBlob(null); return; }
      setBlob(b);
      const t = attachment.mimeType;
      if (/^(image|audio|video)\//.test(t)) { made = URL.createObjectURL(b); setUrl(made); }
      else if (t.startsWith('text/') || /json|markdown|xml/.test(t) || /\.(md|txt|json|csv|ts|tsx|js|py)$/i.test(attachment.name)) setText((await b.slice(0, 200_000).text()));
    }).catch((e) => { if (!dead) setError(errMsg(e)); });
    return () => { dead = true; if (made) URL.revokeObjectURL(made); };
  }, [attachment]);
  const t = attachment.mimeType;
  return <Modal title={attachment.name} onClose={onClose} wide>
    <p className="mb-3 text-xs text-slate-500">{t || 'unknown type'} · {formatBytes(attachment.size)} · stored in this browser only</p>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {blob === undefined && !error && <div className="h-40 animate-pulse rounded-lg bg-white/[.05]" />}
    {blob === null && <p className="rounded-lg border border-amber-300/20 bg-amber-300/[.05] p-4 text-sm text-amber-200">The file data is not available locally. Only its record exists.</p>}
    {blob && url && t.startsWith('image/') && <img src={url} alt={attachment.name} className="mx-auto max-h-[60dvh] rounded-lg" />}
    {blob && url && t.startsWith('audio/') && <audio src={url} controls className="w-full" />}
    {blob && url && t.startsWith('video/') && <video src={url} controls className="max-h-[60dvh] w-full rounded-lg" />}
    {blob && text !== null && <pre className="mono max-h-[55dvh] overflow-auto whitespace-pre-wrap rounded-lg bg-[#101116] p-4 text-xs leading-5 text-slate-300">{text}</pre>}
    {blob && !url && text === null && <p className="text-sm text-slate-400">No in-app preview for this file type. It is never opened or executed automatically; download it to use it.</p>}
    <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Close</Button>{blob && <Button onClick={() => downloadBlob(blob, attachment.name)}><Download size={15} />Download</Button>}</div>
  </Modal>;
}
