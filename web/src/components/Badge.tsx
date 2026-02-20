import type { PropsWithChildren } from "react";

export function Badge({ children, tone = "neutral" }: PropsWithChildren<{ tone?: "neutral" | "green" | "yellow" | "red" | "blue" }>) {
  const cls = {
    neutral: "bg-slate-700 text-slate-100",
    green: "bg-emerald-700 text-emerald-100",
    yellow: "bg-amber-700 text-amber-100",
    red: "bg-red-700 text-red-100",
    blue: "bg-cyan-700 text-cyan-100"
  }[tone];

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs ${cls}`}>{children}</span>;
}
