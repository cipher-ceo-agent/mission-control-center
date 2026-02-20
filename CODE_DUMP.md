## package.json
```
{
  "name": "mission-control-center",
  "private": true,
  "version": "0.1.0",
  "workspaces": [
    "server",
    "web"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev -w server\" \"npm run dev -w web\"",
    "build": "npm run build -w server && npm run build -w web",
    "start": "npm run start -w server",
    "start:prod": "npm run build && npm run start",
    "lint": "npm run lint -w server && npm run lint -w web"
  },
  "devDependencies": {
    "concurrently": "^9.0.1"
  }
}

```

## .env.example
```
# Core binding
MCC_HOST=127.0.0.1
MCC_PORT=3001

# Set to 0.0.0.0 to allow LAN/Tailscale access
# MCC_HOST=0.0.0.0

# REQUIRED when MCC_HOST is not loopback
MCC_PASSWORD=change-me
MCC_SESSION_SECRET=change-me-too

# OpenClaw gateway integration
GATEWAY_BASE_URL=http://127.0.0.1:9471
GATEWAY_WS_URL=ws://127.0.0.1:9471/ws
GATEWAY_TOKEN=
GATEWAY_TOOLS_INVOKE_PATH=/tools/invoke
GATEWAY_RPC_PATH=/rpc

# Data/config paths
MCC_DATA_DIR=
OPENCLAW_WORKSPACE=/home/raspberrypi/.openclaw/workspace

```

## README.md
```
# Mission Control Center (MCC) — Local Operator Dashboard

MCC is a **fully local** control plane for OpenClaw. It runs on the same machine as Gateway and provides a responsive web app + PWA.

## Guarantees
- 100% local runtime (no CDN, no telemetry/analytics)
- Browser never gets raw Gateway token (server-side only)
- Modular plugin architecture (server + UI)
- Cross-platform target: Linux/macOS/Windows

## Repo Layout
- `server/` Fastify API + Gateway client + plugin backend
- `web/` React + Tailwind + PWA frontend

## Install
```bash
cd company/repos/mission-control-center
npm install
```

## Dev (hot reload)
```bash
npm run dev
```
- API: `http://127.0.0.1:3001`
- Web: `http://127.0.0.1:5173`

## Production Build
```bash
npm run build
```

## Production Run (single command)
```bash
npm run start:prod
```
Then open `http://127.0.0.1:3001`.

## Run MCC alongside OpenClaw (one-liner)
```bash
cd company/repos/mission-control-center && npm run start:prod
```
(Keep OpenClaw Gateway running on same host.)

## Security Model
- Default bind: `127.0.0.1`
- If `MCC_HOST=0.0.0.0`, auth is mandatory via `MCC_PASSWORD` + signed cookie session.

## Config
Copy `.env.example` to `.env` and adjust as needed.

## Service Setup

### Linux (systemd user service)
Create `~/.config/systemd/user/mcc.service`:

```ini
[Unit]
Description=Mission Control Center
After=default.target

[Service]
Type=simple
WorkingDirectory=%h/.openclaw/workspace/company/repos/mission-control-center
Environment=MCC_HOST=127.0.0.1
Environment=MCC_PORT=3001
Environment=GATEWAY_BASE_URL=http://127.0.0.1:9471
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
```

Commands:
```bash
systemctl --user daemon-reload
systemctl --user enable --now mcc.service
systemctl --user status mcc.service
```

### macOS (launchd)
Create `~/Library/LaunchAgents/com.local.mcc.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>com.local.mcc</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>cd ~/path/to/mission-control-center && npm run start</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>EnvironmentVariables</key>
    <dict>
      <key>MCC_HOST</key><string>127.0.0.1</string>
      <key>MCC_PORT</key><string>3001</string>
      <key>GATEWAY_BASE_URL</key><string>http://127.0.0.1:9471</string>
    </dict>
  </dict>
</plist>
```

Load:
```bash
launchctl load ~/Library/LaunchAgents/com.local.mcc.plist
launchctl start com.local.mcc
```

### Windows (run at startup)
- Create a Task Scheduler task (At logon) that runs:
  - Program: `npm`
  - Arguments: `run start`
  - Start in: `C:\path\to\mission-control-center`
- Set env vars in System/User Environment Variables.

## Troubleshooting
- **Gateway Offline**: check OpenClaw service and `GATEWAY_BASE_URL`
- **Unauthorized**: verify `GATEWAY_TOKEN` on server
- **MCC Login Required unexpectedly**: check if `MCC_HOST` is set to non-loopback

## Audit Logging
Every write operation logs into SQLite (`audit_log` table):
- timestamp, action, target, outcome, detail

## MVP Status
✅ Overview plugin
✅ Calendar/Cron plugin
✅ Memory manager plugin
✅ Placeholder plugin skeletons (tasks, skills, activity, stats)

```

## server/package.json
```
{
  "name": "mcc-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@fastify/cookie": "^10.0.1",
    "@fastify/cors": "^11.0.0",
    "@fastify/static": "^8.1.0",
    "dotenv": "^16.4.5",
    "fastify": "^5.1.0",
    "ws": "^8.18.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@types/ws": "^8.5.13",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}

```

## server/tsconfig.json
```
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}

```

## server/src/config.ts
```
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function isLoopback(host: string): boolean {
  return ["127.0.0.1", "::1", "localhost"].includes(host);
}

const host = process.env.MCC_HOST ?? "127.0.0.1";
const port = Number(process.env.MCC_PORT ?? 3001);

const dataDir =
  process.env.MCC_DATA_DIR || path.join(os.homedir(), ".mcc-local");

const workspace =
  process.env.OPENCLAW_WORKSPACE || path.join(os.homedir(), ".openclaw", "workspace");

export const config = {
  app: {
    host,
    port,
    requiresAuth: !isLoopback(host)
  },
  auth: {
    password: process.env.MCC_PASSWORD ?? "",
    sessionSecret: process.env.MCC_SESSION_SECRET ?? "mcc-dev-secret"
  },
  gateway: {
    baseUrl: process.env.GATEWAY_BASE_URL ?? "http://127.0.0.1:9471",
    wsUrl: process.env.GATEWAY_WS_URL ?? "ws://127.0.0.1:9471/ws",
    token: process.env.GATEWAY_TOKEN ?? "",
    rpcPath: process.env.GATEWAY_RPC_PATH ?? "/rpc",
    invokePath: process.env.GATEWAY_TOOLS_INVOKE_PATH ?? "/tools/invoke"
  },
  paths: {
    dataDir,
    dbFile: path.join(dataDir, "mcc.sqlite"),
    workspace,
    memoryDir: path.join(workspace, "memory"),
    longTermMemory: path.join(workspace, "MEMORY.md")
  }
};

if (config.app.requiresAuth && !config.auth.password) {
  throw new Error("MCC_PASSWORD is required when MCC_HOST is non-loopback.");
}

```

## server/src/types.ts
```
import type { FastifyInstance } from "fastify";
import type { GatewayClient } from "./gateway/GatewayClient.js";
import type { MccDb } from "./db/index.js";

export type PluginContext = {
  app: FastifyInstance;
  gateway: GatewayClient;
  db: MccDb;
};

export type ServerPlugin = {
  id: string;
  register: (ctx: PluginContext) => Promise<void>;
};

```

## server/src/utils/time.ts
```
export function nowIso(): string {
  return new Date().toISOString();
}

```

## server/src/db/index.ts
```
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

```

## server/src/db/audit.ts
```
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

```

## server/src/gateway/GatewayClient.ts
```
import { EventEmitter } from "node:events";
import WebSocket from "ws";

type GatewayState = "disconnected" | "reconnecting" | "connected" | "unauthorized";

type RpcPayload = {
  method: string;
  params?: Record<string, unknown>;
};

export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private state: GatewayState = "disconnected";
  private connectedAt: number | null = null;

  constructor(
    private readonly cfg: {
      baseUrl: string;
      wsUrl: string;
      token: string;
      rpcPath: string;
      invokePath: string;
    }
  ) {
    super();
  }

  start() {
    this.connect();
  }

  stop() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
    this.ws = null;
    this.setState("disconnected");
  }

  status() {
    return {
      state: this.state,
      connectedAt: this.connectedAt,
      uptimeSeconds: this.connectedAt ? Math.floor((Date.now() - this.connectedAt) / 1000) : 0
    };
  }

  private setState(next: GatewayState) {
    this.state = next;
    if (next === "connected" && !this.connectedAt) this.connectedAt = Date.now();
    if (next !== "connected") this.connectedAt = null;
    this.emit("state", this.status());
  }

  private connect() {
    this.setState(this.reconnectAttempt > 0 ? "reconnecting" : "disconnected");

    const headers: Record<string, string> = {};
    if (this.cfg.token) headers.Authorization = `Bearer ${this.cfg.token}`;

    this.ws = new WebSocket(this.cfg.wsUrl, { headers });

    this.ws.on("open", () => {
      this.reconnectAttempt = 0;
      this.setState("connected");
    });

    this.ws.on("message", (msg) => {
      this.emit("message", msg.toString());
    });

    this.ws.on("close", (code) => {
      if (code === 1008 || code === 4001) {
        this.setState("unauthorized");
        return;
      }
      this.scheduleReconnect();
    });

    this.ws.on("error", () => {
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    this.setState("reconnecting");
    const delayMs = Math.min(30_000, 1000 * 2 ** Math.min(this.reconnectAttempt, 5));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  private async postJson(url: string, payload: unknown): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (this.cfg.token) {
      headers.Authorization = `Bearer ${this.cfg.token}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (res.status === 401 || res.status === 403) {
      this.setState("unauthorized");
      throw new Error(`Gateway unauthorized (${res.status})`);
    }

    if (!res.ok) {
      throw new Error(`Gateway request failed (${res.status})`);
    }

    return res.json().catch(() => ({}));
  }

  async rpc(payload: RpcPayload): Promise<any> {
    const url = `${this.cfg.baseUrl}${this.cfg.rpcPath}`;
    const raw = await this.postJson(url, payload);
    return raw?.result ?? raw;
  }

  async invokeTool(tool: string, input: Record<string, unknown>): Promise<any> {
    const url = `${this.cfg.baseUrl}${this.cfg.invokePath}`;

    const attempts = [
      { tool, input },
      { name: tool, parameters: input },
      { recipient_name: `functions.${tool}`, parameters: input }
    ];

    let lastErr: unknown;
    for (const attempt of attempts) {
      try {
        const raw = await this.postJson(url, attempt);
        return raw?.result ?? raw?.output ?? raw;
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error("tool invoke failed");
  }
}

```

## server/src/plugins/index.ts
```
import type { ServerPlugin } from "../types.js";
import { overviewPlugin } from "./overview/index.js";
import { calendarPlugin } from "./calendar/index.js";
import { memoryPlugin } from "./memory/index.js";
import { tasksPlugin } from "./tasks/index.js";
import { skillsPlugin } from "./skills/index.js";
import { activityPlugin } from "./activity/index.js";
import { statsPlugin } from "./stats/index.js";

export const plugins: ServerPlugin[] = [
  overviewPlugin,
  calendarPlugin,
  memoryPlugin,
  tasksPlugin,
  skillsPlugin,
  activityPlugin,
  statsPlugin
];

```

## server/src/plugins/overview/index.ts
```
import os from "node:os";
import type { ServerPlugin } from "../../types.js";

function normalizeSessions(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.sessions)) return raw.sessions;
  return [];
}

function normalizeAgents(raw: any): string[] {
  if (Array.isArray(raw?.agents)) return raw.agents.map((a: any) => a.id ?? a.agentId ?? String(a));
  if (Array.isArray(raw)) return raw.map((a: any) => a.id ?? a.agentId ?? String(a));
  return [];
}

export const overviewPlugin: ServerPlugin = {
  id: "overview",
  async register({ app, gateway }) {
    app.get("/api/overview", async () => {
      let sessions: any[] = [];
      let agents: string[] = [];

      try {
        sessions = normalizeSessions(
          await gateway.invokeTool("sessions_list", { limit: 500, messageLimit: 0 })
        );
      } catch {
        sessions = [];
      }

      try {
        agents = normalizeAgents(await gateway.invokeTool("agents_list", {}));
      } catch {
        agents = [];
      }

      const byAgent = new Map<string, any[]>();
      for (const s of sessions) {
        const id = s.agentId ?? s.agent ?? "unknown";
        if (!byAgent.has(id)) byAgent.set(id, []);
        byAgent.get(id)!.push(s);
      }

      for (const a of agents) {
        if (!byAgent.has(a)) byAgent.set(a, []);
      }

      const now = Date.now();
      const agentCards = [...byAgent.entries()].map(([agentId, list]) => {
        const lastMessageAt = list
          .map((s) => new Date(s.updatedAt ?? s.lastMessageAt ?? 0).getTime())
          .filter((n) => Number.isFinite(n) && n > 0)
          .sort((a, b) => b - a)[0] ?? 0;

        const busy = list.some((s) => {
          const status = String(s.status ?? s.state ?? "").toLowerCase();
          if (status.includes("running") || status.includes("busy") || status.includes("active")) return true;
          const updated = new Date(s.updatedAt ?? s.lastMessageAt ?? 0).getTime();
          return Number.isFinite(updated) && now - updated < 120_000;
        });

        return {
          agentId,
          displayName: agentId,
          activeSessions: list.length,
          lastHeartbeat: lastMessageAt ? new Date(lastMessageAt).toISOString() : null,
          state: busy ? "busy" : "idle"
        };
      });

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memUsed = totalMem - freeMem;

      return {
        gateway: gateway.status(),
        host: {
          platform: process.platform,
          uptimeSeconds: os.uptime(),
          loadavg: os.loadavg(),
          cpuCount: os.cpus().length,
          memory: {
            total: totalMem,
            used: memUsed,
            free: freeMem,
            usedPct: Number(((memUsed / totalMem) * 100).toFixed(2))
          }
        },
        agents: agentCards
      };
    });

    app.get<{ Params: { agentId: string } }>("/api/overview/agents/:agentId", async (req) => {
      const raw = await gateway.invokeTool("sessions_list", { limit: 500, messageLimit: 1 });
      const sessions = normalizeSessions(raw);
      const filtered = sessions.filter((s) => (s.agentId ?? s.agent ?? "unknown") === req.params.agentId);

      return {
        agentId: req.params.agentId,
        sessions: filtered.map((s) => ({
          sessionKey: s.sessionKey ?? s.key ?? "",
          label: s.label ?? "",
          kind: s.kind ?? "",
          updatedAt: s.updatedAt ?? s.lastMessageAt ?? null,
          lastMessage: s.lastMessage ?? null,
          status: s.status ?? s.state ?? "unknown"
        }))
      };
    });

    app.get<{ Params: { sessionKey: string }; Querystring: { limit?: string } }>(
      "/api/overview/sessions/:sessionKey/history",
      async (req) => {
        const out = await gateway.invokeTool("sessions_history", {
          sessionKey: req.params.sessionKey,
          limit: Number(req.query.limit ?? 100),
          includeTools: false
        });

        return {
          sessionKey: req.params.sessionKey,
          messages: out?.messages ?? out?.history ?? out ?? []
        };
      }
    );
  }
};

```

## server/src/plugins/calendar/index.ts
```
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

```

## server/src/plugins/memory/index.ts
```
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

```

## server/src/plugins/tasks/index.ts
```
import type { ServerPlugin } from "../../types.js";

export const tasksPlugin: ServerPlugin = {
  id: "tasks",
  async register({ app }) {
    app.get("/api/tasks", async () => ({
      plugin: "tasks",
      status: "placeholder",
      message: "MVP placeholder ready. Full implementation coming next phase."
    }));
  }
};

```

## server/src/plugins/skills/index.ts
```
import type { ServerPlugin } from "../../types.js";

export const skillsPlugin: ServerPlugin = {
  id: "skills",
  async register({ app }) {
    app.get("/api/skills", async () => ({
      plugin: "skills",
      status: "placeholder",
      message: "MVP placeholder ready. Full implementation coming next phase."
    }));
  }
};

```

## server/src/plugins/activity/index.ts
```
import type { ServerPlugin } from "../../types.js";

export const activityPlugin: ServerPlugin = {
  id: "activity",
  async register({ app }) {
    app.get("/api/activity", async () => ({
      plugin: "activity",
      status: "placeholder",
      message: "MVP placeholder ready. Full implementation coming next phase."
    }));
  }
};

```

## server/src/plugins/stats/index.ts
```
import type { ServerPlugin } from "../../types.js";

export const statsPlugin: ServerPlugin = {
  id: "stats",
  async register({ app }) {
    app.get("/api/stats", async () => ({
      plugin: "stats",
      status: "placeholder",
      message: "MVP placeholder ready. Full implementation coming next phase."
    }));
  }
};

```

## server/src/server.ts
```
import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { config } from "./config.js";
import { GatewayClient } from "./gateway/GatewayClient.js";
import { MccDb } from "./db/index.js";
import { plugins } from "./plugins/index.js";
import { logAudit } from "./db/audit.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true
});

await app.register(cookie, {
  secret: config.auth.sessionSecret,
  hook: "onRequest"
});

const db = new MccDb(config.paths.dbFile);
const gateway = new GatewayClient(config.gateway);
gateway.start();

app.decorate("db", db);

app.get("/api/health", async () => ({ ok: true, ts: new Date().toISOString() }));
app.get("/api/gateway/status", async () => gateway.status());
app.get("/api/audit", async (req) => {
  const query = req.query as { limit?: string };
  return { items: db.listAudit(Number(query.limit ?? 200)) };
});

if (config.app.requiresAuth) {
  app.post("/api/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { password?: string };
    if (!body.password || body.password !== config.auth.password) {
      reply.code(401);
      return { error: "Invalid credentials" };
    }

    reply.setCookie("mcc_session", "ok", {
      path: "/",
      signed: true,
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 60 * 60 * 8
    });
    return { ok: true };
  });

  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/api")) return;
    if (req.url === "/api/health" || req.url === "/api/auth/login") return;

    const cookieVal = req.unsignCookie(req.cookies.mcc_session ?? "");
    if (!cookieVal.valid || cookieVal.value !== "ok") {
      reply.code(401).send({ error: "Auth required" });
    }
  });
}

for (const plugin of plugins) {
  await plugin.register({ app, gateway, db });
}

const webDist = path.resolve(process.cwd(), "../web/dist");
if (fs.existsSync(webDist)) {
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: "/"
  });

  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith("/api")) {
      return reply.code(404).send({ error: "Not found" });
    }

    const index = path.join(webDist, "index.html");
    return reply.type("text/html").send(fs.readFileSync(index, "utf8"));
  });
}

const start = async () => {
  try {
    await app.listen({ host: config.app.host, port: config.app.port });
    app.log.info(`MCC API listening at http://${config.app.host}:${config.app.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

process.on("SIGINT", async () => {
  logAudit(db, "system.shutdown", "mcc", "success");
  gateway.stop();
  await app.close();
  process.exit(0);
});

start();

```

## web/package.json
```
{
  "name": "mcc-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "tsc -b --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "react-window": "^1.8.10"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/react-window": "^1.8.8",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vite-plugin-pwa": "^0.21.1"
  }
}

```

## web/tsconfig.json
```
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}

```

## web/tsconfig.node.json
```
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}

```

## web/vite.config.ts
```
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [],
      manifest: {
        name: "Mission Control Center",
        short_name: "MCC",
        start_url: "/",
        display: "standalone",
        background_color: "#0b1220",
        theme_color: "#111827",
        icons: []
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      }
    })
  ],
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  build: {
    outDir: "dist"
  }
});

```

## web/postcss.config.js
```
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};

```

## web/tailwind.config.ts
```
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0b1220",
        panel: "#111827",
        muted: "#1f2937",
        text: "#e5e7eb",
        accent: "#22d3ee"
      }
    }
  },
  plugins: []
} satisfies Config;

```

## web/index.html
```
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#111827" />
    <title>MCC</title>
  </head>
  <body class="bg-bg text-text">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

```

## web/src/index.css
```
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
}

.card {
  @apply rounded-xl border border-slate-700 bg-panel p-4;
}

.btn {
  @apply rounded-md px-3 py-2 text-sm font-medium bg-slate-700 hover:bg-slate-600;
}

.btn-danger {
  @apply bg-red-700 hover:bg-red-600;
}

.input {
  @apply w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm;
}

```

## web/src/main.tsx
```
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

```

## web/src/lib/api/client.ts
```
export type GatewayState = "disconnected" | "reconnecting" | "connected" | "unauthorized";

const API_BASE = "/api";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    ...init
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ ok: boolean; ts: string }>("/health"),
  gatewayStatus: () => req<{ state: GatewayState; uptimeSeconds: number }>("/gateway/status"),
  overview: () => req<any>("/overview"),
  overviewAgent: (agentId: string) => req<any>(`/overview/agents/${encodeURIComponent(agentId)}`),
  overviewHistory: (sessionKey: string, limit = 100) => req<any>(`/overview/sessions/${encodeURIComponent(sessionKey)}/history?limit=${limit}`),

  cronList: () => req<{ jobs: any[] }>("/calendar/cron"),
  cronPatch: (id: string, patch: any) => req<any>(`/calendar/cron/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  cronRun: (id: string) => req<any>(`/calendar/cron/${id}/run`, { method: "POST", body: "{}" }),
  cronRuns: (id: string) => req<any>(`/calendar/cron/${id}/runs`),

  memorySearch: (payload: { query: string; maxResults?: number; agentId?: string; global?: boolean }) =>
    req<any>("/memory/search", { method: "POST", body: JSON.stringify(payload) }),
  memoryExport: (payload: { agentId?: string; all?: boolean }) =>
    req<any>("/memory/export", { method: "POST", body: JSON.stringify(payload) }),
  memoryImport: (payload: { items: Array<{ path: string; content: string }>; overwrite?: boolean }) =>
    req<any>("/memory/import", { method: "POST", body: JSON.stringify(payload) }),
  memoryClear: (payload: { confirm: string; target?: "daily" | "long-term" | "all" }) =>
    req<any>("/memory/clear", { method: "POST", body: JSON.stringify(payload) }),

  audit: () => req<{ items: any[] }>("/audit")
};

```

## web/src/components/Badge.tsx
```
import type { PropsWithChildren } from "react";

export function Badge({ children, tone = "neutral" }: PropsWithChildren<{ tone?: "neutral" | "green" | "yellow" | "red" | "blue" }>) {
  const cls = {
    neutral: "bg-slate-700 text-slate-100",
    green: "bg-emerald-700 text-emerald-100",
    yellow: "bg-amber-700 text-amber-100",
    red: "bg-red-700 text-red-100",
    blue: "bg-cyan-700 text-cyan-100"
  }[tone];

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs ${cls}`}>{children}</span>;
}

```

## web/src/components/Nav.tsx
```
import { NavLink } from "react-router-dom";

const items = [
  ["/", "Overview"],
  ["/calendar", "Calendar"],
  ["/memory", "Memory"],
  ["/tasks", "Tasks"],
  ["/skills", "Skills"],
  ["/activity", "Activity"],
  ["/stats", "Stats"]
] as const;

export function Nav() {
  return (
    <nav className="grid gap-2">
      {items.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm ${isActive ? "bg-cyan-700 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

```

## web/src/components/TopStatus.tsx
```
import { useEffect, useState } from "react";
import { api, type GatewayState } from "../lib/api/client";
import { Badge } from "./Badge";

export function TopStatus() {
  const [state, setState] = useState<GatewayState>("disconnected");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const s = await api.gatewayStatus();
        if (mounted) setState(s.state);
      } catch {
        if (mounted) setState("disconnected");
      }
    };

    run();
    const t = setInterval(run, 5000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const tone = state === "connected" ? "green" : state === "reconnecting" ? "yellow" : state === "unauthorized" ? "red" : "neutral";

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-slate-400">Gateway</span>
      <Badge tone={tone}>{state}</Badge>
    </div>
  );
}

```

## web/src/app/Layout.tsx
```
import { Outlet } from "react-router-dom";
import { Nav } from "../components/Nav";
import { TopStatus } from "../components/TopStatus";

export function Layout() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-10 border-b border-slate-700 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
          <div>
            <h1 className="text-lg font-semibold">Mission Control Center</h1>
            <p className="text-xs text-slate-400">Local operator dashboard</p>
          </div>
          <TopStatus />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 p-4 md:grid-cols-[220px_1fr]">
        <aside className="card h-fit">
          <Nav />
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

```

## web/src/app/router.tsx
```
import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { OverviewPage } from "../plugins/overview/OverviewPage";
import { CalendarPage } from "../plugins/calendar/CalendarPage";
import { MemoryPage } from "../plugins/memory/MemoryPage";
import { TasksPage } from "../plugins/tasks/TasksPage";
import { SkillsPage } from "../plugins/skills/SkillsPage";
import { ActivityPage } from "../plugins/activity/ActivityPage";
import { StatsPage } from "../plugins/stats/StatsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "memory", element: <MemoryPage /> },
      { path: "tasks", element: <TasksPage /> },
      { path: "skills", element: <SkillsPage /> },
      { path: "activity", element: <ActivityPage /> },
      { path: "stats", element: <StatsPage /> }
    ]
  }
]);

```

## web/src/plugins/index.ts
```
export type UiPluginManifest = {
  id: string;
  route: string;
  title: string;
  mvp: boolean;
};

export const uiPlugins: UiPluginManifest[] = [
  { id: "overview", route: "/", title: "Overview", mvp: true },
  { id: "calendar", route: "/calendar", title: "Calendar", mvp: true },
  { id: "memory", route: "/memory", title: "Memory", mvp: true },
  { id: "tasks", route: "/tasks", title: "Tasks", mvp: false },
  { id: "skills", route: "/skills", title: "Skills", mvp: false },
  { id: "activity", route: "/activity", title: "Activity", mvp: false },
  { id: "stats", route: "/stats", title: "Stats", mvp: false }
];

```

## web/src/plugins/overview/OverviewPage.tsx
```
import { useEffect, useMemo, useState } from "react";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";
import { api } from "../../lib/api/client";
import { Badge } from "../../components/Badge";

type AgentCard = {
  agentId: string;
  displayName: string;
  activeSessions: number;
  lastHeartbeat: string | null;
  state: "busy" | "idle";
};

export function OverviewPage() {
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [transcript, setTranscript] = useState<any[] | null>(null);
  const [transcriptKey, setTranscriptKey] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await api.overview();
        if (mounted) setData(next);
      } catch {
        // keep old data if poll fails
      }
    };

    load();
    const timer = setInterval(load, 7000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.overviewAgent(selected).then(setDetail).catch(() => setDetail(null));
  }, [selected]);

  const agents: AgentCard[] = data?.agents ?? [];

  const filtered = useMemo(
    () => agents.filter((a) => a.agentId.toLowerCase().includes(search.toLowerCase())),
    [agents, search]
  );

  const Row = ({ index, style }: ListChildComponentProps) => {
    const item = filtered[index];
    const tone = item.state === "busy" ? "yellow" : "green";

    return (
      <button
        style={style}
        className="w-full border-b border-slate-700 px-3 py-2 text-left hover:bg-slate-800"
        onClick={() => setSelected(item.agentId)}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">{item.displayName}</span>
          <Badge tone={tone}>{item.state}</Badge>
        </div>
        <div className="mt-1 text-xs text-slate-400">
          sessions: {item.activeSessions} · last: {item.lastHeartbeat ? new Date(item.lastHeartbeat).toLocaleString() : "n/a"}
        </div>
      </button>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="card">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Agent / Session Grid</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input md:max-w-xs"
            placeholder="Search agents..."
          />
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-slate-900 p-3">
            <div className="text-xs text-slate-400">Gateway state</div>
            <div className="text-base font-semibold">{data?.gateway?.state ?? "unknown"}</div>
          </div>
          <div className="rounded-lg bg-slate-900 p-3">
            <div className="text-xs text-slate-400">CPU cores</div>
            <div className="text-base font-semibold">{data?.host?.cpuCount ?? "-"}</div>
          </div>
          <div className="rounded-lg bg-slate-900 p-3">
            <div className="text-xs text-slate-400">RAM used</div>
            <div className="text-base font-semibold">
              {data?.host?.memory?.usedPct ? `${data.host.memory.usedPct}%` : "-"}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-700">
          <List height={420} width={"100%"} itemCount={filtered.length} itemSize={68}>
            {Row}
          </List>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 text-base font-semibold">Agent Detail</h3>
        {!selected && <p className="text-sm text-slate-400">Select an agent to view sessions.</p>}
        {selected && (
          <>
            <p className="mb-3 text-sm text-slate-300">{selected}</p>
            <div className="grid gap-2">
              {(detail?.sessions ?? []).map((s: any) => (
                <div key={s.sessionKey} className="rounded-lg bg-slate-900 p-3 text-sm">
                  <div className="font-medium">{s.label || s.sessionKey}</div>
                  <div className="mt-1 text-xs text-slate-400">{s.status} · {s.kind}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="btn"
                      onClick={() => navigator.clipboard.writeText(s.sessionKey || "")}
                    >
                      Copy Session Key
                    </button>
                    <button
                      className="btn"
                      onClick={async () => {
                        const out = await api.overviewHistory(s.sessionKey, 80);
                        setTranscript(out.messages || []);
                        setTranscriptKey(s.sessionKey);
                      }}
                    >
                      View Transcript
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {transcript && (
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Transcript (read-only)</h4>
              <button className="btn" onClick={() => setTranscript(null)}>Close</button>
            </div>
            <div className="mb-2 text-xs text-slate-400">session: {transcriptKey}</div>
            <div className="grid max-h-64 gap-2 overflow-auto">
              {transcript.map((m: any, i: number) => (
                <div key={i} className="rounded bg-slate-900 p-2 text-xs">
                  <div className="text-slate-400">{m.role || m.type || "message"}</div>
                  <div className="mt-1 whitespace-pre-wrap text-slate-200">{m.content || m.text || JSON.stringify(m)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

```

## web/src/plugins/calendar/CalendarPage.tsx
```
import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api/client";
import { Badge } from "../../components/Badge";

function formatSchedule(job: any): string {
  const s = job.schedule;
  if (!s) return "n/a";
  if (s.kind === "cron") return `${s.expr} (${s.tz || "UTC"})`;
  if (s.kind === "every") return `every ${Math.round((s.everyMs || 0) / 1000)}s`;
  if (s.kind === "at") return `at ${new Date(s.at).toLocaleString()}`;
  return "n/a";
}

export function CalendarPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [expr, setExpr] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const load = async () => {
    const out = await api.cronList();
    setJobs(out.jobs || []);
  };

  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selected?.jobId && !selected?.id) return;
    const id = selected.jobId || selected.id;
    api.cronRuns(id).then((r) => setRuns(r.runs || r.items || [])).catch(() => setRuns([]));
  }, [selected]);

  const sorted = useMemo(() => [...jobs].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))), [jobs]);
  const groupedByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const job of sorted) {
      const key = job.nextRunAt ? new Date(job.nextRunAt).toLocaleDateString() : "No next run";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(job);
    }
    return [...map.entries()];
  }, [sorted]);

  const toggleEnabled = async (job: any) => {
    const id = job.jobId || job.id;
    setLoading(true);
    try {
      await api.cronPatch(id, { enabled: !job.enabled });
      await load();
    } finally {
      setLoading(false);
    }
  };

  const runNow = async (job: any) => {
    const id = job.jobId || job.id;
    if (!confirm(`Run ${job.name || id} now?`)) return;
    setLoading(true);
    try {
      await api.cronRun(id);
      if (selected && (selected.jobId || selected.id) === id) {
        const r = await api.cronRuns(id);
        setRuns(r.runs || r.items || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveSchedule = async () => {
    if (!selected) return;
    const id = selected.jobId || selected.id;
    setLoading(true);
    try {
      await api.cronPatch(id, { schedule: { kind: "cron", expr, tz: selected.schedule?.tz || "America/Los_Angeles" } });
      await load();
      alert("Schedule updated");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div className="card overflow-hidden">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cron + Heartbeats</h2>
          <div className="flex gap-2">
            <button className={`btn ${viewMode === "list" ? "bg-cyan-700" : ""}`} onClick={() => setViewMode("list")}>List</button>
            <button className={`btn ${viewMode === "calendar" ? "bg-cyan-700" : ""}`} onClick={() => setViewMode("calendar")}>Calendar</button>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="overflow-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Schedule</th>
                  <th className="pb-2">Next run</th>
                  <th className="pb-2">Enabled</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((job) => {
                  const id = job.jobId || job.id;
                  return (
                    <tr key={id} className="border-t border-slate-700">
                      <td className="py-2 pr-3 align-top">
                        <button className="text-left underline" onClick={() => { setSelected(job); setExpr(job.schedule?.expr || ""); }}>
                          {job.name || id}
                        </button>
                        <div className="text-xs text-slate-400">target: {job.payload?.kind || "n/a"}</div>
                      </td>
                      <td className="py-2 pr-3 align-top">{formatSchedule(job)}</td>
                      <td className="py-2 pr-3 align-top">{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : "n/a"}</td>
                      <td className="py-2 pr-3 align-top">{job.enabled ? <Badge tone="green">on</Badge> : <Badge tone="red">off</Badge>}</td>
                      <td className="py-2 align-top">
                        <div className="flex gap-2">
                          <button className="btn" disabled={loading} onClick={() => toggleEnabled(job)}>
                            {job.enabled ? "Disable" : "Enable"}
                          </button>
                          <button className="btn" disabled={loading} onClick={() => runNow(job)}>Run now</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3">
            {groupedByDay.map(([day, dayJobs]) => (
              <div key={day} className="rounded-lg border border-slate-700 p-3">
                <div className="mb-2 text-sm font-semibold">{day}</div>
                <div className="grid gap-2">
                  {dayJobs.map((job) => {
                    const id = job.jobId || job.id;
                    return (
                      <button
                        key={id}
                        className="rounded bg-slate-900 p-2 text-left text-sm hover:bg-slate-800"
                        onClick={() => {
                          setSelected(job);
                          setExpr(job.schedule?.expr || "");
                        }}
                      >
                        <div>{job.name || id}</div>
                        <div className="text-xs text-slate-400">
                          {job.nextRunAt ? new Date(job.nextRunAt).toLocaleTimeString() : "n/a"} · {formatSchedule(job)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="mb-2 text-base font-semibold">Selected Job</h3>
        {!selected && <p className="text-sm text-slate-400">Choose a job to inspect runs / edit schedule.</p>}
        {selected && (
          <>
            <div className="text-sm text-slate-200">{selected.name || selected.jobId || selected.id}</div>
            <label className="mt-3 block text-xs text-slate-400">Cron expression</label>
            <input className="input mt-1" value={expr} onChange={(e) => setExpr(e.target.value)} />
            <button className="btn mt-2" disabled={loading || !expr} onClick={saveSchedule}>Save Schedule</button>

            <h4 className="mt-4 text-sm font-semibold">Recent Runs</h4>
            <div className="mt-2 grid max-h-72 gap-2 overflow-auto">
              {runs.map((run: any, idx: number) => (
                <div key={run.runId || idx} className="rounded-lg bg-slate-900 p-2 text-xs">
                  <div>{run.status || "unknown"}</div>
                  <div className="text-slate-400">{run.startedAt ? new Date(run.startedAt).toLocaleString() : "n/a"}</div>
                </div>
              ))}
              {runs.length === 0 && <div className="text-xs text-slate-500">No run history returned.</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

```

## web/src/plugins/memory/MemoryPage.tsx
```
import { useState } from "react";
import { api } from "../../lib/api/client";

export function MemoryPage() {
  const [query, setQuery] = useState("");
  const [agentId, setAgentId] = useState("main");
  const [globalMode, setGlobalMode] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [clearPhrase, setClearPhrase] = useState("");
  const [importText, setImportText] = useState("");
  const [busy, setBusy] = useState(false);

  const runSearch = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const out = await api.memorySearch({ query, maxResults: 15, global: globalMode, agentId });
      setResults(out.results || out.items || out.matches || []);
    } finally {
      setBusy(false);
    }
  };

  const exportMemory = async () => {
    setBusy(true);
    try {
      const out = await api.memoryExport(globalMode ? { all: true } : { agentId });
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mcc-memory-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const importMemory = async () => {
    if (!importText.trim()) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(importText);
      await api.memoryImport({ items: parsed.items || [], overwrite: true });
      alert("Memory import complete.");
    } catch (err: any) {
      alert(err?.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const clearMemory = async () => {
    if (!confirm("This is destructive. Continue?")) return;
    setBusy(true);
    try {
      await api.memoryClear({ confirm: clearPhrase, target: "all" });
      alert("Memory cleared.");
    } catch (err: any) {
      alert(err?.message || "Clear failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div className="card">
        <h2 className="mb-3 text-lg font-semibold">Memory Manager</h2>
        <div className="mb-3 grid gap-3 md:grid-cols-[1fr_160px]">
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search memory..." />
          <button className="btn" disabled={busy} onClick={runSearch}>Search</button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={globalMode} onChange={(e) => setGlobalMode(e.target.checked)} />
            Global search mode
          </label>
          {!globalMode && (
            <input
              className="input max-w-xs"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="agent id"
            />
          )}
        </div>

        <div className="grid gap-2">
          {results.map((r: any, i: number) => (
            <div key={i} className="rounded-lg bg-slate-900 p-3 text-sm">
              <div className="text-slate-100">{r.snippet || r.text || "(no snippet)"}</div>
              <div className="mt-1 text-xs text-slate-400">
                Source: {r.path || r.source || "unknown"} {r.line ? `#${r.line}` : ""}
              </div>
            </div>
          ))}
          {results.length === 0 && <div className="text-sm text-slate-500">No results yet.</div>}
        </div>
      </div>

      <div className="card">
        <h3 className="text-base font-semibold">Actions</h3>
        <div className="mt-3 grid gap-3">
          <button className="btn" disabled={busy} onClick={exportMemory}>Export Memory JSON</button>

          <label className="text-xs text-slate-400">Import payload JSON</label>
          <textarea
            className="input min-h-32"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"items":[{"path":"memory/2026-02-20.md","content":"..."}]}'
          />
          <button className="btn" disabled={busy} onClick={importMemory}>Import Memory</button>

          <hr className="border-slate-700" />
          <label className="text-xs text-slate-400">Type CLEAR MEMORY to confirm</label>
          <input className="input" value={clearPhrase} onChange={(e) => setClearPhrase(e.target.value)} />
          <button className="btn btn-danger" disabled={busy} onClick={clearMemory}>Clear Memory</button>
        </div>
      </div>
    </div>
  );
}

```

## web/src/plugins/tasks/TasksPage.tsx
```
export function TasksPage() {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Tasks (Placeholder)</h2>
      <p className="mt-2 text-sm text-slate-400">
        Plugin skeleton is wired. Full implementation is intentionally deferred for post-MVP.
      </p>
    </div>
  );
}

```

## web/src/plugins/skills/SkillsPage.tsx
```
export function SkillsPage() {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Skills (Placeholder)</h2>
      <p className="mt-2 text-sm text-slate-400">
        Plugin skeleton is wired. Full implementation is intentionally deferred for post-MVP.
      </p>
    </div>
  );
}

```

## web/src/plugins/activity/ActivityPage.tsx
```
export function ActivityPage() {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Activity (Placeholder)</h2>
      <p className="mt-2 text-sm text-slate-400">
        Plugin skeleton is wired. Full implementation is intentionally deferred for post-MVP.
      </p>
    </div>
  );
}

```

## web/src/plugins/stats/StatsPage.tsx
```
export function StatsPage() {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Stats (Placeholder)</h2>
      <p className="mt-2 text-sm text-slate-400">
        Plugin skeleton is wired. Full implementation is intentionally deferred for post-MVP.
      </p>
    </div>
  );
}

```

