const Monitors = () => {
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Monitors</h1>
        <p className="text-sm text-slate-300">
          Configure high-sensitivity monitors for individuals, collectives, or geographic regions. Tailor notification
          channels and thresholds to align with operational readiness.
        </p>
      </header>
      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-sm text-slate-300">
        Monitor configuration UI and alert routing will appear here. Integrate with the backend subscriptions service to
        persist user preferences.
      </div>
    </section>
  );
};

export default Monitors;
