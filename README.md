# Yuvomi for Home Assistant

Home Assistant app repository for [Yuvomi](https://github.com/ulsklyc/yuvomi),
the self-hosted family planner.

[![Add repository to Home Assistant][repo-badge]][repo-link]

## Installation

1. Select the button above, or go to **Settings > Apps > Install app**, open the
   menu at the top right, choose **Repositories** and add
   `https://github.com/ulsklyc/yuvomi-home-assistant`.
2. Search for **Yuvomi**, install it and start it.
3. Select **Open Web UI** and create the admin account.

Requires Home Assistant OS or a Supervised installation on amd64 or aarch64
(e.g. Raspberry Pi 4/5, Home Assistant Green and Yellow). About 256 MB RAM.

All options are described on the app's **Documentation** tab and in
[DOCS.md](yuvomi/DOCS.md).

## How it works

The app builds on the official `ghcr.io/ulsklyc/yuvomi` image and only adds a
launcher (`yuvomi/rootfs/ha/`) that turns the app options into Yuvomi's
environment variables, generates the session secret, and manages the
optional database key. Yuvomi itself runs unchanged.

| Yuvomi path       | In Home Assistant                                   |
| ----------------- | --------------------------------------------------- |
| `/data/yuvomi.db` | App data (in every backup of this app)              |
| backups           | `/share/yuvomi/backups` (option)                    |
| documents         | `/share/yuvomi/documents` (option, off by default)  |
| modules           | `/addon_configs/<id>_yuvomi/modules`                |

## Updating to a new Yuvomi release

The version appears in two places and both must match the image tag:

- `yuvomi/config.yaml` → `version`
- `yuvomi/Dockerfile` → `ARG BUILD_FROM`

Renovate (`renovate.json`) opens a pull request for both when a new image is
published. Add an entry to `yuvomi/CHANGELOG.md` with the link to the
Yuvomi release.

[repo-badge]: https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg
[repo-link]: https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fulsklyc%2Fyuvomi-home-assistant
