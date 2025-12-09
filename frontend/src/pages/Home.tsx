import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Share2, Megaphone, ShieldAlert, Send, Network, X, type LucideIcon } from "lucide-react";
import GaugeChart from "@/components/GaugeChart";
import PlatformCard, { FEED_FRAMING, type PlatformCardProps } from "@/components/PlatformCard";
import ThreatTrendChart from "@/components/ThreatTrendChart";
import { useAuth } from "@/context/AuthContext";

const SPLASH_BOX_STORAGE_KEY = "stg.splashBox.dismissed";
const SPLASH_BOX_ENABLED_KEY = "stg.splashBox.enabled";

type CommentPost = {
  postText?: string | null;
  predIntent?: string | null;
  predIntensity?: string | null;
  timeAgo?: string | null;
  platform?: string | null;
  postUrl?: string | null;
  hateScore?: number | string | null;
};

type SeverityLevel = "low" | "medium" | "high" | "critical";

type SeverityPreset = {
  label: string;
  badgeClass: string;
  Icon: LucideIcon;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

const buildApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${API_BASE}/${normalizedPath}`;
};

const SEVERITY_PRESETS: Record<SeverityLevel, SeverityPreset> = {
  low: {
    label: "Low",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    Icon: MessageSquare,
  },
  medium: {
    label: "Elevated",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    Icon: Share2,
  },
  high: {
    label: "High",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
    Icon: Megaphone,
  },
  critical: {
    label: "Critical",
    badgeClass: "bg-red-500/10 text-red-600 dark:text-red-300",
    Icon: ShieldAlert,
  },
};

const mapIntentToSeverityLevel = (intent?: string | null): SeverityLevel => {
  if (!intent) return "medium";
  const normalized = intent.toLowerCase();

  if (/(threat|violence|attack|kill|harm)/.test(normalized)) {
    return "critical";
  }
  if (/(hate|harass|abuse|target)/.test(normalized)) {
    return "high";
  }
  if (normalized.includes("neutral") || normalized.includes("benign")) {
    return "low";
  }

  return "medium";
};

const mapIntensityToSeverityLevel = (
  intensity?: string | null,
  intentFallback?: string | null,
): SeverityLevel => {
  if (intensity) {
    const normalized = intensity.trim().toLowerCase();
    const simplified = normalized.replace(/[^a-z]/g, "");
    if (["low", "minimal", "minor"].includes(simplified)) return "low";
    if (["medium", "moderate", "elevated"].includes(simplified)) return "medium";
    if (["high", "severe"].includes(simplified)) return "high";
    if (["critical", "extreme"].includes(simplified)) return "critical";
  }
  return mapIntentToSeverityLevel(intentFallback);
};

const resolveSeverityPresentation = (intensity?: string | null, intent?: string | null) => {
  const level = mapIntensityToSeverityLevel(intensity, intent);
  const preset = SEVERITY_PRESETS[level] ?? SEVERITY_PRESETS.medium;
  const Icon = preset.Icon;
  const intentLabel = intent?.trim();

  return {
    label:
      intentLabel && intentLabel.length > 0 ? intentLabel.toUpperCase() : preset.label,
    badgeClass: preset.badgeClass,
    icon: <Icon className="h-5 w-5" aria-hidden />,
  };
};

type PlatformIconFactory = () => JSX.Element;

const createLucideIconFactory =
  (Icon: LucideIcon): PlatformIconFactory =>
    () =>
      <Icon className="h-5 w-5" aria-hidden />;

const BlueskyIcon: PlatformIconFactory = () => (
  <img src="/Bluesky_Logo.svg" alt="" className="h-5 w-5 object-contain" aria-hidden />
);

const mastodonIcon = createLucideIconFactory(Network);
const telegramIcon = createLucideIconFactory(Send);
const shieldIcon = createLucideIconFactory(ShieldAlert);

const PLATFORM_ICON_MAP: Record<string, PlatformIconFactory> = {
  mastodon: mastodonIcon,
  "platform 1": mastodonIcon,
  bluesky: BlueskyIcon,
  blusky: BlueskyIcon,
  blusky_test: BlueskyIcon,
  "platform 2": BlueskyIcon,
  telegram: telegramIcon,
  "platform 3": telegramIcon,
};

const resolvePlatformIcon = (platform?: string | null) => {
  const normalized = platform?.trim().toLowerCase() ?? "";
  const factory = normalized ? PLATFORM_ICON_MAP[normalized] : undefined;
  const renderIcon = factory ?? shieldIcon;
  return renderIcon();
};

const Home = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [isFeedRevealed, setIsFeedRevealed] = useState(false);
  const [posts, setPosts] = useState<CommentPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [showSplashBox, setShowSplashBox] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const threatIndexRef = useRef<HTMLDivElement | null>(null);
  const [threatIndexHeight, setThreatIndexHeight] = useState<number | null>(null);
  const isGuest = !token;

  // Check if splash box should be shown
  useEffect(() => {
    // For guests (not logged in), always show the welcome splash and ignore dismissal
    if (isGuest) {
      setShowSplashBox(true);
      setDontShowAgain(false);
      return;
    }

    const isDismissed = localStorage.getItem(SPLASH_BOX_STORAGE_KEY) === "true";
    const isEnabled = localStorage.getItem(SPLASH_BOX_ENABLED_KEY) !== "false"; // Default to true

    if (!isDismissed && isEnabled) {
      setShowSplashBox(true);
    } else {
      setShowSplashBox(false);
    }
  }, [isGuest]);

  const handleSplashYes = () => {
    if (isGuest) {
      // Guests cannot dismiss; keep splash visible but allow navigation
      setShowSplashBox(true);
      navigate("/about");
      return;
    }
    if (dontShowAgain) {
      localStorage.setItem(SPLASH_BOX_STORAGE_KEY, "true");
      localStorage.setItem(SPLASH_BOX_ENABLED_KEY, "false");
      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("splashBoxSettingChanged"));
    }
    setShowSplashBox(false);
    navigate("/about");
  };

  const handleSplashNo = () => {
    if (isGuest) {
      // Guests cannot dismiss
      setShowSplashBox(true);
      return;
    }
    if (dontShowAgain) {
      localStorage.setItem(SPLASH_BOX_STORAGE_KEY, "true");
      localStorage.setItem(SPLASH_BOX_ENABLED_KEY, "false");
      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event("splashBoxSettingChanged"));
    }
    setShowSplashBox(false);
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadPosts = async () => {
      setIsLoadingPosts(true);
      setPostsError(null);
      try {
        const response = await fetch(buildApiUrl("comments/latest?limit=10"), {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          comments?: CommentPost[];
          error?: string;
        };

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error ?? "Unable to load latest posts.");
        }

        setPosts(Array.isArray(payload.comments) ? payload.comments : []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setPosts([]);
        setPostsError((err as Error).message || "Unable to load latest posts.");
      } finally {
        setIsLoadingPosts(false);
      }
    };

    void loadPosts();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const element = threatIndexRef.current;
    if (!element) return;

    const updateHeight = () => {
      const nextHeight = element.getBoundingClientRect().height;
      setThreatIndexHeight(nextHeight > 0 ? nextHeight : null);
    };

    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const platformCards = useMemo<PlatformCardProps[]>(() => {
    return posts.map((post, index) => {
      const severity = resolveSeverityPresentation(post.predIntensity, post.predIntent);
      const parsedHateScore =
        typeof post.hateScore === "number"
          ? post.hateScore
          : typeof post.hateScore === "string"
            ? Number.parseFloat(post.hateScore)
            : null;
      const harmfulScore = Number.isFinite(parsedHateScore) ? parsedHateScore : null;
      return {
        heading: FEED_FRAMING.cardHeading,
        platform: post.platform?.trim() || "Unattributed source",
        summary: post.postText?.trim() || "No content provided for this post.",
        updated: post.timeAgo ?? "moments ago",
        severity: {
          label: severity.label,
          badgeClass: severity.badgeClass,
        },
        harmfulScore,
        icon: resolvePlatformIcon(post.platform),
        linkUrl: post.postUrl ?? null,
      } satisfies PlatformCardProps;
    });
  }, [posts]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4">
      {/* Splash Box */}
      {showSplashBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-xl transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/95">
            {!isGuest && (
              <button
                type="button"
                onClick={handleSplashNo}
                className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-200/80 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            )}
            <div className="space-y-4">
              <header className="space-y-2 pr-8">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Welcome to Social Threat Guardian
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Would you like to learn more about our platform and how we help protect against online threats?
                </p>
              </header>
              {!isGuest && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="dont-show-again"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-stg-accent focus:ring-2 focus:ring-stg-accent/40 dark:border-white/20"
                  />
                  <label
                    htmlFor="dont-show-again"
                    className="text-sm text-slate-600 dark:text-slate-300"
                  >
                    Don't show this message again
                  </label>
                </div>
              )}
              <div className={`flex flex-col gap-3 ${isGuest ? "" : "sm:flex-row"}`}>
                <button
                  type="button"
                  onClick={handleSplashYes}
                  className="flex-1 rounded-full bg-stg-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/40"
                >
                  Yes, tell me more
                </button>
                {!isGuest && (
                  <button
                    type="button"
                    onClick={handleSplashNo}
                    className="flex-1 rounded-full border border-slate-300/80 bg-white px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent/40 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    No, thanks
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,_1.35fr)_minmax(0,_1fr)] lg:items-start lg:gap-10">
        <div className="order-1 [&>section]:mt-0" ref={threatIndexRef}>
          <GaugeChart platform={selectedPlatform} onPlatformChange={setSelectedPlatform} />
        </div>
        <div className="order-2 flex flex-col gap-8">
          <section aria-label="Platform threat summaries" className="flex h-full flex-col">
            <div
              className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-3 sm:p-4 shadow-soft transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/40"
              style={threatIndexHeight ? { height: threatIndexHeight } : undefined}
            >
              <header className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold tracking-wide text-slate-900 dark:text-white">
                  {FEED_FRAMING.sectionTitle}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {FEED_FRAMING.sectionDescription}
                </p>
              </header>
              <div className="relative mt-3 flex-1 min-h-0">
                <div
                  className={`h-full min-h-[12rem] space-y-3 sm:space-y-4 overflow-y-auto px-1 sm:px-2 pt-0 pb-3 sm:pb-4 transition duration-200 ${isFeedRevealed ? "" : "pointer-events-none select-none blur-xl"
                    }`}
                  role="list"
                  aria-busy={isLoadingPosts}
                  aria-live={isFeedRevealed ? "polite" : "off"}
                >
                  {platformCards.map((card, idx) => (
                    <PlatformCard key={`${card.platform}-${idx}`} {...card} />
                  ))}
                  {!isLoadingPosts && !postsError && platformCards.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-slate-300/60 p-6 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
                      No flagged posts are available right now.
                    </p>
                  )}
                  {postsError && (
                    <p className="rounded-2xl border border-red-500/60 bg-red-500/15 p-6 text-sm font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                      {postsError}
                    </p>
                  )}
                  {isLoadingPosts && platformCards.length === 0 && !postsError && (
                    <p className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300">
                      Loading latest posts…
                    </p>
                  )}
                </div>
                {!isFeedRevealed && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 p-6 text-center backdrop-blur-sm">
                    <div className="space-y-4 max-w-sm">
                      <h3 className="text-base font-semibold text-white">
                        Sensitive content ahead
                      </h3>
                      <p className="text-sm text-slate-200">
                        Some posts may contain explicit hate speech or harassment. Confirm to reveal the latest
                        flagged content.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsFeedRevealed(true)}
                        className="w-full rounded-full bg-stg-accent px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                      >
                        Reveal posts
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
        <div className="order-3 lg:col-span-2">
          <ThreatTrendChart />
        </div>
      </div>
    </div>
  );
};

export default Home;
