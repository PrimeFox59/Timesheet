import path from 'path';

// Dynamically require better-sqlite3 at runtime to avoid Webpack native binary bundling issue
const Database = eval("require")("better-sqlite3");

const dbPath = path.join(process.cwd(), 'timesheet.db');


let db: any;

try {
  db = new Database(dbPath);
  // High performance SQLite tuning
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  db.pragma('cache_size = -64000'); // 64MB cache
} catch (e) {
  console.error("Failed to connect to SQLite database:", e);
  throw e;
}

// Initialize tables and indexes
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Member',
      grade TEXT DEFAULT 'A',
      preferred_areas TEXT DEFAULT 'CMN',
      preferred_shift TEXT DEFAULT 'Day Shift',
      number_of_areas INTEGER DEFAULT 2
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
      submission_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
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

    -- Create High Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_presensi_user_date ON presensi(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_presensi_date ON presensi(date DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);
    CREATE INDEX IF NOT EXISTS idx_areas_name ON areas(name);
    CREATE INDEX IF NOT EXISTS idx_approvals_user_month ON approvals(user_id, month);
  `);

  // Ensure missing columns are dynamically added if table already existed from older schema
  const presensiColumns = (db.prepare("PRAGMA table_info(presensi)").all() as any[]).map(c => c.name);

  if (!presensiColumns.includes('working_hours')) {
    try { db.exec("ALTER TABLE presensi ADD COLUMN working_hours REAL DEFAULT 8;"); } catch (e) {}
  }
  if (!presensiColumns.includes('hours')) {
    try { db.exec("ALTER TABLE presensi ADD COLUMN hours REAL DEFAULT 8;"); } catch (e) {}
  }
  if (!presensiColumns.includes('overtime')) {
    try { db.exec("ALTER TABLE presensi ADD COLUMN overtime REAL DEFAULT 0;"); } catch (e) {}
  }
  if (!presensiColumns.includes('overtime_hours')) {
    try { db.exec("ALTER TABLE presensi ADD COLUMN overtime_hours REAL DEFAULT 0;"); } catch (e) {}
  }
  if (!presensiColumns.includes('submission_timestamp')) {
    try { db.exec("ALTER TABLE presensi ADD COLUMN submission_timestamp TEXT DEFAULT (datetime('now'));"); } catch (e) {}
  }

  // Dynamic migration for audit_log columns
  const auditColumns = (db.prepare("PRAGMA table_info(audit_log)").all() as any[]).map(c => c.name);
  if (!auditColumns.includes('description')) {
    try { db.exec("ALTER TABLE audit_log ADD COLUMN description TEXT DEFAULT '';"); } catch (e) {}
  }
  if (!auditColumns.includes('details')) {
    try { db.exec("ALTER TABLE audit_log ADD COLUMN details TEXT DEFAULT '';"); } catch (e) {}
  }

  // Dynamic migration for users columns (phone, email, avatar)
  const userColumns = (db.prepare("PRAGMA table_info(users)").all() as any[]).map(c => c.name);
  if (!userColumns.includes('phone')) {
    try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT '';"); } catch (e) {}
  }
  if (!userColumns.includes('email')) {
    try { db.exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT '';"); } catch (e) {}
  }
  if (!userColumns.includes('avatar')) {
    try { db.exec("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '';"); } catch (e) {}
  }
}

// Auto-run schema initialization on module load
initDb();

export default db;
