# 🛡️ IT Operations Runbook: Backup & Disaster Recovery (DR)

> **System:** Bitirme Projesi Takip (Capstone Project Tracking Infrastructure)  
> **Classification:** IT Operations / System Administration / Security  
> **Recovery Point Objective (RPO):** $< 24$ hours (Daily scheduled snapshots)  
> **Recovery Time Objective (RTO):** $< 5$ minutes (Automated hot-restore drill)  
> **Target Audience:** Systems Administrators, DevOps Engineers, IT Operations

---

## 1. Overview & Architecture

The Capstone Project Tracking System persists all relational user records, task assignments, milestone deliverables, and audit logs inside a hardened SQLite database running in **WAL (Write-Ahead Logging)** mode.

```
┌─────────────────────────┐          ┌──────────────────────────┐          ┌─────────────────────────┐
│   Active Database       │          │   Online Hot Backup      │          │   Compressed Archive    │
│  (project_tracker.db)   │ ───────> │  (scripts/backup_db.py)  │ ───────> │  (/backups/*.db.gz)     │
│   WAL Mode Enabled      │          │   Page-by-page copy      │          │   7-Day Retention Pool  │
└─────────────────────────┘          └──────────────────────────┘          └─────────────────────────┘
```

---

## 2. Automated Backup Execution

### A. Manual / Ad-hoc Backup
Run the backup script directly from the project root:
```bash
python scripts/backup_db.py
```

### B. Command-line Options
```bash
python scripts/backup_db.py --help
# Options:
#   --db PATH               Path to SQLite database (default: project_tracker.db)
#   --dest PATH             Backup destination directory (default: backups/)
#   --retention-days INT    Number of days to keep backups (default: 7)
#   --no-compress           Disable gzip compression
```

### C. Automated Cron / Scheduled Task Configuration

#### Linux / Docker (Crontab)
To execute automated daily backups at 02:00 AM:
```cron
0 2 * * * cd /app && /usr/local/bin/python scripts/backup_db.py --retention-days 14 >> /var/log/backup.log 2>&1
```

#### Windows Task Scheduler (PowerShell)
```powershell
$Action = New-ScheduledTaskAction -Execute "python.exe" -Argument "scripts/backup_db.py" -WorkingDirectory "C:\app"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "CapstoneDB_Backup" -Action $Action -Trigger $Trigger
```

---

## 3. Disaster Recovery & Restoration Drill (Step-by-Step)

If the active database experiences data corruption, accidental deletion, or catastrophic hardware failure, execute the following recovery procedure:

### Step 1: Isolate the Service
Stop the live application to prevent concurrent dirty writes:
```bash
# Docker Compose
docker-compose down

# Or Standalone Process
pkill -f "uvicorn server:app"
```

### Step 2: Identify the Target Backup
List available backups in chronological order:
```bash
ls -lh backups/
# capstone_backup_20260926_134616.db.gz
```

### Step 3: Extract and Restore
Decompress the latest verified snapshot into the active database location:
```bash
# Backup existing corrupted DB if present
mv project_tracker.db project_tracker.db.corrupted_$(date +%s)

# Decompress and restore
gzip -dc backups/capstone_backup_20260926_134616.db.gz > project_tracker.db
```

### Step 4: Verify Database Integrity
Run SQLite PRAGMA integrity check before restarting service:
```bash
python -c "import sqlite3; conn = sqlite3.connect('project_tracker.db'); print(conn.execute('PRAGMA integrity_check;').fetchall())"
# Expected output: [('ok',)]
```

### Step 5: Resume Application & Health Probe
```bash
# Restart container or service
docker-compose up -d

# Verify system health
curl -f http://localhost:8000/api/health
# Expected output: {"status":"ok","app":"Bitirme Projesi Takip API","version":"2.0.0"}
```

---

## 4. Emergency Contacts & Escalation Matrix

| Role | Responsibility | Escalation Trigger |
|---|---|---|
| **L1 IT Support** | Run ad-hoc backup, monitor `/api/health` | Service unresponsive $> 2$ minutes |
| **L2 SysAdmin / DBA** | Database restoration drill, disk expansion | SQLite I/O errors or disk $> 90\%$ |
| **L3 Lead Engineer** | Application bugs, migration scripts | Schema conflict or data corruption |
