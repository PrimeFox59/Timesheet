// QA Automated Test Suite for Timesheet METSO
// Tests functional integrity, security controls, multi-user queries, and system stability.

const https = require('https');

const BASE_URL = 'https://timesweet.primeprojectx.net';

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      timeout: 15000
    };

    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf-8');
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: text,
          json,
          buffer
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${path}`));
    });

    if (body) {
      if (typeof body === 'string') {
        req.write(body);
      } else if (Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

async function runAllTests() {
  console.log('====================================================');
  console.log('🚀 STARTING COMPREHENSIVE QA & PRODUCTION READINESS SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`[TEST] ${name} ... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      failed++;
    }
  }

  // 1. System Settings
  await test('GET /api/system/settings - returns system settings map', async () => {
    const res = await request('/api/system/settings');
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
    if (!res.json?.success || !res.json?.settings) throw new Error('Invalid response body');
  });

  // 2. Security: Passwords Redaction in GET /api/master/users
  await test('GET /api/master/users - passwords MUST NOT be exposed', async () => {
    const res = await request('/api/master/users');
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
    if (!res.json?.data || !Array.isArray(res.json.data)) throw new Error('Expected data array');
    
    for (const u of res.json.data) {
      if (u.password !== undefined && u.password !== null && u.password !== '') {
        throw new Error(`Security Violation: User ${u.id} exposed plain password: ${u.password}`);
      }
    }
  });

  // 3. Security: Database Factory Reset Endpoint Protection
  await test('POST /api/database/reset - unauthorized requests must be rejected (401/403)', async () => {
    // Attempt 1: No credentials
    const res1 = await request('/api/database/reset', { method: 'POST' }, {});
    if (res1.statusCode !== 401) throw new Error(`Expected 401 without admin ID, got ${res1.statusCode}`);

    // Attempt 2: Non-superuser role (e.g. member)
    const res2 = await request('/api/database/reset', { method: 'POST' }, { adminId: 'COM200' });
    if (res2.statusCode !== 403) throw new Error(`Expected 403 for non-superuser, got ${res2.statusCode}`);
  });

  // 4. Authentication: Invalid Login Rejection
  await test('POST /api/auth/login - invalid credentials reject with 401', async () => {
    const res = await request('/api/auth/login', { method: 'POST' }, { user_id: 'prime', password: 'wrongpassword123' });
    if (res.statusCode !== 401) throw new Error(`Expected 401, got ${res.statusCode}`);
  });

  // 5. Authentication: Superuser Valid Login
  await test('POST /api/auth/login - valid superuser login returns session', async () => {
    const res = await request('/api/auth/login', { method: 'POST' }, { user_id: 'prime', password: 'zzz' });
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
    if (!res.json?.user || res.json.user.id !== 'prime') throw new Error('Login user payload mismatch');
  });

  // 6. Timesheet Multi-User Query
  await test('GET /api/timesheet?userIds=prime,COM116 - multi-user filter query', async () => {
    const res = await request('/api/timesheet?userIds=prime,COM116');
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
    if (!res.json?.success || !Array.isArray(res.json.data)) throw new Error('Expected data array');
    
    // Verify every returned row belongs to prime or COM116
    for (const row of res.json.data) {
      if (row.user_id !== 'prime' && row.user_id !== 'COM116') {
        throw new Error(`Row user_id ${row.user_id} was not in requested filter [prime, COM116]`);
      }
    }
  });

  // 7. Presence Heartbeat & Online Timeout
  await test('POST /api/realtime/heartbeat - toggle offline and verify in /api/users/online', async () => {
    // Set prime offline
    const resOffline = await request('/api/realtime/heartbeat', { method: 'POST' }, { user_id: 'prime', action: 'offline' });
    if (resOffline.statusCode !== 200) throw new Error(`Offline failed with HTTP ${resOffline.statusCode}`);

    // Verify online count
    const resOnline = await request('/api/users/online?currentUserId=COM116');
    if (resOnline.statusCode !== 200) throw new Error(`Online query failed with HTTP ${resOnline.statusCode}`);
    const primeUser = resOnline.json?.users?.find(u => u.id === 'prime');
    if (primeUser && primeUser.is_online === true) {
      throw new Error('Prime should be marked offline after explicit action: offline');
    }

    // Restore prime to online
    await request('/api/realtime/heartbeat', { method: 'POST' }, { user_id: 'prime' });
  });

  // 8. Chat Messages & Channels
  await test('GET /api/chat/messages?recipientId=ALL - general chat messages retrieval', async () => {
    const res = await request('/api/chat/messages?recipientId=ALL&userId=prime');
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
    if (!Array.isArray(res.json?.messages)) throw new Error('Expected messages array');
  });

  // 9. File Security: Path Traversal Protection
  await test('GET /api/chat/download?file=../../etc/passwd - path traversal defense', async () => {
    const res = await request('/api/chat/download?file=../../etc/passwd');
    // It should either return 404 or cleanly treat as basename passwd and not leak file
    if (res.statusCode === 200 && res.body.includes('root:')) {
      throw new Error('Critical Vulnerability: Path traversal leaked system file!');
    }
  });

  // 10. Database Backup: Full Multi-Sheet Backup Export
  await test('GET /api/database/backup - returns multi-sheet XLSX workbook', async () => {
    const res = await request('/api/database/backup');
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
    if (res.buffer.length < 1000) throw new Error('Export buffer suspiciously small');
    const contentType = res.headers['content-type'] || '';
    if (!contentType.includes('spreadsheetml')) {
      throw new Error(`Expected spreadsheetml content-type, got: ${contentType}`);
    }
  });

  // 11. Projects & Tasks
  await test('GET /api/projects & /api/projects/tasks - verify project management endpoints', async () => {
    const resP = await request('/api/projects');
    if (resP.statusCode !== 200) throw new Error(`Projects HTTP ${resP.statusCode}`);
    const resT = await request('/api/projects/tasks');
    if (resT.statusCode !== 200) throw new Error(`Tasks HTTP ${resT.statusCode}`);
  });

  console.log('\n====================================================');
  console.log(`🏁 QA RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
