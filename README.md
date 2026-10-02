# Notesflow

A fast, private to-do list and notes app in the spirit of TickTick. Lists hold tasks and Markdown notes, and
everything is stored in your browser; nothing is sent to a server.

## Features

**Organise**

- Smart views: Inbox, Today (with overdue), Tomorrow, Next 7 Days, All, Completed, Won't Do, Trash
- Your own lists, grouped into folders; `#tags` found automatically in titles and notes
- Search and sort (smart order, due date, priority, title, last edited) in every view

**Tasks**

- Quick add with shortcuts: `Pay rent tomorrow !high #bills`
- Priorities, due dates, subtasks with progress, descriptions in Markdown
- Complete, mark Won't Do, duplicate, move to trash and restore

**Notes**

- Markdown editor with live split preview, formatting toolbar, list continuation, clickable checklists
- Pin, duplicate, export as `.md`, import `.md` / `.txt` files; word count and reading time

**Everywhere**

- Command palette (Ctrl/⌘+K), `/` to search, `?` for shortcuts, Alt+T new task, Alt+N new note
- Light, dark and system themes; responsive layout; keyboard and screen-reader friendly
- Full JSON backup and restore (older backups still import)

## Development

```bash
npm ci
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm test
npm run build
```

Built with Next.js (App Router), React, TypeScript, Tailwind CSS v4, Zustand and Vitest.

## Autonomous daily improvements

`.github/workflows/daily-improvement.yml` runs every day at 09:00 Asia/Kolkata (and on demand from the Actions tab).
Claude makes one improvement following [CLAUDE.md](CLAUDE.md) and the maintainer's [ROADMAP.md](ROADMAP.md).
Every change must pass the protected-path guard, lint, type check, tests and build before it is published:

- **Minor changes** (small, low-risk) are committed straight to the default branch.
- **Major changes** (big features, new dependencies, config, database or auth paths) are opened as a pull request
  with a summary, rationale, test steps and risks. Nothing is merged until the owner approves it.

Changes are committed in batches of at most 5 files (`(1/3)`, `(2/3)`, …) and pushed together.
If nothing worthwhile is found, no commit is made.

One-time setup in **Settings → Secrets and variables → Actions**:

| Kind     | Name                      | Value                                                |
| -------- | ------------------------- | ---------------------------------------------------- |
| Secret   | `CLAUDE_CODE_OAUTH_TOKEN` | Output of `claude setup-token` (Claude subscription) |
| Variable | `GIT_AUTHOR_EMAIL`        | The GitHub noreply email that receives commit credit |
