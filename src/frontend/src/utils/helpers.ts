// Haversine formula to calculate distance between two lat/lng points in km
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimated travel time at 30 km/h urban speed
export function estimatedTravelTime(distanceKm: number): string {
  const minutes = Math.round((distanceKm / 30) * 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Ahmedabad center coordinates (default/fallback)
export const AHMEDABAD_CENTER = { lat: 23.0225, lng: 72.5714 };

export function serviceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    plumber: "Plumber",
    electrician: "Electrician",
    mechanic: "Mechanic",
  };
  return map[type] ?? type;
}

export function serviceTypeIcon(type: string): string {
  const map: Record<string, string> = {
    plumber: "🔧",
    electrician: "⚡",
    mechanic: "🔩",
  };
  return map[type] ?? "🛠️";
}

export function formatDate(timestamp: bigint): string {
  return new Date(Number(timestamp / 1_000_000n)).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
