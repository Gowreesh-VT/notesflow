"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownPreview({
  source,
  onToggleTask,
}: {
  source: string;
  onToggleTask?: (line: number) => void;
}) {
  if (!source.trim()) {
    return <p className="text-sm text-stone-500 dark:text-stone-400">Nothing to preview yet.</p>;
  }
  return (
    <div className="prose prose-stone max-w-none dark:prose-invert prose-pre:bg-stone-900 prose-pre:text-stone-100 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
          a: (props) => (
            <a href={props.href} target="_blank" rel="noopener noreferrer">
              {props.children}
            </a>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
