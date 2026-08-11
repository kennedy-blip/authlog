import { useEffect, useMemo, useState } from "react";
import {
  Database,
  Dice5,
  ExternalLink,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Server,
  StepForward,
  Zap,
} from "lucide-react";
import { cn } from "../utils/cn";
import { ACTORS, FLOWS, generateRun, type Actor, type FlowId, type FlowStep, type RunTokens } from "../lib/oauth";
import { useReducedMotion } from "../lib/hooks";
import { CopyButton, MethodBadge, Panel, SectionHead } from "./ui";

interface Props {
  onInspectToken: (token: string, secret: string) => void;
}

const ACTOR_ORDER: Actor[] = ["ua", "auth", "rs"];
const ACTOR_ICON: Record<Actor, typeof Monitor> = { ua: Monitor, auth: Server, rs: Database };
const ACTOR_STYLE: Record<Actor, string> = {
  ua: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  auth: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  rs: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};
const ACTOR_GLOW: Record<Actor, string> = {
  ua: "shadow-[0_0_26px_rgba(34,211,238,0.35)]",
  auth: "shadow-[0_0_26px_rgba(139,92,246,0.4)]",
  rs: "shadow-[0_0_26px_rgba(16,185,129,0.35)]",
};

const col = (a: Actor) => (a === "ua" ? 0 : a === "auth" ? 1 : 2);

function StepRow({
  step,
  index,
  state,
  onJump,
}: {
  step: FlowStep;
  index: number;
  state: "done" | "active" | "pending";
  onJump: () => void;
}) {
  const cf = col(step.from);
  const ct = col(step.to);
  const self = cf === ct;
  const fromLeft = Math.min(cf, ct) * (100 / 3) + 100 / 6;
  const arrowW = Math.abs(ct - cf) * (100 / 3);
  const rightward = ct > cf;

  return (
    <div
      onClick={onJump}
      className={cn(
        "group relative h-[72px] cursor-pointer transition-opacity duration-300",
        state === "pending" && "opacity-35 hover:opacity-70",
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-1/2 z-10 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border font-mono text-[10px] transition-all",
          state === "active"
            ? "border-violet-400 bg-violet-500/25 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.5)]"
            : state === "done"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              : "border-slate-700 bg-slate-800/70 text-slate-500",
        )}
      >
        {index + 1}
      </div>

      {self ? (
        <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${cf * (100 / 3) + 100 / 6}%)` }}>
          <div
            className={cn(
              "-translate-x-1/2 whitespace-nowrap rounded-md border px-3 py-1.5 font-mono text-[10.5px] transition-colors",
              state === "active"
                ? "border-violet-500/60 bg-violet-500/15 text-violet-200 shadow-[0_0_16px_rgba(139,92,246,0.3)]"
                : state === "done"
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300/90"
                  : "border-slate-700 bg-slate-800/50 text-slate-500",
            )}
          >
            ◇ internal · {step.title}
          </div>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "absolute top-2 z-10 -translate-x-1/2 whitespace-nowrap px-1 font-mono text-[10.5px]",
              state === "active" ? "text-violet-200" : state === "done" ? "text-emerald-300/70" : "text-slate-500",
            )}
            style={{ left: `calc(${fromLeft}%)` }}
          >
            <span className="mr-1.5 rounded border border-slate-700 bg-slate-800/90 px-1.5 py-px text-[9px] tracking-wide text-slate-400">
              {step.method}
            </span>
            {step.title}
          </div>
          <div
            className={cn(
              "absolute top-[38px] h-[2px]",
              state === "active"
                ? "arrow-flow arrow-draw shadow-[0_0_10px_rgba(139,92,246,0.55)]"
                : state === "done"
                  ? "bg-emerald-500/50"
                  : "bg-slate-700/80",
            )}
            style={{
              left: `${fromLeft}%`,
              width: `${arrowW}%`,
              transformOrigin: rightward ? "left" : "right",
            }}
          >
            {state !== "pending" && (
              <div
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 border-y-[5px] border-y-transparent",
                  rightward
                    ? "right-0 border-l-[9px]" + (state === "active" ? " border-l-violet-400" : " border-l-emerald-400/70")
                    : "left-0 border-r-[9px]" + (state === "active" ? " border-r-violet-400" : " border-r-emerald-400/70"),
                )}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function OAuthSimulator({ onInspectToken }: Props) {
  const [flowId, setFlowId] = useState<FlowId>("pkce");
  const [run, setRun] = useState<RunTokens | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const reduced = useReducedMotion();

  const flow = FLOWS[flowId];
  const steps = useMemo(() => (run ? flow.steps(run) : []), [run, flow]);
  const activeStep = steps[Math.min(stepIndex, steps.length - 1)] ?? null;
  const finished = steps.length > 0 && stepIndex === steps.length - 1;

  useEffect(() => {
    let on = true;
    generateRun().then((r) => on && setRun(r));
    return () => {
      on = false;
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (finished) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setStepIndex((i) => Math.min(i + 1, steps.length - 1)), 2200 / speed);
    return () => window.clearTimeout(id);
  }, [playing, stepIndex, steps.length, speed, finished]);

  const switchFlow = (id: FlowId) => {
    setFlowId(id);
    setStepIndex(0);
    setPlaying(false);
  };

  const newRun = async () => {
    setRun(await generateRun());
    setStepIndex(0);
    setPlaying(false);
  };

  const toneBox = (tone?: FlowStep["tone"]) =>
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-200"
        : tone === "bad"
          ? "border-rose-500/30 bg-rose-500/5 text-rose-200"
          : "border-slate-700 bg-slate-800/30 text-slate-400";

  return (
    <div className="space-y-6">
      <SectionHead
        eyebrow="02 · OAuth2 / OIDC simulator"
        title="Watch the flow execute."
        desc="Pick a grant type and run the handshake step by step across the three parties. Every code, verifier and token shown is generated live for this run."
      />

      {/* flow selector */}
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.values(FLOWS)).map((f) => (
          <button
            key={f.id}
            onClick={() => switchFlow(f.id)}
            className={cn(
              "panel panel-hover relative p-5 text-left transition-all",
              flowId === f.id
                ? "border-violet-500/60 bg-violet-500/[0.07] shadow-[0_0_30px_-6px_rgba(139,92,246,0.4)]"
                : "hover:border-slate-600",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-[15px] font-semibold text-slate-100">{f.name}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider",
                  f.risk.tone === "ok"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : f.risk.tone === "bad"
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-300",
                )}
              >
                {f.risk.label}
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{f.desc}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 font-mono text-[9.5px] text-violet-300">{f.tag}</span>
              {f.specs.map((s) => (
                <span key={s} className="rounded border border-slate-700/70 bg-slate-800/40 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500">
                  {s}
                </span>
              ))}
            </div>
            {flowId === f.id && (
              <span className="absolute -top-px left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-violet-400 to-transparent shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
            )}
          </button>
        ))}
      </div>

      {/* controls */}
      <Panel className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button
          onClick={() => (finished ? (setStepIndex(0), setPlaying(true)) : setPlaying((p) => !p))}
          className="inline-flex items-center gap-2 rounded-lg border border-violet-500/50 bg-violet-500/15 px-4 py-2 font-mono text-[12px] font-semibold text-violet-200 transition-all hover:bg-violet-500/25 hover:shadow-[0_0_18px_rgba(139,92,246,0.35)]"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? "Pause" : finished ? "Replay" : "Run flow"}
        </button>
        <button
          onClick={() => setStepIndex((i) => Math.min(i + 1, steps.length - 1))}
          disabled={finished}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 font-mono text-[12px] text-slate-300 transition-colors hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <StepForward size={14} /> Step
        </button>
        <button
          onClick={() => {
            setStepIndex(0);
            setPlaying(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 font-mono text-[12px] text-slate-300 transition-colors hover:border-slate-500"
        >
          <RotateCcw size={14} /> Reset
        </button>
        <span className="mx-1 hidden h-6 w-px bg-slate-700/70 sm:block" />
        <button
          onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 font-mono text-[12px] text-slate-300 transition-colors hover:border-slate-500"
        >
          <Zap size={14} className="text-amber-400" /> {speed}×
        </button>
        <button
          onClick={newRun}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 font-mono text-[12px] text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-300"
        >
          <Dice5 size={14} /> New tokens
        </button>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-slate-800 sm:block">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${((stepIndex + 1) / Math.max(steps.length, 1)) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            step <span className="text-violet-300">{steps.length ? stepIndex + 1 : "–"}</span>/{steps.length || "–"}
            {run && <span className="ml-2 text-slate-600">{run.runId}</span>}
          </span>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-12">
        {/* sequence diagram */}
        <Panel className="p-5 xl:col-span-7">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500">sequence diagram</span>
            <span className="font-mono text-[10.5px] text-slate-600">click any step to jump</span>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[580px] pl-12 pr-4">
              {/* actors */}
              <div className="grid grid-cols-3">
                {ACTOR_ORDER.map((a) => {
                  const Icon = ACTOR_ICON[a];
                  const involved = !!activeStep && (activeStep.from === a || activeStep.to === a);
                  return (
                    <div key={a} className="flex flex-col items-center gap-2 pb-4">
                      <div
                        className={cn(
                          "grid h-12 w-12 place-items-center rounded-xl border transition-all duration-300",
                          ACTOR_STYLE[a],
                          involved && !reduced && cn("scale-110", ACTOR_GLOW[a]),
                        )}
                      >
                        <Icon size={22} />
                      </div>
                      <div className="text-center">
                        <div className={cn("font-display text-[13px] font-semibold transition-colors", involved ? "text-slate-50" : "text-slate-300")}>
                          {ACTORS[a].label}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">{ACTORS[a].sub}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* body with lifelines */}
              <div className="relative">
                {ACTOR_ORDER.map((a, i) => (
                  <div
                    key={a}
                    className="absolute bottom-0 top-0 border-l border-dashed border-slate-700/50"
                    style={{ left: `${(i + 0.5) * (100 / 3)}%` }}
                  />
                ))}
                {steps.map((s, i) => (
                  <StepRow
                    key={`${flowId}-${i}`}
                    step={s}
                    index={i}
                    state={i < stepIndex ? "done" : i === stepIndex ? "active" : "pending"}
                    onJump={() => {
                      setStepIndex(i);
                      setPlaying(false);
                    }}
                  />
                ))}
                {!steps.length && (
                  <div className="py-16 text-center font-mono text-[12px] text-slate-500">
                    <Dice5 size={18} className="mx-auto mb-2 animate-pulse text-violet-400" />
                    minting fresh codes & tokens for this run…
                  </div>
                )}
              </div>
            </div>
          </div>
        </Panel>

        {/* step detail */}
        <Panel className="flex flex-col p-5 xl:col-span-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500">wire detail</span>
            {activeStep && <MethodBadge method={activeStep.method} />}
            <span className="ml-auto font-mono text-[10.5px] text-slate-600">{flow.name}</span>
          </div>

          {activeStep && (
            <div key={`${flowId}-${stepIndex}`} className={cn(!reduced && "anim-fade-up")}>
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-[13px] font-bold text-violet-400">{String(stepIndex + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-[17px] font-semibold text-slate-100">{activeStep.title}</h3>
              </div>

              <div className="mt-4 space-y-1.5 rounded-lg border border-slate-700/70 bg-black/40 p-4">
                {activeStep.lines.map((l, i) => (
                  <div key={i} className="flex gap-3 font-mono text-[11.5px] leading-relaxed">
                    <span className="w-32 shrink-0 truncate text-slate-500">{l.k}</span>
                    <span className={cn("break-all", l.strong ? "font-semibold text-violet-300" : "text-slate-300")}>{l.v}</span>
                  </div>
                ))}
              </div>

              {activeStep.note && (
                <div className={cn("mt-3 rounded-lg border px-3.5 py-2.5 text-[12px] leading-relaxed", toneBox(activeStep.tone))}>
                  {activeStep.note}
                </div>
              )}

              {activeStep.lines.some((l) => l.k === "access_token" || l.k === "Authorization") && (
                <button
                  onClick={() => onInspectToken(run!.accessToken, run!.secret)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 font-mono text-[12px] text-cyan-300 transition-all hover:bg-cyan-500/20 hover:shadow-[0_0_16px_rgba(34,211,238,0.3)]"
                >
                  <ExternalLink size={13} /> Inspect issued access token →
                </button>
              )}
            </div>
          )}

          {finished && run && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 font-display text-[14px] font-semibold text-emerald-300">
                <Zap size={15} /> Flow complete — tokens issued for {run.runId}
              </div>
              <div className="mt-3 space-y-2">
                {(
                  [
                    ["access_token", run.accessToken],
                    ["id_token", run.idToken],
                    ["refresh_token", run.refreshToken],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 rounded-md bg-black/40 px-3 py-2">
                    <span className="w-28 shrink-0 font-mono text-[10.5px] text-emerald-400">{k}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-400">{v}</span>
                    <CopyButton text={v} className="px-2 py-1 text-[10px]" />
                  </div>
                ))}
              </div>
              <div className="mt-2.5 font-mono text-[10px] text-slate-500">
                access_token is a real HS256 JWT — secret: <span className="text-violet-300">{run.secret}</span>
              </div>
            </div>
          )}

          {!activeStep && (
            <div className="grid flex-1 place-items-center py-10 text-center">
              <div>
                <Play size={22} className="mx-auto text-slate-600" />
                <p className="mt-3 font-mono text-[11.5px] text-slate-500">press “Run flow” or “Step” to begin</p>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
