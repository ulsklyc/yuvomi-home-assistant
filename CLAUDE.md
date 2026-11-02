# CLAUDE.md

Context for Claude Code when working on this repository.

## What this is

A Home Assistant app repository (apps were formerly called add-ons) for
[Yuvomi](https://github.com/ulsklyc/yuvomi), a self-hosted family planner
(Node.js/Express, vanilla JS PWA, SQLite/SQLCipher). Maintainer of Yuvomi:
ulsklyc. This repo is meant to be handed to ulsklyc and published as
`ulsklyc/yuvomi-home-assistant`. Prepared by Oliver Kluth (Olli).

The app does **not** fork or patch Yuvomi. It builds `FROM` the official
multi-arch image `ghcr.io/ulsklyc/yuvomi:<version>` and only adds a launcher.

## Layout

```
repository.yaml              HA app repository metadata
LICENSE                      MIT (Oliver Kluth); Yuvomi itself is MIT by ulsklyc
yuvomi/config.yaml           App manifest: version, arch, ports, options + schema
yuvomi/Dockerfile            ARG BUILD_FROM=upstream image (must match config.yaml
                             version), copies rootfs/, HEALTHCHECK, entrypoint /ha/run.sh
yuvomi/rootfs/ha/run.sh      Evaluates prepare.mjs output, runs upstream /entrypoint.sh, maps stop to exit 0
yuvomi/rootfs/ha/prepare.mjs Options -> env vars, secrets, key guard, dirs, HA location
yuvomi/translations/*.yaml   Option labels (en, de); keys must match config.yaml schema
yuvomi/DOCS.md               Documentation tab in Home Assistant
scripts/test-launcher.sh     End-to-end test of prepare.mjs against a real Yuvomi server
renovate.json                Bumps image tag in Dockerfile and version in config.yaml together
.github/workflows/lint.yml   frenck addon linter, version check, multi-arch build
```

## How the launcher works

1. Supervisor starts the container; `/data/options.json` holds the options.
2. `run.sh` runs `node /ha/prepare.mjs`, which prints `export K='v'` lines on
   stdout (logs on stderr) and `eval`s them.
3. `run.sh` starts the upstream `/entrypoint.sh node server/index.js` as a
   child (it chowns `/data`, `/backups`, `/app/modules`, the documents dir,
   then drops to user `node` via gosu) and forwards SIGTERM/SIGINT. After a
   requested stop it exits 0, otherwise with the child's code.

`prepare.mjs` responsibilities:
- `SESSION_SECRET`: generated once, stored in `/data/.ha/session_secret`.
- `DB_ENCRYPTION_KEY`: only when `encrypt_database` is on. Own key from the
  option, else generated and stored in `/data/.ha/db_encryption_key`, with a
  user-reachable copy in `/config/db_encryption_key.txt` (`app_config` map,
  formerly `addon_config`).
  The sha256 of the key in use goes to `/data/.ha/db_encryption_key.sha256`.
- Guards (abort before Yuvomi starts):
  - DB encrypted (SQLite header check) but option off.
  - DB encrypted and key hash differs from the stored hash.
  - Own key shorter than 16 chars or still a `REPLACE_WITH_` placeholder.
- Paths: DB `/data/yuvomi.db`, modules `/config/modules`, backups and
  documents from options (must be under `/share` or `/media`).
- `behind_https_proxy` -> `SESSION_SECURE=true`, `TRUST_PROXY=1`;
  otherwise `false` / `loopback`.
- Weather: if `use_home_assistant_location`, reads `/core/api/config` via the
  Supervisor (`homeassistant_api: true`) unless the user set `WEATHER_LAT` or
  `OPENWEATHER_API_KEY` in `env_vars`. `WEATHER_CITY` is only a label: the
  `weather_city` option, else HA's `location_name` unless it is the default
  "Home" (that is the instance name, not a place; issue #4).
- `env_vars` are applied last; managed names (DB_PATH, PORT, SESSION_SECRET,
  DB_ENCRYPTION_KEY, their `_FILE` variants, BACKUP_DIR, MODULES_DIR,
  DOCUMENT_STORAGE_LOCAL_PATH, NODE_ENV) are ignored with a log line.
  Yuvomi 2.80+ refuses to start when `<NAME>` and `<NAME>_FILE` are both set,
  and with encryption off `DB_ENCRYPTION_KEY_FILE` would bypass the key guard.
- All paths can be overridden with `HA_DATA_DIR`, `HA_CONFIG_DIR`,
  `HA_SUPERVISOR_URL` for local testing.

## Decisions (agreed with Olli)

- **Home of the repo**: with ulsklyc, as a separate repository (keeps HA's
  store scanner away from the main Yuvomi repo).
- **Ingress**: not possible with Yuvomi 2.84.0. The frontend uses absolute
  paths throughout (~1,430 `import … from '/…'` lines, `API_BASE = '/api/v1'`,
  router on `location.pathname`, `/sw.js` with root scope). Upstream needs a
  base-path feature first; tracked in ulsklyc/yuvomi#2231 (our notes are in
  a comment there). Until then the
  app exposes port 3000 and `webui`.
- **Webpage dashboard / iframe** is no workaround: helmet defaults
  (`frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`) block embedding
  from HA on port 8123, and ulsklyc wants framing kept out (#2231, discussion
  #2427). An iframe-based ingress page was offered in issue #4 and declined.
- **Encryption**: an option, default off. Switching on later works (Yuvomi
  encrypts the existing DB once and keeps `yuvomi.db.plaintext-backup`, which
  is excluded from HA backups). Switching off or changing the key is blocked.
- **Backups**: `backup: cold` so SQLite is consistent in HA backups.
- **init**: default (tini), because Yuvomi has no SIGTERM handler.
- **Stop exit code**: Yuvomi dies with 143 on SIGTERM (no handler, on purpose,
  see upstream `server/db.js`; SQLite replays the WAL on the next start).
  Current Supervisors log "did not handle SIGTERM" and set the app to `error`,
  e.g. during every cold backup. `run.sh` therefore reports a requested stop
  as 0. Upstream could add a graceful shutdown handler instead.
- **Build config in the Dockerfile**: `build.yaml` is deprecated (Supervisor
  2026.10 warns); `ARG BUILD_FROM=ghcr.io/ulsklyc/yuvomi:<version>` is the
  default and `buildx --platform` picks the arch from the multi-arch image.
- **`app_config`** instead of the legacy `addon_config` map type. The Samba
  share is still called `addon_configs`, so the docs keep that path.
- **Watchdog**: Docker `HEALTHCHECK` in the Dockerfile (node `fetch` on
  `/health`, no curl in the image); the `watchdog:` key is obsolete per the
  linter. `startup`/`boot` are omitted because they are defaults.
- Arch: amd64 and aarch64 only (upstream image has no armv7).

## Testing

`scripts/test-launcher.sh <path-to-yuvomi-checkout>` runs prepare.mjs and the
real Yuvomi server through five scenarios: unencrypted start, enabling
encryption with a generated key, switching it off (must fail), wrong own key
(must fail), back to the generated key. Needs Node 22.14+ and
`npm ci --omit=dev` in the Yuvomi checkout (`--ignore-scripts` works; the
SQLite module ships prebuilt binaries). Port 3000 must be free.

Verified locally (Colima, arm64; amd64 via emulation):
- `docker build yuvomi` for both arches.
- frenck addon linter (`frenck/action-addon-linter` v2, built from its
  `src/Dockerfile`, `INPUT_PATH=./yuvomi INPUT_COMMUNITY=false`): clean.

Verified on a real Supervisor (HA devcontainer `ghcr.io/home-assistant/devcontainer:2-addons`,
Supervisor 2026.10.5-dev, aarch64, 2026-10-25):
- Local install and build without `build.yaml`, no Supervisor warnings.
- `/share/yuvomi/{backups,documents}` owned by node and writable.
- Watchdog: node frozen with SIGSTOP -> `unhealthy` after ~1.5 min ->
  Supervisor restarts the app 7 s later -> `healthy`.
- Stop and cold backup: state `stopped` (not `error`), no SIGTERM warning,
  `*.plaintext-backup` not in the backup.
- Restore after uninstall with `remove_config`: same key and hash, encrypted
  DB opens, options and watchdog setting kept.

Running the devcontainer outside VS Code (Colima): run it `--privileged`
with volumes on `/var/lib/docker` and `/mnt/supervisor`, bind `yuvomi/` to
`/mnt/supervisor/addons/local/yuvomi`, map 8123 to a free port and 3000.
Inside: `supervisor_bootstrap`, then `supervisor_run` (the `stty` error
without a TTY is harmless), `mkdir -p /run/supervisor` or Core will not
start, `ha jobs options --ignore-conditions healthy` (nested Docker reports
`docker_gateway_unprotected`). Needs ~4 GB free on the Docker disk.
Core dev 2026.11 serves on port 80 and redirects 8123 there.

In the devcontainer the HA location lookup cannot be tested: the dev
Supervisor reaches Core via `/run/os/core.sock`, which the devcontainer
scripts do not mount, so the proxy answers 502.

Verified on real Home Assistant OS by littleopa (issue #4, 2026-11-02;
HA 2026.10.2, amd64, app 2.79.0): install and first start, weather from the HA
location via `/core/api/config`, setup and sign-in, partial cold backup.

## Open tasks

1. Real Home Assistant OS: amd64 basics are done (see Testing). Still open:
   aarch64, and watchdog, restore and encryption on HAOS.
2. Decide on prebuilt images (home-assistant/builder action pushing
   `ghcr.io/ulsklyc/yuvomi-ha-{arch}` and setting `image:` in config.yaml) vs.
   local builds on the device (current state; fast, since it only adds two files).
3. ~~Send ulsklyc the repo plus `docs/ingress-issue-draft.md`.~~ ulsklyc asked
   to take it over as the official Yuvomi app (issue #2). Transferred to
   `ulsklyc/yuvomi-home-assistant` on 2026-11-01; Olli stays on as a
   collaborator (write access), changes go in via pull requests. ulsklyc made
   the repo public on 2026-11-02. Still to do: point the local `origin` at the
   new URL (the old one redirects).
4. Sign in with Home Assistant: upstream PR ulsklyc/yuvomi#2428 (open, by
   littleopa) adds `HOMEASSISTANT_URL` / `HOMEASSISTANT_INTERNAL_URL`. Do not
   patch the image; add options once it is released. Planned mapping:
   `homeassistant_login` -> `HOMEASSISTANT_URL` (default: HA's `external_url`,
   else `internal_url` from `/core/api/config`, which we already read) and
   `HOMEASSISTANT_INTERNAL_URL=http://homeassistant:8123`; require `base_url`;
   warn when `OIDC_ISSUER` is in `env_vars` (OIDC wins). `OIDC_ALLOW_SIGNUP`
   and `AUTH_ALLOW_PASSWORD_LOGIN` stay in `env_vars`. Gaps in the PR as of
   2026-11-01: no email claim, so admin-created SSO-only accounts never link
   (only Settings > Account while signed in with a password); new accounts get
   the 32-hex HA user ID as username; `is_admin` is computed but unused.
   littleopa/ha-yuvomi works around linking with a direct DB write
   (`link_accounts`); better fixed upstream (admin-side linking).
5. Once upstream supports a base path: add `ingress: true`,
   `ingress_port: 3000`, `panel_icon`, and drop or keep the port.

## Conventions

- Docs, code comments and commit messages in English (upstream audience).
- Keep option keys, schema keys and translation keys in sync.
- When bumping Yuvomi: `config.yaml` version, Dockerfile `BUILD_FROM` tag,
  `CHANGELOG.md` entry with link to the upstream release.
