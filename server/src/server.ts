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
app.get("/api/gateway/status", async () => {
  await gateway.probeHttpStatus();
  return gateway.status();
});
app.get("/api/audit", async (req) => {
  const query = req.query as { limit?: string };
  return { items: db.listAudit(Number(query.limit ?? 200)) };
});

const isSessionValid = (req: any) => {
  const cookieVal = req.unsignCookie(req.cookies.mcc_session ?? "");
  return cookieVal.valid && cookieVal.value === "ok";
};

app.get("/api/auth/status", async (req) => ({
  requiresAuth: config.app.requiresAuth,
  authenticated: config.app.requiresAuth ? isSessionValid(req) : true
}));

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

  app.post("/api/auth/logout", async (_, reply) => {
    reply.clearCookie("mcc_session", { path: "/" });
    return { ok: true };
  });

  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/api")) return;
    if (
      req.url === "/api/health" ||
      req.url === "/api/auth/login" ||
      req.url === "/api/auth/logout" ||
      req.url === "/api/auth/status"
    ) {
      return;
    }

    if (!isSessionValid(req)) {
      reply.code(401).send({ error: "Auth required" });
    }
  });
} else {
  app.post("/api/auth/login", async () => ({ ok: true, auth: "disabled" }));
  app.post("/api/auth/logout", async () => ({ ok: true, auth: "disabled" }));
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
