#!/bin/sh
# Home Assistant launcher for Yuvomi.
# 1. prepare.mjs reads /data/options.json, manages the secrets and prints
#    the environment as shell exports (logs go to stderr).
# 2. The upstream entrypoint fixes volume permissions and starts the app as
#    the unprivileged node user.
set -e
umask 077

env_script="$(node /ha/prepare.mjs)"
eval "$env_script"
unset env_script

umask 022
cd /app
exec /entrypoint.sh node server/index.js
