import React from "react"
import Layout from "@/components/layout-client"
import type { Metadata } from "next"
import styles from "./revocation.module.scss"

export const metadata: Metadata = {
  title: "Right of Withdrawal (Revocation)",
  description: "Withdrawal instruction and right of withdrawal for Concerts.",
}

export default function RevocationPage() {
  return (
    <Layout>
      <main>
        <article className={styles.revocation}>
          <h1>Right of Withdrawal</h1>
          <p className={styles.intro}>
            You have the right to withdraw from this contract within fourteen
            days without giving any reason. The withdrawal period is fourteen
            days from the day of the conclusion of the contract. To exercise
            your right of withdrawal, you must inform us by means of a clear
            statement of your decision to withdraw from the contract.
          </p>

          <section aria-labelledby="period-heading">
            <h2 id="period-heading">Withdrawal Period</h2>
            <p>
              The withdrawal period is 14 days from the day of the conclusion of
              the contract for sales contracts, or from the day of the
              conclusion of the contract for service contracts. To exercise your
              right of withdrawal within the period, you must inform [Business
              Name] GBR, [Street Address], [Postal Code] [City], or by email at{" "}
              <a href="mailto:contact@example.com">[contact@example.com]</a> by
              means of a clear statement (e.g. a letter sent by post or email)
              of your decision to withdraw from the contract.
            </p>
          </section>

          <section aria-labelledby="consequences-heading">
            <h2 id="consequences-heading">Consequences of Withdrawal</h2>
            <p>
              If you withdraw from this contract, we shall reimburse you all
              payments we have received from you, including delivery costs (with
              the exception of any additional costs resulting from your choice
              of a type of delivery other than the least expensive standard
              delivery offered by us) without undue delay and in any event not
              later than fourteen days from the day on which we receive
              notification of your withdrawal from this contract.
            </p>
            <p>
              For this reimbursement, we will use the same means of payment that
              you used for the initial transaction, unless you have expressly
              agreed otherwise; in any event, you will not be charged any fees
              as a result of this reimbursement.
            </p>
            <p>
              If you requested that the service should begin during the
              withdrawal period, you shall pay us an amount that is in
              proportion to what has been provided until the time you have
              informed us of the exercise of your right of withdrawal from this
              contract, in comparison with the full coverage of the contract.
            </p>
          </section>

          <section aria-labelledby="model-form-heading">
            <h2 id="model-form-heading">Model Withdrawal Form</h2>
            <p>
              If you wish to withdraw from the contract, please complete and
              return this form to:
            </p>
            <div className={styles.modelForm}>
              <p>
                To [Business Name] GBR, [Street Address], [Postal Code] [City],
                Email:{" "}
                <a href="mailto:contact@example.com">[contact@example.com]</a>
              </p>
              <p>
                I hereby give notice that I withdraw from my contract for the
                purchase of the following goods / the provision of the following
                service:
              </p>
              <p>Ordered on / received on: _________________________</p>
              <p>Name of consumer(s): _________________________</p>
              <p>Address of consumer(s): _________________________</p>
              <p>Signature of consumer(s): _________________________</p>
              <p>Date: _________________________</p>
            </div>
          </section>

          <section aria-labelledby="exceptions-heading">
            <h2 id="exceptions-heading">Special Notes (Digital Content)</h2>
            <p>
              Pursuant to § 356 para. 5 of the German Civil Code (BGB), your
              right of withdrawal expires for contracts for the supply of
              digital content not supplied on a tangible medium (e.g. downloads)
              if we have begun the execution of the contract after you have
              expressly consented to this and you have acknowledged that you
              thereby lose your right of withdrawal once we have begun execution
              of the contract.
            </p>
            <p>
              For subscriptions or recurring payments, the provisions in our{" "}
              <a href="/terms">Terms and Conditions</a> apply additionally.
            </p>
          </section>

          <section aria-labelledby="contact-heading">
            <h2 id="contact-heading">Contact</h2>
            <p>
              For questions about withdrawal, please contact{" "}
              <a href="mailto:contact@example.com">[contact@example.com]</a> or
              see our <a href="/imprint">Imprint</a> for further contact
              details.
            </p>
          </section>
        </article>
      </main>
    </Layout>
  )
}
