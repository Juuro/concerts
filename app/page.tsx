import React from "react";
import Layout from "../src/components/layout-client";
import ConcertCard from "../src/components/ConcertCard/concertCard";
import HeroBanner from "../src/components/HeroBanner/heroBanner";
import StatisticsWidget from "../src/components/StatisticsWidget/statisticsWidget";
import { getAllConcerts, getAllBands } from "../src/utils/data";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Concerts",
  description: "List of all concerts and festivals I've visited.",
};

export default async function HomePage() {
  const [concerts, bands, session] = await Promise.all([
    getAllConcerts(),
    getAllBands(),
    auth.api
      .getSession({ headers: await headers() })
      .catch((err: unknown) => {
        console.error("[auth] getSession failed:", err)
        return null
      }),
  ]);

  return (
    <Layout concerts={concerts}>
      <main>
        <div className="container">
          {!session?.user && <HeroBanner />}
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
