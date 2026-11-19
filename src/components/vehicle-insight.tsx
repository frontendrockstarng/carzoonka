"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CarFront, SearchX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleSearch } from "@/components/vehicle-search";
import { VehicleReportView } from "@/components/vehicle-report";
import type { ApiError, VehicleReport } from "@/lib/nhtsa";
import type { VehicleQuery } from "@/lib/parse-vehicle";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; report: VehicleReport };

export function VehicleInsight() {
  const [query, setQuery] = useState<VehicleQuery>({ year: "", make: "", model: "" });
  const [state, setState] = useState<State>({ status: "idle" });
  const requestId = useRef(0);

  async function search(q: VehicleQuery) {
    const id = ++requestId.current;
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/vehicle?${new URLSearchParams(q)}`);
      const body = (await res.json().catch(() => null)) as VehicleReport | ApiError | null;
      if (id !== requestId.current) return; // a newer search started
      if (!res.ok || !body || "error" in body) {
        setState({ status: "error", message: (body && "error" in body && body.error) || `Request failed (${res.status}).` });
        return;
      }
      setState({ status: "done", report: body });
      // Results may be for NHTSA's base model name ("TRAX" for "TRAX LT"); reflect that in the form.
      if (body.requestedModel) setQuery({ ...q, model: body.vehicle.model });
    } catch {
      if (id !== requestId.current) return;
      setState({ status: "error", message: "Network error. Check your connection and try again." });
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg border bg-card">
          <CarFront className="size-4.5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Vehicle Insight</h1>
          <p className="text-sm text-muted-foreground">Research owner complaints and recalls from NHTSA records.</p>
        </div>
      </header>

      <VehicleSearch value={query} onChange={setQuery} onSearch={search} loading={state.status === "loading"} />

      <section className="mt-8" aria-live="polite">
        {state.status === "idle" && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Enter a vehicle above to see its NHTSA complaint and recall history.
          </div>
        )}

        {state.status === "loading" && <LoadingState />}

        {state.status === "error" && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              <p>{state.message}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => search(query)}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {state.status === "done" &&
          (isEmpty(state.report) ? (
            <EmptyState
              report={state.report}
              onPickModel={(model) => {
                const next = { ...query, year: state.report.vehicle.year, make: state.report.vehicle.make, model };
                setQuery(next);
                search(next);
              }}
            />
          ) : (
            <VehicleReportView key={state.report.retrievedAt} report={state.report} />
          ))}
      </section>
    </div>
  );
}

function isEmpty(r: VehicleReport) {
  return r.complaints.total === 0 && r.recalls.ok && r.recalls.items.length === 0;
}

function EmptyState({ report, onPickModel }: { report: VehicleReport; onPickModel: (m: string) => void }) {
  const { vehicle, suggestions } = report;
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const guess = vehicle.model.split(/[\s-]/)[0];
  const ranked = suggestions?.models
    ? [...suggestions.models].sort((a, b) => Number(b.startsWith(guess)) - Number(a.startsWith(guess)))
    : [];

  return (
    <div className="rounded-xl border bg-card p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <SearchX className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="font-medium">No NHTSA records for {name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {suggestions && !suggestions.makeKnown
              ? `NHTSA has no complaint records for the make "${vehicle.make}" in ${vehicle.year}. Check the spelling of the make and the year.`
              : "Either no complaints or recalls have been filed for this vehicle, or the model name doesn't match NHTSA's naming."}
          </p>
          {ranked.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">
                {vehicle.year} {vehicle.make} models with NHTSA complaints:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ranked.map((m) => (
                  <Button key={m} variant="outline" size="sm" onClick={() => onPickModel(m)}>
                    {m}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Retrieved {new Date(report.retrievedAt).toLocaleString()} from{" "}
            <a href={report.sources.complaintsApi} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              NHTSA Complaints API
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
