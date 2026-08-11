import { useMemo, useState } from "react";
import { Braces, Dice5, ExternalLink, KeyRound, Plus, ShieldCheck, Trash2, Wand2 } from "lucide-react";
import { cn } from "../utils/cn";
import { signJwt } from "../lib/jwt";
import { DEMO_ISS, DEMO_SECRET, randHex } from "../lib/samples";
import { ROLES } from "../lib/rbac";
import { JsonView, Panel, SectionHead, CopyButton } from "./ui";

interface Props {
  secret: string;
  onSecret: (s: string) => void;
  onInspectToken: (token: string, secret: string) => void;
}

const EXP_PRESETS: [number, string][] = [
  [900, "15 minutes"],
  [3600, "1 hour"],
  [28800, "8 hours"],
  [86400, "24 hours"],
  [604800, "7 days"],
];

const ALGS = ["HS256", "HS384", "HS512"] as const;
const ROLE_OPTIONS = [...ROLES.map((r) => r.id), "editor"];
const CLAIM_TYPES = ["string", "number", "boolean", "json"] as const;

const inputCls =
  "w-full rounded-lg border border-slate-700/70 bg-black/40 px-3 py-2.5 font-mono text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20";
const labelCls = "mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.2em] text-slate-500";

interface CustomClaim {
  key: string;
  value: string;
  type: (typeof CLAIM_TYPES)[number];
}

export default function TokenGenerator({ secret, onSecret, onInspectToken }: Props) {
  const [iss, setIss] = useState(DEMO_ISS);
  const [sub, setSub] = useState("usr_1a2b3c4d");
  const [aud, setAud] = useState("api.authpulse.dev");
  const [jti, setJti] = useState(() => `jti_${randHex(8)}`);
  const [roles, setRoles] = useState<string[]>(["admin"]);
  const [scope, setScope] = useState("profile email");
  const [expPreset, setExpPreset] = useState(3600);
  const [customMinutes, setCustomMinutes] = useState(60);
  const [alg, setAlg] = useState<(typeof ALGS)[number]>("HS256");
  const [claims, setClaims] = useState<CustomClaim[]>([{ key: "", value: "", type: "string" }]);
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");

  const expSeconds = expPreset === -1 ? Math.max(1, customMinutes) * 60 : expPreset;

  const buildPayload = (iat: number): Record<string, unknown> => {
    const p: Record<string, unknown> = {};
    if (iss.trim()) p.iss = iss.trim();
    if (sub.trim()) p.sub = sub.trim();
    if (aud.trim()) p.aud = aud.trim();
    p.roles = roles;
    if (scope.trim()) p.scope = scope.trim();
    p.iat = iat;
    p.exp = iat + expSeconds;
    if (jti.trim()) p.jti = jti.trim();
    for (const c of claims) {
      if (!c.key.trim()) continue;
      if (c.type === "number") p[c.key] = Number(c.value) || 0;
      else if (c.type === "boolean") p[c.key] = c.value === "true";
      else if (c.type === "json") {
        try {
          p[c.key] = JSON.parse(c.value || "null");
        } catch {
          p[c.key] = c.value;
        }
      } else p[c.key] = c.value;
    }
    return p;
  };

  const draftPayload = useMemo(() => buildPayload(Math.floor(Date.now() / 1000)), [iss, sub, aud, roles, scope, expSeconds, jti, claims]);

  const generate = async () => {
    if (!secret.trim()) {
      setErr("Provide a signing secret first — an empty key produces a garbage signature.");
      return;
    }
    try {
      setToken(await signJwt({ alg, typ: "JWT" }, buildPayload(Math.floor(Date.now() / 1000)), secret, alg));
      setErr("");
    } catch (e) {
      setErr(`Signing failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  };

  const setClaim = (i: number, patch: Partial<CustomClaim>) =>
    setClaims((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-6">
      <SectionHead
        eyebrow="04 · Token generator"
        title="Mint a real, signed JWT."
        desc="Compose the payload, pick a lifetime, and sign it in-browser with WebCrypto. The result verifies in the inspector — same secret, same digest."
      />

      <div className="grid gap-5 lg:grid-cols-12">
        {/* form */}
        <Panel className="space-y-5 p-5 lg:col-span-5">
          <div>
            <label className={labelCls}>issuer (iss)</label>
            <input value={iss} onChange={(e) => setIss(e.target.value)} spellCheck={false} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>subject (sub)</label>
              <input value={sub} onChange={(e) => setSub(e.target.value)} spellCheck={false} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>audience (aud)</label>
              <input value={aud} onChange={(e) => setAud(e.target.value)} spellCheck={false} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              token id (jti) <span className="normal-case tracking-normal text-slate-600">· revocable identity</span>
            </label>
            <div className="flex gap-2">
              <input value={jti} onChange={(e) => setJti(e.target.value)} spellCheck={false} className={inputCls} />
              <button
                onClick={() => setJti(`jti_${randHex(8)}`)}
                title="Regenerate jti"
                className="shrink-0 rounded-lg border border-slate-700/70 bg-slate-800/40 px-3 text-slate-300 transition-colors hover:border-violet-500/50 hover:text-violet-300"
              >
                <Dice5 size={15} />
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>roles</label>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_OPTIONS.map((r) => {
                const on = roles.includes(r);
                return (
                  <button
                    key={r}
                    onClick={() => setRoles((rs) => (on ? rs.filter((x) => x !== r) : [...rs, r]))}
                    className={cn(
                      "rounded-full border px-3 py-1.5 font-mono text-[11px] transition-all",
                      on
                        ? "border-violet-500/60 bg-violet-500/15 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                        : "border-slate-700 bg-slate-800/40 text-slate-500 hover:border-slate-500 hover:text-slate-300",
                    )}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>scope</label>
              <input value={scope} onChange={(e) => setScope(e.target.value)} spellCheck={false} placeholder="profile email" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>lifetime</label>
              <select value={expPreset} onChange={(e) => setExpPreset(Number(e.target.value))} className={inputCls}>
                {EXP_PRESETS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
                <option value={-1}>Custom…</option>
              </select>
            </div>
          </div>
          {expPreset === -1 && (
            <div>
              <label className={labelCls}>custom minutes</label>
              <input
                type="number"
                min={1}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(Number(e.target.value))}
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>algorithm</label>
            <div className="grid grid-cols-3 gap-1.5">
              {ALGS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAlg(a)}
                  className={cn(
                    "rounded-lg border py-2 font-mono text-[11.5px] transition-all",
                    alg === a
                      ? "border-violet-500/60 bg-violet-500/15 text-violet-200"
                      : "border-slate-700 bg-slate-800/40 text-slate-500 hover:text-slate-300",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1.5">
                <KeyRound size={11} /> signing secret (HMAC)
              </span>
            </label>
            <input
              value={secret}
              onChange={(e) => onSecret(e.target.value)}
              spellCheck={false}
              placeholder={DEMO_SECRET}
              className={cn(inputCls, "text-violet-200")}
            />
          </div>

          {/* custom claims */}
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1.5">
                <Braces size={11} /> custom claims
              </span>
            </label>
            <div className="space-y-2">
              {claims.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={c.key}
                    onChange={(e) => setClaim(i, { key: e.target.value })}
                    placeholder="key"
                    spellCheck={false}
                    className={cn(inputCls, "w-32 shrink-0")}
                  />
                  <input
                    value={c.value}
                    onChange={(e) => setClaim(i, { value: e.target.value })}
                    placeholder="value"
                    spellCheck={false}
                    className={cn(inputCls, "flex-1")}
                  />
                  <select
                    value={c.type}
                    onChange={(e) => setClaim(i, { type: e.target.value as CustomClaim["type"] })}
                    className={cn(inputCls, "w-24 shrink-0")}
                  >
                    {CLAIM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setClaims((cs) => cs.filter((_, idx) => idx !== i))}
                    disabled={claims.length === 1}
                    className="shrink-0 rounded-lg border border-slate-700/70 bg-slate-800/40 px-2.5 text-slate-400 transition-colors hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-30"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setClaims((cs) => [...cs, { key: "", value: "", type: "string" }])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-700 px-3 py-2 font-mono text-[11px] text-slate-500 transition-colors hover:border-violet-500/50 hover:text-violet-300"
              >
                <Plus size={13} /> add claim
              </button>
            </div>
          </div>
        </Panel>

        {/* output */}
        <div className="space-y-5 lg:col-span-7">
          <Panel className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-emerald-300">draft payload · live</span>
              <span className="font-mono text-[10.5px] text-slate-600">
                exp = iat + {Math.floor(expSeconds / 60)}m
              </span>
            </div>
            <div className="max-h-[260px] overflow-y-auto rounded-lg border border-slate-800 bg-black/40 p-4">
              <JsonView obj={{ alg, typ: "JWT" }} className="mb-1 opacity-60" />
              <div className="my-2 border-t border-dashed border-slate-800" />
              <JsonView obj={draftPayload} />
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-violet-300">signed token</span>
              <div className="ml-auto flex items-center gap-2">
                {token && (
                  <>
                    <CopyButton text={token} />
                    <button
                      onClick={() => onInspectToken(token, secret)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 font-mono text-[11px] text-cyan-300 transition-all hover:bg-cyan-500/20 hover:shadow-[0_0_14px_rgba(34,211,238,0.3)]"
                    >
                      <ExternalLink size={12} /> Open in Inspector
                    </button>
                  </>
                )}
              </div>
            </div>

            {err && (
              <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 font-mono text-[11.5px] text-rose-200">
                {err}
              </div>
            )}

            {token ? (
              <>
                <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-4 font-mono text-[11.5px] leading-relaxed break-all text-violet-100/90">
                  {token}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10.5px] text-slate-500">
                  <span>
                    signed with <span className="text-violet-300">{alg}</span>
                  </span>
                  <span>
                    key length <span className="text-slate-300">{secret.length}b</span>
                  </span>
                  <span>
                    token size <span className="text-slate-300">{token.length} chars</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <ShieldCheck size={11} /> will verify against the inspector
                  </span>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center">
                <Wand2 size={20} className="mx-auto text-slate-600" />
                <p className="mt-2 font-mono text-[11.5px] text-slate-500">token appears here after signing</p>
              </div>
            )}

            <button
              onClick={generate}
              className="mt-4 w-full rounded-lg border border-violet-500/50 bg-violet-500/15 py-3 font-display text-[14px] font-semibold tracking-wide text-violet-200 transition-all hover:bg-violet-500/25 hover:shadow-[0_0_24px_rgba(139,92,246,0.35)]"
            >
              {token ? "Re-sign token" : "Sign & generate token"}
            </button>
          </Panel>
        </div>
      </div>
    </div>
  );
}
