import { useAuth } from "@/context/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <section className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
          Welcome back, {user?.username ?? "Analyst"}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Manage your monitoring keywords, track escalations, and configure notifications from this workspace.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft transition-colors dark:border-white/10 dark:bg-slate-900/70">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Alert Channels</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Configure delivery methods for urgent notifications. Integrations with email and web push.
          </p>
        </article>

        <article className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft transition-colors dark:border-white/10 dark:bg-slate-900/70">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Keyword Monitors</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Add keywords you track. Use granular thresholds to reduce noise while still catching critical threats.
          </p>
        </article>
      </div>
    </section>
  );
};

export default Dashboard;
