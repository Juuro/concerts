import React from "react";
import Link from "next/link";
import { cityToSlug, extractCityName } from "../../utils/helpers";
import type { Concert } from "../../types/concert";
import "./concertCard.scss";

interface ConcertCardProps {
  concert: Concert;
}

const ConcertCard: React.FC<ConcertCardProps> = ({ concert }) => {
  const heading = () => {
    if (concert.isFestival) {
      return concert.festival?.fields.name || '';
    }
    const mainBand = concert.bands[0];
    if (!mainBand) {
      return 'Unknown band';
    }
    return (
      <Link href={`/band/${mainBand.slug}`}>
        {mainBand.name}
      </Link>
    );
  };

  const bands = () => {
    const bands = [...concert.bands];
    // TODO: Badges as seperate (tag) component?
    if (concert.isFestival) {
      return bands.map((band) => {
        return (
          <Link
            href={`/band/${band.slug}`}
            key={band.id}
            className="badge bg-primary mr-2"
          >
            {band.name}
          </Link>
        );
      });
    } else {
      bands.shift();
      return bands.map((band) => {
        return (
          <Link
            href={`/band/${band.slug}`}
            key={band.id}
            className="badge bg-primary mr-2"
          >
            {band.name}
          </Link>
        );
      });
    }
  };

  const isInTheFuture = () => {
    if (concert.date > new Date().toISOString()) {
      return "future";
    }
    return "";
  };

  const getDate = () => {
    const date = new Date(concert.date);
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Get image URL - prefer Contentful over Last.fm placeholders
  const getImageUrl = () => {
    // Last.fm API only returns placeholder images, so use Contentful images
    return (
      concert.bands[0]?.image?.file?.url ||
      concert.bands[0]?.image?.fields?.file?.url
    );
  };

  return (
    <li className={`concert-card card ${isInTheFuture()}`}>
      <div
        className="concert-card-image"
        style={{
          backgroundImage: getImageUrl() ? `url(${getImageUrl()})` : "none",
        }}
      ></div>
      <div className="concert-card-body">
        <h3 className="card-title">{heading()}</h3>
        <span>{getDate()}</span>
        {bands() && <div className="bands">{bands()}</div>}
      </div>
      <div className="concert-card-location">
        <div>
          <div className="club">{concert.club}</div>
          <div className="city">
            <Link
              href={`/city/${cityToSlug(extractCityName(concert.fields.geocoderAddressFields))}`}
            >
              {extractCityName(concert.fields.geocoderAddressFields)}
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
};

export default ConcertCard;
