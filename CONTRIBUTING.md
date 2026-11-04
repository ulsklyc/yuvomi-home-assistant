# Contributing to Yuvomi for Home Assistant

Thanks for helping! This repository packages [Yuvomi](https://github.com/ulsklyc/yuvomi) as a
Home Assistant app. Changes go in through pull requests; questions about Yuvomi itself belong in
the [Yuvomi discussions](https://github.com/ulsklyc/yuvomi/discussions).

---

## Hard Constraints

- **No Yuvomi code, no patches.** The app builds `FROM` the official multi-arch image
  `ghcr.io/ulsklyc/yuvomi:<version>` and only adds the launcher in `yuvomi/rootfs/ha/`. A change
  Yuvomi needs goes upstream.
- **The app version is the Yuvomi version.** `version` in `yuvomi/config.yaml` and the tag in
  `ARG BUILD_FROM` in `yuvomi/Dockerfile` always match; CI fails otherwise.
- **Option, schema and translation keys stay in sync** across `config.yaml` and every file in
  `yuvomi/translations/`.
- **The launcher never loses data.** It refuses to start rather than open the database with a
  wrong key, switch encryption off, or let `env_vars` override a value the app manages.

## Layout

```
repository.yaml              Home Assistant app repository metadata
yuvomi/config.yaml           App manifest: version, arch, ports, options + schema
yuvomi/Dockerfile            BUILD_FROM = upstream image, copies rootfs/, HEALTHCHECK
yuvomi/rootfs/ha/run.sh      Evaluates prepare.mjs, runs the upstream entrypoint, maps stop to exit 0
yuvomi/rootfs/ha/prepare.mjs Options -> env vars, secrets, key guard, dirs, HA location
yuvomi/translations/*.yaml   Option labels (en, de)
yuvomi/DOCS.md               Documentation tab in Home Assistant
yuvomi/CHANGELOG.md          Shown in Home Assistant on update
scripts/test-launcher.sh     End-to-end test of prepare.mjs against a real Yuvomi server
scripts/changelog-release.mjs Names the release block in yuvomi/CHANGELOG.md (--check: it exists)
renovate.json                Bumps the image tag and the app version together, automerges actions
.github/ISSUE_TEMPLATE/      App problem form; Yuvomi bugs and questions go upstream
.github/workflows/lint.yml   App linter, version check, multi-arch build, launcher test
.github/workflows/changelog.yml Names the release on Renovate's bump, checks every pull request,
                             starts Lint and Images again for the commit it adds
.github/workflows/images.yml Builds and pushes ghcr.io/ulsklyc/yuvomi-ha-{amd64,aarch64}:<version>
```

## How the launcher works

1. The Supervisor starts the container; `/data/options.json` holds the options.
2. `run.sh` runs `node /ha/prepare.mjs`, which prints `export K='v'` lines on stdout (logs on
   stderr), and evaluates them.
3. `run.sh` starts the upstream `/entrypoint.sh node server/index.js` as a child (it fixes volume
   ownership and drops to the `node` user) and forwards SIGTERM/SIGINT. After a requested stop it
   exits 0, otherwise with the child's code.

`prepare.mjs`:

- **`SESSION_SECRET`** - generated once, stored in `/data/.ha/session_secret`.
- **`DB_ENCRYPTION_KEY`** - only with `encrypt_database` on. The own key from the option, else a
  generated one in `/data/.ha/db_encryption_key` with a copy in `/config/db_encryption_key.txt`.
  The sha256 of the key in use goes to `/data/.ha/db_encryption_key.sha256`.
- **`DB_ENCRYPTION_AUTO_KEY=false`** - always. Yuvomi 2.85+ otherwise encrypts a new database with
  a key of its own in `/data/.secrets/`, past the guards. A database the 2.85.0 app let Yuvomi
  encrypt that way has no key hash yet: the launcher takes the key over once (marker
  `/data/.ha/db_encryption_key.adopted`) and keeps it running with the option off until the option
  is switched on.
- **Guards** (abort before Yuvomi starts) - the database is encrypted but the option is off; the
  key hash differs from the stored one; an own key is shorter than 16 characters or still a
  `REPLACE_WITH_` placeholder.
- **Paths** - database `/data/yuvomi.db`, modules `/config/modules`, backups and documents from
  the options (below `/share` or `/media`).
- **`behind_https_proxy`** - `SESSION_SECURE=true`, `TRUST_PROXY=1`; otherwise `false` /
  `loopback`.
- **Weather** - with `use_home_assistant_location`, reads `/core/api/config` through the
  Supervisor unless `WEATHER_LAT` or `OPENWEATHER_API_KEY` is set in `env_vars`. Coordinates are
  rounded to 2 decimals (~1 km). `WEATHER_CITY` is the `weather_city` option, else the instance
  name, even "Home": left empty, Yuvomi up to 2.84 showed the raw coordinates as the city, 2.85+
  shows no place line.
- **`env_vars`** are applied last. Managed names (`DB_PATH`, `PORT`, `SESSION_SECRET`,
  `DB_ENCRYPTION_KEY`, their `_FILE` variants, `DB_ENCRYPTION_AUTO_KEY`, `BACKUP_DIR`, `MODULES_DIR`,
  `DOCUMENT_STORAGE_LOCAL_PATH`, `NODE_ENV`) are ignored with a log line.
- `HA_DATA_DIR`, `HA_CONFIG_DIR` and `HA_SUPERVISOR_URL` override the paths for local testing.

## Decisions

- **A separate repository** keeps Home Assistant's store scanner away from the main Yuvomi repo.
- **No Ingress yet.** The Yuvomi frontend uses absolute paths throughout (module imports,
  `API_BASE = '/api/v1'`, a router on `location.pathname`, `/sw.js` with root scope). It needs
  sub-path support upstream first ([ulsklyc/yuvomi#2231](https://github.com/ulsklyc/yuvomi/discussions/2231)).
  Once that ships: `ingress: true`, `ingress_port: 3000`, `panel_icon`.
- **No iframe workaround.** Yuvomi's headers (`frame-ancestors 'self'`,
  `X-Frame-Options: SAMEORIGIN`) block embedding from Home Assistant, and framing stays out.
- **Host port 3880**, container port 3000. Port 3000 is the default of many other apps; 3880 was
  free in the official, community and alexbelgium app repositories (173 apps, 2026-11-03).
- **Encryption** is an option, default off. Switching it on later works (Yuvomi encrypts the
  database once and keeps `yuvomi.db.plaintext-backup`, excluded from backups); switching it off
  or changing the key is refused.
- **`backup: cold`**, so SQLite is consistent in Home Assistant backups.
- **Default init (tini)** and **stop as exit 0**: Yuvomi has no SIGTERM handler on purpose and
  exits with 143, which current Supervisors report as an error, e.g. during every cold backup.
  SQLite replays the WAL on the next start.
- **Build config in the Dockerfile**, not the deprecated `build.yaml`.
- **Prebuilt images** (`image:` in `config.yaml`), so devices pull instead of build and backups
  stay small (a locally built app carries its ~590 MB image in every backup). The Images workflow
  pushes `ghcr.io/ulsklyc/yuvomi-ha-{amd64,aarch64}:<version>` with the repository's
  `GITHUB_TOKEN` only, and it is a required check, so the images exist before a version reaches
  `main`. Each image carries the label `dev.yuvomi.ha.content` (git hashes of `rootfs/` and the
  Dockerfile). A version bump rebuilds when they differ; images of a version already on `main` are
  never replaced, so launcher changes ship with the next version, like the changelog says.
  Every run also pulls the images without signing in, as a Home Assistant install does; a new
  GHCR package starts private and has to be made public once in its package settings.
- **`app_config`** instead of the legacy `addon_config` map; the Samba share is still called
  `addon_configs`, so the docs keep that path.
- **Watchdog through a Docker `HEALTHCHECK`** (node `fetch` on `/health`; the image has no curl).
- **amd64 and aarch64 only**, like the upstream image.
- **Sign in with Home Assistant** gets options once
  [ulsklyc/yuvomi#2428](https://github.com/ulsklyc/yuvomi/pull/2428) is in a release; the image
  is not patched for it.

## Testing

- **CI** runs on every pull request: the app linter, the version check, a build for amd64 and
  aarch64, and the launcher test against the Yuvomi tag in the Dockerfile.
- **Launcher test** - `scripts/test-launcher.sh <path-to-yuvomi-checkout>` runs `prepare.mjs` and
  the real Yuvomi server through five scenarios: unencrypted start, enabling encryption with a
  generated key, switching it off (must fail), a wrong own key (must fail), back to the generated
  key, and with Yuvomi 2.85+ taking over a key Yuvomi generated itself. Needs Node 22.14+, `npm ci --omit=dev` in the checkout (`--ignore-scripts` works) and a
  free port 3000.
- **Real Supervisor** - the Home Assistant devcontainer
  (`ghcr.io/home-assistant/devcontainer:2-addons`) runs the app end to end. Outside VS Code, run
  it `--privileged` with volumes on `/var/lib/docker` and `/mnt/supervisor`, bind `yuvomi/` to
  `/mnt/supervisor/addons/local/yuvomi`, then `supervisor_bootstrap`, `supervisor_run`,
  `mkdir -p /run/supervisor` and `ha jobs options --ignore-conditions healthy`. Remove the
  `image:` line from `config.yaml` in the bound copy, or the Supervisor pulls the published image
  instead of building your changes. The Home Assistant location lookup cannot be tested there
  (the proxy answers 502).

## Commits and pull requests

Same rules as [Yuvomi](https://github.com/ulsklyc/yuvomi/blob/main/CONTRIBUTING.md#4-commit):

- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), e.g.
  `fix(weather): keep a city name and round the Home Assistant coordinates`. The subject says
  what is true after the change, lowercase, no period, max 72 characters.
- One logical change per pull request; pull requests are squash-merged.
- A user-visible change gets an entry in `yuvomi/CHANGELOG.md` under **Unreleased**; the next
  version bump turns that into the version heading.
- **New Yuvomi release** - Renovate opens one pull request that bumps `version` in
  `yuvomi/config.yaml` and the tag in `yuvomi/Dockerfile` together. The Changelog workflow then
  turns **Unreleased** into the version block with the link to the Yuvomi release (and to the
  releases it skips). Before merging, read the Yuvomi release notes for changes to environment
  variables or secrets, check that the launcher test passed against the new tag, and add a line for
  anything Home Assistant users have to do. A pull request that leaves the app version without a
  changelog block fails the check. The Images workflow pushes the images for the new version on
  that pull request; a bump from a fork cannot (its token is read-only), so bumps come from a
  branch in this repository.

## AI Assistance

The full policy is in Yuvomi's
[AI Assistance](https://github.com/ulsklyc/yuvomi/blob/main/CONTRIBUTING.md#ai-assistance)
section, and it applies here unchanged.

- **If you contribute, say so if an agent wrote it**, with one line in the pull request
  description ("drafted with Claude Code"). It is not a mark against the contribution. The
  maintainer's own pull requests carry no such line: how this project uses agents is stated once,
  in the section linked above.
- **No tool attribution in commits** - no `Co-Authored-By:` trailer for a tool and no
  "Generated with" footer.
- Agent instruction files (`CLAUDE.md`, `AGENTS.md`, `.claude/` and the like) stay local; they
  are ignored in `.gitignore`.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
