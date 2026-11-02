# Changelog

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
