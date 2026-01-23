import React from "react";
import Layout from "../src/components/layout-client";
import ConcertCard from "../src/components/ConcertCard/concertCard";
import StatisticsWidget from "../src/components/StatisticsWidget/statisticsWidget";
import { getAllConcerts, getAllBands, getSiteMetadata } from "../src/utils/data";
import type { Metadata } from 'next';

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Concerts",
  description: "List of all concerts and festivals I've visited.",
};

export default async function HomePage() {
  const concerts = await getAllConcerts();
  const bands = await getAllBands();
  const siteMetadata = getSiteMetadata();

  return (
    <Layout concerts={concerts}>
      <main>
        <div className="container">
          <StatisticsWidget concerts={concerts} bands={bands} />
          <ul className="list-unstyled">
            {concerts.map((concert) => (
              <ConcertCard key={concert.id} concert={concert} />
            ))}
          </ul>
        </div>
      </main>
    </Layout>
  );
}
