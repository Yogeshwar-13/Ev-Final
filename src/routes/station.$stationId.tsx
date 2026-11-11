import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteChrome } from "../components/SiteChrome";
import { IndiaEvMap } from "../components/IndiaEvMap";
import { Station, statusMeta } from "../data/stations";
import { fetchStationById } from "../lib/api";

export const Route = createFileRoute("/station/$stationId")({
  loader: async ({ params }) => {
    const station = await fetchStationById(params.stationId);
    if (!station) throw notFound();
    return station;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} — ${loaderData.city} EV Charging | EvFinder`
          : "Station unavailable | EvFinder",
      },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.name} by ${loaderData.network} in ${loaderData.city}: ${loaderData.connectors.join(", ")} up to ${loaderData.maxPowerKw}kW at ₹${loaderData.pricePerKwh}/kWh.`
          : "This charging station is unavailable.",
      },
      ...(loaderData
        ? [
            {
              property: "og:title",
              content: `${loaderData.name} — ${loaderData.city} EV Charging`,
            },
            {
              property: "og:description",
              content: `${loaderData.connectors.join(", ")} up to ${loaderData.maxPowerKw}kW · ₹${loaderData.pricePerKwh}/kWh · ${statusMeta[loaderData.status].label}.`,
            },
          ]
        : [{ name: "robots", content: "noindex" }]),
    ],
  }),
  component: StationDetailPage,
});

const toneDot: Record<string, string> = {
  accent: "bg-accent text-accent",
  warn: "bg-warn text-warn",
  frost: "bg-frost text-frost",
  destructive: "bg-destructive text-destructive",
};

function StationDetailPage() {
  const station = Route.useLoaderData() as Station;
  const meta = statusMeta[station.status];

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;
  const osmUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${station.lat}%2C${station.lng}`;

  return (
    <SiteChrome>
      <section className="px-6 sm:px-8 lg:px-14 pt-6 pb-14">
        <div className="flex items-center justify-between">
          <Link
            to="/stations"
            className="text-sm text-frost/60 hover:text-accent transition flex items-center gap-1.5"
          >
            <span>←</span> Back to all stations
          </Link>
          <Link
            to="/map"
            search={{ city: station.city, stationId: station.id }}
            className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
          >
            🗺️ View on Map View
          </Link>
        </div>

        <div className="mt-6 grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold uppercase tracking-wider text-accent bg-accent/10 px-3 py-1 rounded-full border border-accent/30">
                {station.network}
              </span>
              <span className="text-sm text-frost/70">📍 {station.city}, {station.state}</span>
              <span className="text-xs text-frost/40">
                GPS: {station.lat.toFixed(4)}, {station.lng.toFixed(4)}
              </span>
            </div>

            <h1 className="mt-3 font-display text-4xl lg:text-6xl font-black tracking-tight">
              {station.name}
            </h1>
            <p className="mt-3 text-lg text-frost/70">
              {station.address}
            </p>

            {/* Metrics cards */}
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl glass-panel-subtle p-5">
                <p className="text-[11px] uppercase tracking-wider text-frost/50">Total Charging Bays</p>
                <p className="mt-1 font-display text-3xl font-extrabold text-accent">
                  🔌 {station.totalPorts} <span className="text-lg text-frost/40">Ports</span>
                </p>
              </div>
              <div className="rounded-2xl glass-panel-subtle p-5">
                <p className="text-[11px] uppercase tracking-wider text-frost/50">Max Power Output</p>
                <p className="mt-1 font-display text-3xl font-extrabold text-foreground">
                  ⚡ {station.maxPowerKw} <span className="text-lg text-frost/40">kW</span>
                </p>
              </div>
            </div>

            {/* Connectors & Amenities */}
            <div className="mt-8 rounded-2xl glass-panel p-6">
              <h2 className="font-display text-xl font-bold">Connectors</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {station.connectors.map((c: string) => (
                  <span
                    key={c}
                    className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm text-accent font-semibold"
                  >
                    ⚡ {c}
                  </span>
                ))}
              </div>
              <h2 className="mt-8 font-display text-xl font-bold">Amenities</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {station.amenities.map((a: string) => (
                  <span
                    key={a}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-frost/70"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {/* Interactive Location Map Box */}
            <div className="mt-8 rounded-2xl glass-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-xl font-bold">Location & OpenStreetMap</h2>
                  <p className="text-xs text-frost/60 mt-0.5">
                    Precise GPS coordinates: {station.lat}, {station.lng}
                  </p>
                </div>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl charge-button font-display font-extrabold px-3.5 py-1.5 text-xs shadow-md shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition"
                >
                  Open in Google Maps ↗
                </a>
              </div>

              <div className="h-[340px] rounded-xl overflow-hidden border border-border">
                <IndiaEvMap
                  stations={[station]}
                  selectedStationId={station.id}
                  initialCenter={[station.lat, station.lng]}
                  initialZoom={14}
                  height="100%"
                  showControls={true}
                  showCitySelector={false}
                  showLayerSelector={true}
                  showRangeOverlay={false}
                  enableLocateMe={true}
                  singleStationMode={true}
                />
              </div>
            </div>
          </div>

          {/* Sticky Sidebar */}
          <aside className="h-fit lg:sticky lg:top-6 rounded-2xl glass-panel p-6 space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-frost/50">Hours</p>
              <p className="mt-1 font-medium">{station.hours}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-frost/50">Driver rating</p>
              <p className="mt-1 font-medium">
                ★ {station.rating.toFixed(1)}{" "}
                <span className="text-frost/50">({station.reviews} reviews)</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-frost/50">Payment</p>
              <p className="mt-1 font-medium">UPI · FastTag · Card · In-app wallet</p>
            </div>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center rounded-xl charge-button px-4 py-3.5 font-display font-black text-sm shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition"
            >
              Start GPS Navigation ↗
            </a>

            <Link
              to="/map"
              search={{ city: station.city, stationId: station.id }}
              className="block w-full text-center rounded-xl charge-button font-display font-extrabold px-4 py-3 text-xs sm:text-sm shadow-md shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition"
            >
              View on Fullscreen Map View →
            </Link>
          </aside>
        </div>
      </section>
    </SiteChrome>
  );
}
