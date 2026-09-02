import path from 'path';

const dbPath = path.join(process.cwd(), 'timesheet.db');

let db: any;

try {
  // 1. Try better-sqlite3 first
  const BetterDatabase = eval("require")("better-sqlite3");
  const candidateDb = new BetterDatabase(dbPath, { timeout: 15000 });
  if (typeof candidateDb.transaction === 'function') {
    db = candidateDb;
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 15000');
    db.pragma('synchronous = NORMAL');
    db.pragma('temp_store = MEMORY');
    db.pragma('cache_size = -64000');
  } else {
    throw new Error("better-sqlite3 instance missing transaction method");
  }
} catch (betterErr) {
  try {
    // 2. Seamless fallback to Node.js native node:sqlite (Node 22.5+ / Node 24+)
    const { DatabaseSync } = eval("require")("node:sqlite");
    const rawDb = new DatabaseSync(dbPath);
    db = {
      raw: rawDb,
      exec: (sql: string) => rawDb.exec(sql),
      pragma: (pragmaSql: string) => {
        try {
          rawDb.exec(`PRAGMA ${pragmaSql};`);
        } catch (e) {}
      },
      prepare: (sql: string) => {
        const stmt = rawDb.prepare(sql);
        return {
          all: (...params: any[]) => stmt.all(...params),
          get: (...params: any[]) => stmt.get(...params),
          run: (...params: any[]) => stmt.run(...params)
        };
      },
      transaction: (fn: (...args: any[]) => any) => {
        return (...args: any[]) => {
          rawDb.exec('BEGIN TRANSACTION;');
          try {
            const res = fn(...args);
            rawDb.exec('COMMIT;');
            return res;
          } catch (txErr) {
            try {
              rawDb.exec('ROLLBACK;');
            } catch (rbErr) {}
            throw txErr;
          }
        };
      }
    };
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 15000');
    db.pragma('synchronous = NORMAL');
    db.pragma('temp_store = MEMORY');
  } catch (nativeErr) {
    console.error("Failed to connect to SQLite database (both better-sqlite3 and node:sqlite failed):", betterErr, nativeErr);
    throw betterErr;
  }
}

let isInitialized = false;

// Initialize tables and indexes
export function initDb() {
  if (isInitialized) return;
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Member',
      grade TEXT DEFAULT 'A',
      preferred_areas TEXT DEFAULT 'CMN',
      preferred_shift TEXT DEFAULT 'Day Shift',
      number_of_areas INTEGER DEFAULT 2,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      last_active TEXT DEFAULT '',
      face_descriptor TEXT DEFAULT '',
      face_photo TEXT DEFAULT '',
      face_registered_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS presensi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      date TEXT NOT NULL,
      day TEXT NOT NULL,
      hours REAL NOT NULL DEFAULT 8,
      working_hours REAL NOT NULL DEFAULT 8,
      overtime REAL NOT NULL DEFAULT 0,
      overtime_hours REAL NOT NULL DEFAULT 0,
      area1 TEXT DEFAULT '',
      area2 TEXT DEFAULT '',
      area3 TEXT DEFAULT '',
      area4 TEXT DEFAULT '',
      shift TEXT DEFAULT 'Day Shift',
      remark TEXT DEFAULT '',
      submission_timestamp TEXT NOT NULL DEFAULT (datetime('now', '+7 hours')),
      timestamp TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      details TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Success'
    );

    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      month TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Approved',
      approver_id TEXT NOT NULL,
      approver_name TEXT NOT NULL,
      signature_data TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      UNIQUE(user_id, month)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      area TEXT DEFAULT 'CMN',
      status TEXT DEFAULT 'In Progress',
      priority TEXT DEFAULT 'Medium',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      budget_hours REAL DEFAULT 0,
      manager_id TEXT DEFAULT '',
      manager_name TEXT DEFAULT '',
      created_by TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      invited_by TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours')),
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      area TEXT DEFAULT 'CMN',
      assignee_id TEXT NOT NULL,
      assignee_name TEXT NOT NULL,
      delegated_by TEXT NOT NULL,
      delegated_by_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      duration_days INTEGER DEFAULT 1,
      progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'To Do',
      priority TEXT DEFAULT 'Medium',
      estimated_hours REAL DEFAULT 0,
      actual_hours REAL DEFAULT 0,
      color TEXT DEFAULT '#FF6B00',
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_msg_id TEXT DEFAULT '',
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_role TEXT DEFAULT 'Member',
      recipient_id TEXT NOT NULL DEFAULT 'ALL',
      message TEXT NOT NULL,
      read_by TEXT DEFAULT '',
      file_url TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      file_type TEXT DEFAULT '',
      timestamp TEXT NOT NULL DEFAULT (datetime('now', '+7 hours')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+7 hours'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now', '+7 hours'))
    );

    -- Create High Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_presensi_user_date ON presensi(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_presensi_date ON presensi(date DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);
    CREATE INDEX IF NOT EXISTS idx_areas_name ON areas(name);
    CREATE INDEX IF NOT EXISTS idx_approvals_user_month ON approvals(user_id, month);
    CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient ON chat_messages(recipient_id);
  `);

    // Seed default system settings
    const defaultSettings = [
      ['menu_timesheet', 'true', 'Enable Timesheet Core Module in navigation'],
      ['menu_project_manager', 'true', 'Enable Project Manager Module in navigation'],
      ['menu_codex', 'true', 'Enable Codex Executive Module in navigation'],
      ['menu_user_management', 'true', 'Enable User Management & Directory Module in navigation'],
      ['menu_audit_log', 'true', 'Enable System Security Audit Trail Module in navigation'],
      ['menu_database', 'true', 'Enable Database Management & Migration Portal in navigation'],
      ['enable_face_login', 'true', 'Enable AI Face ID login biometrics on login portal'],
      ['enable_face_registration', 'true', 'Allow AI Face ID registration in user profile'],
      ['feature_realtime_chat', 'true', 'Enable Real-time Team Live Chat Widget'],
      ['feature_online_users', 'true', 'Enable Live Online Presence Sidebar'],
      ['enable_realtime_socket', 'true', 'Enable SSE stream live presence synchronization'],
      ['enable_workhour_analytics', 'true', 'Enable Work Hour Analytics Dashboard'],
      ['feature_excel_export', 'true', 'Enable Metso formatted Excel Timesheet template export'],
      ['feature_gantt_chart', 'true', 'Enable Interactive Gantt Timeline Engine in Project Manager'],
      ['feature_activity_log', 'true', 'Enable Submission Activity History Sub-menu in Timesheet'],
      ['enable_retroactive_entry', 'true', 'Allow retroactive timesheet entry for past dates'],
      ['allow_overtime_entry', 'true', 'Allow employees to enter overtime hours']
    ];

    for (const [k, v, desc] of defaultSettings) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO system_settings (key, value, description, updated_at)
          VALUES (?, ?, ?, datetime('now'))
        `).run(k, v, desc);
      } catch (e) {}
    }

    // Dynamic migration for users columns
    try {
      const userColumns = (db.prepare("PRAGMA table_info(users)").all() as any[]).map(c => c.name);
      if (!userColumns.includes('phone')) { try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT '';"); } catch (e) {} }
      if (!userColumns.includes('email')) { try { db.exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT '';"); } catch (e) {} }
      if (!userColumns.includes('avatar')) { try { db.exec("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '';"); } catch (e) {} }
      if (!userColumns.includes('last_active')) { try { db.exec("ALTER TABLE users ADD COLUMN last_active TEXT DEFAULT '';"); } catch (e) {} }
      if (!userColumns.includes('face_descriptor')) { try { db.exec("ALTER TABLE users ADD COLUMN face_descriptor TEXT DEFAULT '';"); } catch (e) {} }
      if (!userColumns.includes('face_photo')) { try { db.exec("ALTER TABLE users ADD COLUMN face_photo TEXT DEFAULT '';"); } catch (e) {} }
      if (!userColumns.includes('face_registered_at')) { try { db.exec("ALTER TABLE users ADD COLUMN face_registered_at TEXT DEFAULT '';"); } catch (e) {} }
    } catch (e) {}

    isInitialized = true;
  } catch (e: any) {
    if (e?.message?.includes('locked') || e?.code === 'ERR_SQLITE_ERROR') {
      // Graceful fallback during Next.js parallel static build workers
    } else {
      console.warn('initDb notice:', e?.message || e);
    }
  }
}

initDb();

export default db;
