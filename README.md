<div align="center">
  <img src="yuvomi/icon.png" alt="Yuvomi logo" width="92" />

  <h1>Yuvomi for Home Assistant</h1>

  <p><strong>The self-hosted family planner, as a Home Assistant app.</strong></p>

  <p>
    Tasks, calendar, budget, meals, health and more for the whole household, installed from
    Home Assistant and backed up with it.
  </p>

  <p>
    <a href="yuvomi/CHANGELOG.md"><img src="https://img.shields.io/badge/dynamic/yaml?url=https%3A%2F%2Fraw.githubusercontent.com%2Fulsklyc%2Fyuvomi-home-assistant%2Fmain%2Fyuvomi%2Fconfig.yaml&query=%24.version&label=app&style=flat-square&color=6C3AED" alt="App version"></a>
    <a href="#install"><img src="https://img.shields.io/badge/platforms-amd64%20%7C%20aarch64-6C3AED?style=flat-square" alt="Runs on amd64 and aarch64"></a>
    <a href="https://github.com/ulsklyc/yuvomi-home-assistant/actions/workflows/lint.yml"><img src="https://img.shields.io/github/actions/workflow/status/ulsklyc/yuvomi-home-assistant/lint.yml?branch=main&style=flat-square&label=lint" alt="Lint status"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-6C3AED?style=flat-square" alt="MIT license"></a>
  </p>

  <p>
    <a href="#install"><strong>→ Install</strong></a>&nbsp;&nbsp;·&nbsp;
    <a href="yuvomi/DOCS.md">Docs</a>&nbsp;&nbsp;·&nbsp;
    <a href="yuvomi/CHANGELOG.md">Changelog</a>&nbsp;&nbsp;·&nbsp;
    <a href="https://github.com/ulsklyc/yuvomi">Yuvomi</a>&nbsp;&nbsp;·&nbsp;
    <a href="https://yuvomi.cloud/">yuvomi.cloud</a>
  </p>

  <p>
    <a href="https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fulsklyc%2Fyuvomi-home-assistant"><img src="https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg" alt="Add this repository to Home Assistant"></a>
  </p>
</div>

This repository brings [Yuvomi](https://github.com/ulsklyc/yuvomi) to Home Assistant OS and
Supervised installations. The app runs the official Yuvomi image unchanged, next to Home
Assistant, and turns the app options into Yuvomi's settings. What Yuvomi itself does, module by
module, is on [yuvomi.cloud](https://yuvomi.cloud/) and in the
[main repository](https://github.com/ulsklyc/yuvomi).

---

## Install

1. Select **Add repository** above, or go to **Settings > Apps > Install app**, open the menu at
   the top right, choose **Repositories** and add
   `https://github.com/ulsklyc/yuvomi-home-assistant`.
2. Search for **Yuvomi**, install it and start it.
3. Select **Open Web UI** and create the admin account. Yuvomi opens on its own port of your
   Home Assistant host; the port is listed under **Configuration > Network**.
4. Invite the rest of the family from **Settings > Family**. On phones, open the same address
   in the browser and add it to the home screen, no app store needed.

**Requirements** - Home Assistant OS or a Supervised installation on amd64 or aarch64
(e.g. Raspberry Pi 4/5, Home Assistant Green and Yellow), about 256 MB RAM.

## What the app takes care of

- **Home Assistant backups** - the database lives in the app's data, so every backup of this app
  contains it. Backups are cold: the app stops for a moment, so SQLite is always consistent.
- **Weather from your home** - the weather widget takes the home location and unit system from
  Home Assistant, no extra setup.
- **Secrets** - the session secret is generated once. Database encryption is one switch: the key
  is generated for you, a copy lands in the app's config folder, and the app refuses to start
  rather than open the database with a wrong key.
- **Watchdog** - with the watchdog switched on, a health check lets the Supervisor restart Yuvomi
  if it stops answering.
- **Everything else Yuvomi supports** - single sign-on (OIDC), Google Calendar, Outlook push,
  e-mail and more go in as additional environment variables.

Every option is explained on the app's **Documentation** tab and in [DOCS.md](yuvomi/DOCS.md).

<details>
<summary><b>Not yet: the Home Assistant sidebar and Sign in with Home Assistant</b></summary>

<br>

- **Sidebar (Ingress)** - Yuvomi does not run under a sub-path yet, so it opens on its own port in
  a separate tab. A **Webpage** dashboard is no workaround: Yuvomi only allows being embedded by
  its own origin. Sub-path support is discussed in
  [ulsklyc/yuvomi#2231](https://github.com/ulsklyc/yuvomi/discussions/2231).
- **Sign in with Home Assistant** - proposed upstream in
  [ulsklyc/yuvomi#2428](https://github.com/ulsklyc/yuvomi/pull/2428). The app gets an option for
  it once a Yuvomi release ships it.

</details>

---

## How it works

The app builds on the official `ghcr.io/ulsklyc/yuvomi` image and only adds a launcher
(`yuvomi/rootfs/ha/`). It turns the app options into Yuvomi's environment variables, generates the
session secret and manages the optional database key. Yuvomi itself runs unchanged, and this
repository contains no Yuvomi code.

| Yuvomi path       | In Home Assistant                                   |
| ----------------- | --------------------------------------------------- |
| `/data/yuvomi.db` | App data (in every backup of this app)              |
| backups           | `/share/yuvomi/backups` (option)                    |
| documents         | `/share/yuvomi/documents` (option, off by default)  |
| modules           | `/addon_configs/<id>_yuvomi/modules`                |

The app version always equals the Yuvomi version it is built on.

<details>
<summary><b>Maintaining this repository</b></summary>

<br>

- **New Yuvomi release** - the version appears in two places, and both must match the image tag:
  `version` in `yuvomi/config.yaml` and `ARG BUILD_FROM` in `yuvomi/Dockerfile`. With the
  Renovate app enabled on this repository, [`renovate.json`](renovate.json) opens one pull request
  for both, and the [Changelog workflow](.github/workflows/changelog.yml) adds the version block
  with the link to the Yuvomi release, which Home Assistant shows on the update.
- **Checks** - every pull request runs the Home Assistant app linter, the version check, a
  build for amd64 and aarch64 and the launcher test ([`lint.yml`](.github/workflows/lint.yml)).
- **Images** - devices pull prebuilt images, `ghcr.io/ulsklyc/yuvomi-ha-{amd64,aarch64}`. The
  [Images workflow](.github/workflows/images.yml) pushes them on the pull request that bumps the
  version, before it reaches `main`.
- **Launcher test** - `scripts/test-launcher.sh <path-to-yuvomi-checkout>` runs the launcher
  against a real Yuvomi server through the encryption scenarios (start, enable, refuse to switch
  off, refuse a wrong key). Needs Node 22.14+ and `npm ci --omit=dev` in the checkout.
- **Contributing** - constraints, decisions, commit and AI assistance rules are in
  [CONTRIBUTING.md](CONTRIBUTING.md).

</details>

---

## Support

- **The app** (install, options, backups) - [issues in this repository](https://github.com/ulsklyc/yuvomi-home-assistant/issues)
- **Yuvomi itself** (features, modules, questions) - [Yuvomi discussions](https://github.com/ulsklyc/yuvomi/discussions)

---

<div align="center">
  <br>
  <img src="yuvomi/icon.png" alt="Yuvomi logo" width="48" />
  <p><strong>One home for your household. Next to the one that already runs it.</strong></p>
  <p>
    <a href="#install"><strong>→ Install it</strong></a>&nbsp;&nbsp;·&nbsp;
    <a href="https://yuvomi.cloud/"><strong>Take the tour</strong></a>&nbsp;&nbsp;·&nbsp;
    <a href="https://github.com/ulsklyc/yuvomi/discussions"><strong>Ask a question</strong></a>
  </p>
  <br>
  <sub>MIT licensed, see <a href="LICENSE">LICENSE</a>. Yuvomi itself is MIT-licensed by ulsklyc.</sub>
</div>
