import { useMemo, useState } from "react";
import { MessageSquare, Share2, Megaphone, ShieldAlert } from "lucide-react";
import GaugeChart from "@/components/GaugeChart";
import PlatformCard from "@/components/PlatformCard";

const Home = () => {
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [isFeedRevealed, setIsFeedRevealed] = useState(false);

  const platformCards = useMemo(
    () => [
      {
        platform: "Reddit",
        summary:
          "Coordinated thread targeting keynote speakers with instructions for disruption at the campus entrance tonight.",
        updated: "4 minutes ago",
        sentiment: "critical" as const,
        icon: <MessageSquare className="h-5 w-5" aria-hidden />,
      },
      {
        platform: "Facebook",
        summary:
          "Group admins report rapid spread of edited event flyers calling for aggressive counter-protest.",
        updated: "11 minutes ago",
        sentiment: "high" as const,
        icon: <Share2 className="h-5 w-5" aria-hidden />,
      },
      {
        platform: "Bluesky",
        summary:
          "Emerging network of new accounts amplifying unfounded threats toward volunteer stewards.",
        updated: "18 minutes ago",
        sentiment: "medium" as const,
        icon: <Megaphone className="h-5 w-5" aria-hidden />,
      },
      {
        platform: "Mastodon",
        summary:
          "Federated instance moderators suppress flagged doxxing attempts; hostilities trending lower but volatile.",
        updated: "26 minutes ago",
        sentiment: "low" as const,
        icon: <ShieldAlert className="h-5 w-5" aria-hidden />,
      },
    ],
    []
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4">
      <div className="mt-4 flex flex-col gap-12 lg:mt-0 lg:grid lg:grid-cols-[minmax(0,_1.35fr)_minmax(0,_1fr)] lg:gap-10">
        <div className="order-2 lg:order-1">
          <GaugeChart platform={selectedPlatform} onPlatformChange={setSelectedPlatform} />
        </div>
        <div className="order-1 lg:order-2">
          <section aria-label="Platform threat summaries" className="flex h-full flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold tracking-wide text-slate-900 dark:text-white">
                Cross-platform Threat Speech
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Recent posts surfaced by our classifiers across monitored communities. Prioritize review of
                critical items with on-ground security teams.
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
                {platformCards.map((card) => (
                  <PlatformCard key={card.platform} {...card} />
                ))}
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
