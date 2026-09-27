#!/usr/bin/env node
/**
 * Create / update the stridely-api Render web service from GitHub.
 *
 * Usage (PowerShell):
 *   $env:RENDER_API_KEY = "<from https://dashboard.render.com/u/settings#api-keys>"
 *   node scripts/render-deploy.mjs
 *
 * Reads secrets from backend/.env (DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID)
 * and never prints their values.
 */
const fs = require('fs');
const path = require('path');

const API = 'https://api.render.com/v1';
const REPO = 'https://github.com/webdevteam002/stridely-api';
const SERVICE_NAME = 'stridely-api';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return v;
}

function loadDotEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function render(method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${requireEnv('RENDER_API_KEY')}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    console.error(`${method} ${route} -> ${res.status}`);
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json;
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  const local = loadDotEnv(envPath);
  for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
    if (!local[key]) {
      console.error(`backend/.env missing ${key}`);
      process.exit(1);
    }
  }

  const cors =
    local.CORS_ORIGINS && local.CORS_ORIGINS !== '*'
      ? local.CORS_ORIGINS
      : 'https://stridely.app,https://app.stridely.app,https://stridely-api.onrender.com';

  const owners = await render('GET', '/owners');
  const owner = Array.isArray(owners)
    ? owners.find((o) => o.owner?.type === 'user' || o.owner?.type === 'team')
        ?.owner || owners[0]?.owner
    : null;
  if (!owner?.id) {
    console.error('No Render owner found for this API key');
    process.exit(1);
  }
  console.log(`Using Render owner id=${owner.id} type=${owner.type}`);

  const existing = await render('GET', '/services?limit=50');
  const list = Array.isArray(existing)
    ? existing.map((e) => e.service || e).filter(Boolean)
    : [];
  let service = list.find((s) => s.name === SERVICE_NAME);

  const envVars = [
    { key: 'NODE_ENV', value: 'production' },
    { key: 'TRUST_PROXY', value: 'true' },
    { key: 'API_PREFIX', value: 'api/v1' },
    { key: 'SWAGGER_ENABLED', value: 'false' },
    { key: 'SKIP_DB_CONNECT', value: 'false' },
    { key: 'JWT_ISSUER', value: local.JWT_ISSUER || 'stridely-api' },
    { key: 'JWT_AUDIENCE', value: local.JWT_AUDIENCE || 'stridely-app' },
    { key: 'JWT_ACCESS_TTL', value: local.JWT_ACCESS_TTL || '15m' },
    {
      key: 'JWT_REFRESH_TTL_DAYS',
      value: String(local.JWT_REFRESH_TTL_DAYS || '30'),
    },
    { key: 'CORS_ORIGINS', value: cors },
    { key: 'DATABASE_URL', value: local.DATABASE_URL },
    { key: 'JWT_SECRET', value: local.JWT_SECRET },
  ];
  if (local.GOOGLE_CLIENT_ID) {
    envVars.push({ key: 'GOOGLE_CLIENT_ID', value: local.GOOGLE_CLIENT_ID });
  }

  if (!service) {
    console.log('Creating web service…');
    const created = await render('POST', '/services', {
      type: 'web_service',
      name: SERVICE_NAME,
      ownerId: owner.id,
      repo: REPO,
      branch: 'main',
      runtime: 'node',
      plan: 'free',
      region: 'oregon',
      buildCommand: 'npm ci && npx prisma generate && npm run build',
      startCommand: 'npx prisma migrate deploy && npm run start:prod',
      healthCheckPath: '/health/live',
      autoDeploy: 'yes',
      envVars,
    });
    service = created.service || created;
  } else {
    console.log(`Service already exists id=${service.id}`);
    await render('PUT', `/services/${service.id}/env-vars`, envVars);
    await render('POST', `/services/${service.id}/deploys`, {
      clearCache: 'do_not_clear',
    });
  }

  const url = service.serviceDetails?.url || service.url;
  console.log('Deploy triggered.');
  console.log(`Service id: ${service.id}`);
  console.log(`Expected URL: ${url || `https://${SERVICE_NAME}.onrender.com`}`);
  console.log('Health: GET /health and /health/ready (cold start may take ~60s)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
