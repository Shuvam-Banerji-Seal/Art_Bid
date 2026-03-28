#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <your-noip-hostname> [public-port]"
  echo "Example: $0 myartapp.ddns.net 80"
  exit 1
fi

NOIP_HOST="$1"
PUBLIC_PORT="${2:-80}"

# For temporary internet access, terminate TLS at router/reverse-proxy if needed.
# This mode keeps app startup simple and reliable for short demos.
export USE_HTTPS="false"
export PUBLIC_HOST="$NOIP_HOST"
export PUBLIC_SCHEME="http"
export PUBLIC_PORT="$PUBLIC_PORT"

echo "Starting app for No-IP host: $NOIP_HOST"
echo "Expected public URL: http://$NOIP_HOST${PUBLIC_PORT:+:$PUBLIC_PORT}"
"$ROOT_DIR/ops/start_server_safe.sh"
