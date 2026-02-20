import type { ServerPlugin } from "../../types.js";

export const tasksPlugin: ServerPlugin = {
  id: "tasks",
  async register({ app }) {
    app.get("/api/tasks", async () => ({
      plugin: "tasks",
      status: "placeholder",
      message: "MVP placeholder ready. Full implementation coming next phase."
    }));
  }
};
