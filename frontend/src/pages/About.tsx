const About = () => {
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">About</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Learn about the Social Threat Guardian initiative, collaborating institutions, and our research principles.
        </p>
      </header>
      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-sm text-slate-600 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
        Team profiles, project history, and mission statements will be added here as materials are finalised.
      </div>
    </section>
  );
};

export default About;
