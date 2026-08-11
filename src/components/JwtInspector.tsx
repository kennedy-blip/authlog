import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crosshair,
  Fingerprint,
  Globe2,
  Hash,
  History,
  Info,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Timer,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useNow } from "../lib/hooks";
import { decodeJwt, getExpStatus, runClaimChecks, verifySignature, type VerifyResult } from "../lib/jwt";
import { buildSamples, DEMO_SECRET, type SampleToken } from "../lib/samples";
import { CopyButton, JsonView, Panel, SectionHead } from "./ui";

interface Props {
  token: string;
  onToken: (t: string) => void;
  secret: string;
  onSecret: (s: string) => void;
}

const VERIFY_UI: Record<VerifyResult["state"], { label: string; text: string; box: string; Icon: ComponentType<{ size?: number | string; className?: string }> }> = {
  verified: { label: "SIGNATURE VALID", text: "text-emerald-300", box: "border-emerald-500/40 bg-emerald-500/10", Icon: ShieldCheck },
  mismatch: { label: "SIGNATURE MISMATCH", text: "text-rose-300", box: "border-rose-500/40 bg-rose-500/10", Icon: ShieldX },
  "no-key": { label: "AWAITING KEY MATERIAL", text: "text-slate-300", box: "border-slate-600/60 bg-slate-800/40", Icon: KeyRound },
  unsigned: { label: "UNSIGNED TOKEN", text: "text-rose-300", box: "border-rose-500/40 bg-rose-500/10", Icon: ShieldAlert },
  unsupported: { label: "NOT VERIFIABLE IN-BROWSER", text: "text-amber-300", box: "border-amber-500/40 bg-amber-500/10", Icon: Info },
  error: { label: "VERIFICATION ERROR", text: "text-amber-300", box: "border-amber-500/40 bg-amber-500/10", Icon: AlertTriangle },
};

const EXP_TONE: Record<string, { border: string; text: string; chip: string }> = {
  valid: { border: "border-emerald-500/50", text: "text-emerald-300", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  expiring: { border: "border-amber-500/50", text: "text-amber-300", chip: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  expired: { border: "border-rose-500/50", text: "text-rose-300", chip: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  unknown: { border: "border-slate-600/60", text: "text-slate-300", chip: "bg-slate-700/30 text-slate-300 border-slate-600/60" },
};

const CLAIM_META: { key: string; Icon: ComponentType<{ size?: number | string; className?: string }> }[] = [
  { key: "sub", Icon: Fingerprint },
  { key: "name", Icon: User },
  { key: "iss", Icon: Globe2 },
  { key: "aud", Icon: Crosshair },
  { key: "roles", Icon: ShieldCheck },
  { key: "exp", Icon: Timer },
  { key: "iat", Icon: History },
  { key: "jti", Icon: Hash },
];

export default function JwtInspector({ token, onToken, secret, onSecret }: Props) {
  const now = useNow(1000);
  const decoded = useMemo(() => decodeJwt(token), [token]);
  const [samples, setSamples] = useState<SampleToken[] | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let on = true;
    buildSamples().then((s) => on && setSamples(s));
    return () => {
      on = false;
    };
  }, []);

  useEffect(() => {
    if (!decoded.ok) {
      setVerify(null);
      return;
    }
    if (String(decoded.alg) === "none") {
      setVerify({
        state: "unsigned",
        detail: 'alg "none" — token carries no signature. Any client can forge claims. Reject in production.',
      });
      return;
    }
    if (!secret.trim()) {
      const needs = String(decoded.alg).startsWith("HS") ? "HMAC secret" : "PEM public key (SPKI)";
      setVerify({ state: "no-key", detail: `${decoded.alg} needs ${needs} to run the digest check.` });
      return;
    }
    let live = true;
    setVerifying(true);
    const t = window.setTimeout(async () => {
      const r = await verifySignature(decoded, secret);
      if (live) {
        setVerify(r);
        setVerifying(false);
      }
    }, 220);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [decoded, secret]);

  const exp = decoded.ok ? getExpStatus(decoded.payload, now) : null;
  const checks = useMemo(() => runClaimChecks(decoded, now), [decoded, now]);
  const expTone = exp ? EXP_TONE[exp.state] : EXP_TONE.unknown;

  const claimChips = decoded.ok
    ? CLAIM_META.filter(({ key }) => decoded.payload && typeof decoded.payload[key] !== "undefined").map(({ key }) => {
        const v = decoded.payload![key];
        return { key, value: Array.isArray(v) ? v.join(" · ") : String(v), Icon: CLAIM_META.find((c) => c.key === key)!.Icon };
      })
    : [];

  const vUi = verify ? VERIFY_UI[verify.state] : null;

  return (
    <div className="space-y-6">
      <SectionHead
        eyebrow="01 · JWT Inspector"
        title="Decode. Verify. Expiry."
        desc="Paste any Bearer token — the three segments are split, decoded and sanity-checked locally in milliseconds. Nothing is sent anywhere."
        right={
          samples ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-widest text-slate-500">demo set</span>
              {samples.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onToken(s.token);
                    onSecret(DEMO_SECRET);
                  }}
                  className="group rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-1.5 text-left transition-all hover:border-violet-400/60 hover:bg-violet-500/15 hover:shadow-[0_0_18px_rgba(139,92,246,0.25)]"
                >
                  <span className="block font-mono text-[11px] font-semibold text-violet-300 group-hover:text-violet-200">{s.label}</span>
                  <span className="block font-mono text-[9.5px] text-slate-500">{s.hint}</span>
                </button>
              ))}
            </div>
          ) : undefined
        }
      />

      {/* input + verification */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="p-5 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500">Encoded token</label>
            <div className="flex items-center gap-2">
              {token && (
                <>
                  <CopyButton text={token} />
                  <button
                    onClick={() => onToken("")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-slate-800/40 px-2.5 py-1.5 font-mono text-[11px] text-slate-400 transition-colors hover:border-rose-500/50 hover:text-rose-300"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                </>
              )}
            </div>
          </div>
          <textarea
            value={token}
            onChange={(e) => onToken(e.target.value)}
            spellCheck={false}
            rows={5}
            placeholder={"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.\neyJzdWIiOiJ1c3JfOTYyIiwiZXhwIjoxNjk5OTk5OTk5fQ.\nSflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"}
            className="w-full resize-y rounded-lg border border-slate-700/70 bg-black/40 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-cyan-100 placeholder:text-slate-600 focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />

          {/* segment meter */}
          {decoded.ok && decoded.segments && (
            <div className="mt-4">
              <div className="flex h-2 gap-px overflow-hidden rounded-full">
                {decoded.segments.map((s, i) => (
                  <div
                    key={i}
                    style={{ width: `${(s.length / (decoded.segments![0].length + decoded.segments![1].length + decoded.segments![2].length)) * 100}%` }}
                    className={cn("h-full", ["bg-cyan-400/80", "bg-emerald-400/80", "bg-violet-500/90"][i])}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10.5px] text-slate-500">
                <span><span className="text-cyan-300">H</span> header · {decoded.segments[0].length}b</span>
                <span><span className="text-emerald-300">P</span> payload · {decoded.segments[1].length}b</span>
                <span><span className="text-violet-300">S</span> signature · {decoded.segments[2].length}b</span>
                <span className="ml-auto">{token.trim().length} chars total</span>
              </div>
            </div>
          )}

          {!decoded.ok && token.trim() !== "" && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-3">
              <XCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />
              <p className="font-mono text-[12px] text-rose-200">{decoded.error}</p>
            </div>
          )}
          {token.trim() === "" && (
            <div className="mt-4 rounded-lg border border-dashed border-slate-700 px-4 py-6 text-center">
              <Fingerprint size={20} className="mx-auto text-slate-600" />
              <p className="mt-2 font-mono text-[11.5px] text-slate-500">awaiting token — paste above or load a demo set</p>
            </div>
          )}
        </Panel>

        {/* signature verification */}
        <Panel className="flex flex-col p-5 lg:col-span-5">
          <label className="mb-3 block font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500">
            Signature verification {decoded.alg && <span className="text-violet-400">· {decoded.alg}</span>}
          </label>
          <div className="relative">
            <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={secret}
              onChange={(e) => onSecret(e.target.value)}
              spellCheck={false}
              placeholder={decoded?.alg?.startsWith("HS") ? "HMAC secret, e.g. authpulse-demo-secret" : "PEM public key (-----BEGIN …)"}
              className="w-full rounded-lg border border-slate-700/70 bg-black/40 py-2.5 pl-9 pr-3 font-mono text-[12px] text-violet-200 placeholder:text-slate-600 focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className={cn("mt-4 flex-1 rounded-lg border px-4 py-4 transition-colors", vUi ? vUi.box : "border-slate-700 bg-slate-800/20")}>
            {verifying ? (
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                <span className="font-mono text-[12px] text-slate-300">computing digest over signing input…</span>
              </div>
            ) : vUi && verify ? (
              <>
                <div className={cn("flex items-center gap-2.5", vUi.text)}>
                  <vUi.Icon size={18} />
                  <span className="font-display text-[15px] font-semibold tracking-wide">{vUi.label}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">{verify.detail}</p>
              </>
            ) : (
              <div className="flex items-center gap-2.5 text-slate-500">
                <KeyRound size={16} />
                <span className="font-mono text-[11.5px]">idle — decode a token to run the check</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-md bg-black/30 px-3 py-2 font-mono text-[10.5px] leading-relaxed text-slate-500">
            <span className="text-violet-400">sig =</span>
            <span>
              HMAC-SHA256( <span className="text-cyan-300">base64url(header)</span> . <span className="text-emerald-300">base64url(payload)</span> , secret )
            </span>
          </div>
        </Panel>
      </div>

      {/* expiration countdown */}
      {decoded.ok && exp && (
        <Panel className={cn("flex flex-wrap items-center gap-x-6 gap-y-3 border-l-4 px-5 py-4", expTone.border)}>
          <div className="flex items-center gap-3.5">
            <div className={cn("grid h-11 w-11 place-items-center rounded-lg border", expTone.chip)}>
              <Clock size={20} />
            </div>
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-slate-500">
                {exp.state === "unknown" ? "lifetime" : "live countdown"}
              </div>
              <div key={exp.ms === null ? -1 : Math.floor(exp.ms / 1000)} className={cn("tick-flash font-display text-[22px] font-semibold leading-tight", expTone.text)}>
                {exp.label}
              </div>
            </div>
          </div>
          <div className="ml-auto text-right font-mono text-[11px] leading-relaxed text-slate-500">
            <div>exp → <span className="text-slate-300">{exp.date ?? "—"}</span></div>
            {typeof decoded.payload?.iat === "number" && (
              <div>iat → <span className="text-slate-300">{new Date((decoded.payload.iat as number) * 1000).toLocaleString([], { hour12: false })}</span></div>
            )}
          </div>
        </Panel>
      )}

      {/* tri-color breakdown */}
      {decoded.ok ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* header */}
          <Panel className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-cyan-400/80 to-cyan-400/0" />
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-300">① Header</span>
                <div className="flex gap-1.5">
                  <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300">alg: {decoded.alg}</span>
                  <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300">typ: {decoded.typ}</span>
                </div>
              </div>
              <JsonView obj={decoded.header} />
            </div>
          </Panel>

          {/* payload */}
          <Panel className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-400/80 to-emerald-400/0" />
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-emerald-300">② Payload · claims</span>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                  {Object.keys(decoded.payload ?? {}).length} claims
                </span>
              </div>
              {claimChips.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {claimChips.map(({ key, value, Icon }) => (
                    <span key={key} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 font-mono text-[10.5px] text-slate-300">
                      <Icon size={11} className="shrink-0 text-emerald-400" />
                      <span className="text-emerald-400">{key}</span>
                      <span className="truncate">{value}</span>
                    </span>
                  ))}
                </div>
              )}
              <JsonView obj={decoded.payload} />
            </div>
          </Panel>

          {/* signature */}
          <Panel className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500/80 to-violet-500/0" />
            <div className="flex flex-col p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-violet-300">③ Signature</span>
                <CopyButton text={decoded.signature ?? ""} />
              </div>
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 font-mono text-[11px] leading-relaxed break-all text-violet-200/90">
                {decoded.signature}
              </div>
              <div className="mt-4 space-y-2 font-mono text-[11px] text-slate-500">
                <div className="flex justify-between gap-3">
                  <span>signing input</span>
                  <span className="text-slate-400">{decoded.signingInput!.length} bytes</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>signature</span>
                  <span className="text-slate-400">{decoded.signature!.length} chars (b64url)</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>verification</span>
                  {verify ? (
                    <span className={VERIFY_UI[verify.state].text}>{VERIFY_UI[verify.state].label}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
              </div>
              <div className="mt-auto pt-4">
                <div className={cn("rounded-md border px-3 py-2 font-mono text-[10.5px]", vUi ? vUi.box : "border-slate-700/60 bg-slate-800/30")}>
                  {verify ? <span className={vUi?.text}>{verify.detail}</span> : <span className="text-slate-500">provide key material at left to verify</span>}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      ) : (
        <Panel className="border-dashed p-10 text-center">
          <div className="mx-auto flex max-w-md items-start gap-3 text-left">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-slate-500" />
            <p className="text-[13px] leading-relaxed text-slate-500">
              The <span className="text-cyan-300">header</span>, <span className="text-emerald-300">payload</span> and <span className="text-violet-300">signature</span> panels light up as soon as a well-formed token is decoded.
            </p>
          </div>
        </Panel>
      )}

      {/* claim hygiene */}
      {decoded.ok && (
        <Panel className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 size={15} className="text-violet-400" />
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400">claim hygiene checklist</span>
            <span className="ml-auto font-mono text-[11px] text-slate-500">
              {checks.filter((c) => c.pass).length}/{checks.length} passing
            </span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border px-3.5 py-3",
                  c.pass ? "border-slate-700/60 bg-slate-800/30" : c.tone === "bad" ? "border-rose-500/40 bg-rose-500/10" : "border-amber-500/30 bg-amber-500/5",
                )}
              >
                {c.pass ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                ) : c.tone === "bad" ? (
                  <XCircle size={15} className="mt-0.5 shrink-0 text-rose-400" />
                ) : (
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
                )}
                <div>
                  <div className="font-mono text-[12px] font-semibold text-slate-200">{c.label}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{c.note}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
