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
