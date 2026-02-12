'use client';

import React, { useEffect, useRef } from 'react';
import type { StaticImageData } from 'next/image';
import type { Map as LeafletMap, TileLayerOptions } from 'leaflet';
import type { Concert } from '../types/concert';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

interface MapClientProps {
  concerts: Concert[];
}

type LeafletContainer = HTMLDivElement & { _leaflet_id?: number | string | null };
type MapboxTileLayerOptions = TileLayerOptions & { id: string; accessToken: string };
type LeafletModule = typeof import('leaflet');

export default function MapClient({ concerts }: MapClientProps) {
  const map = useRef<LeafletMap | null>(null);
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
    import('leaflet').then((leafletModule) => {
      const Leaflet =
        (leafletModule as LeafletModule & { default?: LeafletModule }).default ?? leafletModule;

      import('leaflet/dist/images/marker-icon.png').then((markerIconModule) => {
        import('leaflet.markercluster').then(() => {
          // Guard: Check again after async imports (component may have unmounted)
          if (!currentMapElement || map.current) {
            return;
          }

          // Guard: Check if container already has a Leaflet instance
          const container = currentMapElement as LeafletContainer;
          if (container._leaflet_id) {
            return;
          }

          // Create icon using Leaflet.Icon with options
          const icon = new Leaflet.Icon({
            iconUrl: (markerIconModule as { default: StaticImageData }).default.src,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          });

          map.current = Leaflet.map(currentMapElement).setView(
            [51.163375, 10.447683],
            6
          );

          const mapboxTileOptions: MapboxTileLayerOptions = {
            attribution:
              'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 18,
            id: 'mapbox/outdoors-v11',
            tileSize: 512,
            zoomOffset: -1,
            accessToken:
              process.env.NEXT_PUBLIC_MAPBOX_TOKEN!,
          };

          Leaflet.tileLayer(
            'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}',
            mapboxTileOptions
          ).addTo(map.current);

          const markers = Leaflet.markerClusterGroup();
          concerts.forEach((concert) => {
            const marker = Leaflet.marker([concert.city.lat, concert.city.lon], {
              icon: icon,
            });
            marker.bindPopup(
              `<strong>${getName(concert)}</strong><br />${concert.venue || ''} am ${getDate(
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
        (currentMapElement as LeafletContainer)._leaflet_id = null;
      }
    };
  }, [concerts]); // Include concerts in dependency array

  return <div className="mapid" ref={mapElement}></div>;
}
