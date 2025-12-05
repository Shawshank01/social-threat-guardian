import type { FC, ReactNode } from "react";

export type FeedFraming = {
  sectionTitle: string;
  sectionDescription: string;
  cardHeading: string;
};

export const FEED_FRAMING: FeedFraming = {
  sectionTitle: "Cross-platform High-Risk Content",
  sectionDescription:
    "Latest posts identified by our systems as containing hate, threats, or other forms of harmful speech across observed communities.",
  cardHeading: "High-Risk Content",
};

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
    <article className="flex flex-col gap-2.5 sm:gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-3 sm:p-4 shadow-soft transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <span className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200/70 bg-white text-stg-accent dark:border-white/10 dark:bg-white/5">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-white truncate">
              {heading}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-300 truncate">{platform}</p>
          </div>
        </div>
        <span className={`self-start sm:self-auto rounded-full px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap ${badgeClass}`}>
          score: {formattedScore ?? "N/A"}
        </span>
      </header>

      <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-200 break-words">{summary}</p>

      <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="block h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-stg-accent flex-shrink-0" aria-hidden />
          <span className="truncate">Updated {updated}</span>
        </span>
        <span className="flex-shrink-0">{action}</span>
      </footer>
    </article>
  );
};

export default PlatformCard;
