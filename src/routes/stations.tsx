import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { SiteChrome } from "../components/SiteChrome";
import { StationCard } from "../components/StationCard";
import { StationFilterPanel, StationFiltersState } from "../components/StationFilterPanel";
import { StationDetailModal } from "../components/StationDetailModal";
import { Station, cityCoordinates } from "../data/stations";
import { useStations } from "../hooks/useStations";
import { matchesConnector, matchesCity, calculateDistanceKm, getClosestCity } from "../lib/utils";

type StationSearch = {
  city?: string | undefined;
  type?: "dc" | "ac" | "all" | undefined;
  connector?: string | undefined;
  power?: string | undefined;
  network?: string | undefined;
};

export const Route = createFileRoute("/stations")({
  validateSearch: (search: Record<string, unknown>): StationSearch => ({
    city: typeof search["city"] === "string" ? search["city"] : undefined,
    type:
      search["type"] === "dc" || search["type"] === "ac" || search["type"] === "all"
        ? (search["type"] as "dc" | "ac" | "all")
        : undefined,
    connector: typeof search["connector"] === "string" ? search["connector"] : undefined,
    power: typeof search["power"] === "string" ? search["power"] : undefined,
    network: typeof search["network"] === "string" ? search["network"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "List View | EV Charging Stations in India | EvFinder" },
      {
        name: "description",
        content:
          "Filter India's EV charging network by city, charging type (DC Fast / AC), connector type, speed (kW), availability with instant Google Maps GPS directions.",
      },
      { property: "og:title", content: "List View — EV Charging Stations in India" },
      {
        property: "og:description",
        content:
          "Search and filter EV charging stations across India in list view with live port status, speed filters, and Google Maps GPS navigation.",
      },
    ],
  }),
  component: StationsPage,
});

function StationsPage() {
  const { stations } = useStations();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/stations" });

  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [projectedStation, setProjectedStation] = useState<Station | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;

  // Automatically detect user location if no city is chosen
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation && !search.city) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoords({ lat: latitude, lng: longitude });
          const closest = getClosestCity(latitude, longitude, cityCoordinates);
          if (closest && !search.city) {
            setFilter({ city: closest });
          }
        },
        () => {},
        { timeout: 8000, enableHighAccuracy: true }
      );
    }
  }, [search.city]);

  const setFilter = (patch: Partial<StationSearch>) => {
    setPage(1);
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

  // Comprehensive Multi-dimensional Filtering Logic
  const results = useMemo(() => {
    return stations.filter((s) => {
      // 1. City Filter
      if (search.city && !matchesCity(s, search.city)) return false;

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

      // 3. Connector Type
      if (search.connector && !matchesConnector(s.connectors, search.connector, s.network)) return false;

      // 4. Charging Speed / Min Power (kW)
      if (search.power && s.maxPowerKw < Number(search.power)) return false;

      // 5. Network filter
      if (search.network && !s.network.toLowerCase().includes(search.network.toLowerCase())) return false;

      return true;
    });
  }, [
    stations,
    search.city,
    search.type,
    search.connector,
    search.power,
    search.network,
  ]);

  // If user GPS is available, sort nearest first
  const sortedResults = useMemo(() => {
    if (!userCoords) return results;
    return [...results].sort((a, b) => {
      const distA = calculateDistanceKm(userCoords.lat, userCoords.lng, a.lat, a.lng);
      const distB = calculateDistanceKm(userCoords.lat, userCoords.lng, b.lat, b.lng);
      return distA - distB;
    });
  }, [results, userCoords]);

  return (
    <SiteChrome>
      {/* Header & Controls */}
      <section className="px-6 sm:px-8 lg:px-14 pt-6 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight">
              Charging Stations {search.city ? `in ${search.city}` : "Across All India"}
            </h1>
            <p className="mt-2 max-w-xl text-frost/70 text-sm">
              Explore {stations.length} live verified charging points across India. Click any charging station to view details and launch exact Google Maps navigation.
            </p>
          </div>
        </div>

        {/* Quick Filter Badges Row */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-border/60 text-xs">
          <span className="text-frost/60 font-semibold text-[11px]">Quick Filters:</span>
          <button
            onClick={() => setFilter({ type: search.type === "dc" ? undefined : "dc" })}
            className={`rounded-full px-3 py-1 font-semibold transition ${
              search.type === "dc"
                ? "bg-accent text-accent-foreground border border-accent/50 shadow"
                : "border border-border bg-ink2/50 text-frost hover:text-foreground"
            }`}
          >
            ⚡ DC Fast Only
          </button>
          <button
            onClick={() => setFilter({ type: search.type === "ac" ? undefined : "ac" })}
            className={`rounded-full px-3 py-1 font-semibold transition ${
              search.type === "ac"
                ? "bg-primary text-primary-foreground border border-primary/50 shadow"
                : "border border-border bg-ink2/50 text-frost hover:text-foreground"
            }`}
          >
            🔌 AC Standard
          </button>
          <button
            onClick={() => setFilter({ power: search.power === "100" ? undefined : "100" })}
            className={`rounded-full px-3 py-1 font-semibold transition ${
              search.power === "100"
                ? "bg-primary text-primary-foreground border border-primary/50 shadow"
                : "border border-border bg-ink2/50 text-frost hover:text-foreground"
            }`}
          >
            🚀 100 kW+ Rapid
          </button>
          {(search.city ||
            search.type ||
            search.connector ||
            search.power ||
            search.network) && (
            <button
              onClick={resetFilters}
              className="text-accent text-xs font-bold hover:underline ml-2"
            >
              Reset All Filters (×)
            </button>
          )}
        </div>
      </section>

      {/* Main Content Layout - Pure List View */}
      <div className="px-6 sm:px-8 lg:px-14 pb-14">
        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          {/* Left: Comprehensive Filters Sidebar */}
          <aside className="h-fit lg:sticky lg:top-6 rounded-2xl glass-panel p-5 shadow-xl border border-border/80">
            <StationFilterPanel
              filters={search as StationFiltersState}
              onFilterChange={setFilter}
              onReset={resetFilters}
              totalResults={sortedResults.length}
              totalAllStations={stations.length}
            />
          </aside>

            {/* Right: Stations Grid */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-bold text-frost">
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, sortedResults.length)}–{Math.min(page * PAGE_SIZE, sortedResults.length)} of {sortedResults.length} live station{sortedResults.length === 1 ? "" : "s"}
                {search.city ? ` in ${search.city}` : " across All India"}
              </p>
              {(search.city ||
                search.type ||
                search.connector ||
                search.power ||
                search.network) && (
                <button
                  onClick={resetFilters}
                  className="rounded-xl charge-button font-display font-extrabold px-3 py-1.5 text-xs shadow-md shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {sortedResults.length === 0 ? (
              <div className="rounded-2xl glass-panel-subtle p-12 text-center text-frost">
                <div className="text-3xl mb-3">⚡</div>
                <p className="font-bold text-foreground text-base">No stations found matching filters</p>
                <p className="text-xs text-frost/70 mt-1">Try selecting a different city, speed tier, or connector type.</p>
                <button
                  onClick={resetFilters}
                  className="mt-5 rounded-full charge-button px-6 py-2.5 text-xs font-bold shadow-lg"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {sortedResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((s) => (
                    <div
                      key={s.id}
                      onMouseEnter={() => setSelectedStationId(s.id)}
                      className={`transition rounded-2xl ${
                        selectedStationId === s.id ? "ring-2 ring-accent scale-[1.01]" : ""
                      }`}
                    >
                      <StationCard
                        station={s}
                        onSelect={(st) => {
                          setSelectedStationId(st.id);
                          setProjectedStation(st);
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                {Math.ceil(results.length / PAGE_SIZE) > 1 && (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2 pt-6 border-t border-border/60">
                    <button
                      onClick={() => {
                        setPage((p) => Math.max(1, p - 1));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-border bg-ink2/50 text-frost hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition"
                    >
                      ← Previous
                    </button>

                    <span className="px-3 py-2 text-xs font-bold text-frost">
                      Page {page} of {Math.ceil(results.length / PAGE_SIZE)}
                    </span>

                    <button
                      onClick={() => {
                        setPage((p) => Math.min(Math.ceil(results.length / PAGE_SIZE), p + 1));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      disabled={page >= Math.ceil(results.length / PAGE_SIZE)}
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-border bg-ink2/50 text-frost hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
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
