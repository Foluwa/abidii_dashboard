'use client';

import React, { useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';

import { cn } from '@/lib/utils';
import { BLOG_INPUT_CLASS } from './blogUi';

/**
 * Markdown -> React for previews. react-markdown never renders raw HTML
 * (no rehype-raw), and unsafe link protocols (javascript: etc.) are stripped
 * by its default urlTransform. Styling is per element because the dashboard
 * has no typography plugin.
 */
const COMPONENTS: Components = {
  h1: ({ children }) => <h1 className="mt-6 mb-3 text-2xl font-semibold text-foreground first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-6 mb-2 text-xl font-semibold text-foreground first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-5 mb-2 text-lg font-semibold text-foreground first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-4 mb-2 text-base font-semibold text-foreground first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="my-3 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" className="text-brand-600 underline underline-offset-2 dark:text-brand-400">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-border pl-4 text-muted-foreground italic">{children}</blockquote>
  ),
  code: ({ children, className }) => (
    <code className={cn('rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]', className)}>{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-6 border-border" />,
  img: ({ src, alt }) =>
    typeof src === 'string' && src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ''} loading="lazy" className="my-4 max-h-96 max-w-full rounded-lg" />
    ) : null,
};

export function MarkdownPreview({ source, emptyText = 'Nothing to preview yet.' }: { source: string; emptyText?: string }) {
  if (!source.trim()) {
    return <p className="text-sm text-muted-foreground italic">{emptyText}</p>;
  }
  return (
    <div className="text-sm text-foreground break-words">
      <ReactMarkdown components={COMPONENTS} skipHtml>
        {source}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Markdown textarea with a live preview: side by side on wide screens,
 * Write / Preview tabs on narrow ones.
 */
export function MarkdownField({
  id,
  label,
  value,
  onChange,
  rows = 18,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: React.ReactNode;
}) {
  const [narrowView, setNarrowView] = useState<'write' | 'preview'>('write');

  const tabClass = (active: boolean) =>
    cn(
      'rounded-md px-2.5 py-1 text-xs font-medium',
      active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
    );

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        <div className="flex gap-1 xl:hidden" role="tablist" aria-label={`${label} view`}>
          <button type="button" role="tab" aria-selected={narrowView === 'write'} className={tabClass(narrowView === 'write')} onClick={() => setNarrowView('write')}>
            Write
          </button>
          <button type="button" role="tab" aria-selected={narrowView === 'preview'} className={tabClass(narrowView === 'preview')} onClick={() => setNarrowView('preview')}>
            Preview
          </button>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          spellCheck
          className={cn(BLOG_INPUT_CLASS, 'font-mono leading-relaxed', narrowView === 'preview' && 'hidden xl:block')}
        />
        <div
          aria-label={`${label} preview`}
          className={cn(
            'min-h-40 overflow-y-auto rounded-lg border border-border bg-background px-4 py-3 xl:max-h-[40rem]',
            narrowView === 'write' && 'hidden xl:block',
          )}
        >
          <MarkdownPreview source={value} />
        </div>
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
