import React from "react"
import Layout from "@/components/layout-client"
import type { Metadata } from "next"
import styles from "./imprint.module.scss"

export const metadata: Metadata = {
  title: "Imprint",
  description: "Legal imprint and provider identification for Concerts.",
}

export default function ImprintPage() {
  return (
    <Layout>
      <main>
        <article className={styles.imprint}>
          <h1>Imprint</h1>
          <p className={styles.intro}>
            Provider identification as required by law in the EU, UK, USA,
            Australia, Brazil, Japan, Mexico, and Indonesia.
          </p>

          <section aria-labelledby="provider-heading">
            <h2 id="provider-heading">Provider Identification</h2>
            <address className={styles.address}>
              [Business Name] GBR
              <br />
              [Street Address]
              <br />
              [Postal Code] [City]
              <br />
              [Country]
              <br />
              <br />
              Email:{" "}
              <a href="mailto:contact@example.com">[contact@example.com]</a>
              <br />
              Phone: <a href="tel:+490000000000">[+49 …]</a>
            </address>
          </section>

          <section aria-labelledby="representatives-heading">
            <h2 id="representatives-heading">
              Representatives / Authorized Persons
            </h2>
            <p>Represented by: [Partner 1 Name], [Partner 2 Name]</p>
          </section>

          <section aria-labelledby="register-heading">
            <h2 id="register-heading">Register and Tax Information</h2>
            <p>VAT ID (if applicable): [DE…]</p>
            <p>Commercial Register (if applicable): [Court, Number]</p>
          </section>

          <section aria-labelledby="content-responsibility-heading">
            <h2 id="content-responsibility-heading">
              Content Responsibility (§ 55 RStV)
            </h2>
            <p>
              Responsible for content (Verantwortlich für den Inhalt): [Name],
              [Address]
            </p>
          </section>

          <section aria-labelledby="data-protection-heading">
            <h2 id="data-protection-heading">
              Data Protection / LGPD (Brazil)
            </h2>
            <p>Data controller: [Business Name]</p>
            <p>CNPJ (if applicable): [CNPJ]</p>
            <p>
              For data subject requests:{" "}
              <a href="mailto:privacy@example.com">[privacy@example.com]</a>
            </p>
          </section>

          <section aria-labelledby="disclosures-heading">
            <h2 id="disclosures-heading">Additional Disclosures</h2>
            <p>
              This website is operated by [Business Name] GBR, a German
              partnership (Gesellschaft bürgerlichen Rechts). The above provider
              identification applies to all jurisdictions where this service is
              offered.
            </p>
          </section>

          <section aria-labelledby="copyright-heading">
            <h2 id="copyright-heading">Copyright</h2>
            <p>© 2025 [Business Name]. All rights reserved.</p>
          </section>
        </article>
      </main>
    </Layout>
  )
}
