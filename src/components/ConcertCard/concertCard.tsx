"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { cityToSlug, extractCityName } from "../../utils/helpers"
import type { TransformedConcert } from "@/lib/concerts"
import "./concertCard.scss"

interface ConcertCardProps {
  concert: TransformedConcert
  showEditButton?: boolean
  currentUserId?: string
}

const ConcertCard: React.FC<ConcertCardProps> = ({
  concert,
  showEditButton = false,
  currentUserId
}) => {
  const heading = () => {
    if (concert.isFestival) {
      return concert.festival?.fields.name || ""
    }
    const mainBand = concert.bands[0]
    if (!mainBand) {
      return "Unknown band"
    }
    return <Link href={`/band/${mainBand.slug}`}>{mainBand.name}</Link>
  }

  const bands = () => {
    const bands = [...concert.bands]
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
        )
      })
    } else {
      bands.shift()
      return bands.map((band) => {
        return (
          <Link
            href={`/band/${band.slug}`}
            key={band.id}
            className="badge bg-primary mr-2"
          >
            {band.name}
          </Link>
        )
      })
    }
  }

  const isInTheFuture = () => {
    if (concert.date > new Date().toISOString()) {
      return "future"
    }
    return ""
  }

  const getDate = () => {
    const date = new Date(concert.date)
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getImageSrc = () => {
    const url = concert.bands[0]?.imageUrl
    if (!url) return undefined
    if (url.startsWith("//")) return `https:${url}`
    return url
  }

  return (
    <li className={`concert-card card ${isInTheFuture()}`}>
      <div className="concert-card-image" aria-hidden="true">
        {getImageSrc() ? (
          <Image
            src={getImageSrc() as string}
            alt=""
            fill
            sizes="(min-width: 1024px) 240px, 33vw"
            className="concert-card-image-img"
          />
        ) : (
          <div className="concert-card-image-placeholder" />
        )}
      </div>
      <div className="concert-card-body">
        <h3 className="card-title">{heading()}</h3>
        <span>{getDate()}</span>
        {bands() && <div className="bands">{bands()}</div>}
      </div>
      <div className="concert-card-location">
        <div>
          <div className="venue">{concert.venue}</div>
          <div className="city">
            <Link
              href={`/city/${cityToSlug(extractCityName(concert.fields.geocoderAddressFields))}`}
            >
              {extractCityName(concert.fields.geocoderAddressFields)}
            </Link>
          </div>
        </div>
        {showEditButton && currentUserId === concert.userId && (
          <Link href={`/concerts/edit/${concert.id}`} className="concert-card-edit-btn">
            Edit
          </Link>
        )}
      </div>
    </li>
  )
}

export default ConcertCard
