#!/usr/bin/env bash
# Deploy the arcade gateway worker to Cloudflare.
# Credentials come from ~/.config/cloudflare/credentials.env (or env vars).
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE="${CLOUDFLARE_ENV_FILE:-$HOME/.config/cloudflare/credentials.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is not set. Put it in $ENV_FILE" >&2
  exit 1
fi

exec npx -y wrangler@4 deploy "$@"
