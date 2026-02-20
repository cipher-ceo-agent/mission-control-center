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
