#!/usr/bin/env bash
# Commits the staged change as a series of commits of at most N files each.
# Usage: commit-in-batches.sh <commit-message-file> [files-per-commit]
# The first commit carries the full message; later ones repeat the subject and note which part they are.
# With N files or fewer, a single commit with the plain message is made. Author/committer come from the
# GIT_AUTHOR_* / GIT_COMMITTER_* environment (or git config).
set -euo pipefail

message_file="${1:?usage: commit-in-batches.sh <commit-message-file> [files-per-commit]}"
chunk="${2:-5}"

if ! [[ "$chunk" =~ ^[1-9][0-9]*$ ]]; then
  echo "::error::files-per-commit must be a positive integer."
  exit 1
fi

files=()
while IFS= read -r -d '' path; do files+=("$path"); done < <(git diff --cached --name-only -z --no-renames)

total="${#files[@]}"
if [ "$total" -eq 0 ]; then
  echo "::error::Nothing is staged."
  exit 1
fi

parts=$(((total + chunk - 1) / chunk))
subject="$(head -n 1 "$message_file")"
msg="$(mktemp)"
trap 'rm -f "$msg"' EXIT

git reset -q

for ((i = 1; i <= parts; i++)); do
  batch=("${files[@]:$(((i - 1) * chunk)):chunk}")
  if [ "$parts" -eq 1 ]; then
    cp "$message_file" "$msg"
  elif [ "$i" -eq 1 ]; then
    { printf '%s (%s/%s)\n' "$subject" "$i" "$parts"; tail -n +2 "$message_file"; } > "$msg"
  else
    printf '%s (%s/%s)\n\nPart %s of %s of the same change.\n' "$subject" "$i" "$parts" "$i" "$parts" > "$msg"
  fi
  git add -- "${batch[@]}"
  git commit --quiet --file "$msg"
  git log -1 --format='Committed %h by %an <%ae>: %s'
done

if [ -n "$(git status --porcelain)" ]; then
  echo "::error::Working tree is not clean after committing all batches."
  git status --short
  exit 1
fi
