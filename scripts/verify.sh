#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERIFY_TARGET="${1:-all}"
GO_CACHE_DIR="${ATAPP_GO_CACHE_DIR:-${TMPDIR:-/tmp}/atapp-go-cache}"
GO_TMP_DIR="$GO_CACHE_DIR/tmp"

mkdir -p "$GO_CACHE_DIR" "$GO_TMP_DIR"

run_server() {
  echo "==> Verifying Go backend"
  (
    cd "$PROJECT_ROOT/server"
    # Integration packages currently reset one shared development schema, so package
    # tests must remain serialized until isolated test databases are introduced.
    GOCACHE="$GO_CACHE_DIR" GOTMPDIR="$GO_TMP_DIR" go test -p 1 -count=1 ./...
    GOCACHE="$GO_CACHE_DIR" GOTMPDIR="$GO_TMP_DIR" go build ./...
  )
}

run_flutter() {
  local app_dir="$1"
  echo "==> Verifying $app_dir"
  (
    cd "$PROJECT_ROOT/$app_dir"
    flutter analyze
    flutter test
  )
}

run_admin() {
  echo "==> Verifying admin_web"
  (
    cd "$PROJECT_ROOT/admin_web"
    npm run lint
    npm run build
  )
}

case "$VERIFY_TARGET" in
  all)
    run_server
    run_flutter student_app
    run_flutter teacher_app
    run_admin
    ;;
  server)
    run_server
    ;;
  student)
    run_flutter student_app
    ;;
  teacher)
    run_flutter teacher_app
    ;;
  admin)
    run_admin
    ;;
  *)
    echo "Usage: $0 [all|server|student|teacher|admin]" >&2
    exit 2
    ;;
esac

echo "==> Verification passed: $VERIFY_TARGET"
