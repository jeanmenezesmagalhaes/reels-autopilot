#!/usr/bin/env bash
# Stores whatever is on the macOS clipboard as a sensitive Vercel env var,
# without printing it, then clears the clipboard and redeploys.
#   scripts/secret-from-clipboard.sh IG_APP_SECRET
set -euo pipefail
name="${1:?usage: secret-from-clipboard.sh ENV_NAME}"
value="$(pbpaste | tr -d '[:space:]')"
if [ "${#value}" -lt 16 ]; then echo "Clipboard doesn't look like a secret (${#value} chars). Copy it first."; exit 1; fi
printf '%s' "$value" | npx vercel env add "$name" production --force --sensitive >/dev/null
unset value
pbcopy < /dev/null
echo "✓ $name saved in Vercel (production, sensitive). Clipboard cleared."
npx vercel deploy --prod --yes >/dev/null && echo "✓ Deployed"
