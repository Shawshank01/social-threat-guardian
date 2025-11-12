import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Share2, Megaphone, ShieldAlert, Send, Network, type LucideIcon } from "lucide-react";
import GaugeChart from "@/components/GaugeChart";
import PlatformCard, { type PlatformCardProps } from "@/components/PlatformCard";

type CommentPost = {
  postText?: string | null;
  predIntent?: string | null;
  predIntensity?: string | null;
  timeAgo?: string | null;
  platform?: string | null;
  postUrl?: string | null;
  hateScore?: number | string | null;
};

type FeedFraming = {
  sectionTitle: string;
  sectionDescription: string;
  cardHeading: string;
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

const FEED_FRAMING: FeedFraming = {
  sectionTitle: "Cross-platform High-Risk Content",
  sectionDescription:
    "Latest posts identified by our systems as containing hate, threats, or other forms of harmful speech across observed communities.",
  cardHeading: "High-Risk Content",
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
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [isFeedRevealed, setIsFeedRevealed] = useState(false);
  const [posts, setPosts] = useState<CommentPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

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
      <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,_1.35fr)_minmax(0,_1fr)] lg:gap-10">
        <div className="order-1">
          <GaugeChart platform={selectedPlatform} onPlatformChange={setSelectedPlatform} />
        </div>
        <div className="order-2">
          <section aria-label="Platform threat summaries" className="flex h-full flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold tracking-wide text-slate-900 dark:text-white">
                {FEED_FRAMING.sectionTitle}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {FEED_FRAMING.sectionDescription}
              </p>
            </header>
            <div className="relative flex-1 space-y-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-4 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/40">
              <div
                className={`max-h-[32rem] space-y-4 overflow-y-auto pr-2 transition duration-200 ${isFeedRevealed ? "" : "pointer-events-none select-none blur-xl"
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
          </section>
        </div>
      </div>
    </div>
  );
};

export default Home;
