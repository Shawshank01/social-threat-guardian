import { Link } from "react-router-dom";

const Terms = () => {
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Terms</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Key terms for using Social Threat Guardian. These highlights summarize how the service works, what we expect
          from users, and what you can expect from us.
        </p>
      </header>
      <div className="space-y-6 rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-sm leading-relaxed text-slate-700 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Purpose of the service</h2>
          <p className="mt-2">
            Social Threat Guardian helps you monitor harmful online activity. It provides a Threat Index, High-Risk
            Content feed, Threat Trend chart, keyword-based monitoring, notifications when risk crosses thresholds, and
            Harassment Networks to spot coordinated behavior.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Accounts and eligibility</h2>
          <p className="mt-2">
            You need an account to save keywords, enable alerts, and access restricted pages. Keep your credentials
            secure and notify us if you suspect unauthorized use. Guests can browse the homepage but cannot save
            preferences.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Acceptable use</h2>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            <li>Do not misuse the service, attempt to break security, or disrupt others.</li>
            <li>Do not use outputs to harass, target, or unlawfully surveil individuals or groups.</li>
            <li>Respect platform rules for any linked or sourced content.</li>
            <li>Please use the comments section with decorum.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Data sources and limitations</h2>
          <p className="mt-2">
            Current live monitoring focuses on Bluesky. Alerts and feeds are informational and may not capture all
            harmful content. The thresholds you set (0–100) determine whether or not notifications are sent, with a six-hour interval between them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Privacy and data handling</h2>
          <p className="mt-2">
            We store your account details and saved preferences to operate the service. For how we collect, use, and
            protect data, please review the <Link to="/privacy" className="text-stg-accent hover:underline">Privacy Policy</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Availability and changes</h2>
          <p className="mt-2">
            Service availability is best-effort. Features, thresholds, and supported platforms may change over time. We
            may update these terms, and continued use means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Contact</h2>
          <p className="mt-2">
            For questions about these terms or your use of the service, contact the Social Threat Guardian team through
            the email address.
          </p>
        </section>
      </div>
    </section>
  );
};

export default Terms;
