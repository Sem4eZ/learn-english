/**
 * Automated Test Suite: Authentication, Security & Session Management
 * Covers: Registration (positive, negative, validation, duplicates, trimming, security),
 * Login (positive, invalid credentials, case-insensitivity, empty fields),
 * Profile / Me (JWT Bearer token verification, fallback to guest, custom headers).
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/schema');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';
const UNIQUE_RUN_ID = Date.now().toString(36);

describe('Authentication & Security Test Suite', () => {
  const testUser = {
    username: `tester_${UNIQUE_RUN_ID}`,
    password: 'password123'
  };
  let authToken = '';
  let authUserId = '';

  before(() => {
    // Ensure clean state for test user if needed
    db.prepare('DELETE FROM users WHERE username LIKE ?').run(`tester_${UNIQUE_RUN_ID}%`);
  });

  // --------------------------------------------------------------------------
  // Registration Negative Cases
  // --------------------------------------------------------------------------
  it('1. Register Negative: Empty request body returns 400 error', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error);
  });

  it('2. Register Negative: Missing username returns 400 error', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secretpassword' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('символов'));
  });

  it('3. Register Negative: Missing password returns 400 error', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'valid_user_name' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Пароль'));
  });

  it('4. Register Negative: Username shorter than 2 characters returns 400 error', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'a', password: 'validpassword' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('не менее 2'));
  });

  it('5. Register Negative: Password shorter than 3 characters returns 400 error', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'valid_user', password: '12' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('не менее 3'));
  });

  // --------------------------------------------------------------------------
  // Registration Positive & Edge Cases
  // --------------------------------------------------------------------------
  it('6. Register Positive: Successfully creates a new user account with initial stats', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.token, 'Should return auth token');
    assert.strictEqual(body.user.username, testUser.username);
    assert.strictEqual(body.user.xp, 0);
    assert.strictEqual(body.user.streak, 1);
    assert.strictEqual(body.user.level, 1);

    authToken = body.token;
    authUserId = body.user.id;

    // Verify row persisted in database
    const dbRow = db.prepare('SELECT * FROM users WHERE id = ?').get(authUserId);
    assert.ok(dbRow);
    assert.strictEqual(dbRow.username, testUser.username);
  });

  it('7. Register Negative: Duplicate exact username is rejected with 400 error', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('уже зарегистрирован'));
  });

  it('8. Register Negative: Case-insensitive duplicate username is rejected', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUser.username.toUpperCase(),
        password: 'anotherpassword'
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('уже зарегистрирован'));
  });

  it('9. Register Edge: Whitespace surrounding username is automatically trimmed', async () => {
    const spacedUsername = `  spaced_${UNIQUE_RUN_ID}  `;
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: spacedUsername, password: 'password123' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.username, `spaced_${UNIQUE_RUN_ID}`);
  });

  it('10. Register Security: SQL Injection payload in username is escaped safely', async () => {
    const sqlInjectionName = `' OR 1=1; --_${UNIQUE_RUN_ID}`;
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: sqlInjectionName, password: 'password123' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.username, sqlInjectionName);

    // Verify database was not corrupted
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(body.user.id);
    assert.ok(row);
  });

  // --------------------------------------------------------------------------
  // Login Positive & Negative Cases
  // --------------------------------------------------------------------------
  it('11. Login Positive: Authenticates with valid username and password', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.token);
    assert.strictEqual(body.user.username, testUser.username);
  });

  it('12. Login Negative: Rejects invalid password with 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUser.username,
        password: 'WRONG_PASSWORD_XYZ'
      })
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Неверный пароль'));
  });

  it('13. Login Negative: Rejects nonexistent username with 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'nonexistent_user_999999999',
        password: 'password123'
      })
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('не найден'));
  });

  it('14. Login Negative: Empty request body returns 400 error', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error);
  });

  it('15. Login Edge: Login handles case-insensitivity in username', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUser.username.toUpperCase(),
        password: testUser.password
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.username, testUser.username);
  });

  // --------------------------------------------------------------------------
  // Me / Session Verification Cases
  // --------------------------------------------------------------------------
  it('16. Me: Successfully validates user identity via Bearer token', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.id, authUserId);
    assert.strictEqual(body.user.username, testUser.username);
    assert.strictEqual(body.user.isGuest, false);
  });

  it('17. Me: Forged / tampered token gracefully returns unauthenticated without crashing', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer INVALID_FORGED_TOKEN_DATA` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.authenticated, false);
    assert.strictEqual(body.user, null);
  });

  it('18. Me: Request without any auth headers returns unauthenticated state cleanly', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.authenticated, false);
    assert.strictEqual(body.user, null);
  });

  it('19. Me: Custom x-user-id header resolves corresponding user', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'x-user-id': authUserId }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.id, authUserId);
  });
});
