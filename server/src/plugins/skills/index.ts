import type { ServerPlugin } from "../../types.js";

export const skillsPlugin: ServerPlugin = {
  id: "skills",
  async register({ app }) {
    app.get("/api/skills", async () => ({
      plugin: "skills",
      status: "placeholder",
      message: "MVP placeholder ready. Full implementation coming next phase."
    }));
  }
};
