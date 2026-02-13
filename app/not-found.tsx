import React from "react"
import Link from "next/link"
import Layout from "../src/components/layout-client"
import FeatureCard from "@/components/FeatureCard/FeatureCard"
import "./not-found.scss"

const messages = [
  {
    heading: "This show got cancelled",
    subtext:
      "Looks like this page doesn\u2019t exist \u2014 but there are thousands of real concerts waiting for you.",
  },
  {
    heading: "Wrong venue, friend",
    subtext:
      "This page must have moved to a different stage. The real action is elsewhere.",
  },
  {
    heading: "The band never showed up",
    subtext:
      "This page is a no-show. But we\u2019ve got plenty of encores lined up for you.",
  },
  {
    heading: "Looks like a sold-out show",
    subtext:
      "This page is gone, but your concert journey doesn\u2019t have to be.",
  },
  {
    heading: "No encore here",
    subtext:
      "This page has left the building. Time to find a better show.",
  },
  {
    heading: "Lost in the mosh pit",
    subtext:
      "You\u2019ve wandered off the setlist. Let\u2019s get you back on track.",
  },
]

export default function NotFound() {
  const message = messages[Math.floor(Math.random() * messages.length)]

  return (
    <Layout>
      <main>
        <div className="container">
          <section className="not-found-hero">
            <div className="not-found-hero__code">
              <span className="not-found-hero__emoji" role="img" aria-hidden="true">🎸</span>
              <span className="not-found-hero__number">404</span>
              <span className="not-found-hero__emoji" role="img" aria-hidden="true">🥁</span>
            </div>
            <h2>{message.heading}</h2>
            <p>{message.subtext}</p>
          </section>

          <section className="not-found-features">
            <FeatureCard
              icon="🎶"
              title="Track your shows"
              description="Log every gig, festival, and secret basement show. Never forget a set."
              iconClassName="not-found-features__icon"
              cardClassName="not-found-features__card"
            />
            <FeatureCard
              icon="📊"
              title="Discover your stats"
              description="How many bands? How many cities? Find out what kind of concertgoer you are."
              iconClassName="not-found-features__icon"
              cardClassName="not-found-features__card"
            />
            <FeatureCard
              icon="🌍"
              title="Share your journey"
              description="Create a public profile and show the world your concert history."
              iconClassName="not-found-features__icon"
              cardClassName="not-found-features__card"
            />
          </section>

          <section className="not-found-cta">
            <h3>The real show is inside</h3>
            <p>Sign in to start building your concert collection.</p>
            <div className="not-found-cta__actions">
              <Link href="/login" className="not-found-btn--primary">
                Get Started
              </Link>
              <Link href="/" className="not-found-btn--secondary">
                Back to homepage
              </Link>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  )
}
