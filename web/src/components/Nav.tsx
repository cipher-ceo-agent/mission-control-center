import { NavLink } from "react-router-dom";

const items = [
  ["/", "Overview"],
  ["/calendar", "Calendar"],
  ["/memory", "Memory"],
  ["/tasks", "Tasks"],
  ["/skills", "Skills"],
  ["/activity", "Activity"],
  ["/stats", "Stats"]
] as const;

export function Nav() {
  return (
    <nav className="grid gap-2">
      {items.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm ${isActive ? "bg-cyan-700 text-white" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
