# Notesflow

A fast, private to-do list and notes app in the spirit of TickTick. Lists hold tasks and Markdown notes.
Everything works offline and is stored on your device; sign in to sync across devices.

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
- Public landing page at `/`, with the app at `/app`
- Installable PWA (Serwist): works offline, home-screen icon, Today and Inbox shortcuts
- Optional accounts (email + password or Google) with sync across devices; last edit wins per item

## Development

```bash
npm ci
npm run dev        # http://localhost:3000 (local-only mode, no setup needed)
npm run lint
npm run typecheck
npm test
npm run build
```

Built with Next.js (App Router), React, TypeScript, Tailwind CSS v4, Zustand, Vitest, Serwist (PWA),
Auth.js (next-auth v5), Drizzle ORM and Postgres.

### Accounts and sync (optional)

Without configuration the app is local-only. To try accounts and sync locally:

```bash
npm run db:dev                       # terminal 1: local Postgres (PGlite), prints a DATABASE_URL
cp .env.example .env.local           # then fill in DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)
npm run dev                          # terminal 2
```

### Deploying on Vercel with Neon

1. Import the repository in Vercel.
2. Add a Neon Postgres database (Vercel → Storage → Neon). It sets `DATABASE_URL` for you.
3. Add environment variables: `AUTH_SECRET` (`openssl rand -base64 32`); for Google sign-in also `AUTH_GOOGLE_ID` and
   `AUTH_GOOGLE_SECRET` (Google Cloud Console → OAuth client; authorised redirect URI
   `https://<your-domain>/api/auth/callback/google`).
4. Create the tables once, from your machine, with the production connection string (use Neon's _direct_,
   non-pooled string for migrations): `DATABASE_URL="…" npm run db:migrate`. Re-run it after pulling any change
   that adds a file under `drizzle/`.
5. Deploy. Open the site on your phone and use "Install app" / "Add to Home Screen".

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

The workflow never needs `DATABASE_URL` or any auth secret: the build and tests run without them.
