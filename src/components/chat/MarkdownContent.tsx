import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

const ALLOWED_ELEMENTS = [
  'p',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'br',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

const COMPONENTS: Components = {
  p: ({ children }) => <p className="leading-relaxed text-zinc-200">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="opacity-70">{children}</del>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5 marker:text-zinc-600">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 marker:text-zinc-500">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed text-zinc-200">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-white/10 pl-3 text-zinc-400">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => (
    <h2 className="font-heading text-base font-semibold text-white">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="font-heading text-sm font-semibold text-white">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="font-heading text-sm font-semibold text-white">{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="font-heading text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
      {children}
    </h5>
  ),
  code: ({ className, children, ...rest }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.82em] text-zinc-200"
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={cn('font-mono text-[0.82em]', className)} {...rest}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg border border-white/5 bg-black/30 p-3 text-xs text-zinc-200">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-zinc-100 underline decoration-zinc-600 underline-offset-2 hover:decoration-zinc-300"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-white/10 px-2 py-1 text-left font-semibold text-zinc-300">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-white/10 px-2 py-1 text-zinc-300">{children}</td>
  ),
};

type MarkdownContentProps = {
  text: string;
  className?: string;
};

function MarkdownContentImpl({ text, className }: MarkdownContentProps) {
  return (
    <div className={cn('space-y-2 leading-relaxed', className)} data-slot="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        skipHtml
        components={COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownContent = memo(MarkdownContentImpl);
