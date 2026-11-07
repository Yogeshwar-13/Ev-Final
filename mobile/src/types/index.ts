export type StationStatus = "available" | "limited" | "busy" | "offline";

export interface Station {
  id: string;
  name: string;
  network: string;
  city: string;
  state: string;
  address: string;
  pincode: string;
  lat: number;
  lng: number;
  distanceKm?: number;
  status: StationStatus;
  freePorts: number;
  totalPorts: number;
  connectors: string[];
  maxPowerKw: number;
  pricePerKwh: number;
  hours: string;
  amenities: string[];
  rating: number;
  reviews: number;
}

export interface PortTelemetry {
  portNumber: number;
  connectorType: string;
  maxPowerKw: number;
  status: "available" | "occupied" | "faulted";
  pricePerKwh: number;
}

export interface ReviewItem {
  id: string;
  stationId: string;
  userName: string;
  rating: number;
  comment: string;
  plugCondition: "working_perfect" | "slow_charge" | "broken_connector";
  createdAt: string;
}

export interface RoutePlanResult {
  totalDistanceKm: number;
  estimatedDriveTimeMinutes: number;
  stopsNeeded: boolean;
  recommendedStops: {
    stopNumber: number;
    station: Station;
    estimatedArrivalSoc: number;
    targetChargeSoc: number;
    chargeTimeMinutes: number;
    estimatedCostInr: number;
  }[];
  arrivalDestinationSocPercent: number;
}
