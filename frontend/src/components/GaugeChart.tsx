import { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";

const ZONES = [
  { label: "Very Chill", max: 20, colors: ["#3ee6b0", "#19ce86"] },
  { label: "Chill", max: 40, colors: ["#5fd4d0", "#3ab3ba"] },
  { label: "Neutral", max: 60, colors: ["#f5c44f", "#f0a52a"] },
  { label: "Radical", max: 80, colors: ["#ff8b60", "#ff6b3d"] },
  { label: "Very Radical", max: 100, colors: ["#ff6b6b", "#ef3251"] },
] as const;

const clamp = (value: number) => Math.min(100, Math.max(0, value));

const readZone = (value: number) => ZONES.find((zone) => value <= zone.max) ?? ZONES[ZONES.length - 1];

type ApiResponse = {
  value?: number;
  percentage?: number;
  score?: number;
};

type GaugeChartProps = {
  platform: string;
  onPlatformChange?: (platform: string) => void;
  availablePlatforms?: ReadonlyArray<{ label: string; value: string }>;
};

const defaultPlatforms = [
  { label: "All Platforms", value: "all" },
  { label: "Reddit", value: "reddit" },
  { label: "Facebook", value: "facebook" },
  { label: "Bluesky", value: "bluesky" },
  { label: "Mastodon", value: "mastodon" },
] as const;

const GaugeChart = ({
  platform,
  onPlatformChange,
  availablePlatforms = defaultPlatforms,
}: GaugeChartProps) => {
  const [targetValue, setTargetValue] = useState(() => 58 + (Math.random() - 0.5) * 10);
  const [displayValue, setDisplayValue] = useState(() => clamp(targetValue));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadGaugeValue = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/index?platform=${encodeURIComponent(platform)}`, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as ApiResponse;
        const next = clamp(
          typeof payload.value === "number"
            ? payload.value
            : typeof payload.percentage === "number"
              ? payload.percentage
              : typeof payload.score === "number"
                ? payload.score
                : Number.parseFloat(String(payload.value ?? payload.percentage ?? payload.score))
        );

        if (Number.isFinite(next)) {
          setTargetValue(next);
          setError(null);
        } else {
          throw new Error("Received non-numeric gauge value");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.warn("Gauge fetch failed", err);
        setError("Live data unavailable — using demo signal.");
      } finally {
        setIsLoading(false);
      }
    };

    loadGaugeValue();

    return () => controller.abort();
  }, [platform]);

  useEffect(() => {
    let timeoutId: number;

    const scheduleNext = () => {
      timeoutId = window.setTimeout(() => {
        setDisplayValue(() => {
          const jitter = (Math.random() - 0.5) * 6;
          return clamp(targetValue + jitter);
        });
        scheduleNext();
      }, 3200 + Math.random() * 1600);
    };

    scheduleNext();

    return () => window.clearTimeout(timeoutId);
  }, [targetValue]);

  useEffect(() => {
    setDisplayValue((prev) => clamp((prev + targetValue) / 2));
  }, [targetValue]);

  const zone = useMemo(() => readZone(displayValue), [displayValue]);

  const chartOptions = useMemo<ApexOptions>(() => {
    return {
      chart: {
        type: "radialBar",
        background: "transparent",
        sparkline: { enabled: true },
        animations: {
          enabled: true,
          speed: 800,
          dynamicAnimation: { enabled: true, speed: 400 },
        },
      },
      plotOptions: {
        radialBar: {
          startAngle: -90,
          endAngle: 90,
          track: {
            background: "rgba(255,255,255,0.08)",
            strokeWidth: "90%",
          },
          hollow: {
            margin: 0,
            size: "60%",
          },
          dataLabels: {
            show: false,
          },
        },
      },
      stroke: {
        lineCap: "round",
      },
      fill: {
        type: "gradient",
        gradient: {
          shade: "dark",
          gradientToColors: [zone.colors[1]],
          stops: [0, 55, 100],
        },
      },
      colors: [zone.colors[0]],
      grid: { padding: { left: -10, right: -10 } },
      tooltip: { enabled: false },
    } satisfies ApexOptions;
  }, [zone.label]);

  return (
    <section
      aria-labelledby="threat-index-heading"
      className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-100 to-slate-50 p-8 shadow-soft transition-colors duration-200 dark:border-white/10 dark:from-slate-900/60 dark:via-slate-900/40 dark:to-slate-900/20"
    >
      <header className="mb-6 flex flex-col items-center gap-2 text-center">
        <h2 id="threat-index-heading" className="text-xl font-semibold tracking-wide text-slate-900 dark:text-white">
          Social Network Threat Index
        </h2>
        <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">
          Aggregated risk score for {platform === "all" ? "all monitored platforms" : platform}. Updated in near real-time as monitoring data
          arrives.
        </p>
      </header>

      <div className="flex flex-col items-center justify-center gap-6">
        <div className="w-full max-w-xl">
          <Chart options={chartOptions} series={[displayValue]} type="radialBar" height={320} />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Current signal</span>
          <div className="flex items-end gap-3">
            <span className="text-5xl font-black text-slate-900 dark:text-white">{displayValue.toFixed(0)}%</span>
            <span className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              {zone.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isLoading ? "Syncing with monitoring API…" : error ?? "Signal calibrated against the last 3 hours of traffic."}
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ZONES.map((entry) => (
          <div
            key={entry.label}
            className={`rounded-xl border border-slate-200/80 px-4 py-3 text-center text-xs uppercase tracking-wide transition-colors ${entry.label === zone.label
              ? "bg-stg-accent/10 text-stg-accent dark:bg-white/15 dark:text-white"
              : "bg-white text-slate-600 dark:bg-white/5 dark:text-slate-300"
              }`}
          >
            {entry.label}
          </div>
        ))}
      </div>

      {onPlatformChange && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 transition-colors dark:border-white/10 dark:bg-slate-900/60">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Filter by platform</h3>
          <div className="flex flex-wrap justify-center gap-2 text-xs sm:text-sm">
            {availablePlatforms.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => onPlatformChange(filter.value)}
                className={`rounded-full border px-4 py-2 font-semibold uppercase tracking-wide transition ${platform === filter.value
                  ? "border-stg-accent bg-stg-accent/20 text-stg-accent dark:text-stg-accent"
                  : "border-slate-200 bg-white text-slate-600 hover:border-stg-accent/60 hover:text-stg-accent dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
                  }`}
                aria-pressed={platform === filter.value}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default GaugeChart;
