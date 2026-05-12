#!/bin/bash
set -euo pipefail

# Only run in remote (web) sessions — local sessions already have node_modules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install dependencies so `npm run dev` (Preview) and `npm run lint` work.
npm install --no-audit --no-fund
