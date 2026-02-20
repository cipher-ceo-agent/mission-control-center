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
