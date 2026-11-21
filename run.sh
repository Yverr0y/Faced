#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-8005}"
HOST="${HOST:-0.0.0.0}"

# Auto-detect and terminate any existing process holding the target port
OLD_PIDS=$(lsof -ti :$PORT 2>/dev/null || fuser $PORT/tcp 2>/dev/null || true)
if [ -n "$OLD_PIDS" ]; then
    echo "[FACED] Releasing port $PORT (terminating PID: $OLD_PIDS)..."
    kill -9 $OLD_PIDS 2>/dev/null || true
    sleep 0.6
fi

echo "========================================================="
echo "  Starting FACED Platform on http://${HOST}:${PORT}      "
echo "========================================================="
exec python3 app.py
