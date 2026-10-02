#!/usr/bin/env bash
# Validates the pull request description Claude wrote for a change that needs review.
# Usage: validate-pr-body.sh <file>
set -euo pipefail

file="${1:?usage: validate-pr-body.sh <file>}"

if [ ! -s "$file" ]; then
  echo "::error::PR description is missing or empty: $file"
  exit 1
fi
if [ "$(wc -c < "$file")" -gt 20000 ]; then
  echo "::error::PR description is too long."
  exit 1
fi
if tr -d '\n\t' < "$file" | LC_ALL=C grep -q '[[:cntrl:]]'; then
  echo "::error::PR description contains control characters."
  exit 1
fi
for heading in "## Summary" "## Why" "## What changed" "## How to test" "## Risks"; do
  if ! grep -q -x -F "$heading" "$file"; then
    echo "::error::PR description is missing the section: $heading"
    exit 1
  fi
done
if grep -q -E -i 'sk-ant-|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY' "$file"; then
  echo "::error::PR description contains something that looks like a secret."
  exit 1
fi
echo "PR description OK."
