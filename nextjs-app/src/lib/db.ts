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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      invited_by TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
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
    ['menu_project_manager', 'true', 'Tampilkan menu Project Manager di navigasi'],
    ['feature_realtime_chat', 'true', 'Aktifkan widget Chat Tim Komisioning'],
    ['feature_online_users', 'true', 'Aktifkan sidebar User Online & Live Presence'],
    ['enable_face_login', 'true', 'Aktifkan login biometrik AI Face ID di layar login'],
    ['enable_face_registration', 'true', 'Izinkan pendaftaran AI Face ID di profil user'],
    ['enable_codex_approval', 'true', 'Aktifkan modul Codex Monitoring & Digital Signature'],
    ['enable_workhour_analytics', 'true', 'Aktifkan Dashboard Analitik Jam Kerja'],
    ['enable_audit_log', 'true', 'Aktifkan pencatatan & pemantauan System Audit Trail'],
    ['enable_database_migration', 'true', 'Aktifkan modul Database Backup, Restore & Excel Migration'],
    ['enable_realtime_socket', 'true', 'Aktifkan sinkronisasi real-time SSE stream online status'],
    ['enable_retroactive_entry', 'true', 'Izinkan pengisian absensi mundur (tanggal lewat)'],
    ['allow_overtime_entry', 'true', 'Izinkan pengisian jam lembur karyawan']
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
  const userColumns = (db.prepare("PRAGMA table_info(users)").all() as any[]).map(c => c.name);
  if (!userColumns.includes('phone')) { try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT '';"); } catch (e) {} }
  if (!userColumns.includes('email')) { try { db.exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT '';"); } catch (e) {} }
  if (!userColumns.includes('avatar')) { try { db.exec("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '';"); } catch (e) {} }
  if (!userColumns.includes('last_active')) { try { db.exec("ALTER TABLE users ADD COLUMN last_active TEXT DEFAULT '';"); } catch (e) {} }
  if (!userColumns.includes('face_descriptor')) { try { db.exec("ALTER TABLE users ADD COLUMN face_descriptor TEXT DEFAULT '';"); } catch (e) {} }
  if (!userColumns.includes('face_photo')) { try { db.exec("ALTER TABLE users ADD COLUMN face_photo TEXT DEFAULT '';"); } catch (e) {} }
  if (!userColumns.includes('face_registered_at')) { try { db.exec("ALTER TABLE users ADD COLUMN face_registered_at TEXT DEFAULT '';"); } catch (e) {} }
}

initDb();

export default db;
