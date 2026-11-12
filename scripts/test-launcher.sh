#!/bin/sh
# End-to-end test of yuvomi/rootfs/ha/prepare.mjs against a real Yuvomi server.
#
# Usage: scripts/test-launcher.sh /path/to/yuvomi
# Prerequisites: Node 22.14+, a Yuvomi tree with the built app in dist/ (the
# unpacked release asset yuvomi-<version>-dist.tar.gz, or a checkout after
# `npm run build`), `npm ci --omit=dev` in it, port 3000 free, curl.
set -u

YUVOMI="${1:?path to a Yuvomi checkout}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREPARE="$ROOT/yuvomi/rootfs/ha/prepare.mjs"
# Another server on port 3000 would answer the health checks instead.
if curl -s -o /dev/null localhost:3000; then
  echo "Port 3000 is already in use; stop that server first." >&2
  exit 1
fi
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/data" "$WORK/config"
failures=0

write_options() {
  cat > "$WORK/data/options.json" <<EOF
{"encrypt_database":$1,"encryption_key":"$2","backup_dir":"$WORK/share/backups",
 "local_documents":false,"documents_dir":"$WORK/share/docs","behind_https_proxy":false,
 "base_url":"","use_home_assistant_location":false,"log_level":"warn",
 "modules_allow_web_install":false,"env_vars":[]}
EOF
}

# $2 = expected outcome: start (server healthy) | refuse (prepare.mjs aborts)
# $3 = expected database afterwards: plain | encrypted
scenario() {
  name="$1"; expect="$2"; want_state="$3"
  if ! env_script="$(HA_DATA_DIR="$WORK/data" HA_CONFIG_DIR="$WORK/config" node "$PREPARE" 2>"$WORK/prepare.log")"; then
    result=refuse
  else
    result=app-failed
    ( eval "$env_script"; cd "$YUVOMI" && exec node server/index.js ) >"$WORK/app.log" 2>&1 &
    pid=$!
    i=0
    while [ $i -lt 30 ]; do
      if [ "$(curl -s -o /dev/null -w '%{http_code}' localhost:3000/health)" = 200 ]; then
        result=start; break
      fi
      i=$((i + 1)); sleep 1
    done
    kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  fi
  if [ ! -f "$WORK/data/yuvomi.db" ]; then state=missing
  elif [ "$(head -c 15 "$WORK/data/yuvomi.db")" = 'SQLite format 3' ]; then state=plain
  else state=encrypted; fi
  if [ "$result" = "$expect" ] && [ "$state" = "$want_state" ]; then
    echo "PASS  $name ($result, database: $state)"
  else
    echo "FAIL  $name (expected $expect/$want_state, got $result/$state)"
    sed 's/^/      /' "$WORK/prepare.log" "$WORK/app.log" 2>/dev/null | tail -10
    failures=$((failures + 1))
  fi
}

write_options false "";                        scenario "unencrypted start"     start  plain
write_options false "";                        scenario "unencrypted restart"   start  plain
write_options true  "";                        scenario "enable, generated key" start  encrypted
write_options false "";                        scenario "switch encryption off" refuse encrypted
write_options true  "this-is-a-wrong-key-123"; scenario "wrong own key"         refuse encrypted
write_options true  "";                        scenario "back to generated key" start  encrypted

[ -f "$WORK/config/db_encryption_key.txt" ] && echo "PASS  key copy written to config dir" \
  || { echo "FAIL  key copy missing"; failures=$((failures + 1)); }

# A database the 2.85.0 app let Yuvomi encrypt with a key of its own (Yuvomi
# 2.85+ only): the launcher takes that key over instead of refusing to start.
if grep -q DB_ENCRYPTION_AUTO_KEY "$YUVOMI/server/utils/auto-secrets.js" 2>/dev/null; then
  rm -rf "$WORK/data" "$WORK/config"; mkdir -p "$WORK/data" "$WORK/config"
  ( cd "$YUVOMI" && NODE_ENV=production PORT=3000 DB_PATH="$WORK/data/yuvomi.db" \
      SESSION_SECRET=test-secret-for-the-launcher-test-0123456789 exec node server/index.js ) \
    >"$WORK/app.log" 2>&1 &
  pid=$!
  i=0
  while [ $i -lt 30 ] && [ "$(curl -s -o /dev/null -w '%{http_code}' localhost:3000/health)" != 200 ]; do
    i=$((i + 1)); sleep 1
  done
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  write_options false "";                      scenario "take over Yuvomi key"  start  encrypted
  write_options false "";                      scenario "restart, option off"   start  encrypted
  write_options true  "";                      scenario "switch option on"      start  encrypted
  write_options false "";                      scenario "then switch it off"    refuse encrypted
fi

exit "$failures"
