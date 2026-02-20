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

export const calendarPlugin: ServerPlugin = {
  id: "calendar",
  async register({ app, gateway, db }) {
    app.get("/api/calendar/cron", async () => {
      const jobs = await gateway.invokeTool("cron", { action: "list", includeDisabled: true });
      return { jobs: jobs?.jobs ?? jobs ?? [] };
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

    app.get<{ Params: { id: string } }>("/api/calendar/cron/:id/runs", async (req) => {
      const out = await gateway.invokeTool("cron", { action: "runs", jobId: req.params.id });
      return out;
    });
  }
};
