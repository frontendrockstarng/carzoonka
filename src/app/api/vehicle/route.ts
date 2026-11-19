import { categorize } from "@/lib/categories";
import {
  NHTSA_API,
  splitComponents,
  slashDateToIso,
  vehiclePageUrl,
  type ApiError,
  type Complaint,
  type Recall,
  type VehicleReport,
} from "@/lib/nhtsa";

const TIMEOUT_MS = 20_000;

class UpstreamError extends Error {}

async function getJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new UpstreamError(timedOut ? "NHTSA did not respond in time." : "Could not reach NHTSA.");
  }
  // NHTSA answers 400 for parameters it can't interpret (e.g. a malformed year). Treat as no data.
  if (res.status === 400 || res.status === 404) return { results: [] };
  if (!res.ok) throw new UpstreamError(`NHTSA returned HTTP ${res.status}.`);
  try {
    return await res.json();
  } catch {
    throw new UpstreamError("NHTSA returned an unreadable response.");
  }
}

function resultsOf(json: unknown): Record<string, unknown>[] {
  const results = (json as { results?: unknown })?.results;
  return Array.isArray(results) ? (results as Record<string, unknown>[]) : [];
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function toComplaint(r: Record<string, unknown>): Complaint {
  const components = splitComponents(r.components);
  const summary = str(r.summary);
  return {
    odiNumber: num(r.odiNumber),
    dateFiled: slashDateToIso(r.dateComplaintFiled, "mdy"),
    dateOfIncident: slashDateToIso(r.dateOfIncident, "mdy"),
    components,
    categories: categorize(components, summary),
    summary,
    crash: r.crash === true,
    fire: r.fire === true,
    injuries: num(r.numberOfInjuries),
    deaths: num(r.numberOfDeaths),
  };
}

function toRecall(r: Record<string, unknown>): Recall {
  return {
    campaignNumber: str(r.NHTSACampaignNumber),
    reportReceivedDate: slashDateToIso(r.ReportReceivedDate, "dmy"),
    component: str(r.Component),
    summary: str(r.Summary),
    consequence: str(r.Consequence),
    remedy: str(r.Remedy),
    manufacturer: str(r.Manufacturer),
    parkIt: r.parkIt === true,
    parkOutside: r.parkOutSide === true,
  };
}

function bad(error: string, status: number) {
  return Response.json({ error } satisfies ApiError, { status });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const year = (params.get("year") ?? "").trim();
  const make = (params.get("make") ?? "").trim().toUpperCase();
  const model = (params.get("model") ?? "").trim().toUpperCase();

  const maxYear = new Date().getFullYear() + 2;
  if (!/^\d{4}$/.test(year) || Number(year) < 1950 || Number(year) > maxYear) {
    return bad(`Enter a model year between 1950 and ${maxYear}.`, 400);
  }
  if (!make || make.length > 50) return bad("Enter a vehicle make, e.g. Toyota.", 400);
  if (!model || model.length > 60) return bad("Enter a vehicle model, e.g. Camry.", 400);

  try {
    const report = await buildReport(year, make, model);
    if (!isEmpty(report)) return Response.json(report);

    // Nothing found usually means the model name doesn't match NHTSA's, most often because a trim level
    // was included ("TRAX LT" vs "TRAX"). Look up NHTSA's real model names for this year and make.
    const models = await getModels(year, make);
    if (models === null) return Response.json(report);

    const match = closestModel(model, models);
    if (match) {
      const retry = await buildReport(year, make, match);
      if (!isEmpty(retry)) return Response.json({ ...retry, requestedModel: model } satisfies VehicleReport);
    }
    return Response.json({ ...report, suggestions: { makeKnown: models.length > 0, models } } satisfies VehicleReport);
  } catch (err) {
    if (err instanceof UpstreamError) return bad(err.message, 502);
    throw err;
  }
}

async function buildReport(year: string, make: string, model: string): Promise<VehicleReport> {
  const qs = new URLSearchParams({ make, model, modelYear: year }).toString();
  const complaintsApi = `${NHTSA_API}/complaints/complaintsByVehicle?${qs}`;
  const recallsApi = `${NHTSA_API}/recalls/recallsByVehicle?${qs}`;

  const [complaintsRes, recallsRes] = await Promise.allSettled([getJson(complaintsApi), getJson(recallsApi)]);

  // Complaints are the core of the report: if they can't be loaded, fail the request.
  if (complaintsRes.status === "rejected") {
    const msg = complaintsRes.reason instanceof UpstreamError ? complaintsRes.reason.message : "Unexpected error.";
    throw new UpstreamError(`Could not load complaints from NHTSA. ${msg} Please try again.`);
  }

  const items = resultsOf(complaintsRes.value)
    .map(toComplaint)
    .sort((a, b) => (b.dateFiled ?? "").localeCompare(a.dateFiled ?? ""));

  const counts = new Map<string, number>();
  for (const c of items) for (const cat of c.categories) counts.set(cat, (counts.get(cat) ?? 0) + 1);
  const components = [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const filedDates = items.map((c) => c.dateFiled).filter((d): d is string => !!d).sort();

  const recalls: VehicleReport["recalls"] =
    recallsRes.status === "fulfilled"
      ? {
          ok: true,
          items: resultsOf(recallsRes.value)
            .map(toRecall)
            .sort((a, b) => (b.reportReceivedDate ?? "").localeCompare(a.reportReceivedDate ?? "")),
        }
      : {
          ok: false,
          error: recallsRes.reason instanceof UpstreamError ? recallsRes.reason.message : "Unexpected error.",
        };

  return {
    vehicle: { year, make, model },
    retrievedAt: new Date().toISOString(),
    complaints: {
      total: items.length,
      items,
      components,
      firstFiled: filedDates[0] ?? null,
      lastFiled: filedDates.at(-1) ?? null,
      crashes: items.filter((c) => c.crash).length,
      fires: items.filter((c) => c.fire).length,
      injuries: items.reduce((s, c) => s + c.injuries, 0),
      deaths: items.reduce((s, c) => s + c.deaths, 0),
    },
    recalls,
    suggestions: null,
    sources: { complaintsApi, recallsApi, vehiclePage: vehiclePageUrl(year, make, model) },
  };

}

function isEmpty(r: VehicleReport) {
  return r.complaints.total === 0 && r.recalls.ok && r.recalls.items.length === 0;
}

/**
 * NHTSA model names for a year + make. The complaints product catalog alone is incomplete (for 2017
 * Chevrolet it omits TRAX), so merge it with NHTSA's vPIC catalog, which has the full model list.
 */
async function getModels(year: string, make: string): Promise<string[] | null> {
  const [products, vpic] = await Promise.allSettled([
    getJson(`${NHTSA_API}/products/vehicle/models?${new URLSearchParams({ modelYear: year, make, issueType: "c" })}`),
    getJson(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`,
    ),
  ]);
  if (products.status === "rejected" && vpic.status === "rejected") return null;

  const names = [
    ...(products.status === "fulfilled" ? resultsOf(products.value).map((r) => str(r.model)) : []),
    ...(vpic.status === "fulfilled"
      ? ((vpic.value as { Results?: { Model_Name?: unknown }[] })?.Results ?? []).map((r) => str(r?.Model_Name))
      : []),
  ];
  return Array.from(new Set(names.filter(Boolean).map((n) => n.toUpperCase()))).sort();
}

/**
 * The longest NHTSA model name that the typed model starts with, ignoring spaces and punctuation:
 * "TRAX LT" -> "TRAX", "CRV EX" -> "CR-V", "F150 XLT" -> "F-150".
 */
function closestModel(typed: string, models: string[]): string | null {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const t = norm(typed);
  const hits = models.filter((m) => norm(m) && t.startsWith(norm(m)));
  return hits.sort((a, b) => norm(b).length - norm(a).length)[0] ?? null;
}
