import { useEffect, useState } from "react";
import { api, type GatewayState } from "../lib/api/client";
import { Badge } from "./Badge";

export function TopStatus() {
  const [state, setState] = useState<GatewayState>("disconnected");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const s = await api.gatewayStatus();
        if (mounted) setState(s.state);
      } catch {
        if (mounted) setState("disconnected");
      }
    };

    run();
    const t = setInterval(run, 5000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const tone = state === "connected" ? "green" : state === "reconnecting" ? "yellow" : state === "unauthorized" ? "red" : "neutral";

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-slate-400">Gateway</span>
      <Badge tone={tone}>{state}</Badge>
    </div>
  );
}
