import { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");
const buildApiUrl = (path: string) => `${API_BASE}/${path.replace(/^\/+/, "")}`;

type AggLevel = "minute" | "hour" | "day";

type TrendPoint = {
  time: string | null;
  avgHateScore: number | null;
  count: number | null;
};

type TrendResponse = {
  ok?: boolean;
  aggLevel?: string;
  data?: TrendPoint[];
  error?: string;
};

const AGG_LEVEL_METADATA: Record<
  AggLevel,
  { label: string; window: string; caption: string }
> = {
  minute: {
    label: "Minute",
    window: "Last 60 minutes",
    caption: "High-resolution minute-by-minute movement.",
  },
  hour: {
    label: "Hourly",
    window: "Last 72 hours",
    caption: "Rolling hourly averages to spot emerging surges.",
  },
  day: {
    label: "Daily",
    window: "Last 35 days",
    caption: "Day-level view to see longer-term shifts.",
  },
};

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.?0+$/, "");
};

const ThreatTrendChart = () => {
  const [aggLevel, setAggLevel] = useState<AggLevel>("minute");
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [isPolling, setIsPolling] = useState(false);

  const handleRefresh = () => {
    setRefreshToken((token) => token + 1);
  };

  const togglePolling = () => {
    setIsPolling((prev) => {
      const next = !prev;
      if (next) {
        setRefreshToken((token) => token + 1);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isPolling) return undefined;

    const intervalMs =
      aggLevel === "minute" ? 60_000 : aggLevel === "hour" ? 300_000 : 600_000;

    const id = window.setInterval(() => {
      setRefreshToken((token) => token + 1);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [isPolling, aggLevel]);

  useEffect(() => {
    const controller = new AbortController();

    const loadTrend = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(buildApiUrl(`threat-index/trend?aggLevel=${aggLevel}`), {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as TrendResponse;

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error ?? "Unable to load threat trend data.");
        }

        setPoints(Array.isArray(payload.data) ? payload.data : []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setPoints([]);
        setError((err as Error).message || "Unable to load threat trend data.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadTrend();

    return () => controller.abort();
  }, [aggLevel, refreshToken]);

  const preparedData = useMemo(() => {
    return points
      .map((point) => {
        const ts = point.time ? Date.parse(point.time) : Number.NaN;
        if (!Number.isFinite(ts)) return null;
        const rawScore = point.avgHateScore;
        const scaledScore =
          typeof rawScore === "number" && Number.isFinite(rawScore)
            ? Math.min(100, Math.max(0, rawScore * 100))
            : null;
        return {
          x: ts,
          y: scaledScore,
          count: point.count ?? 0,
        };
      })
      .filter((value): value is { x: number; y: number | null; count: number } => Boolean(value));
  }, [points]);

  const latestPoint = preparedData.length > 0 ? preparedData[preparedData.length - 1] : null;
  const totalMessages = useMemo(
    () => preparedData.reduce((sum, point) => sum + (point.count ?? 0), 0),
    [preparedData],
  );

  const yAxisMax = 100;

  const chartSeries = useMemo(
    () => [
      {
        name: "Threat Index",
        data: preparedData.map((point) => ({ x: point.x, y: point.y })),
      },
    ],
    [preparedData],
  );

  const chartOptions = useMemo<ApexOptions>(() => {
    const accent = "#0ea5e9";
    return {
      chart: {
        type: "area",
        toolbar: { show: false },
        animations: { enabled: true },
        foreColor: "#94a3b8",
      },
      grid: {
        borderColor: "rgba(148, 163, 184, 0.35)",
        strokeDashArray: 4,
        yaxis: { lines: { show: true } },
      },
      stroke: { curve: "smooth", width: 3, colors: [accent] },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 0.85,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 100],
          colorStops: [
            { offset: 0, color: accent, opacity: 0.45 },
            { offset: 100, color: accent, opacity: 0.05 },
          ],
        },
      },
      dataLabels: { enabled: false },
      markers: { size: 0, strokeWidth: 0, hover: { size: 7 } },
      xaxis: {
        type: "datetime",
        labels: {
          style: { colors: ["#475569"] },
          datetimeFormatter: {
            hour: "HH:mm",
            minute: "HH:mm",
            day: "MMM dd",
            month: "MMM dd",
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        max: yAxisMax,
        tickAmount: 10, // 0,10,...,100
        forceNiceScale: false,
        labels: {
          formatter: (value) => `${Math.round(Number(value))}`,
          style: { colors: ["#475569"] },
        },
        decimalsInFloat: 0,
      },
      tooltip: {
        theme: "dark",
        x: { format: "MMM dd, HH:mm" },
        y: {
          formatter: (value) => formatNumber(Number(value)),
          title: { formatter: () => "Threat Index" },
        },
      },
    } satisfies ApexOptions;
  }, [yAxisMax]);

  const latestTimestamp =
    latestPoint && Number.isFinite(latestPoint.x)
      ? new Date(latestPoint.x).toLocaleString()
      : null;

  const aggMeta = AGG_LEVEL_METADATA[aggLevel];

  return (
    <section
      aria-label="Bluesky threat index trend"
      className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white/90 to-sky-50/80 p-4 shadow-sm transition-colors duration-200 dark:border-white/10 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900"
    >
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Bluesky
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            Threat Trend
          </h2>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-100/80 p-1 text-sm font-semibold text-slate-700 shadow-inner dark:bg-white/10 dark:text-slate-200">
            {(Object.keys(AGG_LEVEL_METADATA) as AggLevel[]).map((level) => {
              const meta = AGG_LEVEL_METADATA[level];
              const isActive = aggLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setAggLevel(level)}
                  className={`rounded-full px-3 py-1.5 transition ${isActive
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-white/5"
                    }`}
                  aria-pressed={isActive}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {`${aggMeta.caption} ${aggMeta.window}.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sky-800 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100"
            >
              Refresh now
            </button>
            <button
              type="button"
              onClick={togglePolling}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 ${isPolling
                ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 focus-visible:ring-emerald-200 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-100"
                : "border border-slate-300/80 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-sky-200 dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
            >
              {isPolling ? "Auto-refresh: On" : "Auto-refresh: Off"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/60 bg-white/80 p-3 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Latest value
          </p>
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            {formatNumber(latestPoint?.y ?? null)}
          </p>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            {latestTimestamp ? `at ${latestTimestamp}` : "Awaiting data"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/80 p-3 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Posts analysed
          </p>
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">
            {totalMessages.toLocaleString()}
          </p>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            Aggregated from Bluesky ({aggMeta.window})
          </p>
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/80 p-3 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Resolution
          </p>
          <p className="text-3xl font-semibold text-slate-900 dark:text-white">{aggMeta.label}</p>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">{aggMeta.window}</p>
        </div>
      </div>

      <div className="mt-4 min-h-[280px] rounded-2xl border border-slate-200/80 bg-white/70 p-2 sm:p-3 dark:border-white/10 dark:bg-slate-900/70">
        {error ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-red-400/60 bg-red-50/80 p-6 text-sm font-semibold text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center rounded-xl bg-slate-100/70 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
            Loading trend data…
          </div>
        ) : preparedData.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300/80 bg-slate-50/60 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
            No trend data available for this window.
          </div>
        ) : (
          <Chart type="area" height={280} width="100%" series={chartSeries} options={chartOptions} />
        )}
      </div>
    </section>
  );
};

export default ThreatTrendChart;
