#!/usr/bin/env bash
# One-command local dev: Firestore emulator + seed + API + frontend.
# Nothing here touches the real fx-makro-app Firestore data.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
export GCLOUD_PROJECT="fx-makro-app"

PIDS=()
cleanup() {
  echo ""
  echo "Stopping..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

echo "Starting Firestore emulator..."
npx --yes firebase-tools emulators:start --only firestore --project "$GCLOUD_PROJECT" &
PIDS+=($!)

npx --yes wait-on tcp:8080 --timeout 60000

echo "Seeding (skips automatically if already seeded)..."
(cd "$ROOT_DIR/functions" && npm run seed)

echo "Starting API on http://localhost:4001 ..."
(cd "$ROOT_DIR/functions" && npm run dev) &
PIDS+=($!)

npx --yes wait-on tcp:4001 --timeout 30000

echo "Starting frontend on http://localhost:5173 ..."
(cd "$ROOT_DIR/client" && npm run dev)
