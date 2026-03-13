import React from "react"
import Layout from "@/components/layout-client"
import type { Metadata } from "next"
import styles from "./privacy.module.scss"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy and data protection information for Concerts, in accordance with GDPR and DSGVO.",
}

export default function PrivacyPage() {
  return (
    <Layout>
      <main>
        <article className={styles.privacy}>
          <h1>Privacy Policy</h1>
          <p className={styles.intro}>
            This privacy policy explains how we collect, use, store, and protect
            your personal data when you use Concerts. It complies with the EU
            General Data Protection Regulation (GDPR) and the German Federal
            Data Protection Act (BDSG). Last updated:{" "}
            {new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            .
          </p>

          <section aria-labelledby="controller-heading">
            <h2 id="controller-heading">1. Controller Identity and Contact</h2>
            <p>
              The controller responsible for data processing is [Business Name]
              GBR. For contact details, including our data protection contact,
              see our{" "}
              <a href="/imprint">Imprint</a>. For data subject requests, you may
              contact us at{" "}
              <a href="mailto:privacy@example.com">[privacy@example.com]</a>.
            </p>
          </section>

          <section aria-labelledby="purposes-heading">
            <h2 id="purposes-heading">2. Purposes and Legal Basis of Processing</h2>
            <p>
              We process your personal data for the following purposes and
              legal bases (Art. 6 GDPR):
            </p>
            <ul>
              <li>
                <strong>Account creation and login:</strong> To provide the
                service, we process your email, name, password (hashed), and
                optional username. <em>Legal basis:</em> Contract performance
                (Art. 6(1)(b) GDPR).
              </li>
              <li>
                <strong>Authentication via GitHub:</strong> If you sign in with
                GitHub, we receive your GitHub profile data (e.g. name, email,
                profile picture) from GitHub.{" "}
                <em>Legal basis:</em> Contract performance (Art. 6(1)(b) GDPR)
                and your consent when you authorise GitHub.
              </li>
              <li>
                <strong>Email verification and password reset:</strong> We send
                verification and password reset emails via our email provider.{" "}
                <em>Legal basis:</em> Contract performance (Art. 6(1)(b) GDPR).
              </li>
              <li>
                <strong>Concert and profile data:</strong> Your concert
                attendance, band preferences, profile settings (including public
                profile option), currency, and visibility settings are processed
                to provide the service. <em>Legal basis:</em> Contract
                performance (Art. 6(1)(b) GDPR).
              </li>
              <li>
                <strong>Session cookies:</strong> Session cookies are used to
                keep you logged in. <em>Legal basis:</em> Legitimate interest in
                secure authentication (Art. 6(1)(f) GDPR).
              </li>
              <li>
                <strong>Admin functions and audit logs:</strong> For
                administrative and security purposes, we may log actions (e.g.
                band edits, user bans). <em>Legal basis:</em> Legitimate interest
                (Art. 6(1)(f) GDPR).
              </li>
            </ul>
          </section>

          <section aria-labelledby="recipients-heading">
            <h2 id="recipients-heading">3. Recipients and Processors</h2>
            <p>
              Your data may be processed by or shared with the following
              categories of processors:
            </p>
            <ul>
              <li>
                <strong>Hosting:</strong> Vercel Inc. (USA) – application
                hosting. Data transfer is governed by the EU-US Data Privacy
                Framework or Standard Contractual Clauses.
              </li>
              <li>
                <strong>Database:</strong> PostgreSQL database (e.g. Prisma
                Postgres / Vercel Postgres, or your configured provider). Data
                may be stored in the EU or USA depending on configuration.
              </li>
              <li>
                <strong>Email:</strong> Resend Inc. – transactional emails
                (verification, password reset). Resend processes data in the USA;
                transfers are governed by Standard Contractual Clauses or
                equivalent safeguards.
              </li>
              <li>
                <strong>GitHub:</strong> For OAuth sign-in, GitHub (GitHub Inc.)
                processes your profile data. Their privacy policy applies:{" "}
                <a
                  href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub Privacy Statement
                </a>
              </li>
              <li>
                <strong>Optional services</strong> (only if enabled in your
                deployment):
                <ul>
                  <li>
                    <strong>Last.fm:</strong> Band metadata enrichment (no
                    personal user data sent; only band identifiers).
                  </li>
                  <li>
                    <strong>Photon (OpenStreetMap):</strong> Venue search and
                    reverse geocoding (only venue/city-related data).
                  </li>
                  <li>
                    <strong>Map tiles:</strong> Map tiles may be loaded from
                    third parties (e.g. OpenFreeMap); typically no personal data
                    is sent.
                  </li>
                </ul>
              </li>
            </ul>
          </section>

          <section aria-labelledby="third-countries-heading">
            <h2 id="third-countries-heading">4. Transfers to Third Countries</h2>
            <p>
              Some processors (e.g. Vercel, Resend, GitHub) may process data in
              the USA or other non‑EEA countries. We ensure appropriate
              safeguards such as adequacy decisions, Standard Contractual
              Clauses, or the EU-US Data Privacy Framework where applicable.
            </p>
          </section>

          <section aria-labelledby="retention-heading">
            <h2 id="retention-heading">5. Retention Periods</h2>
            <ul>
              <li>
                <strong>Sessions:</strong> Session data is retained for the
                duration of your session; session cookies expire after 7 days of
                inactivity.
              </li>
              <li>
                <strong>Account data:</strong> Retained until you delete your
                account. After account deletion, data is removed within a
                reasonable period, subject to legal retention requirements.
              </li>
              <li>
                <strong>Concert and band data:</strong> Retained as long as
                associated with your account or until deletion.
              </li>
              <li>
                <strong>Admin audit logs:</strong> Retained as needed for
                security and legal compliance, typically for a limited period.
              </li>
            </ul>
          </section>

          <section aria-labelledby="rights-heading">
            <h2 id="rights-heading">6. Your Rights (Art. 15–22 GDPR)</h2>
            <p>You have the following data subject rights:</p>
            <ul>
              <li>
                <strong>Right of access (Art. 15):</strong> Obtain confirmation
                as to whether we process your data and a copy of your data.
              </li>
              <li>
                <strong>Right to rectification (Art. 16):</strong> Request
                correction of inaccurate or incomplete data.
              </li>
              <li>
                <strong>Right to erasure (Art. 17):</strong> Request deletion of
                your data under certain conditions (e.g. withdrawal of consent,
                unlawful processing).
              </li>
              <li>
                <strong>Right to restriction (Art. 18):</strong> Request
                restriction of processing in specific situations.
              </li>
              <li>
                <strong>Right to data portability (Art. 20):</strong> Receive
                your data in a structured, machine-readable format and, where
                technically feasible, have it transmitted to another controller.
              </li>
              <li>
                <strong>Right to object (Art. 21):</strong> Object to processing
                based on legitimate interest. We will cease processing unless we
                demonstrate compelling legitimate grounds.
              </li>
              <li>
                <strong>Withdrawal of consent (Art. 7(3)):</strong> If
                processing is based on consent, you may withdraw it at any time
                without affecting the lawfulness of processing before withdrawal.
              </li>
              <li>
                <strong>Right to lodge a complaint (Art. 77):</strong> You have
                the right to lodge a complaint with a supervisory authority in
                your country. For Germany: the competent Landesdatenschutzbehörde
                or the Federal Commissioner for Data Protection (BfDI),{" "}
                <a
                  href="https://www.bfdi.bund.de"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  www.bfdi.bund.de
                </a>
                .
              </li>
            </ul>
            <p>
              To exercise these rights, contact us at{" "}
              <a href="mailto:privacy@example.com">[privacy@example.com]</a> or
              via the address in our{" "}
              <a href="/imprint">Imprint</a>.
            </p>
          </section>

          <section aria-labelledby="necessity-heading">
            <h2 id="necessity-heading">7. Statutory or Contractual Requirement</h2>
            <p>
              The provision of personal data for account creation and use of the
            service is necessary to perform the contract. Without it, we cannot
            provide the service. There is no obligation to provide data for
              optional features (e.g. public profile, username).
            </p>
          </section>

          <section aria-labelledby="automated-heading">
            <h2 id="automated-heading">8. Automated Decision-Making and Profiling</h2>
            <p>
              We do not use automated decision-making or profiling that produces
              legal effects concerning you or similarly significantly affects
              you.
            </p>
          </section>

          <section aria-labelledby="cookies-heading">
            <h2 id="cookies-heading">9. Cookies</h2>
            <p>
              We use strictly necessary cookies for authentication (session
              cookies). These are required for the service to function and do
              not require separate consent. Session cookies typically expire
              after 7 days of inactivity. We do not use advertising or
              third-party analytics cookies by default.
            </p>
          </section>

          <section aria-labelledby="changes-heading">
            <h2 id="changes-heading">10. Changes to This Privacy Policy</h2>
            <p>
              We may update this privacy policy from time to time. Material
              changes will be communicated via the website or by email where
              appropriate. Continued use of the service after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>
        </article>
      </main>
    </Layout>
  )
}
