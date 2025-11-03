import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "react-apexcharts";
import ApexCharts from "apexcharts";
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
  { label: "Telegram", value: "telegram" },
  { label: "Bluesky", value: "bluesky" },
  { label: "Mastodon", value: "mastodon" },
] as const;

// Adjust these constants to reposition the arc labels
const ARC_RADIUS_X_RATIO = 0.45; // Horizontal distance from gauge center to labels relative to width
const ARC_RADIUS_Y_RATIO = 0.45; // Vertical distance from gauge center to labels relative to height
const ARC_CENTER_Y_RATIO = 0.5; // Vertical center alignment of the label arc (lower value pushes labels upward)
const ARC_START_ANGLE = 180; // Degrees from left to start label placement
const ARC_END_ANGLE = 0; // Degrees on the right where labels end

// Inner numeric scale constants (0-100)
const INNER_RADIUS_X_RATIO = 0.17; // Horizontal distance for 0-100 scale relative to width
const INNER_RADIUS_Y_RATIO = 0.28; // Vertical distance for 0-100 scale relative to height
const INNER_CENTER_Y_RATIO = 0.51; // Vertical center for numeric scale (tweak to lift/drop numbers)

const GaugeChart = ({
  platform,
  onPlatformChange,
  availablePlatforms = defaultPlatforms,
}: GaugeChartProps) => {
  const [targetValue, setTargetValue] = useState(() => Math.floor(Math.random() * 101));
  const [displayValue, setDisplayValue] = useState(() => clamp(targetValue));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [gaugeDimensions, setGaugeDimensions] = useState({ width: 320, height: 340 });

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
        const next = clamp(Math.floor(Math.random() * 101));
        setTargetValue(next);
        setDisplayValue(next);
        scheduleNext();
      }, 3200 + Math.random() * 1600);
    };

    scheduleNext();

    return () => window.clearTimeout(timeoutId);
  }, [targetValue]);

  useEffect(() => {
    setDisplayValue((prev) => clamp((prev + targetValue) / 2));
  }, [targetValue]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateDimensions = () => {
      const width = element.getBoundingClientRect().width || 320;
      const height = Math.max(200, Math.min(340, width * 0.68));
      setGaugeDimensions({ width, height });
    };

    updateDimensions();

    const observer = new ResizeObserver(() => updateDimensions());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const zone = useMemo(() => readZone(displayValue), [displayValue]);

  const chartOptions = useMemo<ApexOptions>(() => {
    return {
      chart: {
        id: "stg-threat-index",
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
  }, [zone.label, zone.colors]);

  useEffect(() => {
    ApexCharts.exec(
      "stg-threat-index",
      "updateOptions",
      {
        colors: [zone.colors[0]],
        fill: {
          type: "gradient",
          gradient: {
            shade: "dark",
            gradientToColors: [zone.colors[1]],
            stops: [0, 55, 100],
          },
        },
      },
      false,
      true
    ).catch(() => undefined);
  }, [zone.colors]);

  useEffect(() => {
    ApexCharts.exec("stg-threat-index", "updateSeries", [displayValue], true).catch(() => undefined);
  }, [displayValue]);

  const arcLabels = useMemo(() => {
    const step = (ARC_START_ANGLE - ARC_END_ANGLE) / (ZONES.length - 1);
    const centerX = gaugeDimensions.width / 2;
    const centerY = gaugeDimensions.height * ARC_CENTER_Y_RATIO;
    const radiusX = gaugeDimensions.width * ARC_RADIUS_X_RATIO;
    const radiusY = gaugeDimensions.height * ARC_RADIUS_Y_RATIO;

    return ZONES.map((entry, index) => {
      const angleDeg = ARC_START_ANGLE - step * index;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = centerX + Math.cos(angleRad) * radiusX;
      const y = centerY - Math.sin(angleRad) * radiusY;
      return {
        ...entry,
        left: `${x}px`,
        top: `${y}px`,
      };
    });
  }, [gaugeDimensions.height, gaugeDimensions.width]);

  const numericLabels = useMemo(() => {
    const values = Array.from({ length: 11 }, (_, index) => index * 10);
    const step = (ARC_START_ANGLE - ARC_END_ANGLE) / (values.length - 1);
    const centerX = gaugeDimensions.width / 2;
    const centerY = gaugeDimensions.height * INNER_CENTER_Y_RATIO;
    const radiusX = gaugeDimensions.width * INNER_RADIUS_X_RATIO;
    const radiusY = gaugeDimensions.height * INNER_RADIUS_Y_RATIO;

    return values.map((value, index) => {
      const angleDeg = ARC_START_ANGLE - step * index;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = centerX + Math.cos(angleRad) * radiusX;
      const y = centerY - Math.sin(angleRad) * radiusY;
      return {
        value,
        left: `${x}px`,
        top: `${y}px`,
      };
    });
  }, [gaugeDimensions.height, gaugeDimensions.width]);

  return (
    <section
      aria-labelledby="threat-index-heading"
      className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-100 to-slate-50 p-8 shadow-soft transition-colors duration-200 dark:border-white/10 dark:from-slate-900/60 dark:via-slate-900/40 dark:to-slate-900/20"
    >
      <header className="mb-6 flex flex-col items-center gap-2 text-center">
        <h2 id="threat-index-heading" className="text-xl font-semibold tracking-wide text-slate-900 dark:text-white">
          Social Network Threat Index
        </h2>
        <div className="flex flex-col items-center gap-1">
          {platform !== "all" && (
            <span className="rounded-full border border-slate-300/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm dark:border-white/20 dark:bg-slate-900/70 dark:text-slate-200">
              {platform}
            </span>
          )}
          <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">
            Aggregated risk score for {platform === "all" ? "all monitored platforms" : platform}.
          </p>
        </div>
      </header>

      <div className="flex flex-col items-center justify-center">
        <div ref={containerRef} className="relative w-full max-w-xl" style={{ height: `${gaugeDimensions.height}px` }}>
          <Chart
            options={chartOptions}
            series={[displayValue]}
            type="radialBar"
            height={Math.round(gaugeDimensions.height)}
          />
          <div className="pointer-events-none absolute inset-0">
            {arcLabels.map((entry) => (
              <span
                key={entry.label}
                className={`absolute -translate-x-1/2 -translate-y-1/2 text-center text-[11px] font-semibold uppercase tracking-widest ${entry.label === zone.label
                  ? "text-stg-accent drop-shadow"
                  : "text-slate-500 dark:text-slate-300"
                  }`}
                style={{ left: entry.left, top: entry.top }}
              >
                {entry.label}
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-0">
            {numericLabels.map((entry) => (
              <span
                key={entry.value}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-600 dark:text-slate-200"
                style={{ left: entry.left, top: entry.top }}
              >
                {entry.value}
              </span>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-2 flex flex-col items-center gap-1 text-center">
            <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              Current signal
            </span>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-slate-900 dark:text-white">{displayValue.toFixed(0)}%</span>
              <span className="rounded-full border border-slate-200/80 bg-white px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
                {zone.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isLoading ? "Syncing with monitoring API…" : error ?? "Signal calibrated against the last 3 hours of traffic."}
            </p>
          </div>
        </div>
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
