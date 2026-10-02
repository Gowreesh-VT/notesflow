"use client";

import { INBOX_ID } from "@/lib/types";
import { useWorkspace } from "@/store/workspace";

export function ListSelect({
  value,
  onChange,
  label = "List",
  className,
}: {
  value: string;
  onChange: (listId: string) => void;
  label?: string;
  className?: string;
}) {
  const lists = useWorkspace((s) => s.lists);
  const folders = useWorkspace((s) => s.folders);
  const topLevel = lists.filter((l) => !l.folderId || !folders.some((f) => f.id === l.folderId));

  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? "field"}
    >
      <option value={INBOX_ID}>Inbox</option>
      {topLevel.map((list) => (
        <option key={list.id} value={list.id}>
          {list.name}
        </option>
      ))}
      {folders.map((folder) => {
        const inFolder = lists.filter((l) => l.folderId === folder.id);
        if (inFolder.length === 0) return null;
        return (
          <optgroup key={folder.id} label={folder.name}>
            {inFolder.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
