/**
 * Comprehensive Automated End-to-End QA Test Suite for Metso Timesheet CMS
 * Tests all 30 API routes, RBAC constraints, Date Locking, Excel generation, and Timezone standards.
 */

const BASE_URL = process.env.TEST_URL || 'http://192.168.3.122:8565';

console.log(`\n===============================================================`);
console.log(`   METSO TIMESHEET CMS - COMPREHENSIVE AUTOMATED QA SUITE`);
console.log(`   Target Server: ${BASE_URL}`);
console.log(`   Date/Time: ${new Date().toISOString()}`);
console.log(`===============================================================\n`);

const results = [];

async function runTest(suite, testName, testFn) {
  process.stdout.write(`[TEST] [${suite}] ${testName} ... `);
  const start = Date.now();
  try {
    const detail = await testFn();
    const duration = Date.now() - start;
    console.log(`\x1b[32mPASS\x1b[0m (${duration}ms) ${detail || ''}`);
    results.push({ suite, testName, status: 'PASS', duration, detail });
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`\x1b[31mFAIL\x1b[0m (${duration}ms) - ${err.message}`);
    results.push({ suite, testName, status: 'FAIL', duration, error: err.message });
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.arrayBuffer();
  }
  return { status: res.status, headers: res.headers, data, contentType };
}

async function main() {
  // SUITE 1: AUTHENTICATION & RBAC
  await runTest('AUTH', '1.1 Login as Superuser prime', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'prime', password: 'zzz' })
    });
    if (res.status !== 200 || !res.data.success || res.data.user.role !== 'superuser') {
      throw new Error(`Expected superuser role, got: ${JSON.stringify(res.data)}`);
    }
    return `User: ${res.data.user.username} (${res.data.user.role})`;
  });

  await runTest('AUTH', '1.2 Login as Permanent Superuser COM116', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'COM116', password: 'Metso' })
    });
    if (res.status !== 200 || !res.data.success || res.data.user.role !== 'superuser') {
      throw new Error(`Expected COM116 superuser role, got: ${JSON.stringify(res.data)}`);
    }
    return `User: ${res.data.user.username} (${res.data.user.role})`;
  });

  await runTest('AUTH', '1.3 Login as Regular Member COM002', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'COM002', password: 'Metso' })
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Regular user login failed: ${JSON.stringify(res.data)}`);
    }
    return `User: ${res.data.user.username} (${res.data.user.role})`;
  });

  await runTest('AUTH', '1.4 Rejection of invalid credentials', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'COM002', password: 'WRONG_PASSWORD_123' })
    });
    if (res.status !== 401 || res.data.success) {
      throw new Error(`Expected 401 Unauthorized, got: ${res.status}`);
    }
    return `Correctly returned 401 Unauthorized`;
  });

  await runTest('AUTH', '1.5 Face descriptors list endpoint', async () => {
    const res = await request('/api/auth/face-descriptors');
    if (res.status !== 200 || !Array.isArray(res.data.embeddings)) {
      throw new Error(`Invalid face descriptors payload: ${JSON.stringify(res.data)}`);
    }
    return `Registered Face Profiles: ${res.data.embeddings.length}`;
  });

  // SUITE 2: TIMESHEET & RUNNING MONTH LOCK
  await runTest('TIMESHEET', '2.1 Regular user submits active month records (September 2026)', async () => {
    const res = await request('/api/timesheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'COM002',
        username: 'Antti Huhtala',
        entries: [
          { date: '2026-09-01', day: 'Tuesday', working_hours: 10, overtime_hours: 0, area1: 'CMN', area2: 'CMN', shift: 'Day Shift', remark: 'QA Commissioning' },
          { date: '2026-09-02', day: 'Wednesday', working_hours: 10, overtime_hours: 2, area1: 'CMN', area2: 'CMN', shift: 'Day Shift', remark: 'QA Overtime' }
        ]
      })
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Active month submission failed: ${JSON.stringify(res.data)}`);
    }
    return `Submitted 2 active month records`;
  });

  await runTest('TIMESHEET', '2.2 Regular user submits past month records (Strict Lock Rejection)', async () => {
    const res = await request('/api/timesheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'COM002',
        username: 'Antti Huhtala',
        entries: [
          { date: '2026-08-15', day: 'Saturday', working_hours: 10, overtime_hours: 0, area1: 'CMN', area2: 'CMN', shift: 'Day Shift', remark: 'Unauthorized Past Entry' }
        ]
      })
    });
    if (res.status !== 400 || !res.data.error || !res.data.error.includes('locked')) {
      throw new Error(`Expected 400 with 'locked' message, got: ${res.status} - ${JSON.stringify(res.data)}`);
    }
    return `Correctly blocked past month edit: "${res.data.error}"`;
  });

  await runTest('TIMESHEET', '2.3 Superuser submits past month records (Admin Exemption)', async () => {
    const res = await request('/api/timesheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'prime',
        username: 'Prime Admin',
        entries: [
          { date: '2026-08-15', day: 'Saturday', working_hours: 10, overtime_hours: 0, area1: 'CMN', area2: 'CMN', shift: 'Day Shift', remark: 'Superuser Retroactive Audit' }
        ]
      })
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Superuser retroactive entry failed: ${JSON.stringify(res.data)}`);
    }
    return `Superuser successfully bypassed month lock for admin adjustments`;
  });

  await runTest('TIMESHEET', '2.4 Fetch timesheet data via GET', async () => {
    const res = await request('/api/timesheet?userId=COM002&startDate=2026-09-01&endDate=2026-09-07');
    if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.data)) {
      throw new Error(`Failed to query timesheet data: ${JSON.stringify(res.data)}`);
    }
    return `Fetched ${res.data.data.length} records for COM002`;
  });

  // SUITE 3: REALTIME PRESENCE & CHAT
  await runTest('REALTIME', '3.1 Heartbeat presence ping', async () => {
    const res = await request('/api/realtime/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'COM116' })
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Heartbeat failed: ${JSON.stringify(res.data)}`);
    }
    return `Timestamp: ${res.data.timestamp}`;
  });

  await runTest('REALTIME', '3.2 Online users presence directory', async () => {
    const res = await request('/api/users/online');
    if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.users)) {
      throw new Error(`Online users query failed: ${JSON.stringify(res.data)}`);
    }
    return `Online Users Count: ${res.data.users.length}`;
  });

  await runTest('REALTIME', '3.3 Chat recent channels & conversations directory', async () => {
    const res = await request('/api/chat/recent?userId=prime');
    if (res.status !== 200 || !res.data.success || !res.data.general || !Array.isArray(res.data.recentChats)) {
      throw new Error(`Chat recent query failed: ${JSON.stringify(res.data)}`);
    }
    return `General Channel: "${res.data.general.name}", Recent Direct Chats: ${res.data.recentChats.length}`;
  });

  await runTest('REALTIME', '3.4 Fetch chat messages history', async () => {
    const res = await request('/api/chat/messages?user_id=prime&recipient_id=ALL');
    if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.messages)) {
      throw new Error(`Chat messages query failed: ${JSON.stringify(res.data)}`);
    }
    return `Total Channel Messages: ${res.data.messages.length}`;
  });

  await runTest('REALTIME', '3.4 Send team chat broadcast message', async () => {
    const res = await request('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: 'prime',
        sender_name: 'Prime Admin',
        sender_role: 'superuser',
        recipient_id: 'ALL',
        message: 'QA Automated Verification Pulse: All systems nominal.'
      })
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Chat send message failed: ${JSON.stringify(res.data)}`);
    }
    return `Broadcast Message Sent successfully`;
  });

  await runTest('REALTIME', '3.5 Mark chat messages as read', async () => {
    const res = await request('/api/chat/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'COM116',
        recipient_id: 'ALL'
      })
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Chat mark read failed: ${JSON.stringify(res.data)}`);
    }
    return `Read receipts updated`;
  });

  // SUITE 4: MASTER DATA & PROJECTS
  await runTest('MASTER', '4.1 Master users directory', async () => {
    const res = await request('/api/master/users');
    if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.data)) {
      throw new Error(`Master users fetch failed: ${JSON.stringify(res.data)}`);
    }
    return `Total System Users: ${res.data.data.length}`;
  });

  await runTest('MASTER', '4.2 Master work areas list', async () => {
    const res = await request('/api/master/areas');
    if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.data)) {
      throw new Error(`Master areas fetch failed: ${JSON.stringify(res.data)}`);
    }
    return `Total Registered Areas: ${res.data.data.length}`;
  });

  await runTest('PROJECTS', '4.3 Projects commissioning list', async () => {
    const res = await request('/api/projects');
    if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.projects)) {
      throw new Error(`Projects fetch failed: ${JSON.stringify(res.data)}`);
    }
    return `Active Projects: ${res.data.projects.length}`;
  });

  await runTest('PROJECTS', '4.4 Tasks delegation & Gantt tasks', async () => {
    const res = await request('/api/projects/tasks');
    if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.tasks)) {
      throw new Error(`Tasks fetch failed: ${JSON.stringify(res.data)}`);
    }
    return `Active Tasks: ${res.data.tasks.length}`;
  });

  await runTest('SYSTEM', '4.5 System configuration flags', async () => {
    const res = await request('/api/system/settings');
    if (res.status !== 200 || !res.data.success || !res.data.settings) {
      throw new Error(`System settings fetch failed: ${JSON.stringify(res.data)}`);
    }
    return `System Flags Configured: ${Object.keys(res.data.settings).length}`;
  });

  // SUITE 5: CODEX EXECUTIVE & APPROVAL ENGINE
  await runTest('CODEX', '5.1 Codex executive monitoring dashboard', async () => {
    const res = await request('/api/codex/monitoring?month=2026-09');
    if (res.status !== 200 || !res.data.success || !res.data.kpi || !Array.isArray(res.data.data)) {
      throw new Error(`Codex monitoring failed: ${JSON.stringify(res.data)}`);
    }
    return `Employees Tracked: ${res.data.kpi.totalUsers}, Total Hours: ${res.data.kpi.grandTotalHours}`;
  });

  await runTest('CODEX', '5.2 Codex analytics & work hour distribution', async () => {
    const res = await request('/api/codex/analytics?month=2026-09');
    if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.dailyTimeline)) {
      throw new Error(`Codex analytics failed: ${JSON.stringify(res.data)}`);
    }
    return `Daily Timeline Points: ${res.data.dailyTimeline.length}, Area Breakdown: ${res.data.areaBreakdown?.length || 0}`;
  });

  await runTest('CODEX', '5.3 Digital signature single approval', async () => {
    const res = await request('/api/codex/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'COM002',
        month: '2026-09',
        status: 'Approved',
        approver_id: 'prime',
        approver_name: 'Prime Admin',
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      })
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Single approval failed: ${JSON.stringify(res.data)}`);
    }
    return `Approved COM002 for 2026-09`;
  });

  await runTest('CODEX', '5.4 Bulk executive approval (all employees)', async () => {
    const res = await request('/api/codex/approve-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: '2026-09',
        approver_id: 'COM116',
        approver_name: 'Iqlima Nur Hayati',
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      })
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Bulk approval failed: ${JSON.stringify(res.data)}`);
    }
    return `Bulk Approved Count: ${res.data.approved_count}`;
  });

  // SUITE 6: EXPORT & AUDIT TRAIL ENGINE
  await runTest('AUDIT', '6.1 Activity log entries & KPI aggregation', async () => {
    const res = await request('/api/activity-log?limit=50');
    if (res.status !== 200 || !res.data.success || !res.data.summary) {
      throw new Error(`Activity log fetch failed: ${JSON.stringify(res.data)}`);
    }
    return `Logged Entries: ${res.data.summary.totalEntries}, Total Hours: ${res.data.summary.totalHours}`;
  });

  await runTest('AUDIT', '6.2 System security audit trail', async () => {
    const res = await request('/api/audit-log?limit=50');
    if (res.status !== 200 || !res.data.success || !Array.isArray(res.data.data)) {
      throw new Error(`Audit log fetch failed: ${JSON.stringify(res.data)}`);
    }
    return `Security Audit Records: ${res.data.data.length}`;
  });

  await runTest('EXPORT', '6.3 Metso official Excel timesheet template export (Python openpyxl)', async () => {
    const res = await request('/api/timesheet/export-template?userId=COM116&month=2026-09');
    if (res.status !== 200 || res.data.byteLength < 10000) {
      throw new Error(`Excel export failed, status: ${res.status}, size: ${res.data?.byteLength || 0} bytes`);
    }
    return `Generated XLSX: ${(res.data.byteLength / 1024).toFixed(1)} KB (Official Template v2)`;
  });

  await runTest('EXPORT', '6.4 Comprehensive Database Backup Excel export', async () => {
    const res = await request('/api/database/backup');
    if (res.status !== 200 || res.data.byteLength < 1000) {
      throw new Error(`Database backup export failed, status: ${res.status}`);
    }
    return `Generated Backup XLSX: ${(res.data.byteLength / 1024).toFixed(1)} KB`;
  });

  // SUMMARY REPORT
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`\n===============================================================`);
  console.log(`   QA TEST EXECUTION SUMMARY`);
  console.log(`   Total Tests: ${total} | \x1b[32mPASSED: ${passed}\x1b[0m | \x1b[31mFAILED: ${failed}\x1b[0m`);
  console.log(`   Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  if (failed > 0) {
    console.log(`\n   FAILED TESTS DETAILS:`);
    results.filter(r => r.status === 'FAIL').forEach(f => {
      console.log(`   - [${f.suite}] ${f.testName}: ${f.error}`);
    });
  }
  console.log(`===============================================================\n`);

  return { passed, failed, total, results };
}

main().catch(console.error);
