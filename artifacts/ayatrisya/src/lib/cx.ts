export const cx = (...parts: Array<string | false | undefined>) =>
  parts.filter(Boolean).join(' ');
