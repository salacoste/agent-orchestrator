#!/usr/bin/env bash
# Kill stale dev server processes from previous pnpm dev sessions.
# Runs automatically as a predev hook to prevent zombie accumulation.

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# 1. Kill any lingering processes spawned from this project's web package
PIDS=$(ps aux | grep "$PROJECT_DIR/packages/web" | grep -v grep | grep -v "kill-stale-dev" | awk '{print $2}')

if [ -n "$PIDS" ]; then
  echo "🧹 Cleaning up $(echo "$PIDS" | wc -w | tr -d ' ') stale dev process(es)..."
  echo "$PIDS" | xargs kill -9 2>/dev/null
fi

# 2. Free the ports used by the dev server (5000=Next.js, 5080=WS, 5081=direct-WS)
for PORT in ${PORT:-5000} 5080 5081; do
  PORT_PIDS=$(lsof -ti:"$PORT" 2>/dev/null)
  if [ -n "$PORT_PIDS" ]; then
    echo "🧹 Freeing port $PORT..."
    echo "$PORT_PIDS" | xargs kill -9 2>/dev/null
  fi
done

# Brief pause so ports are released before new server starts
sleep 0.3
