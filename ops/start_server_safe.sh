#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"
LOG_DIR="$ROOT_DIR/logs"
CERT_DIR="$ROOT_DIR/certs"
SERVER_PID_FILE="$SERVER_DIR/server.pid"
CLIENT_PID_FILE="$CLIENT_DIR/client.pid"
SERVER_LOG="$LOG_DIR/server.out"
CLIENT_LOG="$LOG_DIR/client.out"
CERT_FILE="$CERT_DIR/dev-cert.pem"
KEY_FILE="$CERT_DIR/dev-key.pem"

BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
USE_HTTPS="${USE_HTTPS:-true}"
PROTOCOL="http"

if [[ "$USE_HTTPS" == "true" ]]; then
  PROTOCOL="https"
fi

mkdir -p "$LOG_DIR"

get_lan_ip() {
  local ip
  ip="$({ /usr/bin/ip -4 -o addr show scope global 2>/dev/null || true; } | awk '{print $4}' | head -n 1 | cut -d/ -f1)"
  if [[ -z "$ip" ]]; then
    ip="127.0.0.1"
  fi
  echo "$ip"
}

ensure_https_cert() {
  if [[ "$USE_HTTPS" != "true" ]]; then
    return 0
  fi

  mkdir -p "$CERT_DIR"
  if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
    return 0
  fi

  echo "Generating HTTPS certificate using Python..."
  python3 "$ROOT_DIR/ops/generate_https_cert.py" --cert "$CERT_FILE" --key "$KEY_FILE"
}

stop_pid_from_file() {
  local pid_file="$1"
  local label="$2"
  local pid=""

  if [[ -f "$pid_file" ]]; then
    pid="$(tr -d '[:space:]' < "$pid_file" || true)"
  fi

  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "Stopping existing $label process (PID: $pid) with SIGTERM..."
    kill -TERM "$pid" || true
    for _ in {1..20}; do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 0.5
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "$label did not exit in time; forcing stop (SIGKILL)..."
      kill -KILL "$pid" || true
      sleep 0.5
    fi
  fi

  rm -f "$pid_file"
}

stop_stale_processes() {
  # Clean up stale processes for this specific app only.
  # This does not touch PostgreSQL or any non-app services.
  local stale_pids
  stale_pids="$(pgrep -f "$SERVER_DIR/index.js|$SERVER_DIR.*npm run start|$SERVER_DIR.*npm run dev|$CLIENT_DIR.*vite|$CLIENT_DIR.*npm run dev" || true)"
  if [[ -n "$stale_pids" ]]; then
    echo "Stopping stale app processes: $stale_pids"
    while IFS= read -r p; do
      [[ -z "$p" ]] && continue
      kill -TERM "$p" 2>/dev/null || true
    done <<< "$stale_pids"
    sleep 1
  fi
}

rotate_log() {
  local file="$1"
  if [[ -f "$file" ]]; then
    mv "$file" "$file.old.$(date +%s)"
  fi
}

start_backend() {
  echo "Starting backend in background..."
  local lan_ip="$1"
  local client_urls
  if [[ "$USE_HTTPS" == "true" ]]; then
    client_urls="https://localhost:${FRONTEND_PORT},https://${lan_ip}:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT},http://${lan_ip}:${FRONTEND_PORT}"
  else
    client_urls="http://localhost:${FRONTEND_PORT},http://${lan_ip}:${FRONTEND_PORT}"
  fi

  (
    cd "$SERVER_DIR"
    nohup env \
      USE_HTTPS="$USE_HTTPS" \
      SSL_CERT_PATH="$CERT_FILE" \
      SSL_KEY_PATH="$KEY_FILE" \
      CLIENT_URLS="$client_urls" \
      npm run start > "$SERVER_LOG" 2>&1 < /dev/null &
    echo $! > "$SERVER_PID_FILE"
    disown || true
  )

  sleep 1
  local pid
  pid="$(tr -d '[:space:]' < "$SERVER_PID_FILE")"
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    echo "Failed to start backend. Check logs: $SERVER_LOG"
    exit 1
  fi
  echo "Backend started (PID: $pid)"
}

start_frontend() {
  echo "Starting frontend in background..."
  (
    cd "$CLIENT_DIR"
    nohup env \
      USE_HTTPS="$USE_HTTPS" \
      VITE_USE_HTTPS="$USE_HTTPS" \
      SSL_CERT_PATH="$CERT_FILE" \
      SSL_KEY_PATH="$KEY_FILE" \
      BACKEND_PORT="$BACKEND_PORT" \
      npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" > "$CLIENT_LOG" 2>&1 < /dev/null &
    echo $! > "$CLIENT_PID_FILE"
    disown || true
  )

  sleep 1
  local pid
  pid="$(tr -d '[:space:]' < "$CLIENT_PID_FILE")"
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    echo "Failed to start frontend. Check logs: $CLIENT_LOG"
    exit 1
  fi
  echo "Frontend started (PID: $pid)"
}

wait_for_port() {
  local port="$1"
  local name="$2"
  local max_tries=20
  local n=0
  while (( n < max_tries )); do
    if /usr/bin/ss -ltn | grep -q ":${port}\\s"; then
      echo "$name is listening on port $port"
      return 0
    fi
    sleep 0.5
    ((n += 1))
  done
  echo "Warning: $name did not confirm listening on port $port yet."
  return 1
}

print_urls() {
  local lan_ip="$1"

  echo
  echo "Startup complete (${PROTOCOL^^})."
  echo "Backend URLs:"
  echo "  Localhost: ${PROTOCOL}://localhost:${BACKEND_PORT}"
  echo "  Intranet:  ${PROTOCOL}://${lan_ip}:${BACKEND_PORT}"
  echo "Frontend URLs:"
  echo "  Localhost: ${PROTOCOL}://localhost:${FRONTEND_PORT}"
  echo "  Intranet:  ${PROTOCOL}://${lan_ip}:${FRONTEND_PORT}"
  echo
  echo "Logs:"
  echo "  Backend: $SERVER_LOG"
  echo "  Frontend: $CLIENT_LOG"
  if [[ "$USE_HTTPS" == "true" ]]; then
    echo "TLS certificate: $CERT_FILE"
    echo "TLS private key: $KEY_FILE"
  fi
}

# Preflight: verify DB is reachable, but never stop/restart DB from this script.
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "PostgreSQL is not reachable at localhost:5432."
  echo "For DB safety, this script will not modify DB processes."
  echo "Start PostgreSQL first, then rerun this script."
  exit 1
fi

stop_pid_from_file "$SERVER_PID_FILE" "backend"
stop_pid_from_file "$CLIENT_PID_FILE" "frontend"
stop_stale_processes

rotate_log "$SERVER_LOG"
rotate_log "$CLIENT_LOG"

ensure_https_cert
LAN_IP="$(get_lan_ip)"

start_backend "$LAN_IP"
start_frontend

wait_for_port "$BACKEND_PORT" "Backend" || true
wait_for_port "$FRONTEND_PORT" "Frontend" || true
print_urls "$LAN_IP"
