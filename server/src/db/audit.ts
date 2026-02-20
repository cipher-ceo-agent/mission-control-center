import { nowIso } from "../utils/time.js";
import type { MccDb } from "./index.js";

export function logAudit(
  db: MccDb,
  action: string,
  target: string,
  outcome: "success" | "error",
  detail?: string
) {
  db.insertAudit({ at: nowIso(), action, target, outcome, detail });
}
