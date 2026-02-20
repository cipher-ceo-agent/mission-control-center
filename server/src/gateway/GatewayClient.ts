import { EventEmitter } from "node:events";
import WebSocket from "ws";

type GatewayState = "disconnected" | "reconnecting" | "connected" | "unauthorized";

type RpcPayload = {
  method: string;
  params?: Record<string, unknown>;
};

function parseJsonLoose(raw: string): any {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function extractErrorMessage(payload: any): string | null {
  if (!payload) return null;
  if (typeof payload === "string") return payload;

  const direct = payload.message ?? payload.error?.message ?? payload.error;
  if (typeof direct === "string") return direct;

  return null;
}

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

    const text = await res.text();
    const json = parseJsonLoose(text);

    if (res.status === 401 || res.status === 403) {
      this.setState("unauthorized");
      throw new Error(`Gateway unauthorized (${res.status})`);
    }

    if (!res.ok) {
      const detail = extractErrorMessage(json) ?? (text && text.length < 220 ? text : null);
      throw new Error(
        detail ? `Gateway request failed (${res.status}): ${detail}` : `Gateway request failed (${res.status})`
      );
    }

    if (json !== undefined) return json;
    return {};
  }

  async rpc(payload: RpcPayload): Promise<any> {
    const url = `${this.cfg.baseUrl}${this.cfg.rpcPath}`;
    const raw = await this.postJson(url, payload);
    return raw?.result ?? raw;
  }

  private unwrapToolResult(raw: any): any {
    if (raw?.ok === false) {
      const msg = extractErrorMessage(raw) ?? "Gateway tool invocation failed";
      throw new Error(msg);
    }

    const result = raw?.result ?? raw?.output ?? raw;

    if (result?.ok === false) {
      const msg = extractErrorMessage(result) ?? "Gateway tool invocation failed";
      throw new Error(msg);
    }

    if (result?.details !== undefined) {
      return result.details;
    }

    if (raw?.details !== undefined) {
      return raw.details;
    }

    const content = result?.content;
    if (Array.isArray(content)) {
      const jsonPart = content.find((c: any) => c?.type === "json" && c?.json !== undefined);
      if (jsonPart?.json !== undefined) return jsonPart.json;

      const textPart = content.find((c: any) => c?.type === "text" && typeof c?.text === "string");
      if (textPart?.text) {
        const parsed = parseJsonLoose(textPart.text);
        if (parsed !== undefined) return parsed;
      }
    }

    if (typeof result === "string") {
      const parsed = parseJsonLoose(result);
      return parsed ?? result;
    }

    return result;
  }

  async invokeTool(tool: string, input: Record<string, unknown>): Promise<any> {
    const url = `${this.cfg.baseUrl}${this.cfg.invokePath}`;

    // OpenClaw /tools/invoke schema is { tool, args, details }
    const raw = await this.postJson(url, {
      tool,
      args: input,
      details: {}
    });

    return this.unwrapToolResult(raw);
  }
}
