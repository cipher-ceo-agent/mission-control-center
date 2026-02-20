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
