import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Share2, Megaphone, ShieldAlert } from "lucide-react";
import GaugeChart from "@/components/GaugeChart";
import PlatformCard from "@/components/PlatformCard";
import { useAuth } from "@/context/AuthContext";

const basePosts = [
  {
    platform: "Reddit",
    summary:
      "Translation team observed coordinated multilingual threads urging harassment of volunteer marshals tonight.",
    updated: "3 minutes ago",
    sentiment: "critical" as const,
    icon: <MessageSquare className="h-5 w-5" aria-hidden />,
    language: "Spanish",
    keywords: ["marshals", "volunteer"],
  },
  {
    platform: "Facebook",
    summary:
      "Regional group sharing subtitled clips targeting Free Voices Coalition speakers across English and Spanish pages.",
    updated: "9 minutes ago",
    sentiment: "high" as const,
    icon: <Share2 className="h-5 w-5" aria-hidden />,
    language: "English",
    keywords: ["Free Voices Coalition", "speakers"],
  },
  {
    platform: "Bluesky",
    summary:
      "Accounts referencing private planning keywords linked to {keyword} with escalating rhetoric in Portuguese.",
    updated: "16 minutes ago",
    sentiment: "medium" as const,
    icon: <Megaphone className="h-5 w-5" aria-hidden />,
    language: "Portuguese",
    keywords: ["planning", "keyword"],
  },
  {
    platform: "Mastodon",
    summary:
      "Moderators flagging doxxing attempts translated via machine-translated threads targeting campus stewards.",
    updated: "24 minutes ago",
    sentiment: "medium" as const,
    icon: <ShieldAlert className="h-5 w-5" aria-hidden />,
    language: "English",
    keywords: ["doxxing", "campus"],
  },
];

const PersonalMonitors = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [isFeedRevealed, setIsFeedRevealed] = useState(false);

  if (!token) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-6 px-4 text-center">
        <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-soft transition-colors dark:border-white/10 dark:bg-slate-900/70">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Sign in to manage monitors</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Personal Monitors aggregate threat intelligence based on your saved languages and keywords.
            Please log in to access your tailored feed.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login", { state: { from: { pathname: "/personal-monitors" } } })}
            className="mx-auto w-full rounded-full bg-stg-accent px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft"
          >
            Go to Login
          </button>
        </div>
      </section>
    );
  }

  const preferences = useMemo(() => {
    const baseKeywords = ["Free Voices Coalition", "Campus Speech Night"];
    const personalisedKeyword = user?.username ? `${user.username}` : undefined;
    return {
      languages: ["English", "Spanish", "Portuguese"],
      keywords: personalisedKeyword ? [...baseKeywords, personalisedKeyword] : baseKeywords,
    };
  }, [user?.username]);

  const personalisedPosts = useMemo(() => {
    const matches = basePosts.filter((post) => {
      const languageMatch = preferences.languages.includes(post.language);
      const keywordMatch = preferences.keywords.some((keyword) => {
        const lowercase = keyword.toLowerCase();
        return (
          post.summary.toLowerCase().includes(lowercase) ||
          post.keywords.some((tag) => tag.toLowerCase().includes(lowercase))
        );
      });
      return languageMatch || keywordMatch;
    });

    const activePosts = matches.length ? matches : basePosts;
    return activePosts.map((post) => ({
      ...post,
      summary: post.summary.replace("{keyword}", preferences.keywords[0] ?? "priority keyword"),
    }));
  }, [preferences.languages, preferences.keywords]);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12">
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Personal Monitors</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Monitoring feed tuned to your settings. Currently prioritising languages: {preferences.languages.join(", ")}
          , keywords: {preferences.keywords.join(", ")}
        </p>
      </header>

      <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,_1.35fr)_minmax(0,_1fr)] lg:gap-10">
        <div>
          <section className="flex flex-col gap-6">
            <GaugeChart platform={selectedPlatform} onPlatformChange={setSelectedPlatform} />
          </section>
        </div>
        <div>
          <section aria-label="Personal monitor feed" className="flex h-full flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold tracking-wide text-slate-900 dark:text-white">
                Flagged Posts Latest
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Matches filtered by your preferred languages and keywords. Update filters in dashboard settings to
                refine delivery.
              </p>
            </header>
            <div className="relative flex-1 space-y-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-4 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/40">
              <div
                className={`max-h-[32rem] space-y-4 overflow-y-auto pr-2 transition duration-200 ${
                  isFeedRevealed ? "" : "pointer-events-none select-none blur-xl"
                }`}
                role="list"
                aria-live={isFeedRevealed ? "polite" : "off"}
              >
                {personalisedPosts.map((card, index) => (
                  <PlatformCard key={`${card.platform}-${index}`} {...card} />
                ))}
              </div>
              {!isFeedRevealed && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 p-6 text-center backdrop-blur-sm">
                  <div className="space-y-4 max-w-sm">
                    <h3 className="text-base font-semibold text-white">Sensitive content for your filters</h3>
                    <p className="text-sm text-slate-200">
                      Posts may include hostile language tied to your custom monitors ({preferences.keywords.join(", ")}).
                      Confirm to review before coordinating response.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsFeedRevealed(true)}
                      className="w-full rounded-full bg-stg-accent px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    >
                      Reveal personalised posts
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
};

export default PersonalMonitors;
