import React from "react"
import Layout from "@/components/layout-client"
import type { Metadata } from "next"
import styles from "./terms.module.scss"

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms and Conditions for Concerts.",
}

export default function TermsPage() {
  return (
    <Layout>
      <main>
        <article className={styles.terms}>
          <h1>Terms and Conditions</h1>
          <p className={styles.intro}>
            General terms and conditions for the use of Concerts. Please read
            these terms carefully. By using our service, you agree to be bound
            by these terms.
          </p>

          <section aria-labelledby="scope-heading">
            <h2 id="scope-heading">§ 1 Scope</h2>
            <p>
              These terms and conditions apply to all contracts between
              [Business Name] GBR and the user regarding the use of the Concerts
              platform. Deviating or supplementary terms of the user do not
              apply unless explicitly agreed in writing.
            </p>
          </section>

          <section aria-labelledby="subject-heading">
            <h2 id="subject-heading">§ 2 Subject Matter</h2>
            <p>
              Concerts is a web-based service for tracking personal concert
              attendance. The scope of services includes the features described
              on the website at the time of registration. [Business Name] GBR
              reserves the right to expand, restrict, or modify the service with
              reasonable notice.
            </p>
          </section>

          <section aria-labelledby="contract-heading">
            <h2 id="contract-heading">§ 3 Contract Conclusion</h2>
            <p>
              The contract is concluded when the user completes registration and
              accepts these terms. For paid subscriptions, the contract is
              concluded upon confirmation of the order. The user will receive an
              order confirmation by email.
            </p>
          </section>

          <section aria-labelledby="term-heading">
            <h2 id="term-heading">§ 4 Contract Term and Termination</h2>
            <p>
              Free accounts run for an indefinite period and may be terminated
              at any time. Paid subscriptions run for the selected billing
              period (monthly or annually) and renew automatically unless
              cancelled. Cancellation must be declared in text form (e.g. email)
              at least [14] days before the end of the current period. Upon
              termination, the user may export their data; after a reasonable
              retention period, data will be deleted.
            </p>
          </section>

          <section aria-labelledby="payment-heading">
            <h2 id="payment-heading">§ 5 Prices and Payment</h2>
            <p>
              Current prices are displayed on the website and in the order
              process. All prices include statutory VAT where applicable.
              Payment is due upon invoice unless otherwise agreed. In case of
              late payment, [Business Name] GBR may suspend the service and
              charge default interest at the statutory rate.
            </p>
          </section>

          <section aria-labelledby="obligations-heading">
            <h2 id="obligations-heading">§ 6 User Obligations</h2>
            <p>
              The user is responsible for maintaining the confidentiality of
              their access credentials. They must provide accurate information
              and notify [Business Name] GBR immediately of any unauthorized
              access. The user may not use the service for unlawful purposes or
              in a manner that harms other users or the service.
            </p>
          </section>

          <section aria-labelledby="liability-heading">
            <h2 id="liability-heading">§ 7 Liability</h2>
            <p>
              [Business Name] GBR is liable without limitation for intent and
              gross negligence, for injury to life, body, or health, and for
              breaches of guaranteed characteristics. For slight negligence,
              liability is limited to foreseeable, typically occurring damage
              and to the amount of the contract value. Liability under the
              Product Liability Act remains unaffected. Limitations of liability
              also apply in favour of legal representatives and vicarious
              agents.
            </p>
          </section>

          <section aria-labelledby="withdrawal-heading">
            <h2 id="withdrawal-heading">§ 8 Right of Withdrawal</h2>
            <p>
              If you are a consumer within the meaning of § 13 BGB, you have a
              right of withdrawal in accordance with § 355 BGB.
            </p>
            <p>
              <strong>Withdrawal period:</strong> You may withdraw from this
              contract within fourteen (14) days without giving reasons. The
              withdrawal period begins on the day of contract conclusion. To
              exercise your right of withdrawal, you must inform us ( [Business
              Name] GBR,{" "}
              <a href="mailto:contact@example.com">contact@example.com</a>) by
              means of a clear statement (e.g. a letter sent by post or email)
              of your decision to withdraw from the contract.
            </p>
            <p>
              <strong>Consequences of withdrawal:</strong> If you withdraw, we
              will refund all payments received from you without undue delay and
              no later than fourteen days from the day we receive your
              withdrawal notice. We will use the same means of payment that you
              used for the original transaction unless otherwise agreed; you
              will not be charged any fees for the refund. If you have requested
              that performance of the service begin during the withdrawal
              period, you must pay us a reasonable amount corresponding to the
              proportion of services already provided up to the time you notify
              us of your withdrawal.
            </p>
            <p>
              <strong>Digital content:</strong> If the contract concerns the
              supply of digital content not supplied on a tangible medium, your
              right of withdrawal lapses once we have begun performance with
              your prior express consent and your acknowledgement that you will
              lose your right of withdrawal once performance has begun (§ 356
              para. 5 BGB).
            </p>
            <p>
              For a model withdrawal form and further details, see our{" "}
              <a href="/revocation">Right of Withdrawal</a> page.
            </p>
          </section>

          <section aria-labelledby="datenschutz-heading">
            <h2 id="datenschutz-heading">§ 9 Data Protection</h2>
            <p>
              The collection and processing of personal data is governed by our{" "}
              <a href="/privacy">privacy policy</a> and the applicable data
              protection regulations (GDPR, BDSG – German Federal Data
              Protection Act). The user agrees to the processing of their data
              as described therein.
            </p>
          </section>

          <section aria-labelledby="dispute-heading">
            <h2 id="dispute-heading">§ 10 Dispute Resolution</h2>
            <p>
              The European Commission provides a platform for online dispute
              resolution (OS):{" "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://ec.europa.eu/consumers/odr
              </a>
              . [Business Name] GBR is not obligated to participate in dispute
              resolution proceedings before a consumer arbitration board. The
              laws of the Federal Republic of Germany apply, excluding the UN
              Convention on Contracts for the International Sale of Goods.
            </p>
          </section>

          <section aria-labelledby="final-heading">
            <h2 id="final-heading">§ 11 Final Provisions</h2>
            <p>
              Should individual provisions be or become invalid, the validity of
              the remaining provisions remains unaffected (severability clause).
              Amendments to these terms will be communicated in advance;
              continued use after the effective date constitutes acceptance. For
              questions, contact{" "}
              <a href="mailto:contact@example.com">[contact@example.com]</a>.
            </p>
          </section>
        </article>
      </main>
    </Layout>
  )
}
