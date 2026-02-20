import { useEffect, useState } from "react";
import { api } from "../../lib/api/client";

function errMsg(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Request failed";
}

export function SkillsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ source: string; root: string; count: number; skills: any[] } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await api.skillsList();
      if (out.error) throw new Error(out.error);
      setData(out);
    } catch (err) {
      setData(null);
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Skills</h2>
        <button className="btn" onClick={() => load()} disabled={loading}>Refresh</button>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading skills…</p>}
      {error && <div className="mb-3 rounded border border-red-700 bg-red-950/40 p-2 text-sm text-red-200">{error}</div>}

      {data && (
        <>
          <p className="mb-3 text-sm text-slate-400">
            {data.count} installed skill{data.count === 1 ? "" : "s"} · root: {data.root}
          </p>

          <div className="grid gap-3">
            {data.skills.map((skill: any) => (
              <div key={skill.id} className="rounded-lg bg-slate-900 p-3 text-sm">
                <div className="font-medium text-slate-100">{skill.name}</div>
                {skill.summary && <p className="mt-1 text-slate-300">{skill.summary}</p>}
                <div className="mt-2 text-xs text-slate-400">path: {skill.skillPath}</div>
                <div className="text-xs text-slate-500">doc: {skill.skillDoc}</div>
                <div className="text-xs text-slate-500">updated: {new Date(skill.updatedAt).toLocaleString()}</div>
              </div>
            ))}
            {data.skills.length === 0 && <div className="text-sm text-slate-500">No SKILL.md files found.</div>}
          </div>
        </>
      )}
    </div>
  );
}
