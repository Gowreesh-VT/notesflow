# Notesflow

A fast, private, local-first workspace for Markdown notes and tasks. Everything is stored in your browser;
nothing is sent to a server.

## Features

**Notes**

- Markdown editor with live split preview (GitHub-flavoured: tables, task lists, strikethrough)
- Formatting toolbar and shortcuts (Ctrl/⌘+B, Ctrl/⌘+I)
- `#tags` found automatically in your text, with a tag browser
- Pin, archive, duplicate, trash with restore, search, and sorting
- Word count, character count, reading time
- Export a note as `.md`; import `.md` / `.txt` files

**Tasks**

- Quick add with natural shortcuts: `Pay rent tomorrow !high`
- Priorities, due dates, details, subtasks and progress
- Inbox, Today (including overdue), Upcoming and Completed views, search

**Everywhere**

- Command palette (Ctrl/⌘+K), `/` to search, Alt+N new note, Alt+T new task
- Light, dark and system themes; responsive layout; keyboard and screen-reader friendly
- Full JSON backup and restore

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
Claude makes one small improvement following [CLAUDE.md](CLAUDE.md) and the maintainer's [ROADMAP.md](ROADMAP.md); the change is committed and pushed only after
the protected-path guard, lint, type check, tests and build all pass. If nothing worthwhile is found, no commit is made.

One-time setup in **Settings → Secrets and variables → Actions**:

| Kind     | Name                      | Value                                                |
| -------- | ------------------------- | ---------------------------------------------------- |
| Secret   | `CLAUDE_CODE_OAUTH_TOKEN` | Output of `claude setup-token` (Claude subscription) |
| Variable | `GIT_AUTHOR_EMAIL`        | The GitHub noreply email that receives commit credit |
