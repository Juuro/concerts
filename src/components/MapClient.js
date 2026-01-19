'use client'

import React, { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

export default function MapClient({ concerts }) {
  const map = useRef(null)
  const mapElement = useRef(null)

  const getYear = (dateInput) => {
    const date = new Date(dateInput)
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
    })
  }

  const getDate = (dateInput) => {
    const date = new Date(dateInput)
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getName = (concert) => {
    if (concert.isFestival) {
      return `${concert.festival.name} ${getYear(concert.date)}`
    }
    return concert.bands[0]?.name || 'Unknown'
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !mapElement.current || map.current) {
      return
    }

    // Dynamically import Leaflet modules only on client side
    import('leaflet').then((L) => {
      import('leaflet/dist/images/marker-icon.png').then((markerIcon) => {
        import('leaflet.markercluster').then(() => {
          const Leaflet = L.default

          const CustomIcon = Leaflet.Icon.extend({
            options: {
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            },
          })

          const icon = new CustomIcon({
            iconUrl: markerIcon.default.src,
          })

          map.current = Leaflet.map(mapElement.current).setView(
            [51.163375, 10.447683],
            6
          )

          Leaflet.tileLayer(
            'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}',
            {
              attribution:
                'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
              maxZoom: 18,
              id: 'mapbox/outdoors-v11',
              tileSize: 512,
              zoomOffset: -1,
              accessToken:
                'pk.eyJ1IjoianV1cm8iLCJhIjoiY2tkaGdoNzk0MDJ1YTJzb2V4anZ3NXk4bSJ9.1m7LQQaTf2W4R-IgKKGZCQ',
            }
          ).addTo(map.current)

          const markers = Leaflet.markerClusterGroup()
          concerts.forEach((concert) => {
            const marker = Leaflet.marker([concert.city.lat, concert.city.lon], {
              icon: icon,
            })
            marker.bindPopup(
              `<strong>${getName(concert)}</strong><br />${concert.club} am ${getDate(
                concert.date
              )}`
            )
            markers.addLayer(marker)
          })

          map.current.addLayer(markers)
        })
      })
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [concerts])

  return <div className="mapid" ref={mapElement}></div>
}
