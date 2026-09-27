# Authentication & Device Identity (S6-T04)

## Authentication architecture

```
Flutter (Riverpod interfaces)
        │  Bearer access + refresh
        ▼
AuthController ──► AuthService
                      ├── PasswordService (argon2id)
                      ├── DeviceService
                      ├── SessionService (LoginAudit)
                      └── TokenService (JWT + refresh rotation)
                              ▼
                         Neon PostgreSQL
```

| Flow | Endpoint |
|------|----------|
| Email register | `POST /api/v1/auth/register` |
| Email login | `POST /api/v1/auth/login` |
| Anonymous local | `POST /api/v1/auth/anonymous` |
| Guest upgrade | `POST /api/v1/auth/guest/upgrade` |
| Refresh | `POST /api/v1/auth/refresh` |
| Logout | `POST /api/v1/auth/logout` |
| Me / devices | `GET /auth/me`, `GET /auth/devices` |
| Trust / revoke | `POST /auth/device/trust`, `DELETE /auth/devices/:id` |

Future stubs (501): Apple, Google, Passkeys.

## JWT lifecycle

1. Login/register issues **access** (short TTL, default 15m) + **refresh** (opaque, hashed at rest).
2. Access JWT claims: `sub`, `deviceId`, `deviceRowId`, `accountType`, `typ=access`.
3. Refresh rotation: present refresh → revoke old → issue new pair in same `familyId`.
4. Reuse of revoked refresh → **entire family revoked** (theft detection).
5. Logout revokes one refresh or all user sessions (`revokeAll`).
6. Clock skew tolerance: `JWT_CLOCK_SKEW_SECONDS` (default 60).

## Device lifecycle

1. Every auth call includes client `deviceId` (UUID).
2. Server upserts `Device` row (`userId` + `deviceId` unique), updates `lastSeen`.
3. Refresh tokens are bound to the device row.
4. Trust: `trusted=true` via `POST /auth/device/trust`.
5. Revoke: soft-delete device + revoke its refresh tokens.

Fields: `deviceId`, `deviceName`, `platform`, `appVersion`, `lastSeen`, `pushToken`, `trusted`, timestamps.

## Offline upgrade strategy

1. App starts with local anonymous identity (`anonymousKey`).
2. `POST /auth/anonymous` creates/resumes cloud shell (`accountType=anonymous`).
3. Upgrade: `POST /auth/guest/upgrade` attaches email/password on same user.
4. If email exists → `MERGE_REQUIRED` (client prepares merge; no silent overwrite).

## CSRF strategy

- Mobile/native clients use **Bearer tokens** (not cookies) → classic CSRF does not apply.
- Browser/SPA (future): prefer SameSite cookies + double-submit CSRF token, or continue Bearer-only from memory.
- CORS is origin-restricted in staging/production via `CORS_ORIGINS`.
- Helmet sets baseline security headers.

## Threat model (summary)

| Threat | Mitigation |
|--------|------------|
| Password stuffing | Argon2id + rate limits on login/register |
| Refresh theft | Rotation + family revoke on reuse |
| Device cloning | Per-device sessions; revoke endpoint |
| Token replay | Short access TTL; hashed refresh at rest |
| Duplicate accounts | Unique email; merge-required on upgrade |
| Weak passwords | Server-side strength rules |

## Env

```
JWT_SECRET=...
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30
JWT_CLOCK_SKEW_SECONDS=60
```
