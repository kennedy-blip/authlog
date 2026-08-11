import { type ReactNode, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../utils/cn";
import { copyText } from "../lib/hooks";

export function Panel({ className, children, hover = false }: { className?: string; children: ReactNode; hover?: boolean }) {
  return <div className={cn("panel", hover && "panel-hover", className)}>{children}</div>;
}

export function SectionHead({
  eyebrow,
  title,
  desc,
  right,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-violet-400/90">{eyebrow}</div>
        <h2 className="mt-1.5 font-display text-[26px] font-semibold leading-tight text-slate-100 md:text-3xl">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{desc}</p>
      </div>
      {right}
    </div>
  );
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1300);
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-slate-800/40 px-2.5 py-1.5 font-mono text-[11px] text-slate-300 transition-colors hover:border-violet-500/50 hover:text-violet-300",
        done && "border-emerald-500/50 text-emerald-300 hover:text-emerald-300",
        className,
      )}
    >
      {done ? <Check size={12} /> : <Copy size={12} />}
      {done ? "Copied" : label}
    </button>
  );
}

const METHOD_TONE: Record<string, string> = {
  GET: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  POST: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  PATCH: "text-cyan-300 border-cyan-500/40 bg-cyan-500/10",
  PUT: "text-violet-300 border-violet-500/40 bg-violet-500/10",
  DELETE: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};

export function MethodBadge({ method, className }: { method: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[52px] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-wide",
        METHOD_TONE[method] ?? "text-slate-300 border-slate-600 bg-slate-700/30",
        className,
      )}
    >
      {method}
    </span>
  );
}

/* ---------- syntax-tinted JSON ---------- */

function primitive(v: unknown): ReactNode {
  if (v === null) return <span className="text-slate-500">null</span>;
  switch (typeof v) {
    case "string":
      return (
        <span className="text-emerald-300">
          "{String(v)}"
        </span>
      );
    case "number":
      return <span className="text-amber-300">{String(v)}</span>;
    case "boolean":
      return <span className="text-rose-300">{String(v)}</span>;
    default:
      return <span>{String(v)}</span>;
  }
}

export function JsonView({ obj, className }: { obj: unknown; className?: string }) {
  return <div className={cn("font-mono text-[12.5px] leading-6 text-slate-200", className)}>{renderValue(obj)}</div>;
}

function renderValue(v: unknown): ReactNode {
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-slate-400">[]</span>;
    return (
      <>
        <span className="text-slate-400">[</span>
        {v.map((it, i) => (
          <div key={i} style={{ paddingLeft: 14 }}>
            {renderValue(it)}
            {i < v.length - 1 && <span className="text-slate-500">,</span>}
          </div>
        ))}
        <span className="text-slate-400">]</span>
      </>
    );
  }
  if (typeof v === "object" && v !== null) {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-slate-400">{"{}"}</span>;
    return (
      <>
        <span className="text-slate-400">{"{"}</span>
        {entries.map(([k, val], i) => (
          <div key={k} style={{ paddingLeft: 14 }}>
            <span className="text-cyan-300">"{k}"</span>
            <span className="text-slate-500">: </span>
            {renderValue(val)}
            {i < entries.length - 1 && <span className="text-slate-500">,</span>}
          </div>
        ))}
        <span className="text-slate-400">{"}"}</span>
      </>
    );
  }
  return primitive(v);
}
