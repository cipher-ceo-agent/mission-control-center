import { useState } from "react";
import { api } from "../../lib/api/client";

export function MemoryPage() {
  const [query, setQuery] = useState("");
  const [agentId, setAgentId] = useState("main");
  const [globalMode, setGlobalMode] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [clearPhrase, setClearPhrase] = useState("");
  const [importText, setImportText] = useState("");
  const [busy, setBusy] = useState(false);

  const runSearch = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const out = await api.memorySearch({ query, maxResults: 15, global: globalMode, agentId });
      setResults(out.results || out.items || out.matches || []);
    } finally {
      setBusy(false);
    }
  };

  const exportMemory = async () => {
    setBusy(true);
    try {
      const out = await api.memoryExport(globalMode ? { all: true } : { agentId });
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mcc-memory-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const importMemory = async () => {
    if (!importText.trim()) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(importText);
      await api.memoryImport({ items: parsed.items || [], overwrite: true });
      alert("Memory import complete.");
    } catch (err: any) {
      alert(err?.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const clearMemory = async () => {
    if (!confirm("This is destructive. Continue?")) return;
    setBusy(true);
    try {
      await api.memoryClear({ confirm: clearPhrase, target: "all" });
      alert("Memory cleared.");
    } catch (err: any) {
      alert(err?.message || "Clear failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div className="card">
        <h2 className="mb-3 text-lg font-semibold">Memory Manager</h2>
        <div className="mb-3 grid gap-3 md:grid-cols-[1fr_160px]">
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search memory..." />
          <button className="btn" disabled={busy} onClick={runSearch}>Search</button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={globalMode} onChange={(e) => setGlobalMode(e.target.checked)} />
            Global search mode
          </label>
          {!globalMode && (
            <input
              className="input max-w-xs"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="agent id"
            />
          )}
        </div>

        <div className="grid gap-2">
          {results.map((r: any, i: number) => (
            <div key={i} className="rounded-lg bg-slate-900 p-3 text-sm">
              <div className="text-slate-100">{r.snippet || r.text || "(no snippet)"}</div>
              <div className="mt-1 text-xs text-slate-400">
                Source: {r.path || r.source || "unknown"} {r.line ? `#${r.line}` : ""}
              </div>
            </div>
          ))}
          {results.length === 0 && <div className="text-sm text-slate-500">No results yet.</div>}
        </div>
      </div>

      <div className="card">
        <h3 className="text-base font-semibold">Actions</h3>
        <div className="mt-3 grid gap-3">
          <button className="btn" disabled={busy} onClick={exportMemory}>Export Memory JSON</button>

          <label className="text-xs text-slate-400">Import payload JSON</label>
          <textarea
            className="input min-h-32"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"items":[{"path":"memory/2026-02-20.md","content":"..."}]}'
          />
          <button className="btn" disabled={busy} onClick={importMemory}>Import Memory</button>

          <hr className="border-slate-700" />
          <label className="text-xs text-slate-400">Type CLEAR MEMORY to confirm</label>
          <input className="input" value={clearPhrase} onChange={(e) => setClearPhrase(e.target.value)} />
          <button className="btn btn-danger" disabled={busy} onClick={clearMemory}>Clear Memory</button>
        </div>
      </div>
    </div>
  );
}
