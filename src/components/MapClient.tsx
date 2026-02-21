"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import type { Concert } from "../types/concert"
import "maplibre-gl/dist/maplibre-gl.css"

interface MapClientProps {
  concerts: Concert[]
  allowFullscreen?: boolean
}

const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
  "https://tiles.openfreemap.org/styles/liberty"

function getYear(dateInput: string): string {
  return new Date(dateInput).toLocaleDateString("de-DE", { year: "numeric" })
}

function getDate(dateInput: string): string {
  return new Date(dateInput).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function getName(concert: Concert): string {
  if (concert.isFestival) {
    return `${concert.festival?.fields.name || ""} ${getYear(concert.date)}`
  }
  return concert.bands[0]?.name || "Unknown"
}

function concertsToGeoJSON(
  concerts: Concert[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: concerts.map((concert) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [concert.city.lon, concert.city.lat],
      },
      properties: {
        id: concert.id,
        name: getName(concert),
        venue: concert.venue || "",
        date: getDate(concert.date),
      },
    })),
  }
}

export default function MapClient({
  concerts,
  allowFullscreen,
}: MapClientProps) {
  const mapInstance = useRef<maplibregl.Map | null>(null)
  const mapContainer = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  // Resize map when fullscreen toggles
  useEffect(() => {
    if (!mapInstance.current) return
    const timeout = setTimeout(() => {
      mapInstance.current?.resize()
    }, 50)
    return () => clearTimeout(timeout)
  }, [isFullscreen])

  // Main map initialization
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainer.current) return
    if (mapInstance.current) return

    const container = mapContainer.current

    import("maplibre-gl").then((maplibregl) => {
      if (!container || mapInstance.current) return

      const map = new maplibregl.Map({
        container,
        style: STYLE_URL,
        center: [10.447683, 51.163375],
        zoom: 6,
        maxZoom: 18,
      })

      map.addControl(new maplibregl.NavigationControl(), "top-left")

      map.on("load", () => {
        const geojson = concertsToGeoJSON(concerts)

        map.addSource("concerts", {
          type: "geojson",
          data: geojson,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        })

        // Cluster circles
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "concerts",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#51bbd6",
              10,
              "#f1f075",
              50,
              "#f28cb1",
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              20,
              10,
              30,
              50,
              40,
            ],
          },
        })

        // Cluster count labels
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "concerts",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 12,
          },
        })

        // Individual concert points
        map.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "concerts",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#ff0666",
            "circle-radius": 8,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        })

        // Click cluster -> zoom in
        map.on("click", "clusters", async (e) => {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["clusters"],
          })
          if (!features.length) return
          const clusterId = features[0].properties.cluster_id
          const source = map.getSource("concerts") as maplibregl.GeoJSONSource
          const zoom = await source.getClusterExpansionZoom(clusterId)
          map.easeTo({
            center: (features[0].geometry as GeoJSON.Point)
              .coordinates as [number, number],
            zoom,
          })
        })

        // Click point -> show popup
        map.on("click", "unclustered-point", (e) => {
          if (!e.features?.length) return
          const feature = e.features[0]
          const coords = (
            feature.geometry as GeoJSON.Point
          ).coordinates.slice() as [number, number]
          const { name, venue, date } = feature.properties!

          // Handle world-wrap
          while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
            coords[0] += e.lngLat.lng > coords[0] ? 360 : -360
          }

          new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(
              `<strong>${name}</strong><br />${venue} am ${date}`
            )
            .addTo(map)
        })

        // Fit map to show all concert pins
        if (concerts.length === 1) {
          map.setCenter([concerts[0].city.lon, concerts[0].city.lat])
          map.setZoom(12)
        } else if (concerts.length > 1) {
          const bounds = new maplibregl.LngLatBounds()
          for (const concert of concerts) {
            bounds.extend([concert.city.lon, concert.city.lat])
          }
          map.fitBounds(bounds, { padding: 50 })
        }

        // Cursor changes
        map.on("mouseenter", "clusters", () => {
          map.getCanvas().style.cursor = "pointer"
        })
        map.on("mouseleave", "clusters", () => {
          map.getCanvas().style.cursor = ""
        })
        map.on("mouseenter", "unclustered-point", () => {
          map.getCanvas().style.cursor = "pointer"
        })
        map.on("mouseleave", "unclustered-point", () => {
          map.getCanvas().style.cursor = ""
        })
      })

      mapInstance.current = map
    })

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [concerts])

  return (
    <div
      className={`map-wrapper${isFullscreen ? " map-wrapper--fullscreen" : ""}`}
    >
      {allowFullscreen && (
        <button
          type="button"
          className="map-wrapper__fullscreen-btn"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
        >
          {isFullscreen ? "Close" : "Fullscreen"}
        </button>
      )}
      <div className="mapid" ref={mapContainer}></div>
    </div>
  )
}
