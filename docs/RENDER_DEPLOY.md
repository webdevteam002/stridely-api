# Deploy Stridely API on Render

## GitHub

Private repo: https://github.com/webdevteam002/stridely-api

## One-time dashboard setup

1. Open https://dashboard.render.com/select-repo?type=blueprint
2. Connect the `webdevteam002/stridely-api` repository (Blueprint uses `render.yaml`).
3. Set these **secret** environment variables in the service (names only — paste values from local `backend/.env`):

| Name | Notes |
|------|--------|
| `DATABASE_URL` | Existing Supabase PostgreSQL URL (`?sslmode=require`) |
| `JWT_SECRET` | ≥ 32 characters |
| `GOOGLE_CLIENT_ID` | Web OAuth client ID |
| `CORS_ORIGINS` | Explicit allow-list, e.g. `https://stridely.app,https://app.stridely.app,https://stridely-api.onrender.com` |

Non-secret vars are already defined in `render.yaml`.

## Build / start (from Blueprint)

- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npx prisma migrate deploy && npm run start:prod`
- Health check: `/health/live`

## After deploy

```bash
curl -sS https://stridely-api.onrender.com/health
curl -sS https://stridely-api.onrender.com/health/ready
```

Free tier spins down after ~15 minutes idle; the first request may take ~30–60s.
