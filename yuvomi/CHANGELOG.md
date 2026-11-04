# Changelog

## 2.85.0

- Based on [Yuvomi 2.85.0](https://github.com/ulsklyc/yuvomi/releases/tag/v2.85.0).
  Without a place name the weather tile now leaves the place line empty instead
  of showing your coordinates.
- With "Encrypt database" off, a new installation stays unencrypted. Yuvomi
  2.85.0 generates a database key of its own when none is set; the app now
  switches that off, because it keeps the key itself. **If you installed the
  app fresh with 2.85.0** and it no longer starts ("The database is encrypted,
  but encrypt_database is off"), reload the store (**Check for updates** in its
  menu), then select **Rebuild** on the app page: the app
  takes over the key Yuvomi generated, keeps the database encrypted and writes
  a copy of the key to `db_encryption_key.txt` in the app's config folder.
  Then switch "Encrypt database" on, so the option says what is true.
  Installations that existed before 2.85.0 are not affected.
- The default host port is now 3880 instead of 3000. Port 3000 is the default
  of many other apps (Dawarich, Gitea, Chromium and others), so the two could
  not run side by side. Reported in #4.
  **If you never changed the port**, Yuvomi moves to port 3880 with this
  update: update bookmarks, the app on your phone's home screen, "Public URL"
  and your reverse proxy, or set the port back to 3000 under
  Configuration > Network. A port you set yourself stays as it is.
  The new port is a new address for the browser: add the app to the home
  screen again and switch push notifications back on.
- The weather city falls back to the name of the Home Assistant instance
  again, even when it is "Home"; 2.84.0 left it empty, and Yuvomi then showed
  the raw coordinates (#4). Set "City name for the weather" to show your town;
  the log says so when the name is "Home".
- The Home Assistant coordinates are rounded to about 1 km before they reach
  Yuvomi, so the exact position of the home no longer shows in the weather
  widget or settings.

## 2.84.0

- Based on [Yuvomi 2.84.0](https://github.com/ulsklyc/yuvomi/releases/tag/v2.84.0)
  (changes since 2.79.0: [2.80.0](https://github.com/ulsklyc/yuvomi/releases/tag/v2.80.0),
  [2.81.0](https://github.com/ulsklyc/yuvomi/releases/tag/v2.81.0),
  [2.81.1](https://github.com/ulsklyc/yuvomi/releases/tag/v2.81.1),
  [2.81.2](https://github.com/ulsklyc/yuvomi/releases/tag/v2.81.2),
  [2.82.0](https://github.com/ulsklyc/yuvomi/releases/tag/v2.82.0),
  [2.83.0](https://github.com/ulsklyc/yuvomi/releases/tag/v2.83.0)).
- `SESSION_SECRET_FILE` and `DB_ENCRYPTION_KEY_FILE` are ignored in
  "Additional environment variables", like the secrets themselves: the app
  manages both.
- The weather widget no longer shows "Home" as the city. That is the default
  name of the Home Assistant instance, not a place. The new option "City name
  for the weather" sets the name; left empty, the instance name is used unless
  it is still "Home". Reported in #4.

## 2.79.0

- First version of the Home Assistant app, based on
  [Yuvomi 2.79.0](https://github.com/ulsklyc/yuvomi/releases/tag/v2.79.0).
