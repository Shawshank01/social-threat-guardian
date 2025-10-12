const Settings = () => {
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Adjust notification schedules, collaboration permissions, and escalation protocols for your organisation.
        </p>
      </header>
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-sm text-slate-600 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
        Settings controls will be implemented soon. Expect integrations with role-based access and audit logging.
      </div>
    </section>
  );
};

export default Settings;
