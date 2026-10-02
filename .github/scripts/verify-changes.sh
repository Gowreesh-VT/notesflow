#!/usr/bin/env bash
# Guards an autonomous change before it is committed. Stages the working tree, then checks the staged
# diff against protected paths, size limits, file types and secret patterns.
# Writes `changed=true|false` to $GITHUB_OUTPUT when available. Exits non-zero on any violation.
set -euo pipefail

MAX_FILES="${MAX_FILES:-15}"
MAX_LINES="${MAX_LINES:-600}"

emit() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "$1" >> "$GITHUB_OUTPUT"; fi
}

git add -A

if git diff --cached --quiet; then
  echo "No changes in the working tree."
  emit "changed=false"
  exit 0
fi

PROTECTED='^(\.github/|\.claude/|\.husky/|\.vscode/|CLAUDE\.md$|AGENTS\.md$|package\.json$|package-lock\.json$|npm-shrinkwrap\.json$|yarn\.lock$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|\.npmrc$|\.nvmrc$|\.node-version$|\.gitignore$|\.gitattributes$|\.prettierrc|\.prettierignore$|\.env|next\.config\.|tsconfig[^/]*\.json$|eslint\.config\.|vitest\.config\.|postcss\.config\.|tailwind\.config\.|vercel\.json$|netlify\.toml$|Dockerfile|docker-compose|fly\.toml$|wrangler\.|firebase\.json$|\.firebaserc$|LICENSE|SECURITY\.md$|CODEOWNERS$)'
PROTECTED_ANYWHERE='(^|/)(migrations|prisma|drizzle|supabase|terraform|infra|\.aws|\.ssh)(/|$)|\.(pem|key|p12|pfx|crt|cer|jks|keystore)$|(^|/)(id_rsa|id_ed25519)'

violations=0
file_count=0
while IFS= read -r -d '' path; do
  file_count=$((file_count + 1))
  if [[ "$path" =~ $PROTECTED ]] || [[ "$path" =~ $PROTECTED_ANYWHERE ]]; then
    echo "::error::Protected path modified: $path"
    violations=$((violations + 1))
  fi
done < <(git diff --cached --name-only -z --no-renames)

if [ "$violations" -gt 0 ]; then
  echo "::error::$violations protected path(s) were modified; refusing to continue."
  exit 1
fi

if [ "$file_count" -gt "$MAX_FILES" ]; then
  echo "::error::Change touches $file_count files (limit $MAX_FILES); scope is too large."
  exit 1
fi

# ROADMAP.md is owner-curated: the only allowed edit is ticking items off ("[ ]" -> "[x]").
if git diff --cached --name-only --no-renames | grep -qx 'ROADMAP.md'; then
  roadmap_diff="$(git diff --cached -U0 --no-renames -- ROADMAP.md | sed '1,/^+++ /d')"
  normalize() { sed -E 's/\[[ xX]\]/[ ]/' | sort; }
  removed="$(grep -E '^-' <<< "$roadmap_diff" | sed 's/^-//' | normalize || true)"
  added_raw="$(grep -E '^\+' <<< "$roadmap_diff" | sed 's/^+//' || true)"
  added="$(normalize <<< "$added_raw")"
  all_ticks="$(grep -v -E '^- \[[xX]\] ' <<< "$added_raw" || true)"
  if [ "$removed" != "$added" ] || [ -n "$all_ticks" ]; then
    echo "::error::ROADMAP.md may only have items ticked off; other edits are not allowed."
    exit 1
  fi
fi

# Reject symlinks, newly executable files, submodules and binary files.
while read -r _src_mode dst_mode _src_sha _dst_sha status path; do
  case "$dst_mode" in
    120000) echo "::error::Symlink not allowed: $path"; exit 1 ;;
    160000) echo "::error::Submodule not allowed: $path"; exit 1 ;;
    100755) [ "$status" = "M" ] || { echo "::error::Executable file not allowed: $path"; exit 1; } ;;
  esac
done < <(git diff --cached --raw --no-renames | sed 's/^://')

total_lines=0
while IFS=$'\t' read -r added removed path; do
  if [ "$added" = "-" ]; then
    echo "::error::Binary file not allowed: $path"
    exit 1
  fi
  total_lines=$((total_lines + added + removed))
done < <(git diff --cached --numstat --no-renames)

if [ "$total_lines" -gt "$MAX_LINES" ]; then
  echo "::error::Change is $total_lines lines (limit $MAX_LINES); scope is too large."
  exit 1
fi

SECRET_PATTERN='(sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
if git diff --cached -U0 --no-renames | grep '^+' | grep -v '^+++' | grep -E -q "$SECRET_PATTERN"; then
  echo "::error::Possible secret found in the diff; refusing to continue."
  exit 1
fi

echo "Verified: $file_count file(s), $total_lines changed line(s)."
git diff --cached --stat --no-renames
emit "changed=true"
