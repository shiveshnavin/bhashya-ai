# Bhashya AI

> Local dev & deployment notes for the ReelAI generation UI and proxy functions.

**Quick Overview**
- Frontend: `public/` hosts the static UI (generate page at `/generate`).
- Functions: `functions/` contains an Express proxy (`apiGenerateProxy`) that forwards `/api/*` requests to an upstream `PROXY_TARGET`.

**Prerequisites**
- Node.js 18+
- Firebase CLI (recommended v15+)
- Install dev deps: `npm install`

**Run locally (emulators)**
- Start emulators (hosting + functions):

```
npm run start
```

- Hosting will serve `public/` (default local URL: http://localhost:5002). Functions emulator runs on the port in `firebase.json` (functions port 5003 in this workspace).

**Proxy / API routing**
- The function in `functions/index.js` mounts a proxy at `/api` and forwards requests unchanged to the backend target defined by the environment variable `PROXY_TARGET` (or `TARGET`).
- To test against a local backend, create `functions/.env` with:

```
PROXY_TARGET=http://127.0.0.1:8080
```

- Hosting rewrites in `firebase.json` currently send `/api/generate` → function. If you need all `/api/**` paths routed through the function (e.g. `/api/health`, `/api/generate/:id`), update `firebase.json` to add a `/api/**` rewrite.

**Frontend behavior & notes**
- Token handling: the UI reads `?token=...` from the URL and sets the token in the frontend only (no server change required).
- Status-to-UI mapping lives in `public/index.js`. Supported statuses: `FAILED`, `IN_PROGRESS`, `PARTIAL_SUCCESS`, `SUCCESS`, `PAUSED` (Queued), `SKIPPED` (Stopped). The page updates percent, progress bar, spinner, and preview overlay accordingly.
- Current executing task computation uses `getCurrentlyExecutingTask(data)` in `public/index.js`. It finds the last entry in `executedTasks`, then treats the next task in `tasks` as the executing task (fallbacks included).
- On small screens the preview column is shown above the generation pipeline (`generate/index.html` uses responsive order classes).

**Deploy**
- Deploy hosting + functions:

```
npm run deploy
```

**Troubleshooting**
- If the UI shows an unexpected task or percentage, inspect the Firestore `generations/<id>` document (fields: `tasks`, `executedTasks`, `status`, `currentTaskIdx`). The UI relies on those shapes.
- For proxy errors check the functions emulator logs (console output) and verify `PROXY_TARGET` reachability.

If you want, I can add example `generations` document snippets, CI steps, or a short CONTRIBUTING section.

This project is now only used for Firebase Hosting.
