'use client';

import React, { useEffect, useRef } from 'react';
import type { Concert } from '../types/concert';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

interface MapClientProps {
  concerts: Concert[];
}

export default function MapClient({ concerts }: MapClientProps) {
  const map = useRef<any>(null);
  const mapElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapElement.current) {
      return;
    }

    // Guard: Don't initialize if map already exists
    if (map.current) {
      return;
    }

    // Capture ref values for cleanup
    const currentMapElement = mapElement.current;

    // Helper functions defined inside useEffect to avoid dependency issues
    const getYear = (dateInput: string) => {
      const date = new Date(dateInput);
      return date.toLocaleDateString('de-DE', {
        year: 'numeric',
      });
    };

    const getDate = (dateInput: string) => {
      const date = new Date(dateInput);
      return date.toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const getName = (concert: Concert) => {
      if (concert.isFestival) {
        return `${concert.festival?.fields.name || ''} ${getYear(concert.date)}`;
      }
      return concert.bands[0]?.name || 'Unknown';
    };

    // Dynamically import Leaflet modules only on client side
    import('leaflet').then((L) => {
      import('leaflet/dist/images/marker-icon.png').then((markerIcon) => {
        import('leaflet.markercluster').then(() => {
          // Guard: Check again after async imports (component may have unmounted)
          if (!currentMapElement || map.current) {
            return;
          }

          // Guard: Check if container already has a Leaflet instance
          if ((currentMapElement as any)._leaflet_id) {
            return;
          }

          const Leaflet = L.default;

          // Create icon using Leaflet.Icon with options
          const icon = new Leaflet.Icon({
            iconUrl: (markerIcon.default as any).src,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          });

          map.current = Leaflet.map(currentMapElement).setView(
            [51.163375, 10.447683],
            6
          );

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
            } as any
          ).addTo(map.current);

          const markers = Leaflet.markerClusterGroup();
          concerts.forEach((concert) => {
            const marker = Leaflet.marker([concert.city.lat, concert.city.lon], {
              icon: icon,
            });
            marker.bindPopup(
              `<strong>${getName(concert)}</strong><br />${concert.club || ''} am ${getDate(
                concert.date
              )}`
            );
            markers.addLayer(marker);
          });

          map.current.addLayer(markers);
        });
      });
    });

    return () => {
      const currentMap = map.current;
      
      if (currentMap) {
        currentMap.remove();
        map.current = null;
      }
      // Clear Leaflet ID from container using captured ref
      if (currentMapElement) {
        (currentMapElement as any)._leaflet_id = null;
      }
    };
  }, [concerts]); // Include concerts in dependency array

  return <div className="mapid" ref={mapElement}></div>;
}
