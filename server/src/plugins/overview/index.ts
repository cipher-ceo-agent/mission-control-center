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
