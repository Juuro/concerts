import React from "react"
import styles from "./heroBanner.module.scss"

const HeroBanner: React.FC = () => (
  <section className={styles.hero} aria-label="Introduction">
    <p className={styles.freeBadge}>Free. Always.</p>
    <h2 className={styles.headline}>Your concert diary. No invoice.</h2>
    <p className={styles.subline}>
      Log every gig. Map your music journey. See the stats. No credit card. No
      catch.
    </p>
    <ul className={styles.featureList} aria-label="What you get for free">
      <li>Track every concert you&apos;ve ever been to</li>
      <li>Interactive world map of your live music history</li>
      <li>Charts — top years, bands, and cities</li>
      <li>Band pages with genre info and history</li>
    </ul>
  </section>
)

export default HeroBanner
