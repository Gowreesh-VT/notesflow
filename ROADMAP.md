# Notesflow roadmap

This file is the owner's steering wheel for the daily autonomous run (see CLAUDE.md). Edit it freely;
the daily run may only tick items off (`- [ ]` → `- [x]`), never reword, add or remove them.

How the daily run uses it:

- It first fixes any real bug or accessibility blocker it finds.
- Otherwise it takes the **first unchecked item under "Next up"**, top to bottom.
- Items larger than one run are done in slices; the item is only ticked when fully complete.
- Nothing under "Ideas" is started until it is moved to "Next up". Nothing under "Not wanted" is ever built.
- When "Next up" is empty it falls back to the general priority order in CLAUDE.md.

Keep items small and concrete: one sentence, user-visible outcome, no implementation details.

## Next up

- [ ] Interactive checkboxes in the Markdown preview: clicking a task-list item toggles it in the note
- [ ] Keyboard shortcut help dialog, opened with `?` and listed in the command palette
- [ ] Highlight search matches in the note list snippets and in the preview
- [ ] Rename a tag across all notes from the sidebar
- [ ] Recurring tasks (daily, weekly, monthly) that reappear when completed

## Ideas (not started — move up to "Next up" to approve)

- Note templates (meeting notes, daily journal)
- Task and note linking with `[[wiki links]]`
- Drag-and-drop ordering for tasks
- Focus mode (hide chrome while writing)
- Print-friendly note export

## Not wanted

- Accounts, sync, or any backend
- AI features
- Heavy dependencies for small features
- A visual redesign
