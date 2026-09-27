# Stridely Backend — NestJS Foundation (S6-T03)

**Status:** Foundation only — no business logic, auth, or sync implementation  
**Stack:** NestJS 11 · Prisma 6 · PostgreSQL (Neon) · Pino · Zod · Swagger  
**Contract:** Aligns with `docs/api/` (`/api/v1`)

---

## 1. Architecture

```
Flutter (offline) ──contract──► NestJS API ──Prisma──► Neon PostgreSQL
                                     │
                     Clean Architecture modules
                     (controllers → services → repositories)
```

| Layer | Location | Role |
|-------|----------|------|
| Bootstrap | `src/main.ts` | Validation pipe, filters, Swagger, Pino |
| Config | `src/config/` | Zod env validation + `@nestjs/config` |
| Database | `src/database/` | Global `PrismaService` |
| Common | `src/common/` | Envelope, RFC 7807 filter, request IDs |
| Modules | `src/modules/*` | Domain boundaries (stubs + health) |
| Shared | `src/shared/` | Prisma entity type aliases |

---

## 2. Folder structure

```
backend/
  prisma/
    schema.prisma
    migrations/20260715120000_init/
  src/
    main.ts
    app.module.ts
    config/
    database/
    common/
      dto/ filters/ interceptors/ middleware/ pipes/
    modules/
      health/
      users/ profiles/ goals/ history/
      achievements/ preferences/ sync/
        controllers/ services/ repositories/
        dto/ entities/ interfaces/ tests/
    shared/
  test/
  .env.example
```

---

## 3. Database conventions

| Rule | Detail |
|------|--------|
| PKs | UUID (`@default(uuid())`) |
| Soft delete | `deletedAt` on domain tables |
| Optimistic lock | `version` Int (default 1) |
| Timestamps | `createdAt` / `updatedAt` timestamptz |
| FKs | Cascade on user-owned data; `AuditLog.userId` SetNull |
| Indexes | user+status, dayKey, updatedAt, unique natural keys |
| Naming | snake_case columns via `@map`, plural table `@@map` |

### Models

User · Profile · Goal · GoalHistory · MovementSession · DailyActivity · Achievement · Preference · SyncJob · Device · AuditLog

---

## 4. Migration workflow

```bash
cd backend
cp .env.example .env   # set Neon DATABASE_URL
# remove SKIP_DB_CONNECT or set to false

npm run prisma:generate
npm run prisma:migrate          # interactive (dev)
# or
npm run prisma:migrate:deploy   # CI / staging / prod
```

Initial migration: `prisma/migrations/20260715120000_init`.

---

## 5. Environment setup

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string (required) |
| `NODE_ENV` | `development` \| `staging` \| `production` \| `test` |
| `PORT` | Default `3000` |
| `API_PREFIX` | Default `api/v1` |
| `LOG_LEVEL` | Pino level |
| `SWAGGER_ENABLED` | Default `true` |
| `SKIP_DB_CONNECT` | `true` skips `$connect` (local/CI without Neon) |

Validated with Zod (`src/config/env.validation.ts`).

---

## 6. Scripts (CI)

| Script | Command |
|--------|---------|
| lint | `npm run lint` |
| test | `npm test` |
| test:e2e | `npm run test:e2e` |
| prisma generate | `npm run prisma:generate` |
| prisma migrate | `npm run prisma:migrate` |

---

## 7. Health & docs

- `GET /health` — uptime, version, environment, DB ping (outside `/api/v1` prefix)
- Swagger UI — `GET /docs` when `SWAGGER_ENABLED=true`

---

## 8. Module map

| Module | Status |
|--------|--------|
| Health | Implemented (foundation) |
| Users / Profiles / Goals / History / Achievements / Preferences / Sync | Scaffold only |

Sync business logic is explicitly deferred to a later sprint.
