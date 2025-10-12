import type { FC, ReactNode } from "react";

export type PlatformCardProps = {
  platform: string;
  summary: string;
  updated: string;
  sentiment: "low" | "medium" | "high" | "critical";
  icon: ReactNode;
};

const sentimentCopy: Record<PlatformCardProps["sentiment"], { label: string; badgeClass: string }> = {
  low: {
    label: "Low",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  medium: {
    label: "Elevated",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  high: {
    label: "High",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
  },
  critical: {
    label: "Critical",
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-300",
  },
};

const PlatformCard: FC<PlatformCardProps> = ({ platform, summary, updated, sentiment, icon }) => {
  const { label, badgeClass } = sentimentCopy[sentiment];

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-soft transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 bg-white text-stg-accent dark:border-white/10 dark:bg-white/5">
            {icon}
          </span>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-white">
              Threat Speech
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-300">{platform}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${badgeClass}`}>
          {label}
        </span>
      </header>

      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{summary}</p>

      <footer className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="block h-2 w-2 rounded-full bg-stg-accent" aria-hidden />
          Updated {updated}
        </span>
        <button
          type="button"
          className="text-[11px] font-semibold uppercase tracking-wide text-stg-accent transition hover:text-slate-900 dark:hover:text-white"
        >
          View details
        </button>
      </footer>
    </article>
  );
};

export default PlatformCard;
