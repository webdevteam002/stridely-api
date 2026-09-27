# Koyeb Free — NestJS (Stridely)

Target: **$0/month** Free Instance only. Supabase remains PostgreSQL.

## Service settings

- Type: Web Service
- Instance: **Free** (do not select Eco / Nano / paid)
- Builder: Buildpack or Dockerfile (repo has Dockerfile)
- GitHub: `webdevteam002/stridely-api`
- Build: `npm ci && npx prisma generate && npm run build`
- Run: `npx prisma migrate deploy && npm run start:prod`
- Health: `/health/live` (also `/health`, `/health/ready`)

## Required env (names only)

`NODE_ENV` `TRUST_PROXY` `API_PREFIX` `CORS_ORIGINS` `DATABASE_URL` `JWT_SECRET` `JWT_ISSUER` `JWT_AUDIENCE` `JWT_ACCESS_TTL` `JWT_REFRESH_TTL_DAYS` `SWAGGER_ENABLED` `SKIP_DB_CONNECT` `GOOGLE_CLIENT_ID` (optional)

`PORT` is injected by Koyeb. App binds `0.0.0.0`.

## Cold starts

Free instances may sleep. Clients must tolerate slow first requests; step counting stays local (Hive).
