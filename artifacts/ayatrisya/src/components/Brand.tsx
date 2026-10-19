import { cx } from '@/lib/cx';

export function Mark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={cx(
        'grid shrink-0 place-items-center rounded-xl border border-violet-200/20 bg-gradient-to-br from-violet-300/20 to-blue-300/[.07] text-violet-200',
        small ? 'size-8' : 'size-10',
      )}
    >
      <span className="relative block size-[17px]">
        <i className="absolute left-0 top-0 h-2.5 w-2.5 rotate-45 rounded-[3px] border border-current" />
        <i className="absolute bottom-0 right-0 h-2.5 w-2.5 rotate-45 rounded-[3px] border border-current opacity-60" />
      </span>
    </span>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Mark small />
      <span
        className={cx(
          'display font-extrabold tracking-[-.04em]',
          compact ? 'text-[15px]' : 'text-[17px]',
        )}
      >
        ayatrisya
      </span>
    </div>
  );
}
