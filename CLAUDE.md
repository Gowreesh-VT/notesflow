@AGENTS.md

# Notesflow — project guide and autonomous development policy

Notesflow is a to-do list and notes app in the spirit of TickTick: **lists hold tasks and notes**, with smart
views (Inbox, Today, Tomorrow, Next 7 Days, All, Completed, Won't Do, Trash), folders, tags, priorities, due dates,
subtasks and Markdown notes. Tasks come first; notes are first-class but secondary.

The app is local-first and works fully offline as an installable PWA (Serwist). Data lives in the browser
(`localStorage`); signed-in users (Auth.js: email + password, optional Google) also sync it to Postgres (Neon via
Drizzle). Without `DATABASE_URL` and `AUTH_SECRET` the app simply stays local-only, and the build, tests and daily
automation never need those variables.

Product direction: build the ideas and UX patterns people know from TickTick-style apps (quick add, smart lists,
calendar, board and matrix views, reminders, recurring tasks, Pomodoro, habits). Never copy TickTick's branding,
logo, icons, copy or assets, and do not mention it in the UI.

## Stack and commands

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · Zustand · react-markdown · Vitest · Serwist (PWA) ·
Auth.js (next-auth v5, JWT sessions) · Drizzle ORM + Postgres (`pg`) · npm.

```bash
npm ci               # install (use the lockfile)
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest (jsdom)
npm run build        # production build
npm run format       # prettier --write (format:check verifies)
```

Routes: `/` is the public landing page (`src/app/page.tsx`, static, with the decorative `AppPreview`), `/app` is the
app itself (the PWA `start_url`), `/~offline` is the offline fallback. Keep the landing page honest: only describe
features that exist; upcoming ones belong in its "Growing steadily" list.

Layout: `src/app` (route + layout), `src/components` (UI: `Sidebar`, `ItemList`, `TaskDetail`, `NoteDetail`,
`MarkdownEditor`, `CommandPalette`), `src/store` (`workspace.ts` holds items, lists and folders; `ui.ts` holds view
state), `src/lib` (pure logic: `items-logic.ts` views/filtering/sorting/quick-add, `migrate.ts`, `backup.ts`,
Markdown formatting — all unit-tested).

Server code lives in `src/server` (schema, db, password hashing, rate limiting, sync store, registration) and
`src/app/api` (`/api/auth`, `/api/register`, `/api/sync`, `/api/cloud`). Client sync is `src/lib/sync.ts` (pure,
last-write-wins merge) and `src/lib/sync-client.ts`. Database tests run against in-memory Postgres (PGlite) using
the real migrations in `drizzle/`; `npm run db:dev` serves the same engine for local development.

Data model: one `Item` type with `kind: "task" | "note"`, a `listId` (`inbox` is built in), a `status`
(`open | done | wontdo`), `priority`, `due` (YYYY-MM-DD), subtasks and soft-delete (`deletedAt`). Tags are
`#words` found in an item's title or body. Smart views are computed, never stored.

**Sync rules for every new field.** Items, lists and folders are synced as JSON records, so a new field needs no
database migration — but it must be added to (1) the types in `src/lib/types.ts`, (2) the sanitisers `parseItem`,
`parseList`, `parseFolder` in `src/lib/backup.ts` (unknown fields are dropped there, on both backup import and
sync), (3) the store's `addItem`/mutations, which must bump `updatedAt` (last write wins), and (4) a persisted-store
`version` + `migrate` if existing local data needs a default. Add a test for each. Permanent deletions must create a
tombstone. A feature that is not synced is incomplete.
Prefer **optional** item fields (`dueTime`, `startDate`, `estimate`, `timeEntries`, `outcome`, `energy`, `template`,
`reminders`, `constantReminder`, `snoozedUntil`, `repeat`, `order`, `dailyNote`; lists: `order`, `archivedAt`): write them
in `optionalItemFields` in `backup.ts` only when set, and list them in `OPTIONAL_FIELDS` in `src/store/workspace.ts`
so a null or empty value is deleted instead of stored. Then no store migration or fixture changes are needed.
Templates are items with `template: true`; every view, count and tag list must keep excluding them.
Saved filters (`"filter"`), habits (`"habit"`) and countdowns (`"countdown"`) are synced collections too: a new collection must be added
everywhere `COLLECTIONS` is used (sync, backup, store, SyncRunner). Archived lists (`archivedAt`) and their items stay
out of smart views, counts, tags and list pickers (use `activeLists`/`isArchived` from `items-logic.ts`).
`filterItems`/`countInView` take an optional context with the saved filters and archived list ids; pass it.
Completing a repeating task goes through `setStatus`, which returns the id of the finished copy; use that id for
anything that follows completion (such as the outcome prompt). Reminder firing state (`src/store/alarms.ts`) and
reminder settings live on the device only and are never synced, except that a device with push reminders sends
its time zone, default reminder time and quiet hours to the server (`src/server/push.ts`, `/api/push/subscribe`,
`/api/cron/reminders`). Server reminder maths must reuse `dueAlarms`/`repeatAlarms` with `atZone(timeZone)`.
Keep logic in `src/lib` as pure functions with tests; keep components thin.

The Next.js version in this repo has breaking changes. Before using a Next.js API you are unsure about,
read the matching guide in `node_modules/next/dist/docs/`.

## Daily autonomous run — mission

You may be started by the scheduled workflow (`.github/workflows/daily-improvement.yml`) with no human
watching. On each run:

1. Read this file.
2. Read `ROADMAP.md` (the owner's plan; see "Roadmap").
3. Inspect the repository and recent history (`git log --stat -n 20`) so you do not keep touching the same component
   and know which roadmap items are done or partly done.
4. Pick exactly ONE improvement: a real bug or accessibility blocker if you find one, otherwise the next roadmap
   item, otherwise the general priority order.
5. Implement it completely, with tests where the change is testable logic.
6. Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`; fix every failure you caused.
7. Classify the change and write the output files (see "Publishing tiers").

Do NOT commit, push, branch, tag or touch git configuration. Leave the finished change in the working tree;
the workflow validates it, then publishes it. If you cannot find a safe, genuinely useful improvement, change
nothing and write no output files — an empty run is correct. Never change something only so that a commit exists.
Never do multiple unrelated improvements in one run.

## Publishing tiers

The workflow publishes your change one of two ways. You classify it; the workflow also checks it independently and
can only make the decision stricter, never looser.

**Minor → committed straight to the default branch.** A bug fix, accessibility or responsive fix, UX polish, small
refactor, tests, docs, or a small self-contained feature. Must be small (the workflow requires ≤ 15 files and
≤ 600 changed lines), must not add dependencies, and must not touch any "needs review" path below.

**Major → opened as a pull request for the owner to approve.** Anything that is a significant feature, changes
architecture or data shape, adds a dependency, or is larger than a minor change. Examples: accounts/auth, a
database or sync layer, new routes with APIs, large editor features, import/export format changes. When in doubt,
choose major — a reviewed PR is always acceptable; an unreviewed risky commit is not.

Paths that always force the pull-request path (the workflow detects these itself): `package.json`, lockfiles,
`.env.example`, build/tooling config (`next.config.*`, `tsconfig*.json`, `eslint.config.*`, `vitest.config.*`,
`postcss.config.*`, `.prettierrc*`), deploy config (`vercel.json`, `Dockerfile*`, …), and anything under or named
`auth`, `api`, `db`, `database`, `migrations`, `prisma`, `drizzle`, `supabase`, `session(s)`, `middleware`, `proxy`,
`server`, `sync`, `scripts`, `payments`, `billing`, `infra`, `terraform`, or a `schema.*` file. Changes above the minor size limit also go to a PR.
The absolute limit is 50 files and 10,000 changed lines; beyond that the run fails and nothing is published.

Prefer several small, reviewable pull requests over one giant one: build large features in slices (for example
schema, then API, then UI) where each slice leaves the app working. If an open automation PR already exists (the
prompt tells you the count), do not start another major change; do a minor one or nothing.

### Output files (all git-ignored, in the repository root)

`.daily-change-class` — a single word: `minor` or `major`. (Missing or anything else is treated as `major`.)

`.daily-commit-message` — required for every change:

```
<type>(<scope>): <imperative summary, at most 64 chars total on line 1>

<optional body: what and why, wrapped at ~72 chars>
```

`type` is one of `feat fix refactor perf test docs style chore a11y`; `scope` is optional, lowercase, e.g. `notes`,
`tasks`, `editor`, `sidebar`. Describe the real change. No emoji, no trailing period, no trailers, no references to AI
or automation. For a slice of a larger roadmap item add `Roadmap: <item>, part N` in the body. The workflow commits large changes in batches of 5 files and appends ` (i/n)` to each subject, which is why
the limit is 64; for a pull request the plain subject becomes the PR title. Because batches are cut by file path,
keep each change coherent so every batch tells a reasonable story.

`.daily-pr-body.md` — required for `major` changes; becomes the pull request description. It must contain exactly
these `##` headings, each with real content:

```
## Summary
## Why
## What changed
## How to test
## Risks
```

Summary: 2–3 sentences for a reviewer. Why: the problem or roadmap item. What changed: the notable files and
decisions. How to test: concrete steps, including anything the owner must configure first (env vars, provider setup).
Risks: what could go wrong, data/migration impact, security considerations, anything you could not verify.
Be honest about limits. Never include secrets.

### Roadmap

`ROADMAP.md` is owned by the maintainer and decides what to build.

- First, fix any real bug, broken behaviour or accessibility blocker you find (priorities 1–3 below). These always win.
- Otherwise take the **first unchecked item under "Next up"**, top to bottom. If it is too big for one run, implement
  the first coherent slice that leaves the app working. The next run continues it — check `git log` for earlier parts
  and for whether the item is already done.
- When an item is fully complete, tick it in `ROADMAP.md` (`- [ ]` → `- [x]`) in the same change. That is the
  only edit you may make to `ROADMAP.md`; the workflow rejects any other change (rewording, adding, removing,
  reordering). Never tick an item that is only partly done.
- Never start anything under "Ideas" and never build anything under "Not wanted".
- If "Next up" is empty or fully ticked, fall back to the priority order below.
- If an item cannot be done within these rules, skip to the next item and leave it unticked.

### Priority order

1. Real bugs 2. Broken behaviour 3. Accessibility 4. Mobile / responsive problems 5. Error and loading states
2. UX improvements to existing features 7. Code quality 8. Performance 9. Tests 10. Small useful features
3. Documentation that is genuinely useful

Prefer improving what exists over adding features. Do not let the app drift into feature bloat; features come from
the roadmap, not from your own ideas. Avoid redesigns, framework swaps, speculative features and anything needing a
product or business decision the roadmap does not already make.

### UI rules

- Preserve the existing design language, "cool minimal": slate neutrals (the `stone-*` scale is overridden with cool
  slate tones in `src/app/globals.css`), a calm blue accent (`accent-*` scale), rounded-xl controls and rounded-2xl
  panels, soft shadows (`shadow-soft`, `shadow-lift`), Geist for UI text and Fraunces for headings
  (`heading-display`), and the `btn` / `btn-primary` / `btn-ghost` / `btn-danger` / `field` classes. Use the scales
  and classes, never raw hex colours (brand hex values live only in `src/lib/brand.ts`); there is no `indigo`.
- Layout (TickTick-style): a slim icon rail (`NavRail`), the lists sidebar, a full-width item list grouped by date
  or section with collapsible group headers, and a detail panel that opens beside the list only when an item is
  selected. Task checkboxes are rounded squares coloured by priority; selected rows use `accent-50`.
- Preserve colours and typography unless fixing a real contrast/accessibility problem (keep text at 4.5:1 or better).
- Everything must work on desktop and mobile, in light and dark mode, and with the keyboard.
- Read the neighbouring components before changing UI and stay consistent with them.
- Prefer subtle polish. No random gradients, no gratuitous animation, no replacing working components because
  another look is "cooler".

### Never modify, in any tier

The workflow rejects the run if any of these are touched:

- `.github/**` (workflows and scripts), `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `.husky/**`
- `.gitignore`, `.gitattributes`, `.npmrc`, `.nvmrc`, `LICENSE`, `SECURITY.md`, `CODEOWNERS`
- `.env` and any `.env.*` file other than `.env.example`; keys, certificates, tokens
- `ROADMAP.md` except ticking items off

Also forbidden: disabling or weakening security mechanisms, reading or printing secrets or environment variables,
hard-coding any credential, destructive data operations, deleting or rewriting user data.

### Dependencies

Prefer the platform, React and what is already installed. Adding a dependency is allowed only for a major change
(pull request) when it is clearly the right tool, well known, actively maintained and widely used — check the
package name carefully for typos and look-alikes. Install with `npm install --ignore-scripts <package>`; install
scripts are never run. Never perform major-version upgrades of Next.js, React or other existing dependencies.
Explain every new dependency in the PR's "What changed" and "Risks" sections.

### Databases, authentication and secrets

These exist already and are security-sensitive, so any change to them is a major change (pull request):

- Never hard-code or commit a secret. Configuration comes from environment variables (`DATABASE_URL`, `AUTH_SECRET`,
  `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`); list any new one with a placeholder in `.env.example` and document in the
  PR's "How to test" what the owner must create and where.
- The app, tests and `npm run build` must succeed with none of those variables set; read them lazily at request
  time, and keep the local-only mode working when no backend is configured.
- Authentication and authorisation: every API route takes the user id from the session, never from the request;
  every query is scoped by that user id; validate all input; keep rate limits; never weaken a check to make
  something work; never custom crypto beyond the existing scrypt helper.
- Database changes: edit `src/server/schema.ts`, generate a migration with `npm run db:generate`, commit the
  files in `drizzle/`, and make migrations additive and non-destructive. Never write code that drops or rewrites
  user data without an explicit, reversible migration path. Tests use the real migrations (PGlite).
- You cannot create accounts, projects or credentials. Do not attempt to; list them as steps for the owner.

Persistent data contracts: the `localStorage` keys `notesflow:workspace`, `notesflow:ui` and `notesflow:sync`, the
sync wire format (`SyncRecord` in `src/lib/sync.ts`) and `sync_record` table, the backup file format
(`src/lib/backup.ts`, version 2, which also imports the original notes+tasks format) and the one-time upgrade from
the legacy `notesflow:notes` / `notesflow:tasks` keys (`upgradeLegacyStorage`; never delete those keys) are user data. Never change them in a way that loses or invalidates
existing data; if a shape must change, add a store `version` + `migrate` and a test.

### Quality bar

Leave no TODO placeholders, fake data, commented-out code, debugging `console.log`, unused imports or
components, type errors, lint errors or build failures. Match the surrounding code's style and comment
density. Add or update tests when you change logic in `src/lib` or `src/store`.
