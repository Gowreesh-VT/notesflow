@AGENTS.md

# Notesflow — project guide and autonomous development policy

Notesflow is a Markdown notes + tasks app. Today it is local-first: all data lives in the browser
(`localStorage`), with no backend, database, authentication or environment variables. Larger features
(accounts, sync, a database) may be added over time through reviewed pull requests — see "Publishing tiers".

## Stack and commands

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · Zustand · react-markdown · Vitest · npm.

```bash
npm ci               # install (use the lockfile)
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest (jsdom)
npm run build        # production build
npm run format       # prettier --write (format:check verifies)
```

Layout: `src/app` (route + layout), `src/components` (UI), `src/store` (Zustand stores, persisted),
`src/lib` (pure logic: filtering, parsing, Markdown formatting, backup — all unit-tested).
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
`payments`, `billing`, `infra`, `terraform`, or a `schema.*` file. Changes above the minor size limit also go to a PR.
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

- Preserve the existing design language: stone neutrals, indigo accent, rounded corners, Geist font, the
  `btn` / `btn-primary` / `btn-ghost` / `btn-danger` / `field` classes in `src/app/globals.css`.
- Preserve colours and typography unless fixing a real contrast/accessibility problem.
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

These are allowed only as major changes (pull requests), built so the owner can review before anything is live:

- Never hard-code or commit a secret. Read configuration from environment variables, list each one with a
  placeholder in `.env.example`, and document in the PR's "How to test" what the owner must create and where.
- The app, tests and `npm run build` must succeed with none of those variables set. Read them lazily at request
  time, not at import time, and keep the existing local-only mode working when no backend is configured.
- Authentication and authorisation: use a well-established library, never custom crypto, never weaken a check to
  make something work, enforce authorisation on the server for every data access, validate all input.
- Databases: provide schema and migrations as files; migrations must be additive and non-destructive. Never write
  code that drops or rewrites user data without an explicit, reversible migration path. Describe data migration
  from the browser's `localStorage` in the PR.
- You cannot create accounts, projects or credentials. Do not attempt to; list them as steps for the owner.

Persistent data contracts: the `localStorage` keys (`notesflow:notes`, `notesflow:tasks`, `notesflow:ui`) and the
backup file format (`src/lib/backup.ts`) are user data. Never change them in a way that loses or invalidates
existing data; if a shape must change, add a store `version` + `migrate` and a test.

### Quality bar

Leave no TODO placeholders, fake data, commented-out code, debugging `console.log`, unused imports or
components, type errors, lint errors or build failures. Match the surrounding code's style and comment
density. Add or update tests when you change logic in `src/lib` or `src/store`.
