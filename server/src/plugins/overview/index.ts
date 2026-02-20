import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import type { ServerPlugin } from "../../types.js";

type AgentRecord = {
  id: string;
  displayName: string;
};

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "unknown error";
}

function pickArray(...candidates: any[]): any[] {
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function normalizeSessions(raw: any): any[] {
  return pickArray(raw, raw?.sessions, raw?.items, raw?.history, raw?.entries, raw?.result?.sessions);
}

function normalizeAgents(raw: any): AgentRecord[] {
  const list = pickArray(raw, raw?.agents, raw?.items, raw?.result?.agents);

  return list
    .map((entry: any) => {
      if (typeof entry === "string") {
        const id = entry.trim();
        if (!id) return null;
        return { id, displayName: id };
      }

      const id = String(entry?.id ?? entry?.agentId ?? entry?.name ?? "").trim();
      if (!id) return null;

      const displayName = String(entry?.displayName ?? entry?.name ?? id).trim() || id;
      return { id, displayName };
    })
    .filter(Boolean) as AgentRecord[];
}

function inferAgentId(session: any): string {
  if (session?.agentId) return String(session.agentId);
  if (session?.agent) return String(session.agent);

  const key = String(session?.sessionKey ?? session?.key ?? "");
  // session key shape often: agent:<agentId>:<sessionLabelOrId>
  const parts = key.split(":");
  if (parts.length >= 2 && parts[0] === "agent" && parts[1]) return parts[1];

  return "unknown";
}

function tsOf(session: any): number {
  const candidates = [
    session?.updatedAt,
    session?.lastMessageAt,
    session?.lastActiveAt,
    session?.createdAt,
    session?.ts
  ];

  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) {
      // Accept both ms and seconds; normalize to ms.
      return c > 10_000_000_000 ? c : c * 1000;
    }

    const n = new Date(c ?? 0).getTime();
    if (Number.isFinite(n) && n > 0) return n;
  }

  return 0;
}

function loadConfiguredAgentIds(): string[] {
  try {
    const cfgPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    if (!fs.existsSync(cfgPath)) return [];
    const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    const list = Array.isArray(raw?.agents?.list) ? raw.agents.list : [];
    return list.map((a: any) => String(a?.id ?? "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export const overviewPlugin: ServerPlugin = {
  id: "overview",
  async register({ app, gateway }) {
    app.get("/api/overview", async () => {
      let sessions: any[] = [];
      let agents: AgentRecord[] = [];
      const warnings: string[] = [];

      try {
        sessions = normalizeSessions(
          await gateway.invokeTool("sessions_list", { limit: 500, messageLimit: 0 })
        );
      } catch (err) {
        warnings.push(`sessions_list failed: ${errorMessage(err)}`);
      }

      try {
        agents = normalizeAgents(await gateway.invokeTool("agents_list", {}));
      } catch (err) {
        warnings.push(`agents_list failed: ${errorMessage(err)}`);
      }

      const configuredAgentIds = loadConfiguredAgentIds();
      const displayNameByAgentId = new Map(agents.map((a) => [a.id, a.displayName]));
      const byAgent = new Map<string, any[]>();

      for (const s of sessions) {
        const id = inferAgentId(s);
        if (!byAgent.has(id)) byAgent.set(id, []);
        byAgent.get(id)!.push(s);
      }

      for (const a of agents) {
        if (!byAgent.has(a.id)) byAgent.set(a.id, []);
      }

      for (const id of configuredAgentIds) {
        if (!byAgent.has(id)) byAgent.set(id, []);
        if (!displayNameByAgentId.has(id)) displayNameByAgentId.set(id, id);
      }

      if (configuredAgentIds.length > agents.length) {
        warnings.push(
          `Gateway tool scope currently exposes ${agents.length} allowlisted agent(s) while ${configuredAgentIds.length} are configured on host.`
        );
      }

      const now = Date.now();
      const agentCards = [...byAgent.entries()]
        .map(([agentId, list]) => {
          const lastMessageAt = list
            .map((s) => tsOf(s))
            .filter((n) => Number.isFinite(n) && n > 0)
            .sort((a, b) => b - a)[0] ?? 0;

          const busy = list.some((s) => {
            const status = String(s.status ?? s.state ?? "").toLowerCase();
            if (status.includes("running") || status.includes("busy") || status.includes("active")) return true;
            const updated = tsOf(s);
            return Number.isFinite(updated) && now - updated < 120_000;
          });

          return {
            agentId,
            displayName: displayNameByAgentId.get(agentId) ?? agentId,
            activeSessions: list.length,
            lastHeartbeat: lastMessageAt ? new Date(lastMessageAt).toISOString() : null,
            state: busy ? "busy" : "idle"
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

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
        agents: agentCards,
        warnings,
        totals: {
          sessions: sessions.length,
          agents: agentCards.length
        }
      };
    });

    app.get<{ Params: { agentId: string } }>("/api/overview/agents/:agentId", async (req, reply) => {
      try {
        const raw = await gateway.invokeTool("sessions_list", { limit: 500, messageLimit: 1 });
        const sessions = normalizeSessions(raw);
        const filtered = sessions.filter((s) => inferAgentId(s) === req.params.agentId);

        return {
          agentId: req.params.agentId,
          sessions: filtered.map((s) => ({
            sessionKey: s.sessionKey ?? s.key ?? "",
            label: s.label ?? s.displayName ?? "",
            kind: s.kind ?? "",
            updatedAt: s.updatedAt ?? s.lastMessageAt ?? s.lastActiveAt ?? null,
            lastMessage: s.lastMessage ?? s.preview ?? null,
            status: s.status ?? s.state ?? "unknown"
          }))
        };
      } catch (err) {
        reply.code(502);
        return { error: `Failed to load sessions: ${errorMessage(err)}` };
      }
    });

    app.get<{ Params: { sessionKey: string }; Querystring: { limit?: string } }>(
      "/api/overview/sessions/:sessionKey/history",
      async (req, reply) => {
        try {
          const out = await gateway.invokeTool("sessions_history", {
            sessionKey: req.params.sessionKey,
            limit: Number(req.query.limit ?? 100),
            includeTools: false
          });

          const messages = pickArray(out?.messages, out?.history, out?.items, out?.entries, out);

          return {
            sessionKey: req.params.sessionKey,
            messages
          };
        } catch (err) {
          reply.code(502);
          return { error: `Failed to load history: ${errorMessage(err)}` };
        }
      }
    );
  }
};
