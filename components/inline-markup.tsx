import type { ReactNode } from 'react';

/**
 * Shared inline-markup renderer for editorial copy: `**double asterisks**`
 * bold key numbers and phrases, `*single asterisks*` italicize quotes and
 * voice asides. Plain text with no markup renders exactly as before.
 * Content is author-written JSON, and React escapes the text segments, so no
 * HTML passes through.
 */
export function renderInlineMarkup(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (/^\*[^*]+\*$/.test(part)) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
