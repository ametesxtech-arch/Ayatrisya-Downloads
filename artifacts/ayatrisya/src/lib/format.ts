import { formatDistanceToNow } from 'date-fns';
import { downloadBlob } from '@/storage/backup';

export function errMsg(e: unknown, fallback = 'Something went wrong.'): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}
export function ago(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${formatDistanceToNow(d)} ago`;
}
export function safeName(s: string): string {
  return (s.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').slice(0, 60) || 'untitled').toLowerCase();
}
export function downloadText(text: string, filename: string, type = 'text/plain') {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}
export { MAX_FILE_BYTES as MAX_UPLOAD } from '@/storage/files';
