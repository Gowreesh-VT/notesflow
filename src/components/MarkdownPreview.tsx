"use client";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { WIKI_HREF_PREFIX, wikiLinksToMarkdown, wikiTitleFromHref } from "@/lib/wiki-links";

export function MarkdownPreview({
  source,
  onToggleTask,
  onOpenLink,
  isLinkMissing,
}: {
  source: string;
  onToggleTask?: (line: number) => void;
  onOpenLink?: (title: string) => void;
  isLinkMissing?: (title: string) => boolean;
}) {
  if (!source.trim()) {
    return <p className="text-sm text-stone-500 dark:text-stone-400">Nothing to preview yet.</p>;
  }
  return (
    <div className="prose prose-stone max-w-none dark:prose-invert prose-pre:bg-stone-900 prose-pre:text-stone-100 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith(WIKI_HREF_PREFIX) ? url : defaultUrlTransform(url))}
        components={{
          input: ({ node, type, checked }) => {
            const line = node?.position?.start.line;
            if (type !== "checkbox" || !onToggleTask || line === undefined) {
              return <input type={type} checked={checked} disabled readOnly />;
            }
            return (
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleTask(line)}
                aria-label="Toggle task"
                className="cursor-pointer"
              />
            );
          },
          a: (props) => {
            const wikiTitle = wikiTitleFromHref(props.href);
            if (wikiTitle === null) {
              return (
                <a href={props.href} target="_blank" rel="noopener noreferrer">
                  {props.children}
                </a>
              );
            }
            const missing = isLinkMissing?.(wikiTitle) ?? false;
            return (
              <a
                href="#"
                title={missing ? `Create “${wikiTitle}”` : `Open “${wikiTitle}”`}
                className={missing ? "text-amber-700 dark:text-amber-400" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenLink?.(wikiTitle);
                }}
              >
                {props.children}
              </a>
            );
          },
        }}
      >
        {wikiLinksToMarkdown(source)}
      </ReactMarkdown>
    </div>
  );
}
