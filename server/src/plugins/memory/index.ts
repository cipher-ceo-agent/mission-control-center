import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ServerPlugin } from "../../types.js";
import { logAudit } from "../../db/audit.js";
import { config } from "../../config.js";

const searchSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().min(1).max(50).optional(),
  agentId: z.string().optional(),
  global: z.boolean().optional()
});

function listMemoryFiles(): string[] {
  const out: string[] = [];
  if (fs.existsSync(config.paths.longTermMemory)) out.push(config.paths.longTermMemory);
  if (fs.existsSync(config.paths.memoryDir)) {
    for (const file of fs.readdirSync(config.paths.memoryDir)) {
      if (file.endsWith(".md")) out.push(path.join(config.paths.memoryDir, file));
    }
  }
  return out;
}

export const memoryPlugin: ServerPlugin = {
  id: "memory",
  async register({ app, gateway, db }) {
    app.get("/api/memory/search", async (req, reply) => {
      const q = req.query as { query?: string; maxResults?: string; agentId?: string; global?: string };
      const parsed = searchSchema.safeParse({
        query: q.query,
        maxResults: q.maxResults ? Number(q.maxResults) : undefined,
        agentId: q.agentId,
        global: q.global ? q.global === "true" : undefined
      });
      if (!parsed.success) {
        reply.code(400);
        return { error: parsed.error.flatten() };
      }

      try {
        const out = await gateway.invokeTool("memory_search", {
          query: parsed.data.query,
          maxResults: parsed.data.maxResults ?? 10
        });
        return out;
      } catch (err: any) {
        reply.code(502);
        return { error: err?.message ?? "memory search failed" };
      }
    });

    app.post("/api/memory/search", async (req, reply) => {
      const parsed = searchSchema.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: parsed.error.flatten() };
      }

      try {
        const out = await gateway.invokeTool("memory_search", {
          query: parsed.data.query,
          maxResults: parsed.data.maxResults ?? 10
        });
        return out;
      } catch (err: any) {
        reply.code(502);
        return { error: err?.message ?? "memory search failed" };
      }
    });

    const exportHandler = async (agentId?: string, all?: boolean) => {
      const files = listMemoryFiles();
      const payload = files.map((f) => ({
        path: path.relative(config.paths.workspace, f),
        content: fs.readFileSync(f, "utf8"),
        updatedAt: fs.statSync(f).mtime.toISOString()
      }));
      logAudit(db, "memory.export", agentId ?? (all ? "all" : "default"), "success");
      return {
        exportedAt: new Date().toISOString(),
        source: "openclaw-markdown-memory",
        items: payload
      };
    };

    app.get("/api/memory/export", async (req, reply) => {
      const q = req.query as { agentId?: string; all?: string };
      try {
        return await exportHandler(q.agentId, q.all === "true");
      } catch (err: any) {
        logAudit(db, "memory.export", "default", "error", err?.message);
        reply.code(500);
        return { error: err?.message ?? "export failed" };
      }
    });

    app.post("/api/memory/export", async (req, reply) => {
      const body = (req.body ?? {}) as { agentId?: string; all?: boolean };
      try {
        return await exportHandler(body.agentId, body.all);
      } catch (err: any) {
        logAudit(db, "memory.export", "default", "error", err?.message);
        reply.code(500);
        return { error: err?.message ?? "export failed" };
      }
    });

    app.get("/api/memory/import", async () => ({
      method: "POST",
      accepts: "{ items: [{ path, content }], overwrite?: boolean }"
    }));

    app.post("/api/memory/import", async (req, reply) => {
      const body = (req.body ?? {}) as {
        items?: Array<{ path: string; content: string }>;
        overwrite?: boolean;
      };

      if (!body.items?.length) {
        reply.code(400);
        return { error: "No items to import" };
      }

      try {
        let written = 0;
        for (const item of body.items) {
          if (!item.path.endsWith(".md")) continue;
          const abs = path.join(config.paths.workspace, item.path);
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          if (!body.overwrite && fs.existsSync(abs)) continue;
          fs.writeFileSync(abs, item.content, "utf8");
          written += 1;
        }
        logAudit(db, "memory.import", `${written} files`, "success");
        return { imported: written };
      } catch (err: any) {
        logAudit(db, "memory.import", "default", "error", err?.message);
        reply.code(500);
        return { error: err?.message ?? "import failed" };
      }
    });

    app.get("/api/memory/clear", async () => ({
      method: "POST",
      requiresConfirmation: "CLEAR MEMORY"
    }));

    app.post("/api/memory/clear", async (req, reply) => {
      const body = (req.body ?? {}) as { confirm: string; target?: "daily" | "long-term" | "all" };
      if (body.confirm !== "CLEAR MEMORY") {
        reply.code(400);
        return { error: "Confirmation phrase must be exactly: CLEAR MEMORY" };
      }

      try {
        const target = body.target ?? "all";
        const touched: string[] = [];

        if (target === "all" || target === "long-term") {
          if (fs.existsSync(config.paths.longTermMemory)) {
            fs.writeFileSync(config.paths.longTermMemory, "# MEMORY.md\n\n", "utf8");
            touched.push("MEMORY.md");
          }
        }

        if ((target === "all" || target === "daily") && fs.existsSync(config.paths.memoryDir)) {
          for (const file of fs.readdirSync(config.paths.memoryDir)) {
            if (!file.endsWith(".md")) continue;
            const abs = path.join(config.paths.memoryDir, file);
            fs.writeFileSync(abs, `# ${file.replace(/\.md$/, "")}\n\n`, "utf8");
            touched.push(path.join("memory", file));
          }
        }

        logAudit(db, "memory.clear", target, "success", touched.join(", "));
        return { cleared: touched };
      } catch (err: any) {
        logAudit(db, "memory.clear", "all", "error", err?.message);
        reply.code(500);
        return { error: err?.message ?? "clear failed" };
      }
    });
  }
};
