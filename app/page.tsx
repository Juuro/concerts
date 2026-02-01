import React from "react";
import Layout from "../src/components/layout-client";
import ConcertCard from "../src/components/ConcertCard/concertCard";
import StatisticsWidget from "../src/components/StatisticsWidget/statisticsWidget";
import { getAllConcerts } from "@/lib/concerts";
import { getAllBands } from "@/lib/bands";
import type { Metadata } from 'next';

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Concerts",
  description: "List of all concerts and festivals I've visited.",
};

export default async function HomePage() {
  const concerts = await getAllConcerts();
  const bands = await getAllBands();

  // Transform concerts to match expected format
  const concertsFormatted = concerts.map((concert) => ({
    ...concert,
    city: concert.city,
    bands: concert.bands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      url: b.url,
      image: b.imageUrl ? { fields: { file: { url: b.imageUrl } } } : undefined,
      lastfm: b.lastfm,
    })),
  }));

  // Transform bands to match expected format
  const bandsFormatted = bands.map((band) => ({
    ...band,
    url: band.url,
    image: band.imageUrl ? { fields: { file: { url: band.imageUrl } } } : undefined,
    concert: band.concert,
  }));

  return (
    <Layout concerts={concertsFormatted}>
      <main>
        <div className="container">
          <StatisticsWidget concerts={concertsFormatted} bands={bandsFormatted} />
          <ul className="list-unstyled">
            {concertsFormatted.map((concert) => (
              <ConcertCard key={concert.id} concert={concert} />
            ))}
          </ul>
        </div>
      </main>
    </Layout>
  );
}
