import { useCallback, useEffect, useRef, useState } from "react";
import {
  Fingerprint,
  Lock,
  Route,
  Shield,
  ShieldCheck,
  Trash2,
  Wand2,
  Wrench,
} from "lucide-react";
import { cn } from "./utils/cn";
import { useScramble } from "./lib/hooks";
import { buildSamples, DEMO_SECRET } from "./lib/samples";
import JwtInspector from "./components/JwtInspector";
import OAuthSimulator from "./components/OAuthSimulator";
import RbacDebugger from "./components/RbacDebugger";
import TokenGenerator from "./components/TokenGenerator";

type Tab = "jwt" | "oauth" | "rbac" | "gen";

const TABS: { id: Tab; label: string; Icon: typeof Fingerprint }[] = [
  { id: "jwt", label: "JWT Inspector", Icon: Fingerprint },
  { id: "oauth", label: "OAuth2 Simulator", Icon: Route },
  { id: "rbac", label: "RBAC Matrix", Icon: ShieldCheck },
  { id: "gen", label: "Token Generator", Icon: Wrench },
];

interface Toast {
  id: number;
  msg: string;
  tone: "ok" | "rose";
}

export default function App() {
  const [tab, setTab] = useState<Tab>("jwt");
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [sessionKey, setSessionKey] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number>(0);
  const booted = useRef(false);

  const title = useScramble("AuthPulse");

  const showToast = useCallback((msg: string, tone: Toast["tone"] = "ok") => {
    setToast({ id: Date.now(), msg, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  const loadSample = useCallback(
    async (id: "admin" | "guest" | "svc" = "admin", announce = true) => {
      const samples = await buildSamples();
      const pick = samples.find((s) => s.id === id) ?? samples[0];
      setToken(pick.token);
      setSecret(DEMO_SECRET);
      setTab("jwt");
      if (announce) showToast(`Sample loaded — ${pick.label} · ${pick.hint}`);
    },
    [showToast],
  );

  /* boot: drop a fresh valid token on the table */
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    loadSample("admin", false);
  }, [loadSample]);

  const clearAll = useCallback(() => {
    setToken("");
    setSecret("");
    setSessionKey((k) => k + 1);
    showToast("All sessions cleared — tool state wiped", "rose");
  }, [showToast]);

  const onInspectToken = useCallback(
    (tok: string, sec: string) => {
      setToken(tok);
      setSecret(sec);
      setTab("jwt");
      showToast("Token handed to JWT Inspector");
    },
    [showToast],
  );

  /* keyboard: 1–4 switch tools */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      if (idx >= 0) setTab(TABS[idx].id);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* ambient scene */}
      <div className="bg-scene" aria-hidden />
      <div className="bg-grid" aria-hidden />
      <div className="scanline" aria-hidden />
      <div className="noise" aria-hidden />

      {/* header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-void/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex items-center gap-3 py-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-500/40 bg-violet-500/10 pulse-ring">
              <Shield size={20} className="glow-breathe text-violet-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h1 className="font-display text-[21px] font-bold leading-none tracking-wide text-slate-50 text-glow-violet">
                  {title}
                </h1>
                <span className="hidden font-mono text-[10px] text-slate-600 sm:inline">/v2.4.1</span>
              </div>
              <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.3em] text-slate-500">
                token · flow · access
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 md:flex">
                <span className="dot-live h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="font-mono text-[11px] text-emerald-300">Auth Engine: Active</span>
              </div>

              <button
                onClick={() => loadSample("admin")}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 font-mono text-[11.5px] text-violet-200 transition-all hover:bg-violet-500/20 hover:shadow-[0_0_16px_rgba(139,92,246,0.35)]"
              >
                <Wand2 size={13} />
                <span className="hidden sm:inline">Load Sample Token</span>
                <span className="sm:hidden">Sample</span>
              </button>
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 font-mono text-[11.5px] text-slate-300 transition-all hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Clear All Sessions</span>
                <span className="sm:hidden">Clear</span>
              </button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map((t, i) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-[13px] font-medium transition-colors",
                    active ? "bg-violet-500/10 text-violet-200" : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200",
                  )}
                >
                  <t.Icon size={15} className={active ? "text-violet-300" : "text-slate-500"} />
                  {t.label}
                  <kbd
                    className={cn(
                      "hidden rounded border px-1 font-mono text-[9px] lg:inline",
                      active ? "border-violet-500/40 text-violet-400" : "border-slate-700 text-slate-600",
                    )}
                  >
                    {i + 1}
                  </kbd>
                  {active && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.9)]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* main view */}
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div key={`${sessionKey}-${tab}`} className="anim-fade-up">
          {tab === "jwt" && (
            <JwtInspector token={token} onToken={setToken} secret={secret} onSecret={setSecret} />
          )}
          {tab === "oauth" && <OAuthSimulator onInspectToken={onInspectToken} />}
          {tab === "rbac" && <RbacDebugger key={`rbac-${sessionKey}`} />}
          {tab === "gen" && (
            <TokenGenerator secret={secret} onSecret={setSecret} onInspectToken={onInspectToken} />
          )}
        </div>
      </main>

      {/* footer */}
      <footer className="mx-auto max-w-7xl px-4 pb-8 md:px-6">
        <div className="panel flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 font-mono text-[11px] text-slate-500">
          <span>
            AuthPulse <span className="text-violet-400">v2.4.1</span>
          </span>
          <span className="hidden sm:inline">HS256 · RS256 · PKCE (S256) · OIDC 1.0</span>
          <span className="inline-flex items-center gap-1.5">
            <Lock size={11} className="text-emerald-400" />
            all operations client-side — no token ever leaves this tab
          </span>
          <span className="ml-auto">
            shortcuts: <kbd className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">1–4</kbd> switch tools
          </span>
        </div>
      </footer>

      {/* toast */}
      {toast && (
        <div
          key={toast.id}
          className={cn(
            "toast-in fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-lg border px-4 py-3 font-mono text-[12px] shadow-xl",
            toast.tone === "ok"
              ? "border-emerald-500/40 bg-[#0c1a15]/95 text-emerald-200 shadow-emerald-500/10"
              : "border-rose-500/40 bg-[#1c0f14]/95 text-rose-200 shadow-rose-500/10",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", toast.tone === "ok" ? "bg-emerald-400" : "bg-rose-400")} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
