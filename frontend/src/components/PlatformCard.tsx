import type { FC, ReactNode } from "react";

const DEFAULT_SEVERITY = {
  label: "Elevated",
  badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
};

export type PlatformCardProps = {
  heading: string;
  platform: string;
  summary: string;
  updated: string;
  severity: {
    label: string;
    badgeClass: string;
  };
  harmfulScore?: number | null;
  icon: ReactNode;
  linkUrl?: string | null;
};

const PlatformCard: FC<PlatformCardProps> = ({
  heading,
  platform,
  summary,
  updated,
  severity,
  harmfulScore,
  icon,
  linkUrl,
}) => {
  const badgeClass = severity.badgeClass || DEFAULT_SEVERITY.badgeClass;
  const normalizedScore =
    typeof harmfulScore === "number" && Number.isFinite(harmfulScore)
      ? harmfulScore * 100
      : null;
  const formattedScore =
    normalizedScore !== null ? Math.round(normalizedScore).toString() : null;
  const action = linkUrl ? (
    <a
      href={linkUrl}
      target="_blank"
      rel="noreferrer"
      className="text-[11px] font-semibold uppercase tracking-wide text-stg-accent transition hover:text-slate-900 dark:hover:text-white"
    >
      Original link
    </a>
  ) : (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      Original link unavailable
    </span>
  );

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-soft transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 bg-white text-stg-accent dark:border-white/10 dark:bg-white/5">
            {icon}
          </span>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-white">
              {heading}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-300">{platform}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${badgeClass}`}>
          score: {formattedScore ?? "N/A"}
        </span>
      </header>

      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{summary}</p>

      <footer className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="block h-2 w-2 rounded-full bg-stg-accent" aria-hidden />
          Updated {updated}
        </span>
        {action}
      </footer>
    </article>
  );
};

export default PlatformCard;
