# 🏛️ METSO TIMESHEET CMS — AGENT MEMORY & ARCHITECTURE SSOT

> **CRITICAL INSTRUCTION FOR ALL AI AGENTS & DEVELOPERS:**  
> This file contains the **IMMUTABLE ARCHITECTURAL RULES, DEPLOYMENT POLICIES, AND WORKFLOW CONSTRAINTS** for the Metso Timesheet Commissioning Management System.  
> **DO NOT** modify, break, or diverge from these established patterns without explicit user instruction.

---

## 1. 🖥️ Host Infrastructure & Deployment Architecture

### ⚠️ SINGLE SOURCE OF TRUTH HOST: PC DEV20 (100% LOCAL & PUBLIC)
- **Primary Production Host:** **PC DEV20** (LAN IP: `192.168.3.122`)
- **App Working Directory on DEV20:** `D:\0 Running apps\Timesheet\nextjs-app`
- **Database Location:** `D:\0 Running apps\Timesheet\timesheet.db` (SQLite Single Source of Truth)
- **Application Port:** **`8565`** (`http://192.168.3.122:8565`)
- **Public Domain Routing:** **`https://ts.primeprojectx.net`**
  - Traffic enters via **Cloudflare Global Edge** and is routed directly to DEV20 via **Cloudflare Ingress Tunnel** (`ffe7c378-83bb-4e3c-a141-9e7e072f4b84`).
  - **NO EXTERNAL VPS DEPENDENCY.** The active database and compute run 100% on DEV20.

---

## 2. ⚙️ PM2 & Master Multi-App Ecosystem Management

### ⚠️ NEVER WIPE THE MASTER PM2 CONFIGURATION!
DEV20 hosts **18 enterprise services** simultaneously. When deploying or updating the Timesheet app, **DO NOT** execute an isolated `pm2 start` that deletes other running applications.

- **Master PM2 Config File:** `D:\0 Running apps\ecosystem.config.js`
- **Standard Deployment Batch Command for Timesheet on DEV20:**
  ```cmd
  cd /d "D:\0 Running apps\Timesheet"
  git fetch origin main
  git reset --hard origin/main
  cd nextjs-app
  call npm run build
  cd /d "D:\0 Running apps"
  call pm2 restart timesheet-metso
  call pm2 save
  ```

### 🔒 Cloudflare Tunnel Singleton Rule
- The tunnel daemon MUST run as a singleton managed by `D:\0 Running apps\tunnel_runner.js`.
- `tunnel_runner.js` contains automatic `taskkill /F /IM cloudflared.exe` cleanup and process signal handlers (`SIGINT`, `SIGTERM`, `exit`) to prevent zombie processes and tunnel flapping.
- **NEVER** launch manual `cloudflared.exe` instances outside PM2.

---

## 3. 🔐 Core Business Rules & RBAC Matrix

### 👑 Permanent Superuser Immutable Rule
The following accounts are hardcoded permanent administrators with bypass privileges:
1. **`prime`** (Password: `zzz`) — Role: `superuser`
2. **`COM116`** (Password: `Metso` / Username: `Iqlima Nur Hayati`) — Role: `superuser`
- **Rule:** They MUST always resolve to `role = 'superuser'`. No password reset or database migration may ever demote them.
- **Export Button:** The Excel Export template button in the UI is strictly visible to users with `role === 'superuser'` (or `prime` / `COM116`).

### 📅 Active Running Month Lock Rule
1. **Regular Members / Engineers:**
   - Permitted to input, edit, or submit timesheet hours **ONLY for dates in the currently running calendar month (WIB GMT+07:00)** (e.g. `2026-09-01` to `2026-09-30`).
   - Any submission attempting to write to previous months (e.g. `2026-08`) is strictly rejected by `POST /api/timesheet` with HTTP 400.
   - **Read-Only Past Viewing:** Regular members CAN freely select and inspect previous months in Read-Only view mode (`isDateEditable = false`, locked inputs).
2. **Superuser Exception:**
   - `prime` and `COM116` possess administrative bypass rights to make retroactive adjustments to any past month.

---

## 4. ⏰ Timezone Standardization: GMT+07:00 (WIB / `Asia/Jakarta`)

All date evaluations, defaults, logs, and clocks MUST strictly observe **GMT+07:00 (WIB)**:
- **Database Default Timestamps:** `DEFAULT (datetime('now', '+7 hours'))` in SQLite schemas.
- **Server Utility:** Import and use helper functions from [`src/lib/dateUtils.ts`](file:///D:/0/Pre%20Deploy/Timesheet/nextjs-app/src/lib/dateUtils.ts):
  - `getWibTimestamp()` $\rightarrow$ `YYYY-MM-DD HH:mm:ss`
  - `getWibDateStr()` $\rightarrow$ `YYYY-MM-DD`
  - `getWibMonthStr()` $\rightarrow$ `YYYY-MM`
- **Working Schedule:** Monday through Saturday are regular 10-hour working days (`font-medium text-slate-700`). **ONLY Sunday** is formatted as the weekly off-day (`font-bold text-amber-700`).
- **Navbar UI:** Features a live ticking digital clock with `WIB (GMT+7)` status pill.

---

## 5. 📊 Excel Export Engine Architecture (Zero Dependency)

- **Route:** `GET /api/timesheet/export-template?userId=...&month=...`
- **Dual-Engine Strategy:**
  1. **Primary Node.js Engine:** Pure `exceljs` implementation that reads `Timesheet_Template_v2.xlsx`, populates all 31-day rows, daily work types (`WORK`, `WEEKLY OFF`, `ROTATION`, `SICK`, `TRAVEL`, `HOLIDAY`), hours, and embeds transparent digital signatures without needing Python.
  2. **Python Fallback:** Uses `scripts/export_metso_template.py` with `openpyxl` and `Pillow` if Python is present.
- **Result:** Export works with 100% certainty across Windows, Linux, and macOS environments.

---

## 6. ⚡ Real-Time SSE Engine & Memory Safety

- **Route:** `GET /api/realtime/stream` (Server-Sent Events)
- **Listener Cap:** `globalEventEmitter.setMaxListeners(0)` set in `src/lib/events.ts`.
- **Stream Cleanup:** `ReadableStream` must include `cancel()` handler to unsubscribe listeners and clear `keepalive` heartbeat intervals upon browser tab disconnection.
- **Proxy Header:** `X-Accel-Buffering: no` must remain set for zero-latency SSE streaming through Nginx/Cloudflare.

---

## 7. 🧪 Automated QA Verification Suite

Before pushing any major change, always run the automated QA test suite:
```bash
# In nextjs-app directory
node scripts/comprehensive_qa_test.js
```
The suite runs 28 integration test cases covering:
1. Authentication & RBAC validation
2. Running month lock rejection & bypass
3. Realtime presence & chat broadcast
4. Master data & project delegation
5. Codex executive monitoring & digital signature approval
6. Official Metso Excel & DB Backup generation
7. Timezone consistency checks

---

## 8. 🔍 CodeGraph First Exploration Policy

When inspecting or maintaining this codebase:
1. Run `codegraph sync` to update the AST graph.
2. Use `codegraph explore "<query>"` for targeted symbol discovery before reading large files.
3. Use `codegraph node <symbol_or_file>` to analyze dependencies and caller hierarchies.
