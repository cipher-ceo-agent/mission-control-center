import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type AuditRecord = {
  at: string;
  action: string;
  target: string;
  outcome: "success" | "error";
  detail?: string;
};

export class MccDb {
  private db: DatabaseSync;

  constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        outcome TEXT NOT NULL,
        detail TEXT
      );

      CREATE TABLE IF NOT EXISTS ui_prefs (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  insertAudit(record: AuditRecord) {
    const stmt = this.db.prepare(
      `INSERT INTO audit_log (at, action, target, outcome, detail)
       VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(record.at, record.action, record.target, record.outcome, record.detail ?? null);
  }

  listAudit(limit = 200) {
    const stmt = this.db.prepare(
      `SELECT id, at, action, target, outcome, detail
       FROM audit_log ORDER BY id DESC LIMIT ?`
    );
    return stmt.all(limit);
  }
}
