#!/usr/bin/env bash
# Removes attribution trailers and boilerplate that Claude tends to append to commit messages, normalises
# line endings and trailing blank lines. The cleaned message must still pass validate-commit-message.sh.
# Usage: clean-commit-message.sh <file>
set -euo pipefail

file="${1:?usage: clean-commit-message.sh <file>}"
[ -s "$file" ] || exit 0

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

tr -d '\r' < "$file" \
  | sed -E '/^[[:space:]]*(co-authored-by|signed-off-by|reviewed-by|generated-by)[[:space:]]*:/Id' \
  | sed -E '/generated (with|by) .*(claude|anthropic)/Id' \
  | sed -E '/^[[:space:]]*(🤖|✨)/d' \
  | sed -E '/^[[:space:]]*https?:\/\/claude\.(com|ai)\b/Id' \
  > "$tmp"

# Trim trailing blank lines, then end with a single newline.
awk 'NF { last = NR } { lines[NR] = $0 } END { for (i = 1; i <= last; i++) print lines[i] }' "$tmp" > "$file"
