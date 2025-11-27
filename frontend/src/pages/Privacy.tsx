const Privacy = () => {
  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Privacy Statement – Social Threat Guardian</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <em>Last updated: Thu 27 Nov, 2025</em>
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Social Threat Guardian ("we", "our", "the platform") is committed to protecting the privacy and personal data of all users. This Privacy Statement explains how we collect, use, store, and protect your personal information in accordance with the <strong>General Data Protection Regulation (GDPR)</strong> and the <strong>Data Protection Act 2018 (Ireland)</strong>.
        </p>
      </header>

      <div className="space-y-8 rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-sm leading-relaxed text-slate-700 transition-colors duration-200 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">1. Data We Collect</h2>
          
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 dark:text-white">1.1 Registration Information</h3>
            <p>If you choose to create an account, we collect:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li><strong>Username</strong></li>
              <li><strong>Email address</strong></li>
              <li><strong>Password</strong></li>
            </ul>
            <p>This information is used solely for authentication, account management, and communication related to system alerts or security notifications.</p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 dark:text-white">1.2 User Preferences</h3>
            <p>Registered users may configure:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li><strong>Keywords</strong> (names, organisations, topics, locations)</li>
              <li><strong>Language preferences</strong></li>
              <li><strong>Platform preferences</strong></li>
              <li><strong>Alert thresholds and notification settings</strong></li>
            </ul>
            <p>These settings are stored <strong>only for the purpose of filtering data and generating personalised alerts</strong>. They are never shared with third parties.</p>
            <blockquote className="border-l-4 border-stg-accent/40 bg-slate-100/50 pl-4 py-2 italic dark:bg-slate-800/50 dark:border-stg-accent/60">
              Keywords may include personal names or sensitive terms. These remain private to your account and are never exposed to other users.
            </blockquote>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 dark:text-white">1.3 Automatically Processed Data</h3>
            <p>When interacting with the platform, we may process:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li>IP address (for security and rate-limiting)</li>
              <li>Browser type and general device information</li>
              <li>Log data required for error detection and system performance</li>
            </ul>
            <p>This information is anonymised or pseudonymised whenever possible.</p>
            <p>We use automated systems (AI) to classify content. These systems do not produce legal effects for users but assist in filtering relevant alerts.</p>
          </div>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">2. Data We Do Not Collect</h2>
          <ul className="ml-6 list-disc space-y-1">
            <li>We do <strong>not</strong> collect passwords in readable form.</li>
            <li>We do <strong>not</strong> store private social media data.</li>
            <li>We do <strong>not</strong> process or retain precise geolocation data, stripping such metadata upon collection.</li>
            <li>We do <strong>not</strong> track online behaviour outside this platform.</li>
          </ul>
          <p>Only <strong>publicly available social media posts</strong> are processed by the system.</p>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">3. Source of Data (GDPR Article 14)</h2>
          <p><strong>Source of Personal Data:</strong> We collect personal data (social media posts, handles, and public biographical info) from third-party sources including Telegram, Mastodon and Bluesky.</p>
          <p>In accordance with Article 14(5)(b) of the GDPR, it proves impossible or would involve a disproportionate effort to provide individual privacy notices to every social media user whose public content is processed. Consequently, this Privacy Statement serves as the public notification of this processing. We adhere to strict data minimisation and only process data relevant to the configured keywords.</p>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">4. How We Use Your Data</h2>
          <p>Your personal data is used for the following purposes:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>To create and authenticate your account</li>
            <li>To allow you to configure preferences and filters</li>
            <li>To send you notifications based on your chosen keywords and alert thresholds</li>
            <li>To display customised dashboards and personal monitor</li>
            <li>To protect system integrity and detect misuse</li>
          </ul>
          <p>We do not use your data for profiling beyond what is strictly necessary to deliver the service features you request.</p>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">5. Automated Processing & AI Transparency</h2>
          <p>In compliance with the EU AI Act, we inform users that this platform utilises Artificial Intelligence and Natural Language Processing (NLP) technologies to analyse public social media content for keyword matches and sentiment analysis. This processing is automated; however, all critical alerts are intended for human review by the account holder. The system does not make automated legal decisions about individuals.</p>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">6. Legal Basis for Processing</h2>
          <p>Under GDPR, we rely on the following lawful bases:</p>
          <ul className="ml-6 list-disc space-y-2">
            <li>
              <strong>Article 6(1)(b) – Contract:</strong>
              <br />
              <span className="ml-4">Required to provide core platform functionality such as account creation and personalised alerts.</span>
            </li>
            <li>
              <strong>Article 6(1)(f) – Legitimate Interests:</strong>
              <br />
              <span className="ml-4">Used for system monitoring, fraud prevention, and ensuring secure platform operation.</span>
            </li>
            <li>
              <strong>Article 6(1)(a) – Consent:</strong>
              <br />
              <span className="ml-4">Required when you opt in to email notifications or configure optional keywords.</span>
            </li>
          </ul>
          <p>You may withdraw consent at any time through user settings or by contacting us.</p>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">7. Data Sharing and Third Parties</h2>
          <p>We do <strong>not</strong> sell, rent, or trade personal data.</p>
          <p>We may use trusted service providers for:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Email delivery</li>
            <li>Server hosting</li>
            <li>Database storage</li>
          </ul>
          <p>These providers operate under strict GDPR-compliant agreements and cannot use your data for their own purposes.</p>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">8. Data Security</h2>
          <p>We implement technical and organisational measures to protect your personal data, including:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Password hashing with modern encryption algorithms</li>
            <li>HTTPS encryption for all data transmission</li>
            <li>Role-based access control for internal components</li>
            <li>Regular security audits and vulnerability monitoring</li>
            <li>Server-side data validation and sanitisation</li>
          </ul>
          <p>In case of a data breach, we will notify affected users and the Irish Data Protection Commission in accordance with GDPR requirements.</p>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">9. Data Retention</h2>
          <ul className="ml-6 list-disc space-y-1">
            <li>Account information is retained <strong>for as long as your account is active</strong>.</li>
            <li>Keyword preferences are retained until deleted by the user.</li>
            <li>Anonymised analytics data may be stored for 10 years.</li>
            <li>Backups may temporarily store deleted user data for disaster recovery but will be purged automatically.</li>
          </ul>
          <p>You may request deletion of your data at any time.</p>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">10. Your Rights Under GDPR</h2>
          <p>You have the following rights:</p>
          <ul className="ml-6 list-disc space-y-1">
            <li><strong>Right to Access</strong> – Request a copy of your personal data.</li>
            <li><strong>Right to Rectification</strong> – Correct incomplete or inaccurate information.</li>
            <li><strong>Right to Erasure</strong> ("Right to be Forgotten").</li>
            <li><strong>Right to Restrict Processing.</strong></li>
            <li><strong>Right to Data Portability.</strong></li>
            <li><strong>Right to Object</strong> to specific types of processing.</li>
            <li><strong>Right to Withdraw Consent</strong> at any time.</li>
          </ul>
          <p>To exercise these rights, contact:</p>
          <p>
            <a
              href="mailto:d24128462@mytudublin.ie"
              className="font-semibold text-stg-accent underline-offset-2 hover:underline dark:text-stg-accent"
            >
              d24128462@mytudublin.ie
            </a>
          </p>
          <p>We will respond within the timeframe required by Irish and EU law.</p>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">11. Children's Privacy</h2>
          <p>The platform is <strong>not intended for users under 16 years old</strong>.</p>
          <p>We do not knowingly collect data from minors.</p>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">12. Changes to This Privacy Statement</h2>
          <p>We may update this Privacy Statement to reflect changes in law, technology, or platform features. Updates will be posted on this page with a revised "Last Updated" date.</p>
        </section>

        <hr className="border-slate-200 dark:border-white/10" />

        <section className="space-y-4">
          <p>If you believe your rights have been violated, you may file a complaint with:</p>
          <p>
            <strong>Data Protection Commission (Ireland):</strong>{" "}
            <a
              href="https://www.dataprotection.ie/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-stg-accent underline-offset-2 hover:underline dark:text-stg-accent"
            >
              https://www.dataprotection.ie/
            </a>
          </p>
        </section>
      </div>
    </section>
  );
};

export default Privacy;
