import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api/client";
import { Badge } from "../../components/Badge";

function errMsg(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Request failed";
}

function formatSchedule(job: any): string {
  const s = job.schedule;
  if (!s) return "n/a";
  if (s.kind === "cron") return `${s.expr} (${s.tz || "UTC"})`;
  if (s.kind === "every") return `every ${Math.round((s.everyMs || 0) / 1000)}s`;
  if (s.kind === "at") return `at ${new Date(s.at).toLocaleString()}`;
  return "n/a";
}

export function CalendarPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [expr, setExpr] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const out = await api.cronList();
    if (out.error) throw new Error(out.error);
    setJobs(out.jobs || []);
  };

  useEffect(() => {
    load()
      .then(() => setError(null))
      .catch((err) => setError(errMsg(err)));

    const t = setInterval(() => {
      load().catch((err) => setError(errMsg(err)));
    }, 10000);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selected?.jobId && !selected?.id) return;
    const id = selected.jobId || selected.id;
    api
      .cronRuns(id)
      .then((r) => {
        setRuns(r.runs || r.items || r.entries || []);
      })
      .catch((err) => {
        setRuns([]);
        setError(errMsg(err));
      });
  }, [selected]);

  const sorted = useMemo(() => [...jobs].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))), [jobs]);
  const groupedByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const job of sorted) {
      const key = job.nextRunAt ? new Date(job.nextRunAt).toLocaleDateString() : "No next run";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(job);
    }
    return [...map.entries()];
  }, [sorted]);

  const toggleEnabled = async (job: any) => {
    const id = job.jobId || job.id;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await api.cronPatch(id, { enabled: !job.enabled });
      await load();
      setNotice(`${job.name || id} ${job.enabled ? "disabled" : "enabled"}.`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const runNow = async (job: any) => {
    const id = job.jobId || job.id;
    if (!confirm(`Run ${job.name || id} now?`)) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await api.cronRun(id);
      setNotice(`${job.name || id} run triggered.`);
      if (selected && (selected.jobId || selected.id) === id) {
        const r = await api.cronRuns(id);
        setRuns(r.runs || r.items || r.entries || []);
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const saveSchedule = async () => {
    if (!selected) return;
    const id = selected.jobId || selected.id;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await api.cronPatch(id, { schedule: { kind: "cron", expr, tz: selected.schedule?.tz || "America/Los_Angeles" } });
      await load();
      setNotice("Schedule updated.");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div className="card overflow-hidden">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cron + Heartbeats</h2>
          <div className="flex gap-2">
            <button className={`btn ${viewMode === "list" ? "bg-cyan-700" : ""}`} onClick={() => setViewMode("list")}>List</button>
            <button className={`btn ${viewMode === "calendar" ? "bg-cyan-700" : ""}`} onClick={() => setViewMode("calendar")}>Calendar</button>
          </div>
        </div>

        {error && <div className="mb-3 rounded border border-red-700 bg-red-950/40 p-2 text-sm text-red-200">{error}</div>}
        {notice && <div className="mb-3 rounded border border-green-700 bg-green-950/30 p-2 text-sm text-green-100">{notice}</div>}

        {viewMode === "list" ? (
          <div className="overflow-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Schedule</th>
                  <th className="pb-2">Next run</th>
                  <th className="pb-2">Enabled</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((job) => {
                  const id = job.jobId || job.id;
                  return (
                    <tr key={id} className="border-t border-slate-700">
                      <td className="py-2 pr-3 align-top">
                        <button className="text-left underline" onClick={() => { setSelected(job); setExpr(job.schedule?.expr || ""); }}>
                          {job.name || id}
                        </button>
                        <div className="text-xs text-slate-400">target: {job.payload?.kind || "n/a"}</div>
                      </td>
                      <td className="py-2 pr-3 align-top">{formatSchedule(job)}</td>
                      <td className="py-2 pr-3 align-top">{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : "n/a"}</td>
                      <td className="py-2 pr-3 align-top">{job.enabled ? <Badge tone="green">on</Badge> : <Badge tone="red">off</Badge>}</td>
                      <td className="py-2 align-top">
                        <div className="flex gap-2">
                          <button className="btn" disabled={loading} onClick={() => toggleEnabled(job)}>
                            {job.enabled ? "Disable" : "Enable"}
                          </button>
                          <button className="btn" disabled={loading} onClick={() => runNow(job)}>Run now</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sorted.length === 0 && <div className="py-3 text-sm text-slate-500">No cron jobs returned.</div>}
          </div>
        ) : (
          <div className="grid gap-3">
            {groupedByDay.map(([day, dayJobs]) => (
              <div key={day} className="rounded-lg border border-slate-700 p-3">
                <div className="mb-2 text-sm font-semibold">{day}</div>
                <div className="grid gap-2">
                  {dayJobs.map((job) => {
                    const id = job.jobId || job.id;
                    return (
                      <button
                        key={id}
                        className="rounded bg-slate-900 p-2 text-left text-sm hover:bg-slate-800"
                        onClick={() => {
                          setSelected(job);
                          setExpr(job.schedule?.expr || "");
                        }}
                      >
                        <div>{job.name || id}</div>
                        <div className="text-xs text-slate-400">
                          {job.nextRunAt ? new Date(job.nextRunAt).toLocaleTimeString() : "n/a"} · {formatSchedule(job)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {groupedByDay.length === 0 && <div className="text-sm text-slate-500">No cron jobs returned.</div>}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="mb-2 text-base font-semibold">Selected Job</h3>
        {!selected && <p className="text-sm text-slate-400">Choose a job to inspect runs / edit schedule.</p>}
        {selected && (
          <>
            <div className="text-sm text-slate-200">{selected.name || selected.jobId || selected.id}</div>
            <label className="mt-3 block text-xs text-slate-400">Cron expression</label>
            <input className="input mt-1" value={expr} onChange={(e) => setExpr(e.target.value)} />
            <button className="btn mt-2" disabled={loading || !expr} onClick={saveSchedule}>Save Schedule</button>

            <h4 className="mt-4 text-sm font-semibold">Recent Runs</h4>
            <div className="mt-2 grid max-h-72 gap-2 overflow-auto">
              {runs.map((run: any, idx: number) => (
                <div key={run.runId || idx} className="rounded-lg bg-slate-900 p-2 text-xs">
                  <div>{run.status || "unknown"}</div>
                  <div className="text-slate-400">{run.startedAt ? new Date(run.startedAt).toLocaleString() : "n/a"}</div>
                </div>
              ))}
              {runs.length === 0 && <div className="text-xs text-slate-500">No run history returned.</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
