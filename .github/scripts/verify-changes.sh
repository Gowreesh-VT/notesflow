#!/usr/bin/env bash
# Guards an autonomous change before it is published. Stages the working tree, then checks the staged diff.
#
#   Always rejected:      hard-protected paths (workflows, policy files, secrets, git/npm config), symlinks,
#                         executables, binaries, likely secrets, changes above the absolute size limits,
#                         and any ROADMAP.md edit other than ticking items off.
#   Requires human review: dependency/config/deploy/database/auth paths, or a change above the direct-commit
#                         size limits. These must go through a pull request, never straight to the default branch.
#
# Writes changed=true|false, needs_review=true|false and review_reasons to $GITHUB_OUTPUT when available.
set -euo pipefail

ABS_MAX_FILES="${ABS_MAX_FILES:-50}"
ABS_MAX_LINES="${ABS_MAX_LINES:-10000}"
DIRECT_MAX_FILES="${DIRECT_MAX_FILES:-15}"
DIRECT_MAX_LINES="${DIRECT_MAX_LINES:-600}"

emit() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "$1" >> "$GITHUB_OUTPUT"; fi
}

git add -A

if git diff --cached --quiet; then
  echo "No changes in the working tree."
  emit "changed=false"
  exit 0
fi

HARD='^(\.github/|\.claude/|\.husky/|\.vscode/|CLAUDE\.md$|AGENTS\.md$|\.npmrc$|\.nvmrc$|\.node-version$|\.gitignore$|\.gitattributes$|LICENSE|SECURITY\.md$|CODEOWNERS$)'
HARD_ANYWHERE='(^|/)(\.aws|\.ssh)(/|$)|\.(pem|key|p12|pfx|crt|cer|jks|keystore)$|(^|/)(id_rsa|id_ed25519)'
REVIEW='^(package\.json$|package-lock\.json$|npm-shrinkwrap\.json$|yarn\.lock$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|\.env|\.prettierrc|\.prettierignore$|next\.config\.|tsconfig[^/]*\.json$|eslint\.config\.|vitest\.config\.|postcss\.config\.|tailwind\.config\.|vercel\.json$|netlify\.toml$|Dockerfile|docker-compose|fly\.toml$|wrangler\.|firebase\.json$|\.firebaserc$)'
REVIEW_ANYWHERE='(^|/)(auth|authentication|authorization|oauth|session|sessions|api|db|database|migrations|prisma|drizzle|supabase|terraform|infra|payments?|billing|middleware|proxy|server|scripts|sync|sync-client)(/|\.[a-z]+$|$)|(^|/)schema\.[a-z]+$'

violations=0
file_count=0
reasons=()
while IFS= read -r -d '' path; do
  file_count=$((file_count + 1))
  base="${path##*/}"
  if [[ "$base" =~ ^\.env ]] && [[ "$base" != ".env.example" && "$base" != ".env.sample" ]]; then
    echo "::error::Environment file modified: $path"
    violations=$((violations + 1))
  elif [[ "$path" =~ $HARD ]] || [[ "$path" =~ $HARD_ANYWHERE ]]; then
    echo "::error::Protected path modified: $path"
    violations=$((violations + 1))
  elif [[ "$path" =~ $REVIEW ]] || [[ "$path" =~ $REVIEW_ANYWHERE ]]; then
    reasons+=("touches $path")
  fi
done < <(git diff --cached --name-only -z --no-renames)

if [ "$violations" -gt 0 ]; then
  echo "::error::$violations protected path(s) were modified; refusing to continue."
  exit 1
fi

if [ "$file_count" -gt "$ABS_MAX_FILES" ]; then
  echo "::error::Change touches $file_count files (absolute limit $ABS_MAX_FILES)."
  exit 1
fi

# ROADMAP.md is owner-curated: the only allowed edit is ticking items off ("[ ]" -> "[x]").
if git diff --cached --name-only --no-renames | grep -qx 'ROADMAP.md'; then
  roadmap_diff="$(git diff --cached -U0 --no-renames -- ROADMAP.md | sed '1,/^+++ /d')"
  normalize() { sed -E 's/\[[ xX]\]/[ ]/' | sort; }
  removed="$(grep -E '^-' <<< "$roadmap_diff" | sed 's/^-//' | normalize || true)"
  added_raw="$(grep -E '^\+' <<< "$roadmap_diff" | sed 's/^+//' || true)"
  added="$(normalize <<< "$added_raw")"
  not_ticks="$(grep -v -E '^- \[[xX]\] ' <<< "$added_raw" || true)"
  if [ "$removed" != "$added" ] || [ -n "$not_ticks" ]; then
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

if [ "$total_lines" -gt "$ABS_MAX_LINES" ]; then
  echo "::error::Change is $total_lines lines (absolute limit $ABS_MAX_LINES)."
  exit 1
fi

SECRET_PATTERN='(sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
if git diff --cached -U0 --no-renames | grep '^+' | grep -v '^+++' | grep -E -q "$SECRET_PATTERN"; then
  echo "::error::Possible secret found in the diff; refusing to continue."
  exit 1
fi

if [ "$file_count" -gt "$DIRECT_MAX_FILES" ] || [ "$total_lines" -gt "$DIRECT_MAX_LINES" ]; then
  reasons+=("size: $file_count files / $total_lines lines exceeds the direct-commit limit of $DIRECT_MAX_FILES files / $DIRECT_MAX_LINES lines")
fi

echo "Verified: $file_count file(s), $total_lines changed line(s)."
git diff --cached --stat --no-renames

if [ "${#reasons[@]}" -gt 0 ]; then
  echo "Needs human review:"
  printf ' - %s\n' "${reasons[@]}"
  emit "needs_review=true"
  joined="$(printf '%s; ' "${reasons[@]}")"
  emit "review_reasons=${joined%; }"
else
  emit "needs_review=false"
  emit "review_reasons="
fi
emit "changed=true"
