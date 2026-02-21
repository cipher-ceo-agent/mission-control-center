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

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "unknown error";
}

function listMemoryFiles(): string[] {
  const out: string[] = [];
  if (fs.existsSync(config.paths.longTermMemory)) out.push(config.paths.longTermMemory);
  if (fs.existsSync(config.paths.memoryDir)) {
    for (const file of fs.readdirSync(config.paths.memoryDir)) {
      if (file.endsWith(".md")) out.push(path.join(config.paths.memoryDir, file));
    }
  }

  return out.sort((a, b) => {
    const aMs = fs.existsSync(a) ? fs.statSync(a).mtimeMs : 0;
    const bMs = fs.existsSync(b) ? fs.statSync(b).mtimeMs : 0;
    return bMs - aMs;
  });
}

function normalizeSearchResult(entry: any): any | null {
  if (!entry) return null;

  const snippet =
    entry.snippet ??
    entry.text ??
    entry.content ??
    entry.chunk ??
    entry.preview ??
    entry.message ??
    "";

  const source = entry.path ?? entry.source ?? entry.file ?? entry.filePath ?? "unknown";
  const line = entry.line ?? entry.lineNumber ?? undefined;

  if (!snippet && !source) return null;

  return {
    ...entry,
    snippet: String(snippet || "(no snippet)"),
    path: String(source),
    line: typeof line === "number" ? line : undefined
  };
}

function normalizeSearchResults(raw: any): any[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.results)
      ? raw.results
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.matches)
          ? raw.matches
          : Array.isArray(raw?.hits)
            ? raw.hits
            : [];

  return list.map(normalizeSearchResult).filter(Boolean) as any[];
}

function buildSnippet(lines: string[], idx: number): string {
  const start = Math.max(0, idx - 1);
  const end = Math.min(lines.length, idx + 2);
  const raw = lines.slice(start, end).join(" ").replace(/\s+/g, " ").trim();
  if (!raw) return "(empty line match)";
  if (raw.length <= 220) return raw;
  return `${raw.slice(0, 217)}...`;
}

function localMarkdownSearch(query: string, maxResults: number): any[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const out: any[] = [];

  for (const file of listMemoryFiles()) {
    const rel = path.relative(config.paths.workspace, file) || path.basename(file);
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].toLowerCase().includes(q)) continue;

      out.push({
        snippet: buildSnippet(lines, i),
        path: rel,
        line: i + 1,
        source: "local-markdown"
      });

      if (out.length >= maxResults) return out;
    }
  }

  return out;
}

function resolveSafeWorkspacePath(relPath: string): string | null {
  const normalized = relPath.replace(/\\/g, "/").trim();
  if (!normalized || normalized.startsWith("/")) return null;

  const abs = path.resolve(config.paths.workspace, normalized);
  const root = path.resolve(config.paths.workspace);
  const relative = path.relative(root, abs);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return abs;
}

export const memoryPlugin: ServerPlugin = {
  id: "memory",
  async register({ app, gateway, db }) {
    const runSearch = async (
      parsed: z.infer<typeof searchSchema>,
      reply: { code: (n: number) => unknown }
    ) => {
      let gatewayOut: any = null;
      let upstreamError: string | null = null;
      let results: any[] = [];

      try {
        gatewayOut = await gateway.invokeTool("memory_search", {
          query: parsed.query,
          maxResults: parsed.maxResults ?? 10
        });
        results = normalizeSearchResults(gatewayOut);
      } catch (err) {
        upstreamError = errorMessage(err);
      }

      let fallbackUsed = false;
      if (results.length === 0) {
        const fallback = localMarkdownSearch(parsed.query, parsed.maxResults ?? 10);
        if (fallback.length > 0) {
          results = fallback;
          fallbackUsed = true;
        }
      }

      const warnings: string[] = [];
      if (upstreamError) warnings.push(`memory_search failed: ${upstreamError}`);
      if (fallbackUsed) warnings.push("Using local markdown fallback results.");

      if (upstreamError && results.length === 0) {
        reply.code(502);
      }

      return {
        results,
        provider: gatewayOut?.provider ?? (fallbackUsed ? "local-markdown" : "unknown"),
        mode: gatewayOut?.mode ?? (fallbackUsed ? "local-fallback" : "gateway"),
        warnings,
        upstreamError
      };
    };

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

      return runSearch(parsed.data, reply);
    });

    app.post("/api/memory/search", async (req, reply) => {
      const parsed = searchSchema.safeParse(req.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: parsed.error.flatten() };
      }

      return runSearch(parsed.data, reply);
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
          const abs = resolveSafeWorkspacePath(item.path);
          if (!abs) continue;
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
