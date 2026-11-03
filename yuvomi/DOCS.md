# Yuvomi

Yuvomi is a self-hosted family planner: tasks, calendar, shopping, meals,
recipes, budget, documents, health and more, for the whole household.
This app runs the official Yuvomi image next to Home Assistant.

## Getting started

1. Install the app and start it.
2. Select **Open Web UI**. Yuvomi opens on port 3000 of your Home Assistant
   host, e.g. `http://homeassistant.local:3000`.
3. The first visit walks you through creating the admin account.
4. Invite the rest of the family from **Settings > Family**.

On phones, open the same address in the browser and add it to the home
screen. Yuvomi is a Progressive Web App, no app store needed.

## Options

### Encrypt database

Encrypts the database with AES-256. Recommended if you use the Health module.

- Leave **Encryption key** empty and the app generates one. A copy is written to
  `db_encryption_key.txt` in the app's config folder
  (`/addon_configs/<id>_yuvomi/` via Samba or the File editor).
  **Keep a copy of it outside Home Assistant.**
- Or enter your own key (at least 16 characters).
- An existing unencrypted database is encrypted once on the next start. The
  untouched original stays next to it as `yuvomi.db.plaintext-backup`. Delete
  it once you have checked that everything is there; it is excluded from
  Home Assistant backups.
- Encryption cannot be switched off again, and the key cannot be changed
  through this option. The app refuses to start rather than open a database
  with the wrong key.

The key is stored inside the app's data, so it is part of every Home Assistant
backup of this app. Encryption protects the database file on its own (for
example a copy in Yuvomi's own backup folder), not a full Home Assistant
backup.

### Backup folder

Yuvomi's own scheduled backups (configured in **Settings > Backup**) go here.
The default `/share/yuvomi/backups` is reachable through Samba. Home
Assistant backups of this app contain the database independently of this.

### Store documents in a folder

By default, uploaded documents live inside the database. With this option
they are stored as files in **Documents folder** instead. Back that folder up
separately: database backups only contain the file references.

### Behind an HTTPS reverse proxy

Turn this on when Yuvomi is reached through an HTTPS reverse proxy (NGINX
Proxy Manager, Caddy, Traefik, Cloudflare Tunnel). It enables secure cookies
and trusts one proxy hop. Leave it off for plain `http://` access on your
network, or signing in will not work.

### Public URL

The address Yuvomi is reached at from outside, e.g.
`https://family.example.com`. Push notifications need it, and HTTPS.

### Use Home Assistant location for weather

Fills in the weather widget with your Home Assistant home location and unit
system. Ignored when you set `WEATHER_LAT` or `OPENWEATHER_API_KEY` yourself.

### City name for the weather

The name the weather widget shows for the Home Assistant location, e.g. your
town. Left empty, the app uses the name of your Home Assistant instance
(Settings > System > General), which is often still the default "Home".

The coordinates are rounded to about 1 km before they reach Yuvomi. That is
plenty for the weather and keeps the exact position of your home out of it.

### Additional environment variables

Everything else Yuvomi supports, such as single sign-on (OIDC), Google
Calendar, Outlook push, Google Drive, e-mail for password resets. Add each
variable as a name/value pair:

```yaml
env_vars:
  - name: OIDC_ISSUER
    value: https://auth.example.com/application/o/yuvomi/
  - name: OIDC_CLIENT_ID
    value: yuvomi
```

The full list is in the
[installation guide](https://github.com/ulsklyc/yuvomi/blob/main/docs/installation.md#environment-variables).
Paths, the session secret and the encryption key are managed by the app and
cannot be overridden here.

## Modules

Third-party modules go into the `modules` folder inside the app's config
folder. Restart the app after copying a module there.

## Access from the Home Assistant sidebar

Yuvomi does not support Home Assistant Ingress yet, so it opens on its own
port in a separate tab. A **Webpage** dashboard does not work as a
workaround: Yuvomi only allows being embedded by its own origin, and Home
Assistant on port 8123 counts as a different one.

## Support

- App: <https://github.com/ulsklyc/yuvomi-home-assistant/issues>
- Yuvomi itself: <https://github.com/ulsklyc/yuvomi/discussions>
