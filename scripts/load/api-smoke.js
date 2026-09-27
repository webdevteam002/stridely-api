/**
 * k6 load-test skeleton (S6-T08) — not run in CI.
 *
 * Install: https://k6.io/docs/get-started/installation/
 * Run:    k6 run scripts/load/api-smoke.js
 *
 * Targets auth + health + sync upload paths with modest VUs.
 * Expand thresholds before production capacity planning.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:3000';

export default function () {
  const live = http.get(`${BASE}/health/live`);
  check(live, { 'live 200': (r) => r.status === 200 });

  const health = http.get(`${BASE}/health`);
  check(health, { 'health ok-ish': (r) => r.status === 200 });

  sleep(1);
}
