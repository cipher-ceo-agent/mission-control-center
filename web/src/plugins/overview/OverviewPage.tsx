import { useEffect, useMemo, useState } from "react";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";
import { api } from "../../lib/api/client";
import { Badge } from "../../components/Badge";

type AgentCard = {
  agentId: string;
  displayName: string;
  activeSessions: number;
  lastHeartbeat: string | null;
  state: "busy" | "idle";
};

export function OverviewPage() {
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [transcript, setTranscript] = useState<any[] | null>(null);
  const [transcriptKey, setTranscriptKey] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await api.overview();
        if (mounted) setData(next);
      } catch {
        // keep old data if poll fails
      }
    };

    load();
    const timer = setInterval(load, 7000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.overviewAgent(selected).then(setDetail).catch(() => setDetail(null));
  }, [selected]);

  const agents: AgentCard[] = data?.agents ?? [];

  const filtered = useMemo(
    () => agents.filter((a) => a.agentId.toLowerCase().includes(search.toLowerCase())),
    [agents, search]
  );

  const Row = ({ index, style }: ListChildComponentProps) => {
    const item = filtered[index];
    const tone = item.state === "busy" ? "yellow" : "green";

    return (
      <button
        style={style}
        className="w-full border-b border-slate-700 px-3 py-2 text-left hover:bg-slate-800"
        onClick={() => setSelected(item.agentId)}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">{item.displayName}</span>
          <Badge tone={tone}>{item.state}</Badge>
        </div>
        <div className="mt-1 text-xs text-slate-400">
          sessions: {item.activeSessions} · last: {item.lastHeartbeat ? new Date(item.lastHeartbeat).toLocaleString() : "n/a"}
        </div>
      </button>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="card">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Agent / Session Grid</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input md:max-w-xs"
            placeholder="Search agents..."
          />
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-slate-900 p-3">
            <div className="text-xs text-slate-400">Gateway state</div>
            <div className="text-base font-semibold">{data?.gateway?.state ?? "unknown"}</div>
          </div>
          <div className="rounded-lg bg-slate-900 p-3">
            <div className="text-xs text-slate-400">CPU cores</div>
            <div className="text-base font-semibold">{data?.host?.cpuCount ?? "-"}</div>
          </div>
          <div className="rounded-lg bg-slate-900 p-3">
            <div className="text-xs text-slate-400">RAM used</div>
            <div className="text-base font-semibold">
              {data?.host?.memory?.usedPct ? `${data.host.memory.usedPct}%` : "-"}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-700">
          <List height={420} width={"100%"} itemCount={filtered.length} itemSize={68}>
            {Row}
          </List>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 text-base font-semibold">Agent Detail</h3>
        {!selected && <p className="text-sm text-slate-400">Select an agent to view sessions.</p>}
        {selected && (
          <>
            <p className="mb-3 text-sm text-slate-300">{selected}</p>
            <div className="grid gap-2">
              {(detail?.sessions ?? []).map((s: any) => (
                <div key={s.sessionKey} className="rounded-lg bg-slate-900 p-3 text-sm">
                  <div className="font-medium">{s.label || s.sessionKey}</div>
                  <div className="mt-1 text-xs text-slate-400">{s.status} · {s.kind}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="btn"
                      onClick={() => navigator.clipboard.writeText(s.sessionKey || "")}
                    >
                      Copy Session Key
                    </button>
                    <button
                      className="btn"
                      onClick={async () => {
                        const out = await api.overviewHistory(s.sessionKey, 80);
                        setTranscript(out.messages || []);
                        setTranscriptKey(s.sessionKey);
                      }}
                    >
                      View Transcript
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {transcript && (
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Transcript (read-only)</h4>
              <button className="btn" onClick={() => setTranscript(null)}>Close</button>
            </div>
            <div className="mb-2 text-xs text-slate-400">session: {transcriptKey}</div>
            <div className="grid max-h-64 gap-2 overflow-auto">
              {transcript.map((m: any, i: number) => (
                <div key={i} className="rounded bg-slate-900 p-2 text-xs">
                  <div className="text-slate-400">{m.role || m.type || "message"}</div>
                  <div className="mt-1 whitespace-pre-wrap text-slate-200">{m.content || m.text || JSON.stringify(m)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
