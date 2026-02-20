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
