import { z } from "zod";
import type { ServerPlugin } from "../../types.js";
import { logAudit } from "../../db/audit.js";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().min(1).optional(),
  schedule: z
    .object({
      kind: z.enum(["at", "every", "cron"]).optional(),
      at: z.string().optional(),
      everyMs: z.number().optional(),
      expr: z.string().optional(),
      tz: z.string().optional()
    })
    .optional()
});

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "unknown error";
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }

  const n = new Date(String(value)).getTime();
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n).toISOString();
}

function normalizeJob(job: any) {
  const state = job?.state ?? {};
  const id = String(job?.jobId ?? job?.id ?? "");

  return {
    ...job,
    id,
    jobId: id,
    enabled: Boolean(job?.enabled),
    name: job?.name ?? id,
    schedule: job?.schedule ?? null,
    nextRunAt: toIso(job?.nextRunAt ?? state?.nextRunAtMs),
    lastRunAt: toIso(job?.lastRunAt ?? state?.lastRunAtMs ?? state?.runAtMs),
    lastStatus: job?.lastStatus ?? state?.lastStatus ?? null,
    consecutiveErrors: Number(job?.consecutiveErrors ?? state?.consecutiveErrors ?? 0)
  };
}

function normalizeJobs(raw: any): any[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.jobs)
      ? raw.jobs
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.entries)
          ? raw.entries
          : [];

  return list.map(normalizeJob);
}

function normalizeRun(run: any, idx: number) {
  const runAtMs = typeof run?.runAtMs === "number" ? run.runAtMs : undefined;
  const durationMs = typeof run?.durationMs === "number" ? run.durationMs : undefined;

  return {
    ...run,
    runId: run?.runId ?? `${run?.jobId ?? "run"}-${run?.ts ?? runAtMs ?? idx}`,
    status: run?.status ?? run?.state ?? run?.action ?? "unknown",
    startedAt: toIso(run?.startedAt ?? run?.startedAtMs ?? runAtMs ?? run?.ts),
    finishedAt: toIso(
      run?.finishedAt ?? run?.finishedAtMs ?? (runAtMs && durationMs ? runAtMs + durationMs : undefined)
    ),
    nextRunAt: toIso(run?.nextRunAt ?? run?.nextRunAtMs),
    durationMs: durationMs ?? null
  };
}

function normalizeRuns(raw: any): any[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.runs)
      ? raw.runs
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.entries)
          ? raw.entries
          : Array.isArray(raw?.history)
            ? raw.history
            : [];

  return list.map(normalizeRun);
}

export const calendarPlugin: ServerPlugin = {
  id: "calendar",
  async register({ app, gateway, db }) {
    app.get("/api/calendar/cron", async (_req, reply) => {
      try {
        const jobs = await gateway.invokeTool("cron", { action: "list", includeDisabled: true });
        return { jobs: normalizeJobs(jobs) };
      } catch (err) {
        reply.code(502);
        return { error: `Failed to load cron jobs: ${errorMessage(err)}`, jobs: [] };
      }
    });

    app.post("/api/calendar/cron", async (req, reply) => {
      try {
        const body = req.body as { job: any };
        const out = await gateway.invokeTool("cron", { action: "add", job: body.job });
        logAudit(db, "cron.add", body.job?.name ?? "unnamed", "success", JSON.stringify(out));
        return out;
      } catch (err: any) {
        logAudit(db, "cron.add", "unknown", "error", err?.message);
        reply.code(400);
        return { error: err?.message ?? "failed" };
      }
    });

    app.patch<{ Params: { id: string } }>("/api/calendar/cron/:id", async (req, reply) => {
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: parsed.error.flatten() };
      }

      try {
        const out = await gateway.invokeTool("cron", {
          action: "update",
          jobId: req.params.id,
          patch: parsed.data
        });
        logAudit(db, "cron.update", req.params.id, "success", JSON.stringify(parsed.data));
        return out;
      } catch (err: any) {
        logAudit(db, "cron.update", req.params.id, "error", err?.message);
        reply.code(400);
        return { error: err?.message ?? "failed" };
      }
    });

    app.patch("/api/calendar/cron", async (req, reply) => {
      const body = (req.body ?? {}) as { id?: string; jobId?: string; patch?: unknown };
      const id = body.id ?? body.jobId;
      if (!id) {
        reply.code(400);
        return { error: "Missing id/jobId" };
      }

      const parsed = patchSchema.safeParse(body.patch ?? req.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: parsed.error.flatten() };
      }

      try {
        const out = await gateway.invokeTool("cron", {
          action: "update",
          jobId: id,
          patch: parsed.data
        });
        logAudit(db, "cron.update", id, "success", JSON.stringify(parsed.data));
        return out;
      } catch (err: any) {
        logAudit(db, "cron.update", id, "error", err?.message);
        reply.code(400);
        return { error: err?.message ?? "failed" };
      }
    });

    app.post<{ Params: { id: string } }>("/api/calendar/cron/:id/run", async (req, reply) => {
      try {
        const out = await gateway.invokeTool("cron", { action: "run", jobId: req.params.id, runMode: "force" });
        logAudit(db, "cron.run", req.params.id, "success");
        return out;
      } catch (err: any) {
        logAudit(db, "cron.run", req.params.id, "error", err?.message);
        reply.code(400);
        return { error: err?.message ?? "failed" };
      }
    });

    app.get<{ Params: { id: string } }>("/api/calendar/cron/:id/runs", async (req, reply) => {
      try {
        const out = await gateway.invokeTool("cron", { action: "runs", jobId: req.params.id });
        return {
          jobId: req.params.id,
          runs: normalizeRuns(out)
        };
      } catch (err) {
        reply.code(502);
        return { error: `Failed to load cron runs: ${errorMessage(err)}`, runs: [] };
      }
    });
  }
};
