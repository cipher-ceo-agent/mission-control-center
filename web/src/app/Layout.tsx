import { Outlet } from "react-router-dom";
import { Nav } from "../components/Nav";
import { TopStatus } from "../components/TopStatus";

export function Layout() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-10 border-b border-slate-700 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
          <div>
            <h1 className="text-lg font-semibold">Mission Control Center</h1>
            <p className="text-xs text-slate-400">Local operator dashboard</p>
          </div>
          <TopStatus />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 p-4 md:grid-cols-[220px_1fr]">
        <aside className="card h-fit">
          <Nav />
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
