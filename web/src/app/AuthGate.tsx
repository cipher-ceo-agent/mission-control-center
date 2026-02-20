import { useEffect, useState, type FormEvent, type PropsWithChildren } from "react";
import { api } from "../lib/api/client";

type AuthState = {
  checking: boolean;
  requiresAuth: boolean;
  authenticated: boolean;
  error: string;
};

export function AuthGate({ children }: PropsWithChildren) {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<AuthState>({
    checking: true,
    requiresAuth: false,
    authenticated: true,
    error: ""
  });

  const check = async () => {
    try {
      const out = await api.authStatus();
      setState({
        checking: false,
        requiresAuth: out.requiresAuth,
        authenticated: out.authenticated,
        error: ""
      });
    } catch (err: any) {
      setState({
        checking: false,
        requiresAuth: true,
        authenticated: false,
        error: err?.message || "Unable to verify auth status"
      });
    }
  };

  useEffect(() => {
    check();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setState((s) => ({ ...s, error: "" }));
    try {
      await api.login(password);
      await check();
      setPassword("");
    } catch (err: any) {
      setState((s) => ({ ...s, error: err?.message || "Login failed" }));
    }
  };

  if (state.checking) {
    return <div className="mx-auto max-w-7xl p-4 text-sm text-slate-400">Checking authentication…</div>;
  }

  if (!state.requiresAuth || state.authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="card">
        <h2 className="text-lg font-semibold">MCC Login Required</h2>
        <p className="mt-1 text-sm text-slate-400">LAN mode is enabled. Enter MCC password to continue.</p>

        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <input
            className="input"
            type="password"
            placeholder="MCC password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button className="btn" type="submit">Sign in</button>
        </form>

        {state.error && <p className="mt-3 text-xs text-red-300">{state.error}</p>}
      </div>
    </div>
  );
}
