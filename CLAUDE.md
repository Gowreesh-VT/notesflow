@AGENTS.md

# Notesflow — project guide and autonomous development policy

Notesflow is a local-first Markdown notes + tasks app. All data lives in the browser (`localStorage`);
there is no backend, no database, no authentication and no environment variables.

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
2. Inspect the repository and recent history (`git log --stat -n 20`) so you do not keep touching the same component.
3. Understand the current app.
4. Pick exactly ONE meaningful, small improvement (see priority order).
5. Implement it completely, with tests where the change is testable logic.
6. Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`; fix every failure you caused.
7. Write the commit message (see below) and stop.

Do NOT commit, push, branch, tag or touch git configuration. Leave the finished change in the working tree;
the workflow validates it, then commits and pushes it. If you cannot find a safe, genuinely useful
improvement, change nothing — an empty run is correct. Never change something only so that a commit exists.
Never do multiple unrelated improvements in one run.

### Commit message file

Write the message to `.daily-commit-message` in the repository root (it is git-ignored). Format:

```
<type>(<scope>): <imperative summary, at most 72 chars total on line 1>

<optional body: what and why, wrapped at ~72 chars>
```

`type` is one of `feat fix refactor perf test docs style chore a11y`; `scope` is optional, lowercase, e.g. `notes`,
`tasks`, `editor`, `sidebar`. Describe the real change. No emoji, no trailing period, no references to AI or
automation. Examples: `fix(editor): keep cursor position after toggling a checklist`,
`feat(tasks): add empty state for the Today view`, `a11y(palette): announce result count to screen readers`.

### Priority order

1. Real bugs 2. Broken behaviour 3. Accessibility 4. Mobile / responsive problems 5. Error and loading states
2. UX improvements to existing features 7. Code quality 8. Performance 9. Tests 10. Small useful features
3. Documentation that is genuinely useful

Prefer improving what exists over adding features. Do not let the app drift into feature bloat.
Good small features fit the existing model (e.g. list continuation in the editor, keyboard shortcuts for
existing actions, better empty states); bad ones need product decisions or new systems.

### Scope

A change should be reviewable as one small pull request: roughly ≤ 10 files and ≤ 400 changed lines.
The workflow rejects larger changes. Avoid redesigns, huge refactors, architecture changes, framework swaps,
speculative features, and anything needing a product or business decision.

### UI rules

- Preserve the existing design language: stone neutrals, indigo accent, rounded corners, Geist font, the
  `btn` / `btn-primary` / `btn-ghost` / `btn-danger` / `field` classes in `src/app/globals.css`.
- Preserve colours and typography unless fixing a real contrast/accessibility problem.
- Everything must work on desktop and mobile, in light and dark mode, and with the keyboard.
- Read the neighbouring components before changing UI and stay consistent with them.
- Prefer subtle polish. No random gradients, no gratuitous animation, no replacing working components because
  another look is "cooler".

### Protected areas — never modify during autonomous runs

The workflow fails (and discards the change) if any of these are touched:

- `.github/**` (workflows and scripts), `CLAUDE.md`, `AGENTS.md`, `.claude/**`
- Dependency and tooling config: `package.json`, `package-lock.json`, `.npmrc`, `next.config.*`,
  `tsconfig.json`, `eslint.config.*`, `vitest.config.*`, `postcss.config.*`, `.prettierrc*`, `.prettierignore`,
  `.gitignore`
- Secrets and environment: `.env*`, keys, certificates, tokens
- Deployment and infrastructure: Dockerfiles, `vercel.json`, `netlify.toml`, CI/CD, DNS, domains, cloud config
- Anything related to authentication, authorisation, OAuth, payments, billing, database schemas or migrations,
  access control, or credential handling (this app currently has none — do not introduce them)

Also forbidden: disabling security mechanisms, reading or printing secrets or environment variables,
destructive data operations, major framework or dependency upgrades.

Persistent data: the `localStorage` keys (`notesflow:notes`, `notesflow:tasks`, `notesflow:ui`) and the backup
file format (`src/lib/backup.ts`) are user data contracts. Never change them in a way that loses or
invalidates existing data; if a shape must change, add a store `version` + `migrate` and a test.

### Dependencies

Do not add dependencies; solve small problems with the platform, React and what is already installed.
(`package.json` is protected, so the workflow would reject the change anyway.)

### Quality bar

Leave no TODO placeholders, fake data, commented-out code, debugging `console.log`, unused imports or
components, type errors, lint errors or build failures. Match the surrounding code's style and comment
density. Add or update tests when you change logic in `src/lib` or `src/store`.
