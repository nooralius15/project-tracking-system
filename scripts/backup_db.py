"""
scripts/backup_db.py
Automated Hot Database Backup & Retention Script for IT Operations.
Uses SQLite's online backup API to take non-blocking, zero-downtime hot backups.
Enforces configurable retention rotation (default: 7 days).
"""
from __future__ import annotations

import argparse
import datetime
import gzip
import logging
import os
import shutil
import sqlite3
import sys
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("backup_db")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
try:
    from constants import DB_PATH
    DEFAULT_DB = Path(__file__).resolve().parent.parent / DB_PATH
except Exception:
    DEFAULT_DB = Path(__file__).resolve().parent.parent / "project_tracker.db"

DEFAULT_BACKUP_DIR = Path(__file__).resolve().parent.parent / "backups"


def perform_hot_backup(db_path: Path, backup_dir: Path, compress: bool = True) -> Path:
    """Execute SQLite online hot backup without blocking live writes."""
    if not db_path.exists():
        raise FileNotFoundError(f"Source database not found: {db_path}")

    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    raw_backup_path = backup_dir / f"capstone_backup_{timestamp}.db"

    logger.info("Starting online hot backup from %s to %s", db_path, raw_backup_path)

    # Use SQLite's online backup API (safe for active WAL databases)
    src_conn = sqlite3.connect(str(db_path), timeout=30.0)
    dst_conn = sqlite3.connect(str(raw_backup_path))
    try:
        with dst_conn:
            src_conn.backup(dst_conn, pages=100, sleep=0.01)
        logger.info("SQLite online backup page copy completed successfully.")
    finally:
        dst_conn.close()
        src_conn.close()

    final_path = raw_backup_path
    if compress:
        compressed_path = backup_dir / f"capstone_backup_{timestamp}.db.gz"
        logger.info("Compressing backup to %s...", compressed_path.name)
        with open(raw_backup_path, "rb") as f_in, gzip.open(compressed_path, "wb", compresslevel=9) as f_out:
            shutil.copyfileobj(f_in, f_out)
        raw_backup_path.unlink()  # Remove uncompressed file
        final_path = compressed_path

    size_kb = final_path.stat().st_size / 1024.0
    logger.info("Backup created: %s (Size: %.2f KB)", final_path.name, size_kb)
    return final_path


def apply_retention_policy(backup_dir: Path, retention_days: int = 7) -> int:
    """Purge backups older than retention_days."""
    if not backup_dir.exists():
        return 0

    now = datetime.datetime.now()
    cutoff_time = now - datetime.timedelta(days=retention_days)
    purged_count = 0

    logger.info("Applying retention policy: Purging backups older than %d days (before %s)", retention_days, cutoff_time)
    for item in backup_dir.glob("capstone_backup_*"):
        if item.is_file():
            file_mtime = datetime.datetime.fromtimestamp(item.stat().st_mtime)
            if file_mtime < cutoff_time:
                logger.info("Purging expired backup: %s (Date: %s)", item.name, file_mtime)
                item.unlink()
                purged_count += 1

    logger.info("Retention sweep finished: %d backup(s) purged.", purged_count)
    return purged_count


def main():
    parser = argparse.ArgumentParser(description="Automated SQLite Database Backup & Retention Tool")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="Path to source SQLite database")
    parser.add_argument("--dest", type=Path, default=DEFAULT_BACKUP_DIR, help="Destination directory for backups")
    parser.add_argument("--retention-days", type=int, default=7, help="Days to retain backups before purging")
    parser.add_argument("--no-compress", action="store_true", help="Do not gzip the backup")

    args = parser.parse_args()

    try:
        perform_hot_backup(args.db, args.dest, compress=not args.no_compress)
        apply_retention_policy(args.dest, retention_days=args.retention_days)
        logger.info("Database backup and maintenance completed successfully.")
        sys.exit(0)
    except Exception as exc:
        logger.exception("Backup failed: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
