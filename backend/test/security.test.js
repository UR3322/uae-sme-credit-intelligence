process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:1/test';
process.env.JWT_SECRET ||= 'test-only-secret-that-is-long-enough-123456789';
process.env.CORS_ORIGINS ||= 'http://allowed.test';

const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../server');

let server;
let baseUrl;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
});

const token = (role = 'CREDIT_ANALYST') => jwt.sign(
  { user_id: 1, email: 'analyst@example.test', role },
  process.env.JWT_SECRET,
  { algorithm: 'HS256', issuer: 'uae-sme-cip', audience: 'uae-sme-cip-api', expiresIn: '5m' }
);

test('health endpoint responds with hardened headers', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('login rejects malformed credentials before touching the database', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email' })
  });
  assert.equal(response.status, 400);
});

test('application data requires an authenticated bearer token', async () => {
  const response = await fetch(`${baseUrl}/api/applications`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Authentication required.' });
});

test('credit decisions reject unknown roles before database access', async () => {
  const response = await fetch(`${baseUrl}/api/decisions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token('OBSERVER')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ application_id: 1, action: 'APPROVE' })
  });
  assert.equal(response.status, 403);
});

test('invalid token issuer is rejected', async () => {
  const badToken = jwt.sign({ user_id: 1, role: 'CREDIT_ANALYST' }, process.env.JWT_SECRET,
    { algorithm: 'HS256', issuer: 'wrong-issuer', audience: 'uae-sme-cip-api' });
  const response = await fetch(`${baseUrl}/api/applications`, { headers: { authorization: `Bearer ${badToken}` } });
  assert.equal(response.status, 401);
});

test('approved amount and tenure are mandatory for approval', async () => {
  const response = await fetch(`${baseUrl}/api/decisions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ application_id: 1, action: 'APPROVE', analyst_notes: 'Reviewed evidence' })
  });
  assert.equal(response.status, 400);
});

test('analyst token cannot finalize an approval', async () => {
  const response = await fetch(`${baseUrl}/api/decisions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token('CREDIT_ANALYST')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ application_id: 1, action: 'APPROVE', approved_amount: 1000, approved_tenure_months: 12, analyst_notes: 'Reviewed evidence' })
  });
  assert.equal(response.status, 403);
});

test('malformed application IDs are rejected before a database lookup', async () => {
  const response = await fetch(`${baseUrl}/api/applications/not-an-id`, {
    headers: { authorization: `Bearer ${token()}` }
  });
  assert.equal(response.status, 400);
});

test('unapproved browser origins are not granted CORS access', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: 'https://attacker.invalid' }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
