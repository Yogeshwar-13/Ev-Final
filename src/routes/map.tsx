import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteChrome } from "../components/SiteChrome";
import { IndiaEvMap } from "../components/IndiaEvMap";
import { StationFilterPanel, StationFiltersState } from "../components/StationFilterPanel";
import { StationDetailModal } from "../components/StationDetailModal";
import { cityCoordinates, statusMeta, Station } from "../data/stations";
import { useStations } from "../hooks/useStations";
import { matchesConnector, matchesCity } from "../lib/utils";

type MapSearch = {
  city?: string | undefined;
  type?: "dc" | "ac" | "all" | undefined;
  connector?: string | undefined;
  power?: string | undefined;
  network?: string | undefined;
  availability?: "available" | "limited" | "all" | undefined;
  amenity?: string | undefined;
  maxPrice?: string | undefined;
  onlyFreePorts?: boolean | undefined;
  stationId?: string | undefined;
};

export const Route = createFileRoute("/map")({
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    city: typeof search["city"] === "string" ? search["city"] : undefined,
    type:
      search["type"] === "dc" || search["type"] === "ac" || search["type"] === "all"
        ? (search["type"] as "dc" | "ac" | "all")
        : undefined,
    connector: typeof search["connector"] === "string" ? search["connector"] : undefined,
    power: typeof search["power"] === "string" ? search["power"] : undefined,
    network: typeof search["network"] === "string" ? search["network"] : undefined,
    availability:
      search["availability"] === "available" ||
      search["availability"] === "limited" ||
      search["availability"] === "all"
        ? (search["availability"] as "available" | "limited" | "all")
        : undefined,
    amenity: typeof search["amenity"] === "string" ? search["amenity"] : undefined,
    maxPrice: typeof search["maxPrice"] === "string" ? search["maxPrice"] : undefined,
    onlyFreePorts:
      search["onlyFreePorts"] === true || search["onlyFreePorts"] === "true" ? true : undefined,
    stationId: typeof search["stationId"] === "string" ? search["stationId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Live EV Charging Map of India | EvFinder" },
      {
        name: "description",
        content:
          "Interactive open map of 48,200+ EV charging stations across India. Live availability, DC Fast/AC filters, connector speeds, and instant Google Maps GPS navigation.",
      },
      { property: "og:title", content: "Live EV Charging Map of India | EvFinder" },
      {
        property: "og:description",
        content:
          "Browse live EV charging stations across 28 Indian states with live port availability and exact Google Maps GPS redirection.",
      },
    ],
  }),
  component: LiveMapPage,
});

function LiveMapPage() {
  const { stations, isLiveDb } = useStations();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/map" });

  const [query, setQuery] = useState("");
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [projectedStation, setProjectedStation] = useState<Station | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"stations" | "filters">("stations");
  const [visibleCount, setVisibleCount] = useState(40);

  const setFilter = (patch: Partial<MapSearch>) => {
    navigate({
      search: (prev: any) => {
        const updated: any = { ...prev, ...patch };
        Object.keys(updated).forEach((k) => {
          if (updated[k] === undefined || updated[k] === null || updated[k] === "") {
            delete updated[k];
          }
        });
        return updated;
      },
    });
  };

  const resetFilters = () => navigate({ search: {} as any });

  const filteredStations = useMemo(() => {
    return stations.filter((s) => {
      // 1. City Filter
      if (search.city && !matchesCity(s, search.city)) {
        return false;
      }

      // 2. Charging Type (DC Fast vs AC)
      if (search.type === "dc") {
        const isDc =
          s.maxPowerKw >= 50 ||
          s.connectors.some(
            (c) =>
              c.toUpperCase().includes("CCS") ||
              c.toUpperCase().includes("DC") ||
              c.toUpperCase().includes("CHADEMO")
          );
        if (!isDc) return false;
      } else if (search.type === "ac") {
        const isAc = s.connectors.some(
          (c) =>
            c.toUpperCase().includes("AC") ||
            c.toUpperCase().includes("TYPE 2") ||
            c.toUpperCase().includes("15A") ||
            c.toUpperCase().includes("SOCKET")
        );
        if (!isAc) return false;
      }

      // 3. Connector
      if (search.connector && !matchesConnector(s.connectors, search.connector, s.network)) return false;

      // 4. Charging Speed / Min Power (kW)
      if (search.power && s.maxPowerKw < Number(search.power)) return false;

      // 5. Network filter
      if (search.network && !s.network.toLowerCase().includes(search.network.toLowerCase())) return false;

      // 6. Availability Status
      if (search.availability === "available" && s.status !== "available") return false;
      if (search.availability === "limited" && s.status !== "limited") return false;

      // 7. Free Ports Check
      if (search.onlyFreePorts && s.freePorts <= 0) return false;

      // 8. Max Price
      if (search.maxPrice && s.pricePerKwh > Number(search.maxPrice)) return false;

      // 9. Amenities
      if (
        search.amenity &&
        !s.amenities.some((a) => a.toLowerCase().includes(search.amenity!.toLowerCase()))
      )
        return false;

      // 10. Search query
      if (query) {
        const q = query.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchCity = s.city.toLowerCase().includes(q);
        const matchState = s.state?.toLowerCase().includes(q);
        const matchAddr = s.address.toLowerCase().includes(q);
        const matchNet = s.network.toLowerCase().includes(q);
        if (!matchName && !matchCity && !matchState && !matchAddr && !matchNet) return false;
      }

      return true;
    });
  }, [
    stations,
    search.city,
    search.type,
    search.connector,
    search.power,
    search.network,
    search.availability,
    search.onlyFreePorts,
    search.maxPrice,
    search.amenity,
    query,
  ]);

  const handleSelectStation = (station: Station) => {
    setSelectedStation(station);
    setProjectedStation(station);
    setFilter({ stationId: station.id });
  };

  const handleCityChangeFromMap = (city: string) => {
    setFilter({ city: city === "All India" ? undefined : city });
  };

  const activeFilterCount = [
    search.city,
    search.type,
    search.connector,
    search.power,
    search.network,
    search.availability,
    search.amenity,
    search.maxPrice,
    search.onlyFreePorts,
  ].filter(Boolean).length;

  return (
    <SiteChrome>
      <div className="px-4 sm:px-8 lg:px-14 pt-4 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
              Live India EV Grid {search.city ? `· ${search.city}` : "· All India"}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-frost/70">
              Interactive OpenStreetMap network with {stations.length} live verified charging points across India. Click any station pin or card for full specs and direct GPS routing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="flex items-center gap-2 rounded-xl charge-button font-display font-extrabold px-4 py-2 text-xs transition shadow-md shadow-accent/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              {isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            </button>
            <Link
              to="/stations"
              className="rounded-xl charge-button font-display font-extrabold px-4 py-2 text-xs transition shadow-md shadow-accent/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              Grid View ({stations.length}) →
            </Link>
          </div>
        </div>

        {/* Interactive Map Layout */}
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-220px)] min-h-[580px]">
          {/* Sidebar Drawer */}
          {isSidebarOpen && (
            <div className="lg:col-span-4 xl:col-span-3 flex flex-col rounded-2xl glass-panel p-4 h-full overflow-hidden border border-border/80 shadow-2xl">
              {/* Tab Switcher: Stations List vs Detailed Filters */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-ink2/60 rounded-xl border border-border mb-3">
                <button
                  onClick={() => setSidebarTab("stations")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    sidebarTab === "stations"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-frost hover:text-foreground"
                  }`}
                >
                  Stations ({filteredStations.length}{!search.city ? ` / ${stations.length}` : ""})
                </button>
                <button
                  onClick={() => setSidebarTab("filters")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                    sidebarTab === "filters"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-frost hover:text-foreground"
                  }`}
                >
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="size-4 rounded-full bg-accent text-accent-foreground text-[10px] flex items-center justify-center font-black">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* TAB 1: STATIONS LIST */}
              {sidebarTab === "stations" && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Search Bar */}
                  <div className="relative mb-3">
                    <input
                      type="text"
                      placeholder="Search city, station, or address..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full rounded-xl border border-border bg-ink2/90 px-3.5 py-2 pl-9 text-xs text-foreground placeholder:text-frost/40 focus:border-accent focus:outline-none"
                    />
                    <svg
                      className="absolute left-3 top-2.5 size-3.5 text-frost/50"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        className="absolute right-3 top-2 text-xs text-frost/50 hover:text-frost"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Quick Filters Pill bar */}
                  <div className="flex items-center gap-1.5 pb-2.5 mb-2 overflow-x-auto custom-scrollbar border-b border-border/50 text-xs">
                    <button
                      onClick={() =>
                        setFilter({ type: search.type === "dc" ? undefined : "dc" })
                      }
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        search.type === "dc"
                          ? "bg-accent text-accent-foreground border border-accent/50"
                          : "border border-border bg-ink2/40 text-frost hover:text-foreground"
                      }`}
                    >
                      ⚡ DC Fast
                    </button>
                    <button
                      onClick={() =>
                        setFilter({ type: search.type === "ac" ? undefined : "ac" })
                      }
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        search.type === "ac"
                          ? "bg-primary text-primary-foreground border border-primary/50"
                          : "border border-border bg-ink2/40 text-frost hover:text-foreground"
                      }`}
                    >
                      🔌 AC Charging
                    </button>
                    <button
                      onClick={() =>
                        setFilter({ power: search.power === "100" ? undefined : "100" })
                      }
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        search.power === "100"
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-ink2/40 text-frost hover:text-foreground"
                      }`}
                    >
                      🚀 100kW+
                    </button>
                  </div>

                  {/* Stations Scrollable List */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
                    {filteredStations.length === 0 ? (
                      <div className="py-12 text-center text-xs text-frost/60">
                        <div className="text-xl mb-1">🔍</div>
                        <p className="font-bold">No stations found</p>
                        <p className="text-[11px] text-frost/50 mt-0.5">Try resetting some filters</p>
                        <button
                          onClick={resetFilters}
                          className="mt-3 text-accent text-xs font-bold hover:underline"
                        >
                          Clear All Filters
                        </button>
                      </div>
                    ) : (
                      <>
                        {filteredStations.slice(0, visibleCount).map((station) => {
                          const isSelected =
                            selectedStation?.id === station.id || search.stationId === station.id;
                          const meta = statusMeta[station.status];
                          const googleMapsUrl =
                            (station as any).google_maps_link ||
                            `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;

                          return (
                            <div
                              key={station.id}
                              onClick={() => handleSelectStation(station)}
                              className={`rounded-2xl border p-4 cursor-pointer transition text-left relative group ${
                                isSelected
                                  ? "border-accent bg-accent/15 shadow-xl shadow-accent/10 ring-2 ring-accent/40"
                                  : "border-border/70 bg-ink2/50 hover:border-accent/40 hover:bg-ink2/80"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-[11px] uppercase font-bold text-accent bg-accent/10 px-2.5 py-0.5 rounded-md border border-accent/30">
                                  {station.network}
                                </span>
                                <span className="text-xs text-frost/70 font-semibold">
                                  📍 {station.city}
                                </span>
                              </div>

                              <h3 className="font-display text-base font-extrabold text-foreground group-hover:text-accent transition leading-tight mt-1">
                                {station.name}
                              </h3>
                              <p className="text-xs text-frost/80 line-clamp-2 mt-1 leading-relaxed">
                                {station.address}
                              </p>

                              <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-border/50">
                                <span className="font-bold text-foreground bg-ink2 px-2.5 py-1 rounded-lg border border-border/60">
                                  ⚡ {station.maxPowerKw} kW
                                </span>
                                <span className="font-bold text-frost bg-ink2 px-2.5 py-1 rounded-lg border border-border/60">
                                  🔌 {station.totalPorts} Ports
                                </span>
                              </div>

                              {/* Direct Big Action Buttons */}
                              <div className="mt-3.5 pt-2.5 border-t border-border/40 flex flex-col gap-2">
                                <a
                                  href={googleMapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full rounded-xl charge-button py-2.5 px-3 text-xs sm:text-sm font-extrabold text-center transition flex items-center justify-center gap-2 shadow-md shadow-accent/20 hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap"
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                  </svg>
                                  <span>Get Directions ↗</span>
                                </a>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProjectedStation(station);
                                  }}
                                  className="w-full rounded-xl charge-button py-2.5 px-3 text-xs sm:text-sm font-extrabold text-center transition flex items-center justify-center gap-1.5 shadow-md shadow-accent/20 hover:scale-[1.01] active:scale-[0.99] whitespace-nowrap"
                                >
                                  <span>View Station Details</span>
                                  <span>→</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {filteredStations.length > visibleCount && (
                          <div className="pt-2 pb-4 text-center">
                            <button
                              onClick={() => setVisibleCount((prev) => prev + 40)}
                              className="w-full py-2.5 px-4 rounded-xl border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 font-bold text-xs transition"
                            >
                              Load More Stations ({filteredStations.length - visibleCount} remaining) ↓
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: DETAILED FILTERS PANEL */}
              {sidebarTab === "filters" && (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                  <StationFilterPanel
                    filters={search as StationFiltersState}
                    onFilterChange={setFilter}
                    onReset={resetFilters}
                    totalResults={filteredStations.length}
                    totalAllStations={stations.length}
                  />
                </div>
              )}
            </div>
          )}

          {/* Interactive Map View */}
          <div
            className={`${
              isSidebarOpen ? "lg:col-span-8 xl:col-span-9" : "lg:col-span-12"
            } h-full min-h-[500px] transition-all duration-300`}
          >
            <IndiaEvMap
              stations={filteredStations}
              totalAllStations={stations.length}
              selectedStationId={search.stationId || selectedStation?.id}
              selectedCity={search.city}
              onCityChange={handleCityChangeFromMap}
              onSelectStation={handleSelectStation}
              height="100%"
              showControls={true}
              showCitySelector={true}
              showLayerSelector={true}
              showRangeOverlay={true}
              enableLocateMe={true}
            />
          </div>
        </div>
      </div>

      {/* Projected Station Details Modal */}
      <StationDetailModal
        station={projectedStation}
        onClose={() => setProjectedStation(null)}
      />
    </SiteChrome>
  );
}
