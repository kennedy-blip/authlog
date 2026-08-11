import { useMemo, useState } from "react";
import { Bot, Check, Eye, FileQuestion, Flag, RotateCcw, Shield, ShieldCheck, ShieldX, X } from "lucide-react";
import { cn } from "../utils/cn";
import { checkAccess, DEFAULT_MATRIX, ENDPOINTS, ROLES, type Matrix } from "../lib/rbac";
import { MethodBadge, Panel, SectionHead } from "./ui";

const ROLE_ICON: Record<string, typeof Shield> = {
  admin: Shield,
  moderator: Flag,
  guest: Eye,
  service_account: Bot,
};

const TONE: Record<string, { text: string; border: string; bg: string; glow: string }> = {
  violet: { text: "text-violet-300", border: "border-violet-500/40", bg: "bg-violet-500/10", glow: "shadow-[0_0_26px_-6px_rgba(139,92,246,0.55)]" },
  emerald: { text: "text-emerald-300", border: "border-emerald-500/40", bg: "bg-emerald-500/10", glow: "shadow-[0_0_26px_-6px_rgba(16,185,129,0.5)]" },
  cyan: { text: "text-cyan-300", border: "border-cyan-500/40", bg: "bg-cyan-500/10", glow: "shadow-[0_0_26px_-6px_rgba(34,211,238,0.5)]" },
  amber: { text: "text-amber-300", border: "border-amber-500/40", bg: "bg-amber-500/10", glow: "shadow-[0_0_26px_-6px_rgba(245,158,11,0.5)]" },
};

const TRACE_TONE: Record<string, string> = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  bad: "text-rose-300",
  info: "text-slate-400",
};

const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"];

const inputCls =
  "rounded-lg border border-slate-700/70 bg-black/40 px-3 py-2.5 font-mono text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20";

export default function RbacDebugger() {
  const [role, setRole] = useState("admin");
  const [matrix, setMatrix] = useState<Matrix>(() => JSON.parse(JSON.stringify(DEFAULT_MATRIX)));
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/api/v1/users?expand=roles");

  const result = useMemo(() => checkAccess(matrix, role, method, path), [matrix, role, method, path]);

  const diffCount = useMemo(
    () =>
      ENDPOINTS.reduce(
        (acc, ep) => acc + ROLES.filter((r) => (matrix[ep.id]?.[r.id] ?? false) !== (DEFAULT_MATRIX[ep.id]?.[r.id] ?? false)).length,
        0,
      ),
    [matrix],
  );

  const toggle = (epId: string, roleId: string) =>
    setMatrix((m) => ({ ...m, [epId]: { ...m[epId], [roleId]: !(m[epId]?.[roleId] ?? false) } }));

  const verdict =
    result.status === "allow"
      ? { word: "ALLOWED", sub: "200 OK — request proceeds to handler", box: "border-emerald-500/40 bg-emerald-500/10", text: "text-emerald-300", Icon: ShieldCheck }
      : result.status === "deny"
        ? { word: "DENIED", sub: "403 Forbidden — role lacks this grant", box: "border-rose-500/40 bg-rose-500/10", text: "text-rose-300", Icon: ShieldX }
        : { word: "NO ROUTE", sub: "404 — route not present in policy table", box: "border-slate-600/60 bg-slate-800/40", text: "text-slate-300", Icon: FileQuestion };

  return (
    <div className="space-y-6">
      <SectionHead
        eyebrow="03 · RBAC matrix"
        title="Role × Endpoint debugger."
        desc="Flip grants live, pick a role, and fire requests at the policy table. The evaluation trace shows exactly how the middleware reached its verdict."
        right={
          <div className="rounded-lg border border-slate-700/70 bg-slate-800/30 px-3.5 py-2 font-mono text-[11px] text-slate-400">
            policy table · <span className="text-violet-300">{ENDPOINTS.length} routes</span> ×{" "}
            <span className="text-violet-300">{ROLES.length} roles</span>
            {diffCount > 0 && <span className="ml-2 text-amber-300">{diffCount} override{diffCount > 1 ? "s" : ""} live</span>}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-12">
        {/* role picker */}
        <div className="space-y-3 lg:col-span-4">
          {ROLES.map((r) => {
            const Icon = ROLE_ICON[r.id];
            const tone = TONE[r.tone];
            const selected = role === r.id;
            const allowed = ENDPOINTS.filter((ep) => matrix[ep.id]?.[r.id]).length;
            return (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                className={cn("panel panel-hover flex w-full items-center gap-3.5 p-4 text-left", selected && cn(tone.border, tone.glow))}
              >
                <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg border", tone.border, tone.bg)}>
                  <Icon size={19} className={tone.text} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-[14px] font-semibold text-slate-100">{r.label}</span>
                    <span className={cn("font-mono text-[10.5px]", selected ? tone.text : "text-slate-500")}>
                      {allowed}/{ENDPOINTS.length} routes
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{r.desc}</p>
                </div>
                {selected && <Check size={16} className={cn("ml-auto shrink-0", tone.text)} />}
              </button>
            );
          })}

          <Panel className="p-4">
            <div className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.2em] text-slate-500">active role grants</div>
            <div className="flex flex-wrap gap-1.5">
              {ENDPOINTS.filter((ep) => matrix[ep.id]?.[role]).map((ep) => (
                <span key={ep.id} className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/50 px-2 py-1 font-mono text-[10px] text-slate-300">
                  <span className="text-emerald-400">✓</span>
                  {ep.method} {ep.path}
                </span>
              ))}
              {!ENDPOINTS.some((ep) => matrix[ep.id]?.[role]) && (
                <span className="font-mono text-[11px] text-rose-300">no routes granted — zero-trust locked out</span>
              )}
            </div>
          </Panel>
        </div>

        {/* checker + matrix */}
        <div className="space-y-5 lg:col-span-8">
          <Panel className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500">endpoint checker</span>
              <span className="ml-auto rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-0.5 font-mono text-[10.5px] text-violet-300">
                as: {role}
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={cn(inputCls, "w-[110px]")}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                spellCheck={false}
                placeholder="/api/v1/users/:id?fields=…"
                className={cn(inputCls, "min-w-[220px] flex-1")}
              />
            </div>

            {/* verdict */}
            <div className={cn("mt-4 flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3.5 transition-colors", verdict.box)}>
              <verdict.Icon size={26} className={verdict.text} />
              <div>
                <div className={cn("font-display text-lg font-bold tracking-wide", verdict.text)}>{verdict.word}</div>
                <div className="font-mono text-[11px] text-slate-400">
                  {verdict.sub} · {method} {path.split("?")[0] || "/"}
                </div>
              </div>
              <div className="ml-auto text-right font-mono text-[11px] leading-relaxed">
                <div className="text-slate-500">granted to</div>
                <div className="max-w-[240px] text-slate-300">{result.rolesWithAccess.join(", ") || "nobody"}</div>
              </div>
            </div>

            {/* trace */}
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-black/50 p-4 font-mono text-[11.5px] leading-[1.9]">
              {result.trace.map((t, i) => (
                <div key={i} className={cn("whitespace-pre", TRACE_TONE[t.tone])}>
                  {t.text}
                </div>
              ))}
              <span className="caret-blink text-violet-400">▍</span>
            </div>
          </Panel>

          {/* matrix */}
          <Panel className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500">permission matrix</span>
              <span className="font-mono text-[10.5px] text-slate-600">click any cell to flip the grant</span>
              <button
                onClick={() => setMatrix(JSON.parse(JSON.stringify(DEFAULT_MATRIX)))}
                disabled={diffCount === 0}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-slate-800/40 px-2.5 py-1.5 font-mono text-[11px] text-slate-300 transition-colors hover:border-violet-500/50 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw size={12} /> Reset to default
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="pb-2 pl-2 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">route</th>
                    {ROLES.map((r) => (
                      <th
                        key={r.id}
                        className={cn(
                          "px-1.5 pb-2 text-center font-mono text-[10px] uppercase tracking-wider",
                          role === r.id ? "text-violet-300" : "text-slate-500",
                        )}
                      >
                        {r.label}
                        {role === r.id && <div className="mx-auto mt-1 h-0.5 w-6 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ENDPOINTS.map((ep) => (
                    <tr key={ep.id} className="group">
                      <td className="rounded-l-lg py-2 pl-2 pr-3 transition-colors group-hover:bg-slate-800/30">
                        <div className="flex items-center gap-2.5">
                          <MethodBadge method={ep.method} />
                          <span className="font-mono text-[12px] text-slate-200">{ep.path}</span>
                        </div>
                        <div className="hidden pl-[60px] text-[11px] text-slate-500 md:block">{ep.desc}</div>
                      </td>
                      {ROLES.map((r, ri) => {
                        const allowed = !!matrix[ep.id]?.[r.id];
                        const highlight = role === r.id;
                        const isLast = ri === ROLES.length - 1;
                        return (
                          <td
                            key={r.id}
                            className={cn(
                              "p-1.5 text-center transition-colors group-hover:bg-slate-800/20",
                              highlight && "bg-violet-500/[0.06]",
                              isLast && "rounded-r-lg",
                            )}
                          >
                            <button
                              onClick={() => toggle(ep.id, r.id)}
                              title={`${r.label} → ${ep.method} ${ep.path}`}
                              className={cn(
                                "mx-auto grid h-8 w-8 place-items-center rounded-md border transition-all active:scale-90",
                                allowed
                                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                  : "border-slate-700/70 bg-slate-800/40 text-slate-600 hover:border-rose-500/40 hover:text-rose-400",
                                highlight && "ring-1 ring-violet-500/40",
                              )}
                            >
                              {allowed ? <Check size={14} /> : <X size={14} />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[10.5px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="grid h-4 w-4 place-items-center rounded border border-emerald-500/50 bg-emerald-500/15 text-emerald-300">
                  <Check size={9} />
                </span>
                grant
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="grid h-4 w-4 place-items-center rounded border border-slate-700 bg-slate-800/40 text-slate-600">
                  <X size={9} />
                </span>
                deny
              </span>
              <span className="ml-auto">path params like <span className="text-cyan-300">:id</span> match any non-empty segment</span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
