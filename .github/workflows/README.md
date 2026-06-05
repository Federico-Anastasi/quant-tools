# CI / Deploy Workflows

Release flow for PsiQuant: **commit → main → GitHub Actions → deploy → verify on server**.
Never deploy by copying files to the server by hand (`scp`, manual edits). Always go through git + the deploy workflow so the server stays traceable to a commit.

## Workflows

### `ci.yml` — Quality gate
Runs automatically on every push to `main` and on pull requests. Does **not** deploy.
- `backend-syntax`: `compileall` over `backend/app` (catches Python syntax errors).
- `frontend-build`: `npm install` + `npm run build` (catches frontend build breakage).

### `deploy.yml` — Production deploy
Manual only (`workflow_dispatch`). Run it from the **Actions** tab → "Deploy (PsiQuant prod)" → Run workflow → `main`.
1. `syntax-check`: backend `compileall` gate (deploy is blocked if it fails).
2. `deploy`: SSH to `root@psiquant.xyz`, then on the server:
   ```
   cd /opt/quant-tools
   git fetch origin
   git reset --hard origin/main          # converge to the pushed commit
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   `reset --hard` (not `pull`) so the server always matches `origin/main` even if it
   carries stray local edits. Untracked files (`backups/`, `*_export.sql`) are kept.
   `up -d --build` rebuilds the frontend image and recreates `api` / `realtime` /
   `compute` so the volume-mounted backend code reloads.
3. `Health check`: polls `https://psiquant.xyz/health` until it returns 200.

## Required configuration

| Type | Name | Value |
|------|------|-------|
| Secret | `PSIQUANT_SSH_KEY` | Private SSH key authorized as `root@psiquant.xyz` |

Set it once: `gh secret set PSIQUANT_SSH_KEY < ~/.ssh/psiquant_ed25519` (or via repo Settings → Secrets).

## Server facts

| | |
|--|--|
| Host | `psiquant.xyz` (root) |
| Path | `/opt/quant-tools` (git checkout of this repo) |
| Compose | `docker-compose.prod.yml` |
| Containers | `quant_tools_{db,redis,api,realtime,compute,frontend,nginx}` |

### Notes
- `api` / `realtime` / `compute` hot-mount `./backend:/app`, so a code change needs a
  container **recreate** (done by `up -d --build`) to reload Python — not just a file swap.
- `realtime` is a singleton (bot executor holds a Redis lock `bot_executor_lock`, TTL 30s).
  On restart the new instance waits for the old lock to expire (~30s) then runs a startup
  catch-up that replays any missed candles before going live — so a deploy never leaves a
  gap in the bot equity curves.
- Live trading is intentionally disabled; `backend/app/config_hyperliquid.json` is absent
  (gitignored) and must stay that way unless live trading is deliberately re-enabled.
