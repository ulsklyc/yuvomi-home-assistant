# Feature request: serve Yuvomi under a path prefix (Home Assistant Ingress)

## Background

I have prepared a Home Assistant app for Yuvomi (repository attached /
linked). It runs the official image unchanged and works on its own port.
The nicer integration would be **Home Assistant Ingress**: Yuvomi in the HA
sidebar, signed in through Home Assistant's existing HTTPS and remote access,
no extra port, no extra certificate. That would also solve push notifications
for most HA users, because their HA instance already has HTTPS.

Ingress proxies the app under a per-installation prefix on Home Assistant's
own origin:

```
https://ha.example.com/api/hassio_ingress/<token>/
```

The proxy strips the prefix before the request reaches the app and sends it
along in the header `X-Ingress-Path: /api/hassio_ingress/<token>`. The app has
to make every URL it emits relative to that prefix.

## What currently assumes the root path

From a read of `main` (v2.79.0):

| Area | Example | Count |
| --- | --- | --- |
| ES module imports | `import … from '/components/…'` in `public/` | ~1,200 lines |
| API base | `const API_BASE = '/api/v1'` in `public/api.js` | 1 constant, ~26 files with literal `/api/v1` |
| Client router | route matching on `location.pathname`, `navigate('/calendar')` | `public/router.js` |
| `index.html` | `href="/styles/…"`, `src="/theme-init.js"`, manifest, icons | ~40 |
| Service worker | `register('/sw.js')` with root scope, cached URLs in `sw.js` | 2 files |
| Manifest | `start_url`, `scope`, icon paths | `manifest.json` |
| Server redirects / links | OAuth and OIDC callbacks, invite links, calendar feed URLs | several routes |

## Proposal

A `BASE_PATH` mechanism that covers both a fixed prefix (reverse proxy at
`/yuvomi/`) and HA's dynamic one:

1. **Server**: determine the prefix per request, from `X-Ingress-Path` when
   `TRUST_INGRESS_HEADER=true`, otherwise from a static `BASE_PATH` env var.
   Inject it into `index.html` as `<base href="<prefix>/">` and as
   `window.__BASE__`.
2. **Frontend**: switch absolute module imports and asset URLs to relative
   ones (a mechanical codemod; relative imports resolve against the module's
   own URL, so they work with and without a prefix). Prefix `API_BASE` with
   `window.__BASE__`. Strip the prefix from `location.pathname` in the router
   and add it in `navigate()` / `pushState`.
3. **Service worker**: register `sw.js` relative to the base with
   `scope: <prefix>/`, and make the precache list relative.
4. **Manifest**: serve it dynamically with `start_url` and `scope` set to the
   prefix (or make them relative).
5. **Absolute links** that leave the browser (OAuth callbacks, invites, ICS
   feeds) keep using `BASE_URL`, extended by the static `BASE_PATH`.

Without a prefix everything behaves exactly as today, so existing
installations are unaffected.

## Two Ingress details worth knowing

- **Framing**: Ingress shows the app in an iframe on Home Assistant's origin.
  Helmet's defaults (`frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`)
  allow that, because the frame is same-origin through the proxy.
- **Authentication**: Ingress requests come only from Home Assistant users.
  Yuvomi's own login stays as it is; mapping HA users to Yuvomi members would
  be a later, optional step.

Happy to help test this on Home Assistant OS (amd64 and aarch64).
