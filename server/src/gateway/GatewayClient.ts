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
