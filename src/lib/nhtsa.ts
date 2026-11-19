// Types and helpers for NHTSA's public APIs (https://api.nhtsa.gov). Server-side fetching lives in
// src/app/api/vehicle/route.ts; these types are shared with the client.

export const NHTSA_API = "https://api.nhtsa.gov";

export type Complaint = {
  odiNumber: number;
  dateFiled: string | null; // ISO yyyy-mm-dd
  dateOfIncident: string | null; // ISO yyyy-mm-dd
  /** NHTSA's own component codes, as filed. */
  components: string[];
  /** Plain-language categories derived from the codes and description (see lib/categories.ts). */
  categories: string[];
  summary: string;
  crash: boolean;
  fire: boolean;
  injuries: number;
  deaths: number;
};

export type ComponentCount = { name: string; count: number };

export type Recall = {
  campaignNumber: string;
  reportReceivedDate: string | null; // ISO yyyy-mm-dd
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  manufacturer: string;
  parkIt: boolean;
  parkOutside: boolean;
};

export type VehicleReport = {
  vehicle: { year: string; make: string; model: string };
  retrievedAt: string; // ISO timestamp
  complaints: {
    total: number;
    items: Complaint[];
    /** Complaint counts per plain-language category, most reported first. */
    components: ComponentCount[];
    firstFiled: string | null;
    lastFiled: string | null;
    crashes: number;
    fires: number;
    injuries: number;
    deaths: number;
  };
  recalls: { ok: true; items: Recall[] } | { ok: false; error: string };
  /** Set when nothing matched the typed model and results are shown for the closest NHTSA model name. */
  requestedModel?: string;
  /** Only populated when the vehicle returned no complaints and no recalls. */
  suggestions: { makeKnown: boolean; models: string[] } | null;
  sources: {
    complaintsApi: string;
    recallsApi: string;
    vehiclePage: string;
  };
};

export type ApiError = { error: string };

/**
 * Slash date -> ISO yyyy-mm-dd. NHTSA is inconsistent: the complaints API uses MM/DD/YYYY
 * ("11/16/2026") while the recalls API uses DD/MM/YYYY ("17/11/2021").
 */
export function slashDateToIso(value: unknown, order: "mdy" | "dmy"): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [month, day] = order === "mdy" ? [m[1], m[2]] : [m[2], m[1]];
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${m[3]}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * NHTSA joins multiple components with a bare comma ("POWER TRAIN,ENGINE"), but some component
 * names themselves contain ", " ("FUEL SYSTEM, GASOLINE"). Split only on commas not followed by a space.
 */
export function splitComponents(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return ["UNKNOWN OR OTHER"];
  return Array.from(new Set(value.split(/,(?! )/).map((c) => c.trim()).filter(Boolean)));
}

export function vehiclePageUrl(year: string, make: string, model: string) {
  return `https://www.nhtsa.gov/vehicle/${encodeURIComponent(year)}/${encodeURIComponent(
    make.toUpperCase(),
  )}/${encodeURIComponent(model.toUpperCase())}`;
}

export function recallUrl(campaignNumber: string) {
  return `https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(campaignNumber)}`;
}
