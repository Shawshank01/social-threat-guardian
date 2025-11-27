import { Link } from "react-router-dom";

const About = () => {
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">About</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Learn about the Social Threat Guardian initiative, collaborating institutions, and our research principles.
        </p>
      </header>

      <div className="space-y-8">
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-sm leading-relaxed text-slate-700 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
          <p className="mb-4">
            Social Threat Guardian offers protection against hate speech.
          </p>
          <p className="mb-4">
            A live threat index shows the social media climate of multiple platforms.
          </p>
          <p className="mb-4">
            We give you one thing attackers don't anticipate: an early warning.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-8 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            Three step process to protect yourself:
          </h2>
          <ol className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stg-accent/10 text-xs font-semibold text-stg-accent dark:bg-stg-accent/20">
                1
              </span>
              <span>Set keywords that you can track to see if it contains hate speech.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stg-accent/10 text-xs font-semibold text-stg-accent dark:bg-stg-accent/20">
                2
              </span>
              <span>Visualise harassment networks to see coordinated campaigns.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stg-accent/10 text-xs font-semibold text-stg-accent dark:bg-stg-accent/20">
                3
              </span>
              <span>Receive real-time alerts.</span>
            </li>
          </ol>
        </div>

        <div className="rounded-3xl border border-stg-accent/40 bg-stg-accent/10 p-8 text-sm leading-relaxed text-slate-700 transition-colors duration-200 dark:border-stg-accent/30 dark:bg-stg-accent/20 dark:text-white">
          <p className="mb-4 font-semibold text-slate-900 dark:text-white">
            Take control now
          </p>
          <p className="mb-4">
            Register to our platform or just keep watching the live threat index and revealing harmful posts that require no signing up.
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
      </div>
    </section>
  );
};

export default About;
