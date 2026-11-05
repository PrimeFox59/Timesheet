# 📐 Metso Timesheet Commissioning Management System (CMS)
## Production Architecture & Operational Runbook (Single Source of Truth)

---

### 1. Network & Routing Matrix
| Domain / URL | Target Endpoint | Description |
| :--- | :--- | :--- |
| **`https://ts.primeprojectx.net`** | Cloudflare Tunnel $\rightarrow$ `127.0.0.1:8565` | Global public access (mobile, cellular, external WiFi) |
| **`http://192.168.3.122:8565`** | Direct Local LAN (DEV20) | Ultra-fast local workshop/office access (< 1ms) |
| **`http://localhost:8565`** | Internal loopback on DEV20 | PM2 Next.js production process |

---

### 2. Service Management (PM2 on DEV20)
| Service Name | Working Directory | Runtime / Port | Role |
| :--- | :--- | :--- | :--- |
| **`timesheet-metso`** | `D:\0 Running apps\Timesheet\nextjs-app` | Node.js / **Port 8565** | Core Timesheet Web Application |
| **`cloudflared-tunnel`** | `D:\0 Running apps` | Node runner (`tunnel_runner.js`) | Ingress tunnel to `ts.primeprojectx.net` |
| **`agy-control-center`** | `D:\0 Running apps\agy-integration-hub` | Node.js / **Port 5678** | Central Integration Dashboard |
| **`dev20-webhook-deployer`**| `D:\0 Running apps\webhook-deployer` | Python / **Port 9005** | CI/CD Auto-Deploy Webhook Server |

---

### 3. Critical Architectural Directives for AI Agents
1. **Never kill other PM2 processes:** When restarting `timesheet-metso`, use `pm2 restart timesheet-metso` or `pm2 start ecosystem.config.js --only timesheet-metso`.
2. **Never change superuser roles:** `prime` and `COM116` are permanently superusers.
3. **Never allow regular users to edit past months:** Active month lock is enforced by server in `POST /api/timesheet`.
4. **Never drop the ExcelJS export implementation:** Keeps export 100% operational without Python.
5. **Always preserve GMT+07:00 (WIB) standard:** In SQLite default timestamps and `dateUtils.ts`.
