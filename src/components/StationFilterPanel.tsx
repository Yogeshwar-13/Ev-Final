import React from "react";
import { cities, cityCoordinates } from "../data/stations";

export type StationFiltersState = {
  city?: string | undefined;
  type?: "dc" | "ac" | "all" | undefined;
  connector?: string | undefined;
  power?: string | undefined;
  network?: string | undefined;
};

interface StationFilterPanelProps {
  filters: StationFiltersState;
  onFilterChange: (patch: Partial<StationFiltersState>) => void;
  onReset: () => void;
  totalResults: number;
  totalAllStations?: number;
  className?: string;
}

const CONNECTORS = [
  { id: "CCS2", label: "CCS2", desc: "Standard 4-wheeler DC Fast" },
  { id: "Type 2 AC", label: "Type 2 AC", desc: "AC Wallbox / Destination" },
  { id: "Bharat DC-001", label: "Bharat DC / GB/T", desc: "15kW–60kW Commercial Fleet DC" },
  { id: "Bharat AC-001", label: "15A Socket / AC-001", desc: "Standard 15A 3-Pin / 2W & 3W" },
  { id: "LECCS", label: "LECCS (Ather 2W)", desc: "Light EV Combined AC/DC Fast" },
  { id: "CHAdeMO", label: "CHAdeMO", desc: "DC Fast Quick Charge" },
];

const SPEED_TIERS = [
  { key: "50", label: "50 kW+", desc: "Fast (30-45m)" },
  { key: "100", label: "100 kW+", desc: "Rapid (20-30m)" },
  { key: "150", label: "150 kW+", desc: "Ultra Fast (15m)" },
  { key: "200", label: "200 kW+", desc: "Hyper Fast (<15m)" },
];

const POPULAR_NETWORKS = [
  { id: "Tata Power", label: "Tata Power" },
  { id: "Ather", label: "Ather Grid" },
  { id: "Jio-bp", label: "Jio-bp pulse" },
  { id: "BPCL", label: "BPCL e-Drive" },
  { id: "Statiq", label: "Statiq" },
  { id: "Charge Zone", label: "Charge Zone" },
  { id: "Zeon", label: "Zeon Charging" },
  { id: "Bolt.Earth", label: "Bolt.Earth" },
];

export function StationFilterPanel({
  filters,
  onFilterChange,
  onReset,
  totalResults,
  totalAllStations,
  className = "",
}: StationFilterPanelProps) {
  const allCityNames = Object.keys(cityCoordinates || {});
  const safeCities = Array.isArray(cities) ? cities : allCityNames.map(name => ({ name }));
  const totalCount = totalAllStations ?? totalResults;

  const activeFilterCount = [
    filters.city,
    filters.type && filters.type !== "all",
    filters.connector,
    filters.power,
    filters.network,
  ].filter(Boolean).length;

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold transition ${
      active
        ? "border border-accent bg-accent/20 text-accent ring-1 ring-accent/30 font-bold"
        : "border border-border text-frost hover:text-foreground hover:bg-ink2/70"
    }`;

  return (
    <div className={`space-y-6 text-foreground ${className}`}>
      {/* Header with Active Filters & Reset */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="font-display font-extrabold text-sm">Filters</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-accent/20 text-accent border border-accent/40 px-2 py-0.5 text-[10px] font-bold">
              {activeFilterCount} active
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={onReset}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Reset all
          </button>
        )}
      </div>

      {/* 1. City Filter */}
      <div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-frost/70 mb-2 font-bold">
          <span>City / Region</span>
          {filters.city && (
            <button
              onClick={() => onFilterChange({ city: undefined })}
              className="text-accent text-[11px] hover:underline lowercase font-normal"
            >
              clear
            </button>
          )}
        </div>

        <div className="relative mb-2">
          <select
            value={filters.city || "All India"}
            onChange={(e) =>
              onFilterChange({
                city: e.target.value === "All India" ? undefined : e.target.value,
              })
            }
            className="w-full rounded-xl border border-border bg-ink2/80 px-3 py-2 text-xs font-semibold text-foreground focus:border-accent focus:outline-none cursor-pointer"
          >
            <option value="All India">🇮🇳 All India ({totalCount} Live Stations)</option>
            {allCityNames.map((c) => (
              <option key={c} value={c}>
                📍 {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar pr-1">
          <button
            onClick={() => onFilterChange({ city: undefined })}
            className={chip(!filters.city)}
          >
            🇮🇳 All India ({totalCount} Live)
          </button>
          {safeCities.map((c) => (
            <button
              key={c.name}
              onClick={() =>
                onFilterChange({
                  city: filters.city?.toLowerCase() === c.name.toLowerCase() ? undefined : c.name,
                })
              }
              className={chip(filters.city?.toLowerCase() === c.name.toLowerCase())}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Charging Type: DC Fast vs AC Standard */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-frost/70 mb-2 font-bold">
          Charging Type
        </p>
        <div className="grid grid-cols-3 gap-1.5 bg-ink2/50 p-1 rounded-xl border border-border">
          <button
            onClick={() => onFilterChange({ type: undefined })}
            className={`py-1.5 text-xs font-semibold rounded-lg transition ${
              !filters.type || filters.type === "all"
                ? "bg-primary text-primary-foreground shadow"
                : "text-frost hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            onClick={() => onFilterChange({ type: "dc" })}
            className={`py-1.5 text-xs font-semibold rounded-lg transition ${
              filters.type === "dc"
                ? "bg-accent text-accent-foreground shadow font-bold"
                : "text-frost hover:text-foreground"
            }`}
          >
            ⚡ DC Fast
          </button>
          <button
            onClick={() => onFilterChange({ type: "ac" })}
            className={`py-1.5 text-xs font-semibold rounded-lg transition ${
              filters.type === "ac"
                ? "bg-primary text-primary-foreground shadow font-bold"
                : "text-frost hover:text-foreground"
            }`}
          >
            🔌 AC
          </button>
        </div>
      </div>

      {/* 3. Connector Speed / Power (kW) */}
      <div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-frost/70 mb-2 font-bold">
          <span>Charging Speed (Power)</span>
          {filters.power && (
            <button
              onClick={() => onFilterChange({ power: undefined })}
              className="text-accent text-[11px] hover:underline lowercase font-normal"
            >
              clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onFilterChange({ power: undefined })}
            className={chip(!filters.power)}
          >
            Any Speed
          </button>
          {SPEED_TIERS.map((tier) => (
            <button
              key={tier.key}
              onClick={() =>
                onFilterChange({
                  power: filters.power === tier.key ? undefined : tier.key,
                })
              }
              className={chip(filters.power === tier.key)}
              title={tier.desc}
            >
              {tier.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Connector Types */}
      <div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-frost/70 mb-2 font-bold">
          <span>Connector Type</span>
          {filters.connector && (
            <button
              onClick={() => onFilterChange({ connector: undefined })}
              className="text-accent text-[11px] hover:underline lowercase font-normal"
            >
              clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onFilterChange({ connector: undefined })}
            className={chip(!filters.connector)}
          >
            All Connectors
          </button>
          {CONNECTORS.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                onFilterChange({
                  connector: filters.connector === c.id ? undefined : c.id,
                })
              }
              className={chip(filters.connector === c.id)}
              title={c.desc}
            >
              {c.id}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Charging Network */}
      <div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-frost/70 mb-2 font-bold">
          <span>Charging Network</span>
          {filters.network && (
            <button
              onClick={() => onFilterChange({ network: undefined })}
              className="text-accent text-[11px] hover:underline lowercase font-normal"
            >
              clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onFilterChange({ network: undefined })}
            className={chip(!filters.network)}
          >
            All Networks
          </button>
          {POPULAR_NETWORKS.map((n) => (
            <button
              key={n.id}
              onClick={() =>
                onFilterChange({
                  network:
                    filters.network?.toLowerCase() === n.id.toLowerCase()
                      ? undefined
                      : n.id,
                })
              }
              className={chip(
                filters.network?.toLowerCase() === n.id.toLowerCase() ||
                  Boolean(filters.network && n.label.toLowerCase().includes(filters.network.toLowerCase())),
              )}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
