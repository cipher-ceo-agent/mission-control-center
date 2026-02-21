import fs from "node:fs";
import path from "node:path";
import type { ServerPlugin } from "../../types.js";
import { config } from "../../config.js";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "unknown error";
}

function findSkillDocs(root: string, depth = 0): string[] {
  if (!fs.existsSync(root)) return [];
  if (depth > 4) return [];

  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;

    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...findSkillDocs(abs, depth + 1));
      continue;
    }

    if (entry.isFile() && entry.name === "SKILL.md") {
      out.push(abs);
    }
  }

  return out;
}

function parseSkillDoc(skillDocAbs: string): { title: string | null; summary: string | null } {
  const content = fs.readFileSync(skillDocAbs, "utf8");
  const lines = content.split(/\r?\n/).map((line) => line.trim());

  let title: string | null = null;
  for (const line of lines) {
    if (!line) continue;
    const m = line.match(/^#\s+(.+)$/);
    if (m) {
      title = m[1].trim();
      break;
    }
  }

  let summary: string | null = null;
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("```")) continue;
    summary = line;
    break;
  }

  return { title, summary };
}

function resolveSkillsRoots(): string[] {
  const roots = [
    path.join(config.paths.workspace, "skills"),
    path.join(config.paths.workspace, "company", "skills"),
    path.join(config.paths.dataDir, "skills"),
    path.join(process.env.HOME || "", ".openclaw", "skills")
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const root of roots) {
    const normalized = path.resolve(root);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

export const skillsPlugin: ServerPlugin = {
  id: "skills",
  async register({ app }) {
    app.get("/api/skills", async (_req, reply) => {
      const skillsRoots = resolveSkillsRoots();

      try {
        const docs = skillsRoots.flatMap((root) => findSkillDocs(root)).sort((a, b) => a.localeCompare(b));
        const uniqueDocs = [...new Set(docs)];

        const skills = uniqueDocs.map((skillDocAbs) => {
          const skillDirAbs = path.dirname(skillDocAbs);
          const relSkillDir = path.relative(config.paths.workspace, skillDirAbs);
          const relSkillDoc = path.relative(config.paths.workspace, skillDocAbs);
          const id = relSkillDir
            .replace(/^skills[\\/]/, "")
            .replace(/^company[\\/]skills[\\/]/, "") || path.basename(skillDirAbs);
          const stat = fs.statSync(skillDocAbs);
          const parsed = parseSkillDoc(skillDocAbs);

          const root = skillsRoots.find((candidate) => skillDocAbs.startsWith(candidate));
          const sourceRoot = root ? path.relative(config.paths.workspace, root) || root : "unknown";

          return {
            id,
            name: parsed.title ?? path.basename(skillDirAbs),
            summary: parsed.summary,
            skillPath: relSkillDir,
            skillDoc: relSkillDoc,
            sourceRoot,
            updatedAt: stat.mtime.toISOString()
          };
        });

        return {
          source: "local-filesystem",
          root: skillsRoots
            .map((root) => path.relative(config.paths.workspace, root) || root)
            .join(", "),
          count: skills.length,
          skills
        };
      } catch (err) {
        reply.code(500);
        return {
          error: `Failed to enumerate skills: ${errorMessage(err)}`,
          source: "local-filesystem",
          root: skillsRoots
            .map((root) => path.relative(config.paths.workspace, root) || root)
            .join(", "),
          count: 0,
          skills: []
        };
      }
    });
  }
};
