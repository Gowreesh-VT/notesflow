#!/usr/bin/env bash
# Validates a commit message file: conventional subject line, sane length, no AI/automation boilerplate.
# Usage: validate-commit-message.sh <file>
set -euo pipefail

file="${1:?usage: validate-commit-message.sh <file>}"

if [ ! -s "$file" ]; then
  echo "::error::Commit message file is missing or empty: $file"
  exit 1
fi

if tr -d '\n\t' < "$file" | LC_ALL=C grep -q '[[:cntrl:]]'; then
  echo "::error::Commit message contains control characters."
  exit 1
fi

subject="$(head -n 1 "$file")"
pattern='^(feat|fix|refactor|perf|test|docs|style|chore|a11y)(\([a-z0-9-]+\))?: [^ ].{2,}[^.]$'
if [ "${#subject}" -gt 64 ] || ! [[ "$subject" =~ $pattern ]]; then
  echo "::error::Invalid commit subject: $subject"
  echo "Expected '<type>(<scope>): <summary>' (<= 64 chars, no trailing period)."
  exit 1
fi

if [ "$(wc -l < "$file")" -gt 30 ] || [ "$(wc -c < "$file")" -gt 2000 ]; then
  echo "::error::Commit message is too long."
  exit 1
fi

if [ "$(sed -n '2p' "$file")" != "" ]; then
  echo "::error::Commit message needs a blank line after the subject."
  exit 1
fi

if grep -q -i -E 'co-authored-by|generated with|claude|anthropic|signed-off-by' "$file"; then
  echo "::error::Commit message must not contain trailers or automation attribution."
  exit 1
fi

echo "Commit message OK: $subject"
