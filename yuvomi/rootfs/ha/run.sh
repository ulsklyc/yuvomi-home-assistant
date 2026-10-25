#!/bin/sh
# Home Assistant launcher for Yuvomi.
# 1. prepare.mjs reads /data/options.json, manages the secrets and prints
#    the environment as shell exports (logs go to stderr).
# 2. The upstream entrypoint fixes volume permissions and starts the app as
#    the unprivileged node user.
# 3. Yuvomi has no SIGTERM handler and exits with 143 on stop, which the
#    Supervisor reports as an error (e.g. during cold backups). A requested
#    stop is forwarded and reported as 0; SQLite recovers the WAL on the next
#    start, exactly as after a plain container stop. Crashes keep their code.
set -e
umask 077

env_script="$(node /ha/prepare.mjs)"
eval "$env_script"
unset env_script

umask 022
cd /app
set +e
stopping=
/entrypoint.sh node server/index.js &
child=$!
trap 'stopping=1; kill -TERM "$child" 2>/dev/null' TERM INT
wait "$child"
status=$?
if [ -n "$stopping" ]; then
  # wait returned because of the trap; wait for the actual exit.
  wait "$child" 2>/dev/null
  exit 0
fi
exit "$status"
