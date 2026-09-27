# Stridely Backend

NestJS foundation for the Stridely offline-first API.

See [docs/BACKEND_FOUNDATION.md](./docs/BACKEND_FOUNDATION.md) for architecture, Prisma conventions, and Neon setup.

## Quick start

```bash
cp .env.example .env
# Set DATABASE_URL to your Neon connection string
# Set SKIP_DB_CONNECT=false when Neon is available

npm install
npm run prisma:generate
npm run prisma:migrate:deploy   # applies initial schema
npm run start:dev
```

- Health: http://localhost:3000/health  
- Swagger: http://localhost:3000/docs  
- API prefix: `/api/v1`

## Scripts

| npm script | Purpose |
|------------|---------|
| `start:dev` | Watch mode |
| `lint` | ESLint |
| `test` | Unit tests |
| `test:e2e` | E2E tests |
| `prisma:generate` | Generate Prisma Client |
| `prisma:migrate` | Dev migrations |
| `prisma:migrate:deploy` | Deploy migrations |
