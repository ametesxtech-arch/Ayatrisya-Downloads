import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';

type SegmenterConstructor = new (
  locale?: string,
  options?: { granularity: 'grapheme' },
) => { segment: (value: string) => Iterable<{ segment: string }> };

function graphemes(value: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter;
  if (Segmenter) {
    try {
      return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(value), (part) => part.segment);
    } catch {
      // Fall through to a code-point fallback for older or partial implementations.
    }
  }

  const points = Array.from(value);
  const result: string[] = [];
  let regionalCount = 0;
  points.forEach((point) => {
    const code = point.codePointAt(0) ?? 0;
    const previous = result[result.length - 1] ?? '';
    const previousCode = previous.codePointAt(previous.length - 1) ?? 0;
    const combining =
      (code >= 0x0300 && code <= 0x036f) ||
      (code >= 0x1ab0 && code <= 0x1aff) ||
      (code >= 0x1dc0 && code <= 0x1dff) ||
      (code >= 0x20d0 && code <= 0x20ff) ||
      (code >= 0xfe00 && code <= 0xfe0f) ||
      (code >= 0xfe20 && code <= 0xfe2f) ||
      (code >= 0xe0100 && code <= 0xe01ef) ||
      (code >= 0x1f3fb && code <= 0x1f3ff);
    const regional = code >= 0x1f1e6 && code <= 0x1f1ff;
    if (result.length && (combining || code === 0x200d || previousCode === 0x200d || (regional && regionalCount % 2 === 1))) {
      result[result.length - 1] += point;
    } else {
      result.push(point);
    }
    regionalCount = regional ? regionalCount + 1 : 0;
  });
  return result;
}

function plainText(children: ReactNode): string {
  return Children.toArray(children).map((child) => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    if (!isValidElement(child)) return '';
    if (child.type === 'br') return '\n';
    return plainText((child.props as { children?: ReactNode }).children);
  }).join('');
}

function renderText(value: string, sequence: { current: number }): ReactNode[] {
  const result: ReactNode[] = [];
  let word: string[] = [];
  const flush = () => {
    if (!word.length) return;
    const wordKey = `word-${sequence.current}`;
    const glyphs = word.map((grapheme) => {
      const index = sequence.current++;
      const style = {
        '--motion-letter-delay': `${Math.min(index, 48) * 8}ms`,
        '--motion-letter-delay-subtle': `${Math.min(index, 20) * 6}ms`,
      } as CSSProperties & {
        '--motion-letter-delay': string;
        '--motion-letter-delay-subtle': string;
      };
      return <span className="motion-letter" key={`letter-${index}`} style={style}>{grapheme}</span>;
    });
    result.push(<span className="motion-word" key={wordKey}>{glyphs}</span>);
    word = [];
  };

  graphemes(value).forEach((grapheme) => {
    if (/^\s+$/u.test(grapheme)) {
      flush();
      result.push(grapheme);
    } else {
      word.push(grapheme);
    }
  });
  flush();
  return result;
}

function visualChildren(children: ReactNode, sequence: { current: number }): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') return renderText(String(child), sequence);
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<{ children?: ReactNode }>;
    if (element.props.children === undefined || element.props.children === null) return child;
    return cloneElement(element, undefined, visualChildren(element.props.children, sequence));
  });
}

export function MotionText({ children }: { children: ReactNode }) {
  const sequence = { current: 0 };
  const label = plainText(children);
  return (
    <span className="motion-text" data-motion-text>
      <span className="motion-text-visual" aria-hidden="true">
        {visualChildren(children, sequence)}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
