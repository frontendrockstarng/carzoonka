"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  Check,
  Copy,
  ChevronDown,
  ExternalLink,
  FileText,
  Flame,
  Info,
  MessageSquareText,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { recallUrl, type Complaint, type Recall, type VehicleReport } from "@/lib/nhtsa";
import {
  COST_BASIS_NOTE,
  DEFAULT_LABOR_RATE,
  LABOR_HOURS_NOTE,
  LABOR_RATE_NOTE,
  estimateFor,
  LABOR_RATE_SOURCE,
  costView,
  type RepairEstimate,
} from "@/lib/repair-costs";
import { retentionScripts, speakableVehicle, type RetentionScript } from "@/lib/retention-scripts";
import { CATEGORY_METHOD_NOTE } from "@/lib/categories";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const TOP_COMPONENTS = 10;
const COST_ROWS = 8;

export function formatDate(iso: string | null) {
  if (!iso) return "Unknown";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function VehicleReportView({ report }: { report: VehicleReport }) {
  const { vehicle, complaints, recalls } = report;
  const [component, setComponent] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState(String(DEFAULT_LABOR_RATE));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const parsedRate = Number(rateInput);
  const rate = Number.isFinite(parsedRate) && parsedRate > 0 && parsedRate <= 1000 ? parsedRate : DEFAULT_LABOR_RATE;
  const selectedIndex = component ? complaints.components.findIndex((c) => c.name === component) : -1;
  const selected: SelectedProblem | null =
    selectedIndex >= 0
      ? { ...complaints.components[selectedIndex], rank: selectedIndex + 1, total: complaints.total }
      : null;
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Vehicle report</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
        <SourceLine report={report} />
      </div>

      {report.requestedModel && (
        <Alert className="border-sky-200 bg-sky-50 text-sky-950">
          <Info />
          <AlertTitle>
            Showing results for &ldquo;{vehicle.model}&rdquo; instead of &ldquo;{report.requestedModel}&rdquo;
          </AlertTitle>
          <AlertDescription className="text-sky-900">
            NHTSA had no records under &ldquo;{report.requestedModel}&rdquo;. NHTSA files complaints under the base
            model name, without trim levels, so this is the closest model name NHTSA uses for {vehicle.year}{" "}
            {vehicle.make}. Records cover all trims of this model.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info />
        <AlertTitle>Owner complaints are not confirmed defects</AlertTitle>
        <AlertDescription>
          Complaints are unverified reports submitted to NHTSA by vehicle owners. A high count suggests an area
          owners notice, not a proven mechanical defect. Recalls listed below are confirmed safety defects
          acknowledged by the manufacturer.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Owner complaints"
          value={fmt(complaints.total)}
          hint={
            complaints.firstFiled
              ? `Filed ${formatDate(complaints.firstFiled)} – ${formatDate(complaints.lastFiled)}`
              : "None on file"
          }
          icon={<Users />}
        />
        <Stat
          label="Recall campaigns"
          value={recalls.ok ? fmt(recalls.items.length) : "—"}
          hint={recalls.ok ? "Confirmed safety defects" : "Unavailable"}
          icon={<ShieldCheck />}
        />
        <Stat
          label="Complaints citing a crash"
          value={fmt(complaints.crashes)}
          hint={`${fmt(complaints.injuries)} injuries, ${fmt(complaints.deaths)} deaths reported`}
          icon={<AlertTriangle />}
        />
        <Stat label="Complaints citing a fire" value={fmt(complaints.fires)} hint="As reported by owners" icon={<Flame />} />
      </div>

      {complaints.total > 0 && (
        <div className="space-y-4">
          {selected && (
            <SelectedStrip
              problem={selected}
              rate={rate}
              onOpen={() => setDrawerOpen(true)}
              onClear={() => setComponent(null)}
            />
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <ComponentChart report={report} selected={component} onSelect={setComponent} />
            <ComplaintList items={complaints.items} components={complaints.components} selected={component} onSelect={setComponent} />
          </div>
        </div>
      )}

      {complaints.total > 0 && (
        <RepairCostCard
          report={report}
          rate={rate}
          rateInput={rateInput}
          onRateInput={setRateInput}
          onSelect={(name) => {
            setComponent(name);
            setDrawerOpen(true);
          }}
        />
      )}

      <ProblemDrawer open={drawerOpen} onOpenChange={setDrawerOpen} problem={selected} rate={rate} vehicle={vehicle} />

      <RecallList recalls={recalls} />
      <InvestigationsCard report={report} />
    </div>
  );
}

function SourceLine({ report }: { report: VehicleReport }) {
  const retrieved = new Date(report.retrievedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <div className="text-xs text-muted-foreground sm:text-right">
      <p>
        Source:{" "}
        <a href="https://www.nhtsa.gov" target="_blank" rel="noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
          NHTSA
        </a>{" "}
        public API · Retrieved {retrieved}
      </p>
      <a
        href={report.sources.vehiclePage}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
      >
        View this vehicle on NHTSA.gov <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

function Stat({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between text-muted-foreground [&_svg]:size-4">
        <span className="text-xs font-medium">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SectionBadge({ kind }: { kind: "complaint" | "recall" }) {
  return kind === "complaint" ? (
    <Badge variant="outline" className="text-muted-foreground">
      <Users /> Owner-reported · unverified
    </Badge>
  ) : (
    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
      <ShieldCheck /> Confirmed defect · recall
    </Badge>
  );
}

function ComponentChart({
  report,
  selected,
  onSelect,
}: {
  report: VehicleReport;
  selected: string | null;
  onSelect: (c: string | null) => void;
}) {
  const { components, total } = report.complaints;
  const top = components.slice(0, TOP_COMPONENTS);
  const max = top[0]?.count ?? 1;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Most reported problems</CardTitle>
        <CardDescription>
          Share of {fmt(total)} complaints. A complaint can fall into several categories, so shares can add up to
          more than 100%. Select a bar to see costs and filter complaints.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1" aria-label="Complaints by component">
          {top.map((c) => {
            const pct = Math.round((c.count / total) * 100);
            const active = selected === c.name;
            return (
              <li key={c.name}>
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : c.name)}
                  aria-pressed={active}
                  title={`${c.name}: ${fmt(c.count)} complaints (${pct}% of all complaints)`}
                  className={cn(
                    "group w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
                    active && "bg-muted",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className={cn("truncate font-medium", active && "underline underline-offset-4")}>
                      {titleCase(c.name)}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {fmt(c.count)} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted group-hover:bg-background">
                    <div
                      className={cn("h-full rounded-full", active ? "bg-foreground" : "bg-foreground/70")}
                      style={{ width: `${Math.max((c.count / max) * 100, 1.5)}%` }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 px-2 text-xs text-muted-foreground">{CATEGORY_METHOD_NOTE}</p>
        {components.length > TOP_COMPONENTS && (
          <p className="mt-3 px-2 text-xs text-muted-foreground">
            +{components.length - TOP_COMPONENTS} more categories in the filter list.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ComplaintList({
  items,
  components,
  selected,
  onSelect,
}: {
  items: Complaint[];
  components: VehicleReport["complaints"]["components"];
  selected: string | null;
  onSelect: (c: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (c) => (!selected || c.categories.includes(selected)) && (!q || c.summary.toLowerCase().includes(q)),
    );
  }, [items, selected, query]);

  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Owner complaints</CardTitle>
          <SectionBadge kind="complaint" />
        </div>
        <CardDescription>Newest first. Select a complaint to read the owner&rsquo;s full description.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search descriptions, e.g. transmission"
              className="pl-8"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE_SIZE);
              }}
            />
          </div>
          <select
            aria-label="Filter by component"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm sm:w-56"
            value={selected ?? ""}
            onChange={(e) => {
              onSelect(e.target.value || null);
              setLimit(PAGE_SIZE);
            }}
          >
            <option value="">All problems ({fmt(items.length)})</option>
            {components.map((c) => (
              <option key={c.name} value={c.name}>
                {titleCase(c.name)} ({fmt(c.count)})
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">
          Showing {fmt(Math.min(limit, filtered.length))} of {fmt(filtered.length)} complaints
          {selected && (
            <>
              {" "}
              in <span className="font-medium text-foreground">{titleCase(selected)}</span> ·{" "}
              <button type="button" className="underline underline-offset-4" onClick={() => onSelect(null)}>
                clear
              </button>
            </>
          )}
        </p>

        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No complaints match these filters.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {filtered.slice(0, limit).map((c) => {
              const isOpen = open.has(c.odiNumber);
              return (
                <li key={c.odiNumber}>
                  <button
                    type="button"
                    onClick={() => toggle(c.odiNumber)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium tabular-nums">{formatDate(c.dateFiled)}</span>
                        {c.categories.map((cat) => (
                          <Badge key={cat} variant="secondary" className="font-normal">
                            {cat}
                          </Badge>
                        ))}
                        {c.crash && <Badge variant="destructive">Crash</Badge>}
                        {c.fire && <Badge variant="destructive">Fire</Badge>}
                      </div>
                      <p className={cn("mt-1.5 text-sm text-muted-foreground", !isOpen && "line-clamp-2")}>
                        {c.summary || "No description provided."}
                      </p>
                      {isOpen && (
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                          <Meta label="Filed" value={formatDate(c.dateFiled)} />
                          <Meta label="Incident" value={formatDate(c.dateOfIncident)} />
                          <Meta label="Injuries / deaths" value={`${c.injuries} / ${c.deaths}`} />
                          <Meta label="NHTSA ID" value={String(c.odiNumber)} />
                          <div className="col-span-2 sm:col-span-4">
                            <dt className="text-muted-foreground">NHTSA component codes</dt>
                            <dd className="font-medium">{c.components.map(titleCase).join(", ")}</dd>
                          </div>
                        </dl>
                      )}
                    </div>
                    <ChevronDown
                      className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > limit && (
          <Button variant="outline" className="w-full" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Show more
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdRange = ([lo, hi]: [number, number]) => (lo === hi ? usd(lo) : `${usd(lo)} – ${usd(hi)}`);
const hoursRange = ([lo, hi]: [number, number]) => (lo === hi ? `${lo} hrs` : `${lo}–${hi} hrs`);

type SelectedProblem = { name: string; count: number; rank: number; total: number };

const sourceLabel = (s: { name: string; year: string | null }) => `${s.name}${s.year ? `, ${s.year}` : ""}`;

/** Slim inline summary for the selected problem; the full breakdown and scripts live in the drawer. */
function SelectedStrip({
  problem,
  rate,
  onOpen,
  onClear,
}: {
  problem: SelectedProblem;
  rate: number;
  onOpen: () => void;
  onClear: () => void;
}) {
  const e = estimateFor(problem.name);
  const total = e ? costView(e, rate).total : null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold">{titleCase(problem.name)}</span>
        <span className="text-sm text-muted-foreground">
          {fmt(problem.count)} complaints ({Math.round((problem.count / problem.total) * 100)}%)
        </span>
        <span className="text-sm">
          {total ? (
            <>
              Est. repair <span className="font-semibold tabular-nums">{usdRange(total)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">No published cost estimate</span>
          )}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" onClick={onOpen}>
          <MessageSquareText /> Costs &amp; talk tracks
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
          <X />
        </Button>
      </div>
    </div>
  );
}

/** Right-hand drawer: full cost breakdown plus retention scripts. Opens over the page without moving it. */
function ProblemDrawer({
  open,
  onOpenChange,
  problem,
  rate,
  vehicle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problem: SelectedProblem | null;
  rate: number;
  vehicle: VehicleReport["vehicle"];
}) {
  return (
    <Sheet open={open && problem !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        {problem && <ProblemDetails problem={problem} rate={rate} vehicle={vehicle} />}
      </SheetContent>
    </Sheet>
  );
}

function ProblemDetails({
  problem,
  rate,
  vehicle,
}: {
  problem: SelectedProblem;
  rate: number;
  vehicle: VehicleReport["vehicle"];
}) {
  const { name, count, rank, total } = problem;
  const e = estimateFor(name);
  const v = e ? costView(e, rate) : null;
  const scripts = retentionScripts({
    vehicle: speakableVehicle(vehicle.year, vehicle.make, vehicle.model),
    component: titleCase(name),
    repair: e?.repair ?? null,
    complaints: count,
    totalComplaints: total,
    rank,
    cost: v?.total ?? null,
    laborRate: rate,
    laborHours: v?.hours ?? null,
    parts: v?.parts ?? null,
  });

  return (
    <>
      <SheetHeader className="border-b p-5 pr-12">
        <p className="text-xs font-medium text-muted-foreground">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </p>
        <SheetTitle className="text-lg">{titleCase(name)}</SheetTitle>
        <SheetDescription>
          {fmt(count)} of {fmt(total)} owner complaints ({Math.round((count / total) * 100)}%)
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 p-5">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Estimated repair cost</h3>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              <Calculator /> Estimate · not a quote
            </Badge>
          </div>
          {!e || !v ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No cost estimate for this category. Either it covers too many different parts to price meaningfully, or
              there&rsquo;s no credible published figure for it.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm">
                Typical repair: <span className="font-medium">{e.repair}</span>
              </p>
              {v.totalBasis === "computed" ? (
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <PanelFigure label="Parts" value={usdRange(v.parts!)} sub={sourceLabel(e.source)} />
                  <PanelFigure
                    label="Labor"
                    value={usdRange(v.labor!)}
                    sub={`${hoursRange(v.hours!)} (standard) × ${usd(rate)}/hr`}
                  />
                  <PanelFigure label="Est. total at your rate" value={usdRange(v.total!)} strong />
                  <PanelFigure
                    label="Source's published total"
                    value={e.published ? usdRange(e.published) : "Not published"}
                    sub={sourceLabel(e.source)}
                  />
                </div>
              ) : (
                <div className="mt-3">
                  <PanelFigure
                    label="Published total, parts and labor"
                    value={v.total ? usdRange(v.total) : "—"}
                    sub={sourceLabel(e.source)}
                    strong
                  />
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                General U.S. estimate, not specific to this vehicle. Complaints don&rsquo;t say which part failed, so
                the real repair may differ. {v.hours && LABOR_HOURS_NOTE}
                {e.note && ` ${e.note}`}{" "}
                <a
                  href={e.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Source: {e.source.name} <ExternalLink className="size-3" />
                </a>
              </p>
            </>
          )}
        </section>

        <ScriptPicker key={name} scripts={scripts} />
      </div>
    </>
  );
}

function ScriptPicker({ scripts }: { scripts: RetentionScript[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const script = scripts[Math.min(active, scripts.length - 1)];

  async function copy() {
    try {
      await navigator.clipboard.writeText(script.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <MessageSquareText className="size-4 text-muted-foreground" /> Retention talk tracks
        </p>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy script"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b px-3 py-2" role="tablist" aria-label="Script variations">
        {scripts.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              i === active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {s.title}
          </button>
        ))}
      </div>
      <div className="px-3 py-3" role="tabpanel">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">When to use:</span> {script.when}
        </p>
        <div className="mt-2 space-y-2.5 text-sm leading-relaxed">
          {script.text.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Fill in the [bracketed] parts. Complaint counts are real NHTSA data; costs are estimates. Don&rsquo;t promise
          coverage without checking the customer&rsquo;s contract.
        </p>
      </div>
    </div>
  );
}

function PanelFigure({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 tabular-nums", strong ? "text-base font-semibold" : "text-sm font-medium")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RepairCostCard({
  report,
  rate,
  rateInput,
  onRateInput,
  onSelect,
}: {
  report: VehicleReport;
  rate: number;
  rateInput: string;
  onRateInput: (v: string) => void;
  onSelect: (component: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const rows = report.complaints.components
    .map((c) => ({ ...c, estimate: estimateFor(c.name) }))
    .filter((r): r is typeof r & { estimate: RepairEstimate } => r.estimate !== null);
  const skipped = report.complaints.components.filter((c) => !estimateFor(c.name)).map((c) => titleCase(c.name));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Estimated repair costs</CardTitle>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
            <Calculator /> General U.S. estimate · not a quote
          </Badge>
        </div>
        <CardDescription>
          Published national cost of the most common repair in each reported component category. Not specific to the{" "}
          {report.vehicle.year} {report.vehicle.make} {report.vehicle.model}, and owner complaints don&rsquo;t say
          which part actually failed, so the real repair may differ. Select a row for the full breakdown and talk
          tracks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <label htmlFor="labor-rate" className="text-sm font-medium">
              Mechanic labor rate
            </label>
            <p className="text-xs text-muted-foreground">
              {LABOR_RATE_NOTE}{" "}
              <a href={LABOR_RATE_SOURCE.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {LABOR_RATE_SOURCE.name}
                {LABOR_RATE_SOURCE.year && `, ${LABOR_RATE_SOURCE.year}`}
              </a>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              id="labor-rate"
              inputMode="decimal"
              className="w-24 bg-background tabular-nums"
              value={rateInput}
              onChange={(e) => onRateInput(e.target.value.replace(/[^\d.]/g, ""))}
              aria-invalid={String(rate) !== rateInput}
            />
            <span className="text-sm text-muted-foreground">/ hr</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="hidden grid-cols-[1.2fr_1.6fr_1fr_1fr_1fr] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>Component</span>
            <span>Typical repair · source</span>
            <span className="text-right">Parts</span>
            <span className="text-right">Labor</span>
            <span className="text-right">Est. total</span>
          </div>
          <ul className="divide-y">
            {(showAll ? rows : rows.slice(0, COST_ROWS)).map(({ name, count, estimate: e }) => {
              const v = costView(e, rate);
              return (
                <li key={name}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(name)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        onSelect(name);
                      }
                    }}
                    className="grid cursor-pointer grid-cols-2 gap-x-3 gap-y-1 px-3 py-3 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50 md:grid-cols-[1.2fr_1.6fr_1fr_1fr_1fr] md:items-center"
                  >
                    <div className="col-span-2 md:col-span-1">
                      <p className="font-medium">{titleCase(name)}</p>
                      <p className="text-xs text-muted-foreground">{fmt(count)} complaints</p>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <p className="text-muted-foreground">{e.repair}</p>
                      {e.source && (
                        <a
                          href={e.source.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(ev) => ev.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-xs underline-offset-4 hover:underline"
                        >
                          {e.source.name}
                          {e.source.year && `, ${e.source.year}`} <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    <CostCell label="Parts" value={v.parts ? usdRange(v.parts) : "—"} />
                    <CostCell
                      label="Labor"
                      value={v.labor ? usdRange(v.labor) : "—"}
                      sub={v.hours ? `${hoursRange(v.hours)} × ${usd(rate)}` : undefined}
                    />
                    <CostCell
                      label="Est. total"
                      value={v.total ? usdRange(v.total) : "—"}
                      sub={v.totalBasis === "published" ? "published total" : undefined}
                      strong
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        {rows.length > COST_ROWS && (
          <Button variant="outline" className="w-full" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show top components only" : `Show all ${rows.length} components`}
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Where a parts price is available, the total is parts + (labor hours × your rate). {LABOR_HOURS_NOTE} Where
          the source only gives a combined figure, that published total is shown as-is. Excludes tax,
          diagnostic fees and shop supplies. {COST_BASIS_NOTE}
          {skipped.length > 0 &&
            ` No published estimate (category too broad, or no credible source): ${skipped.join(", ")}.`}
        </p>
      </CardContent>
    </Card>
  );
}

function CostCell({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="md:text-right">
      <p className="text-xs text-muted-foreground md:hidden">{label}</p>
      <p className={cn("tabular-nums", strong ? "font-semibold" : "text-foreground")}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground tabular-nums">{sub}</p>}
    </div>
  );
}

function RecallList({ recalls }: { recalls: VehicleReport["recalls"] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Safety recalls</CardTitle>
          <SectionBadge kind="recall" />
        </div>
        <CardDescription>
          Defects confirmed by the manufacturer or NHTSA. A recall applies to specific VINs; confirm with the
          customer&rsquo;s VIN on NHTSA.gov.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!recalls.ok ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Recall data could not be loaded</AlertTitle>
            <AlertDescription>{recalls.error} Complaint data above is unaffected.</AlertDescription>
          </Alert>
        ) : recalls.items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            NHTSA lists no recalls for this vehicle.
          </p>
        ) : (
          <ul className="space-y-3">
            {recalls.items.map((r) => (
              <RecallItem key={r.campaignNumber} recall={r} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecallItem({ recall: r }: { recall: Recall }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">{titleCase(r.component) || "Component not specified"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Campaign {r.campaignNumber} · Reported {formatDate(r.reportReceivedDate)}
            {r.manufacturer && ` · ${r.manufacturer}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {r.parkIt && <Badge variant="destructive">Do not drive</Badge>}
          {r.parkOutside && <Badge variant="destructive">Park outside</Badge>}
          <a
            href={recallUrl(r.campaignNumber)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
          >
            NHTSA record <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
      <p className={cn("mt-2 text-sm text-muted-foreground", !open && "line-clamp-2")}>{r.summary}</p>
      {open && (
        <dl className="mt-3 space-y-2 text-sm">
          {r.consequence && (
            <div>
              <dt className="text-xs font-medium">Consequence</dt>
              <dd className="text-muted-foreground">{r.consequence}</dd>
            </div>
          )}
          {r.remedy && (
            <div>
              <dt className="text-xs font-medium">Remedy</dt>
              <dd className="text-muted-foreground">{r.remedy}</dd>
            </div>
          )}
        </dl>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 text-xs font-medium underline-offset-4 hover:underline"
        aria-expanded={open}
      >
        {open ? "Show less" : "Show consequence & remedy"}
      </button>
    </li>
  );
}

function InvestigationsCard({ report }: { report: VehicleReport }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Defect investigations</p>
            <p className="text-xs text-muted-foreground">
              NHTSA&rsquo;s public API does not filter investigations by vehicle, so they aren&rsquo;t summarized here.
              Open investigations for this vehicle are listed on its NHTSA page.
            </p>
          </div>
        </div>
        <a
          href={report.sources.vehiclePage}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
        >
          View investigations <ExternalLink className="size-3" />
        </a>
      </CardContent>
    </Card>
  );
}

/** "SERVICE BRAKES, HYDRAULIC:POWER ASSIST:VACUUM" -> "Service Brakes, Hydraulic › Power Assist › Vacuum" */
export function titleCase(s: string) {
  // Already human-cased (e.g. our category names like "AC / Heater"): leave as-is.
  if (s !== s.toUpperCase()) return s;
  const keep = new Set(["(ESC)", "ESC", "ABS", "TPMS", "A/C", "LATCH", "OCS"]);
  return s
    .split(":")
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .split(/(\s+|\/)/)
        .map((w) => (keep.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(""),
    )
    .join(" › ");
}
