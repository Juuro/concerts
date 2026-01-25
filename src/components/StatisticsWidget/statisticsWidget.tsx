"use client";

import React, { useEffect, useState } from "react";
import { cityToSlug } from "../../utils/helpers";
import type { Concert, Band } from "../../types/concert";
import "./statisticsWidget.scss";
import BarChart from "../BarChart/barchart";

interface StatisticsWidgetProps {
  concerts?: Concert[];
  bands?: Band[];
}

const StatisticsWidget: React.FC<StatisticsWidgetProps> = ({ concerts = [], bands = [] }) => {
  const [yearCountsObject, setYearCountsObject] = useState<Record<string, number>>({});
  const [cityCountsObject, setCityCountsObject] = useState<Record<string, number>>({});
  const [mostConcerts, setMostConcerts] = useState(0);
  const [mostCities, setMostCities] = useState(0);
  const [mostSeenBandsArray, setMostSeenBandsArray] = useState<Array<{ id: string; slug: string; name: string; numberOfConcerts: number }>>([]);
  const [mostConcertsOfOneBand, setMostConcertsOfOneBand] = useState(0);

  const yearCountEntries = Object.entries(yearCountsObject);
  const cityCountEntries = Object.entries(cityCountsObject);

  useEffect(() => {
    if (bands.length === 0) return;

    const bandsArray = bands
      .filter((band) => band.concert && band.concert.length > 0)
      .map((band) => {
        const concertCount = band.concert!.filter(
          (concert) => new Date() > new Date(concert.date)
        ).length;

        return {
          id: band.id,
          slug: band.slug,
          name: band.name,
          numberOfConcerts: concertCount,
        };
      })
      .sort((a, b) => b.numberOfConcerts - a.numberOfConcerts)
      .slice(0, 5);

    setMostSeenBandsArray(bandsArray);
  }, [bands]);

  useEffect(() => {
    if (mostSeenBandsArray.length > 0) {
      setMostConcertsOfOneBand(
        Math.max.apply(
          null,
          mostSeenBandsArray.map((band) => band.numberOfConcerts)
        )
      );
    }
  }, [mostSeenBandsArray]);

  useEffect(() => {
    if (concerts.length === 0) return;

    const cityArray = concerts
      .map((concert) => {
        if (new Date() < new Date(concert.date)) {
          return false;
        }

        return concert.fields?.geocoderAddressFields?._normalized_city;
      })
      .filter((city): city is string => typeof city === "string" && city.length > 0);

    if (Object.entries(cityCountsObject).length === 0 && cityArray.length > 0) {
      const cityCounts: Record<string, number> = {};
      for (const city of cityArray) {
        if (!city) {
          continue;
        }
        cityCounts[city] = cityCounts[city] ? cityCounts[city] + 1 : 1;
      }
      setCityCountsObject(cityCounts);
    }
  }, [concerts, cityCountsObject]);

  useEffect(() => {
    if (concerts.length === 0) return;

    const yearArray = concerts
      .filter((concert) => {
        if (new Date() < new Date(concert.date)) {
          return false;
        }
        return true;
      })
      .map((concert) => {
        const date = new Date(concert.date);
        const year = date.getFullYear();
        return Number.isFinite(year) ? year.toString() : undefined;
      });
    
    const yearArrayFiltered = yearArray.filter((year): year is string => typeof year === "string" && year.length > 0);

    if (Object.entries(yearCountsObject).length === 0 && yearArrayFiltered.length > 0) {
      const yearCounts: Record<string, number> = {};
      for (const year of yearArrayFiltered) {
        yearCounts[year] = yearCounts[year] ? yearCounts[year] + 1 : 1;
      }
      setYearCountsObject(yearCounts);
    }
  }, [concerts, yearCountsObject]);

  useEffect(() => {
    if (Object.values(yearCountsObject).length > 0) {
      setMostConcerts(Math.max.apply(null, Object.values(yearCountsObject)));
    }
  }, [yearCountsObject]);

  useEffect(() => {
    if (Object.values(cityCountsObject).length > 0) {
      setMostCities(Math.max.apply(null, Object.values(cityCountsObject)));
    }
  }, [cityCountsObject]);

  return (
    <div className="card statistics-widget">
      <BarChart
        data={yearCountEntries
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map((year) => [year[0], year[1], year[0]])}
        max={mostConcerts}
        title="most concerts per year"
        category="year"
      />
      <BarChart
        data={mostSeenBandsArray.map((band) => [
          band.name,
          band.numberOfConcerts,
          band.slug,
        ])}
        max={mostConcertsOfOneBand}
        title="most concerts per band"
        category="band"
      />
      <BarChart
        data={cityCountEntries
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map((city) => [city[0], city[1], cityToSlug(city[0])])}
        max={mostCities}
        title="most concerts per city"
        category="city"
      />
    </div>
  );
};

export default StatisticsWidget;
