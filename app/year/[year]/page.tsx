import React from 'react';
import Layout from '../../../src/components/layout-client';
import ConcertCard from '../../../src/components/ConcertCard/concertCard';
import ConcertCount from '../../../src/components/ConcertCount/concertCount';
import { getAllYears, getConcertsByYear, getAllConcerts } from '@/lib/concerts';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const years = await getAllYears();
  return years.map((year) => ({
    year: year,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const { year } = await params;

  return {
    title: `${year} | Concerts`,
  };
}

export default async function YearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const [concerts, allConcerts] = await Promise.all([
    getConcertsByYear(year),
    getAllConcerts(),
  ]);

  // Transform for layout
  const allConcertsFormatted = allConcerts.map((c) => ({
    ...c,
    bands: c.bands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      url: b.url,
    })),
  }));

  const concertsFormatted = {
    edges: concerts.map(c => ({ node: c })),
    totalCount: concerts.length,
  };

  return (
    <Layout concerts={allConcertsFormatted}>
      <main>
        <div className="container">
          <h2>
            {year}
            <ConcertCount concerts={concertsFormatted} />
          </h2>

          <ul className="list-unstyled">
            {concerts.map((concert) => (
              <ConcertCard
                key={concert.id}
                concert={{
                  ...concert,
                  bands: concert.bands.map((b) => ({
                    id: b.id,
                    name: b.name,
                    slug: b.slug,
                    url: b.url,
                  })),
                }}
              />
            ))}
          </ul>
        </div>
      </main>
    </Layout>
  );
}
