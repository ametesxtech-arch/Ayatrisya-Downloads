import { createElement, useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button, ConfirmDialog, Skeleton } from '@/components/Primitives';
import { validateFile, validateFileContent } from '@/storage/files';
import { useLocalQuery } from '@/storage/hooks';
import { repository } from '@/storage/repository';
import { downloadBlob } from '@/storage/backup';
import { errMsg, formatBytes } from '@/lib/format';

export const assetFilter: Record<string, (n: string, t: string) => boolean> = {
  image: (n, t) => t.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(n),
  music: (n, t) => t.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm)$/i.test(n),
  '3d': (n) => /\.(glb|gltf)$/i.test(n),
};

export const accepts: Record<string, string> = {
  image: 'image/png,image/jpeg,image/gif,image/webp',
  music: 'audio/*',
  '3d': '.glb,.gltf',
};

export function useBlobUrl(attachmentId: string | undefined, enabled = true) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!attachmentId || !enabled) return;
    let u: string | null = null;
    let off = false;
    repository.getFile(attachmentId).then(
      (b) => {
        if (off) return;
        if (!b) {
          setErr('File data is not stored in this browser.');
          return;
        }
        u = URL.createObjectURL(b);
        setUrl(u);
      },
      (e) => !off && setErr(errMsg(e)),
    );
    return () => {
      off = true;
      if (u) URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [attachmentId, enabled]);
  return { url, err };
}

export function ModelView({ attachmentId }: { attachmentId: string }) {
  const { url, err } = useBlobUrl(attachmentId);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const el = useRef<HTMLElement & {
    cameraOrbit: string;
    cameraTarget: string;
    getCameraOrbit: () => { theta: number; phi: number; radius: number };
    jumpCameraToGoal: () => void;
  } | null>(null);

  useEffect(() => {
    import('@google/model-viewer').then(
      () => setReady(true),
      (e) => setLoadErr(errMsg(e)),
    );
  }, []);

  const orbit = (dTheta: number, scale: number) => {
    const v = el.current;
    if (!v) return;
    const o = v.getCameraOrbit();
    v.cameraOrbit = `${o.theta + dTheta}rad ${o.phi}rad ${Math.max(0.05, o.radius * scale)}m`;
  };

  const reset = () => {
    const v = el.current;
    if (!v) return;
    v.cameraOrbit = 'auto auto auto';
    v.cameraTarget = 'auto auto auto';
    v.jumpCameraToGoal();
  };

  if (err || loadErr) return <p role="alert" className="text-xs text-rose-300">{err || loadErr}</p>;
  if (!url || !ready) return <div className="h-72 animate-pulse rounded-lg bg-white/[.05]" />;

  return (
    <div>
      {createElement('model-viewer', {
        ref: el,
        src: url,
        'camera-controls': '',
        'touch-action': 'pan-y',
        alt: '3D model you imported',
        style: { width: '100%', height: 320, background: '#0d0e13', borderRadius: 12 },
        onError: () => setLoadErr('This file could not be rendered as a valid glTF model.'),
      })}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => orbit(-0.4, 1)}>Orbit left</Button>
        <Button variant="outline" onClick={() => orbit(0.4, 1)}>Orbit right</Button>
        <Button variant="outline" onClick={() => orbit(0, 0.8)}>Zoom in</Button>
        <Button variant="outline" onClick={() => orbit(0, 1.25)}>Zoom out</Button>
        <Button variant="outline" onClick={reset}>Reset view</Button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Drag to orbit, scroll or pinch to zoom. Shows only the file you imported.</p>
    </div>
  );
}

export function AssetPreview({ kind, id }: { kind: 'image' | 'music'; id: string }) {
  const { url, err } = useBlobUrl(id);
  if (err) return <p role="alert" className="text-xs text-rose-300">{err}</p>;
  if (!url) return <div className="h-24 animate-pulse rounded bg-white/[.05]" />;
  return kind === 'music' ? (
    <audio src={url} controls className="w-full" aria-label="Audio playback" />
  ) : (
    <img src={url} alt="Stored file preview" className="max-h-96 rounded-lg" />
  );
}

export function AssetHistory({ kind, notify }: { kind: 'image' | 'music' | '3d'; notify: (m: string) => void }) {
  const items = useLocalQuery(() => repository.listItems({ kind: 'file', limit: 500 }), []);
  const atts = useLocalQuery(() => repository.listAttachments(), []);
  const map = new Map((atts.data ?? []).map((a) => [a.id, a]));
  const rows = (items.data ?? []).filter((i) => {
    const a = i.attachmentId ? map.get(i.attachmentId) : undefined;
    return a && assetFilter[kind](a.name, a.mimeType);
  });
  const [open, setOpen] = useState<string | null>(null);
  const [del, setDel] = useState<(typeof rows)[number] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function add(files: FileList | null) {
    for (const f of Array.from(files ?? [])) {
      try {
        validateFile(f);
        await validateFileContent(f);
        if (!assetFilter[kind](f.name, f.type)) throw new Error('This is not a supported file for this studio.');
        await repository.addFile(f);
        notify(`Saved ${f.name} in this browser.`);
      } catch (e) {
        notify(`${f.name}: ${errMsg(e)}`);
      }
    }
    if (input.current) input.current.value = '';
  }

  return (
    <section className="mt-8" aria-label="Local asset history">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Local {kind === '3d' ? 'models' : kind === 'image' ? 'images' : 'audio'}</h2>
        <span>
          <input ref={input} type="file" multiple hidden accept={accepts[kind]} onChange={(e) => void add(e.target.files)} />
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload size={14} />Import
          </Button>
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">Files you imported, generated, or saved. They are stored only in this browser.</p>
      {items.loading && !items.data && <Skeleton className="mt-3 h-16" />}
      {items.data && rows.length === 0 && (
        <p className="mt-3 rounded-lg border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
          Nothing here yet. Import a file to keep it with your work.
        </p>
      )}
      <ul className="mt-3 grid gap-2">
        {rows.map((i) => {
          const a = map.get(i.attachmentId!)!;
          return (
            <li key={i.id} className="rounded-xl border border-white/[.075] bg-[#15171e] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {i.title}
                  <span className="ml-2 text-[11px] text-slate-500">{formatBytes(a.size)}</span>
                </span>
                <Button variant="outline" onClick={() => setOpen(open === i.id ? null : i.id)}>
                  {open === i.id ? 'Close' : kind === 'music' ? 'Play' : kind === '3d' ? 'View' : 'Preview'}
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const b = await repository.getFile(a.id);
                      if (!b) throw new Error('File data is not stored in this browser.');
                      downloadBlob(b, a.name);
                    } catch (e) {
                      notify(errMsg(e));
                    }
                  }}
                >
                  <Download size={14} />Export
                </Button>
                <Button variant="outline" onClick={() => setDel(i)}>Delete</Button>
              </div>
              {open === i.id && (
                <div className="mt-3">
                  {kind === '3d' ? <ModelView attachmentId={a.id} /> : <AssetPreview kind={kind} id={a.id} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {del && (
        <ConfirmDialog
          danger
          title="Delete file"
          confirmLabel="Delete"
          body={
            <>Delete <b>{del.title}</b> from this browser? This cannot be undone. Copies already backed up to Google Drive are not affected.</>
          }
          onConfirm={async () => {
            try {
              if (del.attachmentId) await repository.deleteAttachment(del.attachmentId);
              await repository.deleteItem(del.id).catch(() => undefined);
            } catch (e) {
              notify(errMsg(e));
            }
            setDel(null);
          }}
          onClose={() => setDel(null)}
        />
      )}
    </section>
  );
}
