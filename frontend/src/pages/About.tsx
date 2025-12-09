import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const About = () => {
  const { token } = useAuth();

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">About</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          How Social Threat Guardian helps you spot and respond to harmful online activity.
        </p>
      </header>

      <div className="space-y-8">
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-sm leading-relaxed text-slate-700 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
          <p className="mb-4">
            <strong>Threat Index (homepage):</strong> A live gauge showing how heated or toxic online conversations are right now. When it’s higher, you’re seeing more harmful content on the monitored platform (currently Bluesky). It updates in real time so you can track spikes as they happen.
          </p>
          <p className="mb-4">
            <strong>High-Risk Content (homepage):</strong> A feed of the latest posts our system flags as hateful, threatening, or otherwise harmful. Each card shows the platform, a summary of the post, and a severity label so you can quickly spot what needs attention.
          </p>
          <p className="mb-4">
            <strong>Threat Trend (homepage):</strong> A chart that shows how the threat level changes over time. It helps you see whether things are calming down or getting worse, rather than looking at a single moment.
          </p>
          <p className="mb-4">
            <strong>Keyword Search (Dashboard):</strong> A place to set the words and phrases you want the system to watch for (e.g., names, events, locations). You enter them with commas or new lines, and the system uses them to focus on content that matters to you.
          </p>
          <p className="mb-4">
            <strong>Notification Settings (Dashboard):</strong> Lets you turn on alerts when the Threat Index crosses a threshold you choose. Set a number (0–100) to control how sensitive the alerts are; when enabled, you’ll be notified if the live threat level exceeds that number.
          </p>
          <p className="mb-0">
            <strong>Harassment Networks:</strong> Identifies clusters of related harmful activity, showing patterns of accounts or posts that are acting together, so you can understand coordinated behavior rather than isolated incidents.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-8 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            What you can do with Social Threat Guardian:
          </h2>
          <ol className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stg-accent/10 text-xs font-semibold text-stg-accent dark:bg-stg-accent/20">
                1
              </span>
              <span>Watch the Threat Index, High-Risk Content, and Threat Trend to see current risk and how it’s changing.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stg-accent/10 text-xs font-semibold text-stg-accent dark:bg-stg-accent/20">
                2
              </span>
              <span>Set keywords for the people, places, and issues you need to monitor.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stg-accent/10 text-xs font-semibold text-stg-accent dark:bg-stg-accent/20">
                3
              </span>
              <span>Choose an alert threshold so you’re notified when risk crosses the level you set.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stg-accent/10 text-xs font-semibold text-stg-accent dark:bg-stg-accent/20">
                4
              </span>
              <span>Use Harassment Networks to spot coordinated behavior and understand who’s involved.</span>
            </li>
          </ol>
        </div>

        {!token ? (
          <div className="rounded-3xl border border-stg-accent/40 bg-stg-accent/10 p-8 text-sm leading-relaxed text-slate-700 transition-colors duration-200 dark:border-stg-accent/30 dark:bg-stg-accent/20 dark:text-white">
            <p className="mb-4 font-semibold text-slate-900 dark:text-white">
              Take control now
            </p>
            <p className="mb-4">
              Create an account to save your keywords and alerts, or keep watching the live Threat Index and flagged posts without signing up.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-stg-accent px-6 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-stg-accent-soft"
              >
                Register Now
              </Link>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-full border border-stg-accent px-6 py-2 text-xs font-semibold uppercase tracking-wide text-stg-accent transition hover:bg-stg-accent/10 dark:border-stg-accent/70 dark:text-stg-accent/90"
              >
                View Threat Index
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-stg-accent/40 bg-stg-accent/10 p-8 text-sm leading-relaxed text-slate-700 transition-colors duration-200 dark:border-stg-accent/30 dark:bg-stg-accent/20 dark:text-white">
            <p className="mb-4 font-semibold text-slate-900 dark:text-white">
              Learn more about your right
            </p>
            <p className="mb-4">
              Review how we handle your data and your rights as a user.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/privacy"
                className="inline-flex items-center justify-center rounded-full border border-stg-accent px-6 py-2 text-xs font-semibold uppercase tracking-wide text-stg-accent transition hover:bg-stg-accent/10 dark:border-stg-accent/70 dark:text-stg-accent/90"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="inline-flex items-center justify-center rounded-full border border-stg-accent px-6 py-2 text-xs font-semibold uppercase tracking-wide text-stg-accent transition hover:bg-stg-accent/10 dark:border-stg-accent/70 dark:text-stg-accent/90"
              >
                Terms
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default About;
