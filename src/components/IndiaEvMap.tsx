import React, { useEffect, useRef, useState, useId, useCallback } from "react";
import type * as LType from "leaflet";
import { Station, stations as allStations, INDIA_CENTER, cityCoordinates, statusMeta } from "../data/stations";
import { useTheme } from "../lib/theme";
import { getClosestCity, matchesCity } from "../lib/utils";

export type TileStyle = "streets" | "satellite" | "osm";

const TILE_LAYERS: Record<
  TileStyle,
  {
    name: string;
    url: string;
    subdomains: string[];
    attribution: string;
    maxZoom: number;
  }
> = {
  streets: {
    name: "Detailed Streets",
    url: "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    subdomains: ["a", "b"],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://www.hotosm.org/">HOT</a>',
    maxZoom: 19,
  },
  satellite: {
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: [],
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Earthstar Geographics',
    maxZoom: 19,
  },
  osm: {
    name: "Standard OSM",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
};

export interface IndiaEvMapProps {
  stations?: Station[] | undefined;
  totalAllStations?: number | undefined;
  selectedStationId?: string | null | undefined;
  selectedCity?: string | null | undefined;
  onSelectStation?: ((station: Station) => void) | undefined;
  onCityChange?: ((city: string) => void) | undefined;
  initialCenter?: [number, number] | undefined;
  initialZoom?: number | undefined;
  height?: string | undefined;
  showControls?: boolean | undefined;
  showCitySelector?: boolean | undefined;
  showLayerSelector?: boolean | undefined;
  showRangeOverlay?: boolean | undefined;
  enableLocateMe?: boolean | undefined;
  className?: string | undefined;
  singleStationMode?: boolean | undefined;
}

export function IndiaEvMap({
  stations = allStations,
  totalAllStations,
  selectedStationId,
  selectedCity: controlledCity,
  onSelectStation,
  onCityChange,
  initialCenter = [INDIA_CENTER.lat, INDIA_CENTER.lng],
  initialZoom = INDIA_CENTER.zoom,
  height = "100%",
  showControls = true,
  showCitySelector = true,
  showLayerSelector = true,
  showRangeOverlay = true,
  enableLocateMe = true,
  className = "",
  singleStationMode = false,
}: IndiaEvMapProps) {
  const mapContainerId = useId().replace(/:/g, "_");
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const tileLayerRef = useRef<LType.TileLayer | null>(null);
  const markersGroupRef = useRef<LType.LayerGroup | null>(null);
  const userMarkerRef = useRef<LType.Marker | null>(null);
  const rangeCircleRef = useRef<LType.Circle | null>(null);

  const { resolvedTheme } = useTheme();
  const [activeTile, setActiveTile] = useState<TileStyle>("streets");

  const [currentCity, setCurrentCity] = useState<string>(controlledCity || "All India");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [rangeKm, setRangeKm] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [activeStation, setActiveStation] = useState<Station | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update controlled city if passed from parent
  useEffect(() => {
    if (controlledCity !== undefined) {
      const targetCity = controlledCity || "All India";
      setCurrentCity(targetCity);
      flyToCity(targetCity);
    }
  }, [controlledCity]);

  // City Zoom helper
  const flyToCity = (cityName: string) => {
    if (!mapInstanceRef.current) return;

    if (cityName === "All India" || !cityName) {
      mapInstanceRef.current.flyTo([INDIA_CENTER.lat, INDIA_CENTER.lng], INDIA_CENTER.zoom, {
        duration: 1.4,
      });
      return;
    }

    const cityCoord = cityCoordinates[cityName];
    if (cityCoord) {
      mapInstanceRef.current.flyTo([cityCoord.lat, cityCoord.lng], cityCoord.zoom, {
        duration: 1.4,
      });
    } else {
      // Find stations in this city and fit bounds
      const matchingStations = stations.filter((s) => matchesCity(s, cityName));
      if (matchingStations.length > 0) {
        import("leaflet").then((L) => {
          if (!mapInstanceRef.current) return;
          const bounds = L.latLngBounds(
            matchingStations.map((s) => [s.lat, s.lng])
          );
          mapInstanceRef.current.fitBounds(bounds.pad(0.3), { duration: 1.2 });
        });
      }
    }
  };

  const handleCitySelect = (cityName: string) => {
    setCurrentCity(cityName);
    flyToCity(cityName);
    if (onCityChange) {
      onCityChange(cityName);
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!isMounted) return;
    let isCancelled = false;

    async function initMap() {
      const L = await import("leaflet");
      if (isCancelled) return;

      const container = document.getElementById(`map-${mapContainerId}`);
      if (!container) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(container, {
        center: initialCenter,
        zoom: initialZoom,
        minZoom: 4,
        maxZoom: 19,
        zoomControl: false,
        attributionControl: true,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // High-speed CDN Tile layer
      const layerConfig = TILE_LAYERS[activeTile];
      const tileLayer = L.tileLayer(layerConfig.url, {
        attribution: layerConfig.attribution,
        subdomains: layerConfig.subdomains,
        maxZoom: layerConfig.maxZoom,
        keepBuffer: 6,
        updateWhenIdle: false,
        updateWhenZooming: true,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Group for markers
      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Event listener for viewport changes
      map.on("moveend", () => {
        if (!mapInstanceRef.current || !markersGroupRef.current) return;
        renderMarkers(L, mapInstanceRef.current, markersGroupRef.current, stations, resolvedTheme);
      });

      // Render initial markers
      renderMarkers(L, map, markersGroup, stations, resolvedTheme);

      // India bounds constraint if whole country
      if (!singleStationMode && initialZoom <= 6) {
        const southWest = L.latLng(6.5, 66.0);
        const northEast = L.latLng(37.5, 98.0);
        const bounds = L.latLngBounds(southWest, northEast);
        map.setMaxBounds(bounds.pad(0.1));
      }

      // If a specific city was passed initially, zoom to it
      if (controlledCity && controlledCity !== "All India") {
        flyToCity(controlledCity);
      } else if (enableLocateMe && !singleStationMode && !selectedStationId) {
        // Automatically extract user location and display their area chargers
        handleLocateMe();
      }
    }

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isMounted, mapContainerId]);

  // Update tile style when switched
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      if (!mapInstanceRef.current) return;
      if (tileLayerRef.current) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current);
      }
      const layerConfig = TILE_LAYERS[activeTile];
      const tileLayer = L.tileLayer(layerConfig.url, {
        attribution: layerConfig.attribution,
        subdomains: layerConfig.subdomains,
        maxZoom: layerConfig.maxZoom,
        keepBuffer: 6,
        updateWhenIdle: false,
        updateWhenZooming: true,
      }).addTo(mapInstanceRef.current);
      tileLayerRef.current = tileLayer;
    });
  }, [activeTile]);

  // Update markers when stations, selection, or theme change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;
    import("leaflet").then((L) => {
      if (!mapInstanceRef.current || !markersGroupRef.current) return;
      renderMarkers(L, mapInstanceRef.current, markersGroupRef.current, stations, resolvedTheme);
    });
  }, [stations, selectedStationId, resolvedTheme]);

  // Pan to selected station if changed from outside
  useEffect(() => {
    if (!selectedStationId || !mapInstanceRef.current) return;
    const target = stations.find((s) => s.id === selectedStationId);
    if (target) {
      mapInstanceRef.current.flyTo([target.lat, target.lng], 14, {
        duration: 1.2,
      });
      setActiveStation(target);
    }
  }, [selectedStationId, stations]);

  // Update Range circle
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      if (!mapInstanceRef.current) return;
      if (rangeCircleRef.current) {
        mapInstanceRef.current.removeLayer(rangeCircleRef.current);
        rangeCircleRef.current = null;
      }

      if (rangeKm && rangeKm > 0) {
        const center = userLocation || (activeStation ? [activeStation.lat, activeStation.lng] : initialCenter);
        const circle = L.circle(center, {
          radius: rangeKm * 1000,
          color: resolvedTheme === "light" ? "#0284c7" : "#06b6d4",
          fillColor: resolvedTheme === "light" ? "#0284c7" : "#06b6d4",
          fillOpacity: 0.12,
          weight: 2,
          dashArray: "6, 8",
        }).addTo(mapInstanceRef.current);
        rangeCircleRef.current = circle;
      }
    });
  }, [rangeKm, userLocation, activeStation, initialCenter, resolvedTheme]);

  // Marker creation helper with viewport-based virtualization
  function renderMarkers(
    L: typeof import("leaflet"),
    map: LType.Map,
    group: LType.LayerGroup,
    stationList: Station[],
    currentTheme: "dark" | "light"
  ) {
    group.clearLayers();
    if (!stationList || stationList.length === 0) return;

    const isLight = currentTheme === "light";
    const accentColor = isLight ? "#0284c7" : "#38bdf8";

    // 1. Get current map bounding box (with 15% padding for smooth panning)
    let visibleStations = stationList;
    try {
      const bounds = map.getBounds().pad(0.15);
      visibleStations = stationList.filter((s) => bounds.contains([s.lat, s.lng]));
    } catch {
      visibleStations = stationList;
    }

    // 2. High-performance marker sampling when zoomed out at country/state level
    const MAX_VISIBLE_MARKERS = 350;
    if (visibleStations.length > MAX_VISIBLE_MARKERS) {
      const step = Math.ceil(visibleStations.length / MAX_VISIBLE_MARKERS);
      const sampled = visibleStations.filter((_, idx) => idx % step === 0);
      // Ensure the actively selected station is included
      if (selectedStationId) {
        const selected = stationList.find((s) => s.id === selectedStationId);
        if (selected && !sampled.some((s) => s.id === selected.id)) {
          sampled.push(selected);
        }
      }
      visibleStations = sampled;
    }

    visibleStations.forEach((station) => {
      const isSelected = selectedStationId === station.id;
      const googleMapsUrl = (station as any).google_maps_link || `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;

      const markerHtml = `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="
            width: ${isSelected ? "34px" : "28px"};
            height: ${isSelected ? "34px" : "28px"};
            border-radius: 50%;
            background: ${isLight ? "#ffffff" : "#0f172a"};
            border: 2.5px solid ${accentColor};
            box-shadow: 0 0 14px ${accentColor}88, 0 4px 8px rgba(0,0,0,${isLight ? "0.2" : "0.6"});
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${accentColor};
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            transform: ${isSelected ? "scale(1.2)" : "scale(1)"};
          ">
            <svg width="${isSelected ? "18" : "14"}" height="${isSelected ? "18" : "14"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "ev-marker-icon",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      const popupContent = `
        <div style="padding: 18px 16px; min-width: 270px; font-family: 'Space Grotesk', sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${accentColor}; background: ${accentColor}20; padding: 3px 10px; border-radius: 8px; border: 1px solid ${accentColor}40;">
              ${station.network}
            </span>
            <span style="font-size: 12px; color: ${isLight ? "#475569" : "#cbd5e1"}; font-weight: 700;">📍 ${station.city}</span>
          </div>

          <h3 style="margin: 6px 0 4px 0; font-size: 18px; font-weight: 900; color: ${isLight ? "#0f172a" : "#f8fafc"}; font-family: 'Archivo', sans-serif; line-height: 1.25;">
            ${station.name}
          </h3>

          <p style="margin: 0 0 12px 0; font-size: 13px; color: ${isLight ? "#475569" : "#94a3b8"}; line-height: 1.4;">
            ${station.address}
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; background: ${isLight ? "rgba(15,23,42,0.05)" : "rgba(14,165,233,0.08)"}; padding: 10px 12px; border-radius: 12px; border: 1px solid ${isLight ? "rgba(15,23,42,0.1)" : "rgba(56,189,248,0.2)"};">
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: ${isLight ? "#64748b" : "#94a3b8"}; font-weight: 700;">Total Ports</div>
              <div style="font-size: 15px; font-weight: 800; color: ${accentColor}; margin-top: 2px;">
                🔌 ${station.totalPorts} Ports
              </div>
            </div>
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: ${isLight ? "#64748b" : "#94a3b8"}; font-weight: 700;">Max Power</div>
              <div style="font-size: 15px; font-weight: 800; color: ${accentColor}; margin-top: 2px;">
                ⚡ ${station.maxPowerKw} kW
              </div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 9px;">
            <a
              href="${googleMapsUrl}"
              target="_blank"
              rel="noopener noreferrer"
              style="width: 100%; text-align: center; background: ${isLight ? "linear-gradient(135deg, #0284c7, #0ea5e9, #06b6d4)" : "linear-gradient(135deg, #00f2fe, #0ea5e9, #0284c7)"}; color: #ffffff; font-weight: 900; font-size: 14px; padding: 12px 16px; border-radius: 12px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 16px rgba(14, 165, 233, 0.4); letter-spacing: 0.01em; border: 1px solid rgba(125, 211, 252, 0.4);"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
              </svg>
              <span>Get Directions (Google Maps) ↗</span>
            </a>
            <a
              href="/station/${station.id}"
              style="width: 100%; text-align: center; background: ${isLight ? "linear-gradient(135deg, #0284c7, #0ea5e9, #06b6d4)" : "linear-gradient(135deg, #00f2fe, #0ea5e9, #0284c7)"}; color: #ffffff; font-size: 13px; font-weight: 800; padding: 10px 14px; border-radius: 10px; text-decoration: none; display: block; box-shadow: 0 4px 16px rgba(14, 165, 233, 0.35); border: 1px solid rgba(125, 211, 252, 0.4);"
            >
              View Full Station Page →
            </a>
          </div>
        </div>
      `;

      const marker = L.marker([station.lat, station.lng], { icon: customIcon });
      marker.bindPopup(popupContent, {
        maxWidth: 320,
        className: "custom-leaflet-popup",
      });

      marker.on("click", () => {
        setActiveStation(station);
        if (onSelectStation) {
          onSelectStation(station);
        }
      });

      marker.addTo(group);
    });
  }

  // HTML5 Geolocation Locate Me
  const handleLocateMe = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude, longitude } = position.coords;
        const coords: [number, number] = [latitude, longitude];
        setUserLocation(coords);

        const closest = getClosestCity(latitude, longitude, cityCoordinates);
        if (closest) {
          setCurrentCity(closest);
          if (onCityChange) {
            onCityChange(closest);
          }
        }

        if (mapInstanceRef.current) {
          import("leaflet").then((L) => {
            if (!mapInstanceRef.current) return;
            if (userMarkerRef.current) {
              mapInstanceRef.current.removeLayer(userMarkerRef.current);
            }

            const userIcon = L.divIcon({
              html: `
                <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
                  <div class="ev-pin-pulse" style="background: #0284c7;"></div>
                  <div style="width: 16px; height: 16px; background: #0284c7; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 12px #0284c7;"></div>
                </div>
              `,
              className: "user-gps-marker",
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            });

            const marker = L.marker(coords, { icon: userIcon })
              .bindPopup("<div style='padding: 8px 12px; font-weight: 700; color: #0284c7;'>📍 Your Location</div>")
              .addTo(mapInstanceRef.current);

            userMarkerRef.current = marker;
            mapInstanceRef.current.flyTo(coords, 13, { duration: 1.5 });
          });
        }
      },
      (error) => {
        setIsLocating(false);
        // Fallback gracefully without aggressive alerts
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [onCityChange]);

  const handleResetView = () => {
    handleCitySelect("All India");
  };

  const quickCities = ["Bengaluru", "Mumbai", "New Delhi", "Hyderabad", "Chennai", "Pune"];

  const allCityNames = React.useMemo(() => {
    const citySet = new Set<string>();
    Object.keys(cityCoordinates).forEach((c) => citySet.add(c));
    stations.forEach((s) => {
      const c = s.city?.trim();
      if (
        c &&
        c.length >= 3 &&
        c.length <= 25 &&
        !/^\d+/.test(c) &&
        !c.includes("+") &&
        !c.includes("/") &&
        !c.includes("\\") &&
        !/dealer|service|station|industrial|highway|toll|sector|opposite|petroleum|plot|near/i.test(c)
      ) {
        citySet.add(c);
      }
    });
    return Array.from(citySet).sort();
  }, [stations]);

  const cityStationCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    stations.forEach((s) => {
      if (s.city) {
        const c = s.city.trim();
        counts[c] = (counts[c] || 0) + 1;
      }
    });
    return counts;
  }, [stations]);

  const allIndiaCount = totalAllStations ?? stations.length;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-border/80 bg-background transition-colors duration-300 ${className}`}
      style={{ height }}
    >
      {/* Map Container */}
      <div id={`map-${mapContainerId}`} className="w-full h-full z-0" />

      {/* Floating Map Top-Left Toolbar: City quick selector with Dropdown */}
      {showControls && showCitySelector && !singleStationMode && (
        <div className="absolute top-4 left-4 z-[400] flex flex-wrap items-center gap-1.5 max-w-[calc(100%-140px)]">
          {/* All India Reset Button with Live Count Badge */}
          <button
            onClick={handleResetView}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold backdrop-blur-md transition shadow-lg ${
              currentCity === "All India"
                ? "bg-primary text-primary-foreground border border-primary/50 ring-2 ring-primary/30"
                : "bg-ink2/90 border border-border text-frost hover:text-foreground hover:bg-ink2"
            }`}
          >
            <span>🇮🇳 All India</span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black tracking-tight ${
                currentCity === "All India"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-primary/20 text-primary border border-primary/30"
              }`}
            >
              {allIndiaCount} Live
            </span>
          </button>

          {/* Quick city pill buttons for top hubs */}
          {quickCities.map((city) => {
            const count = cityStationCounts[city];
            return (
              <button
                key={city}
                onClick={() => handleCitySelect(city)}
                className={`hidden sm:inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition shadow-md ${
                  currentCity === city
                    ? "bg-accent text-accent-foreground border border-accent/50 ring-2 ring-accent/30"
                    : "bg-ink2/85 border border-border text-frost hover:text-foreground hover:bg-ink2"
                }`}
              >
                <span>{city}</span>
                {count ? (
                  <span className="text-[10px] opacity-80 font-bold">({count})</span>
                ) : null}
              </button>
            );
          })}

          {/* City Dropdown Selector for all cities */}
          <div className="relative">
            <select
              value={currentCity}
              onChange={(e) => handleCitySelect(e.target.value)}
              className="appearance-none rounded-full border border-border bg-ink2/90 backdrop-blur-md px-3.5 py-1.5 pr-7 text-xs font-semibold text-frost hover:text-foreground focus:border-accent focus:outline-none shadow-md cursor-pointer"
            >
              <option value="All India">🇮🇳 All India ({allIndiaCount} Live Stations)</option>
              {allCityNames.map((city) => {
                const count = cityStationCounts[city];
                return (
                  <option key={city} value={city}>
                    📍 {city} {count ? `(${count} Live)` : ""}
                  </option>
                );
              })}
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-frost/60 text-[10px]">
              ▼
            </div>
          </div>
        </div>
      )}

      {/* Floating Map Top-Right Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 z-[400] flex items-center gap-2">
          {/* Tile Layer Selector (100% Free - No Watermark) */}
          {showLayerSelector && (
            <div className="flex items-center rounded-xl border border-border bg-ink2/90 backdrop-blur-md p-1 shadow-lg">
              <button
                title="Detailed Streets (Fast CDN)"
                onClick={() => setActiveTile("streets")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  activeTile === "streets"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-frost hover:text-foreground"
                }`}
              >
                Streets
              </button>
              <button
                title="Satellite Imagery"
                onClick={() => setActiveTile("satellite")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  activeTile === "satellite"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-frost hover:text-foreground"
                }`}
              >
                Satellite
              </button>
              <button
                title="OpenStreetMap Standard"
                onClick={() => setActiveTile("osm")}
                className={`hidden sm:block px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  activeTile === "osm"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-frost hover:text-foreground"
                }`}
              >
                OSM
              </button>
            </div>
          )}

          {/* Locate Me Button */}
          {enableLocateMe && (
            <button
              onClick={handleLocateMe}
              disabled={isLocating}
              title="Locate nearest charging stations"
              className="flex items-center gap-1.5 rounded-xl border border-border bg-ink2/90 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-frost shadow-lg hover:border-accent/40 hover:text-accent transition disabled:opacity-50"
            >
              <svg
                className={`size-3.5 ${isLocating ? "animate-spin text-accent" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="12 8 8 12 12 16 16 12 12 8" />
              </svg>
              <span className="hidden sm:inline">{isLocating ? "Locating..." : "My GPS"}</span>
            </button>
          )}
        </div>
      )}

      {/* Floating Bottom Left: Battery Range Calculator Filter */}
      {showControls && showRangeOverlay && !singleStationMode && (
        <div className="absolute bottom-4 left-4 z-[400] hidden sm:flex items-center gap-2 rounded-xl border border-border bg-ink2/90 backdrop-blur-md px-3 py-2 text-xs shadow-xl">
          <span className="text-frost font-medium flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="18" height="10" rx="2" ry="2"></rect>
              <line x1="22" y1="11" x2="22" y2="13"></line>
            </svg>
            EV Range Radius:
          </span>
          <div className="flex gap-1">
            {[
              { label: "Off", val: null },
              { label: "50km", val: 50 },
              { label: "100km", val: 100 },
              { label: "200km", val: 200 },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setRangeKm(opt.val)}
                className={`rounded-lg px-2 py-0.5 font-semibold text-[11px] transition ${
                  rangeKm === opt.val
                    ? "bg-accent text-accent-foreground"
                    : "bg-ink2 text-frost hover:text-foreground border border-border/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}



      {/* Error message toast */}
      {locationError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[500] rounded-xl border border-destructive/40 bg-destructive/20 backdrop-blur-md px-4 py-2 text-xs text-destructive-foreground shadow-lg flex items-center gap-2">
          <span>⚠️ {locationError}</span>
          <button
            onClick={() => setLocationError(null)}
            className="ml-2 font-bold text-frost hover:text-foreground"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
