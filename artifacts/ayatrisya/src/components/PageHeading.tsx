import { type ReactNode } from 'react';
import { Eyebrow } from '@/components/Primitives';

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-white/[.06] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="display text-3xl font-semibold tracking-[-.055em] sm:text-[34px]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-xs leading-6 text-slate-500">
          {description}
        </p>
      </div>
      {actions && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">{actions}</div>}
    </div>
  );
}
