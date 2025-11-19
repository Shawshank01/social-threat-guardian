import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Chart from "react-apexcharts";
import ApexCharts from "apexcharts";
import type { ApexOptions } from "apexcharts";

// Get WebSocket URL from environment variables
// Supports VITE_BACKEND_URL (preferred) or VITE_API_BASE_URL
const getWebSocketUrl = () => {
  // Check for explicit backend URL (VITE_BACKEND_URL takes precedence)
  const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL;
  
  // If a full backend URL is provided, derive WebSocket URL from it
  if (backendUrl && (backendUrl.startsWith("http://") || backendUrl.startsWith("https://"))) {
    const wsProtocol = backendUrl.startsWith("https://") ? "wss://" : "ws://";
    try {
      const url = new URL(backendUrl);
      // Preserve port if specified, otherwise use default
      const port = url.port ? `:${url.port}` : "";
      const wsUrl = `${wsProtocol}${url.hostname}${port}/ws`;
      return wsUrl;
    } catch (err) {
      console.warn("[GaugeChart] Failed to parse backend URL:", err);
    }
  }
  
  // If no valid backend URL is configured, throw an error
  throw new Error(
    "VITE_BACKEND_URL or VITE_API_BASE_URL must be set to a full URL (e.g., http://your-backend:3000)"
  );
};

const ZONES = [
  { label: "Harmony", max: 20, colors: ["#3ee6b0", "#19ce86"] },
  { label: "Uneasy", max: 40, colors: ["#5fd4d0", "#3ab3ba"] },
  { label: "Turbulent", max: 60, colors: ["#f5c44f", "#f0a52a"] },
  { label: "Hostile", max: 80, colors: ["#ff8b60", "#ff6b3d"] },
  { label: "Toxic", max: 100, colors: ["#ff6b6b", "#ef3251"] },
] as const;

const clamp = (value: number) => Math.min(100, Math.max(0, value));

const readZone = (value: number) => ZONES.find((zone) => value <= zone.max) ?? ZONES[ZONES.length - 1];

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type HateScoreUpdate = {
  type: "HATE_SCORE_UPDATE";
  data: {
    value: number | null;
    updatedAt: string | null;
    sampleSize: number;
    tableName: string | null;
  };
};

type ConnectedMessage = {
  type: "CONNECTED";
  data: {
    connectedAt: string;
  };
};

type WebSocketMessage = HateScoreUpdate | ConnectedMessage;

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
  const [targetValue, setTargetValue] = useState<number | null>(null);
  const [displayValue, setDisplayValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [sampleSize, setSampleSize] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isBluesky = platform === "bluesky";
  // Initialise with mobile-friendly dimensions that will be updated immediately
  const [gaugeDimensions, setGaugeDimensions] = useState(() => {
    // Use a mobile-friendly default that will be updated on first render
    if (typeof window !== "undefined") {
      const viewportWidth = window.innerWidth;
      const width = Math.min(viewportWidth - 32, 512); // Account for padding, max-w-xl
      const height = Math.max(200, Math.min(340, width * 0.68));
      return { width, height };
    }
    return { width: 320, height: 340 };
  });

  // Reset values immediately when switching away from Bluesky
  useEffect(() => {
    if (!isBluesky) {
      // Close any existing WebSocket connection immediately
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Reset all values immediately (no animation delay)
      setTargetValue(null);
      setDisplayValue(0);
      setIsLoading(false);
      setError("Real-time monitoring is currently only available for Bluesky.");
      setLastUpdatedAt(null);
      setSampleSize(0);
    }
  }, [isBluesky]);

  // WebSocket connection for Bluesky platform
  useEffect(() => {
    if (!isBluesky) {
      // Don't establish WebSocket connection for non-Bluesky platforms
      return;
    }

    const connectWebSocket = () => {
      try {
        const wsUrl = getWebSocketUrl();
        console.log("[GaugeChart] Connecting to WebSocket:", wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[GaugeChart] WebSocket connected");
          setIsLoading(false);
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);

            if (message.type === "CONNECTED") {
              console.log("[GaugeChart] WebSocket handshake complete", message.data);
            } else if (message.type === "HATE_SCORE_UPDATE") {
              // Only process updates from BLUSKY_TEST table
              if (message.data.tableName === "BLUSKY_TEST" && message.data.value !== null) {
                // Convert from 0-1 range to 0-100 range
                const scorePercent = clamp(message.data.value * 100);
                setTargetValue(scorePercent);
                setLastUpdatedAt(message.data.updatedAt);
                setSampleSize(message.data.sampleSize);
                setError(null);
              }
            }
          } catch (err) {
            console.warn("[GaugeChart] Failed to parse WebSocket message", err);
          }
        };

        ws.onerror = (event) => {
          console.error("[GaugeChart] WebSocket error", event);
          setError("Connection error. Attempting to reconnect...");
          setIsLoading(true);
        };

        ws.onclose = () => {
          console.log("[GaugeChart] WebSocket closed");
          wsRef.current = null;
          setIsLoading(true);
          setError("Connection lost. Reconnecting...");

          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connectWebSocket();
          }, 3000);
        };
      } catch (err) {
        console.error("[GaugeChart] Failed to create WebSocket", err);
        setError("Failed to connect to monitoring service.");
        setIsLoading(false);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isBluesky]);

  // Smooth animation from current display value to target value
  useEffect(() => {
    if (targetValue === null) {
      // If targetValue is null (non-Bluesky platform), ensure displayValue is 0
      setDisplayValue(0);
      return;
    }

    const animate = () => {
      setDisplayValue((prev) => {
        const diff = targetValue - prev;
        if (Math.abs(diff) < 0.1) {
          return targetValue;
        }
        // Smooth interpolation
        return clamp(prev + diff * 0.1);
      });
    };

    const intervalId = window.setInterval(animate, 50);
    return () => window.clearInterval(intervalId);
  }, [targetValue]);

  useIsomorphicLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateDimensions = () => {
      // Force a reflow to ensure accurate measurements
      void element.offsetWidth;
      const rect = element.getBoundingClientRect();
      const width = rect.width || 320;
      const height = Math.max(200, Math.min(340, width * 0.68));
      setGaugeDimensions({ width, height });
    };

    // Update immediately
    updateDimensions();

    // Also update after a microtask to catch any layout changes
    queueMicrotask(updateDimensions);

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateDimensions()) : null;
    observer?.observe(element);

    return () => observer?.disconnect();
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
      className="mt-6 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-100 to-slate-50 p-8 shadow-soft transition-colors duration-200 dark:border-white/10 dark:from-slate-900/60 dark:via-slate-900/40 dark:to-slate-900/20"
    >
      <header className="mb-6 flex flex-col items-center gap-2 text-center">
        <h2 id="threat-index-heading" className="text-xl font-semibold tracking-wide text-slate-900 dark:text-white">
          Social Discourse Risk Index
        </h2>
        <div className="flex flex-col items-center gap-1">
          {platform !== "all" && (
            <span className="rounded-full border border-slate-300/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm dark:border-white/20 dark:bg-slate-900/70 dark:text-slate-200">
              {platform}
            </span>
          )}
          <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">
            Aggregated measure of online toxicity and harmful discourse across {platform === "all" ? "major social platforms" : platform}.{" "}
            <Link
              to="/about"
              className="font-medium text-stg-accent underline-offset-2 hover:underline dark:text-stg-accent"
            >
              Learn more
            </Link>
          </p>
        </div>
      </header>

      <div className="flex flex-col items-center justify-center">
        <div 
          ref={containerRef} 
          className="relative w-full max-w-xl" 
          style={{ 
            height: `${gaugeDimensions.height}px`,
            minHeight: '200px',
            maxHeight: '340px'
          }}
        >
          <Chart
            key={`gauge-${gaugeDimensions.width}-${gaugeDimensions.height}`}
            options={chartOptions}
            series={[displayValue]}
            type="radialBar"
            height={Math.round(gaugeDimensions.height)}
            width={Math.round(gaugeDimensions.width)}
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
              {isLoading
                ? "Connecting to monitoring service…"
                : error
                  ? error
                  : lastUpdatedAt
                    ? `Updated ${new Date(lastUpdatedAt).toLocaleTimeString()} • ${sampleSize} samples`
                    : "Waiting for data…"}
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
