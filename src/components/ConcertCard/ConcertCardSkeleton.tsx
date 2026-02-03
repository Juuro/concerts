import React from "react"
import "./concertCardSkeleton.scss"

const ConcertCardSkeleton: React.FC = () => {
  return (
    <li className="concert-card-skeleton card">
      <div className="concert-card-skeleton-image skeleton-pulse" aria-hidden="true" />
      <div className="concert-card-skeleton-body">
        <div className="skeleton-title skeleton-pulse" />
        <div className="skeleton-date skeleton-pulse" />
        <div className="skeleton-badges">
          <div className="skeleton-badge skeleton-pulse" />
          <div className="skeleton-badge skeleton-pulse" />
        </div>
      </div>
      <div className="concert-card-skeleton-location">
        <div className="skeleton-club skeleton-pulse" />
        <div className="skeleton-city skeleton-pulse" />
      </div>
    </li>
  )
}

export default ConcertCardSkeleton
