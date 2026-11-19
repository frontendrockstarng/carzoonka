// Published U.S. repair-cost figures by problem category (Transmission, Engine, Brakes, ...).
//
// These are NOT vehicle-specific and NOT from NHTSA. Each row is the most common repair for that
// complaint category, with a national cost figure from a named public source (RepairPal, AAA,
// J.D. Power, Consumer Reports, AutoZone). Researched Nov 2026.
//
// Verification status:
// - AAA, J.D. Power, Consumer Reports and Tekmetric figures were confirmed on the source pages.
// - RepairPal (and the AutoZone headlight figure) block automated access, so those numbers were taken
//   from search-engine copies of the pages. Spot-check them on the source site before quoting them.
// Categories with no credible published figure are deliberately left out (diesel injectors, seat belts).

export type Range = [number, number];
export type Source = { name: string; url: string; year: string | null };

export type RepairEstimate = {
  repair: string;
  /** Parts cost range, when the source breaks it out. */
  parts: Range | null;
  /** Total parts-and-labor range as published by the source. */
  published: Range | null;
  source: Source;
  note: string | null;
};

export const DEFAULT_LABOR_RATE = 132; // Tekmetric U.S. average, 2026
export const LABOR_RATE_NOTE = "U.S. average is $132/hr; state averages range from $85 to $197/hr.";
export const LABOR_RATE_SOURCE: Source = {
  name: "Tekmetric",
  url: "https://www.tekmetric.com/post/average-auto-repair-labor-rates-by-state",
  year: "2026",
};
/** Labor hours applied to every repair, by product decision; a simplifying assumption, not book time. */
export const STANDARD_LABOR_HOURS: Range = [3, 5];
export const LABOR_HOURS_NOTE =
  "Labor uses a standard 3–5 hour assumption for every repair, not the actual book time for this job.";
export const COST_BASIS_NOTE =
  "Parts prices and published totals come from the source linked on each row (national figures, not this vehicle).";

const REPAIRPAL_NOTE = "RepairPal national estimate; spot-check on RepairPal before quoting.";
const repairPal = (slug: string, year: string | null = "2026"): Source => ({
  name: "RepairPal",
  url: `https://repairpal.com/estimator/${slug}`,
  year,
});
const AAA_ADAS: Source = {
  name: "AAA",
  url: "https://newsroom.aaa.com/2023/12/fixing-advanced-vehicle-systems-makes-up-over-one-third-of-repair-costs-following-a-crash/",
  year: "2023",
};
const AAA_FUEL_PUMP: Source = {
  name: "AAA",
  url: "https://www.aaa.com/autorepair/articles/how-much-does-a-fuel-pump-replacement-cost",
  year: null,
};

const TABLE: Record<string, RepairEstimate> = {
  "Transmission": {
    repair: "Automatic transmission replacement",
    parts: null,
    published: [2500, 5000],
    source: {
      name: "J.D. Power",
      url: "https://www.jdpower.com/cars/shopping-guides/how-much-does-it-cost-to-replace-a-transmission-on-a-car",
      year: "2023",
    },
    note: "Mainstream automatic, parts and labor. RepairPal's 2026 national estimate is higher ($6,238–$6,764).",
  },
  "Engine": {
    repair: "Engine replacement",
    parts: null,
    published: [2000, 10000],
    source: {
      name: "J.D. Power",
      url: "https://www.jdpower.com/cars/shopping-guides/how-much-does-it-cost-to-replace-a-car-engine",
      year: "2025",
    },
    note: "Can run higher for luxury and sports cars.",
  },
  "Cooling System": {
    repair: "Water pump replacement",
    parts: [525, 598],
    published: [891, 1135],
    source: repairPal("water-pump-replacement-cost"),
    note: REPAIRPAL_NOTE,
  },
  "Fuel System": {
    repair: "Fuel pump replacement",
    parts: null,
    published: [1150, 1400],
    source: AAA_FUEL_PUMP,
    note: "AAA figure for most vehicles, parts and labor.",
  },
  "Hybrid System": {
    repair: "Hybrid high-voltage battery replacement",
    parts: [4434, 4434],
    published: [4856, 5053],
    source: repairPal("hybrid-high-voltage-battery-replacement-cost"),
    note: REPAIRPAL_NOTE,
  },
  "EV Battery / Motor": {
    repair: "EV battery replacement",
    parts: null,
    published: [5000, 20000],
    source: {
      name: "AAA",
      url: "https://www.aaa.com/autorepair/articles/how-much-does-an-ev-battery-replacement-cost",
      year: null,
    },
    note: "Varies mainly with battery pack size; large packs can exceed $20,000.",
  },
  "Brakes": {
    repair: "Brake pads and rotors, one axle",
    parts: null,
    published: [250, 500],
    source: { name: "AAA", url: "https://www.aaa.com/autorepair/articles/how-much-to-replace-brake-pads", year: null },
    note: "Per axle, parts and labor.",
  },
  "Electrical": {
    repair: "Alternator replacement",
    parts: [613, 800],
    published: [809, 1088],
    source: repairPal("alternator-replacement-cost"),
    note: `${REPAIRPAL_NOTE} Copies of this page showed slightly different ranges.`,
  },
  "Airbags": {
    repair: "Airbag clockspring replacement",
    parts: [387, 387],
    published: [510, 567],
    source: repairPal("air-bag-clockspring-replacement-cost", null),
    note: REPAIRPAL_NOTE,
  },
  "Steering": {
    repair: "Rack and pinion replacement",
    parts: [1770, 1784],
    published: [2307, 2572],
    source: repairPal("rack-and-pinion-replacement-cost"),
    note: REPAIRPAL_NOTE,
  },
  "Suspension": {
    repair: "Shock or strut replacement",
    parts: [812, 862],
    published: [1144, 1348],
    source: repairPal("suspension-shock-or-strut-replacement-cost", null),
    note: `${REPAIRPAL_NOTE} The source doesn't say whether this is per pair.`,
  },
  "Acceleration / Cruise Control": {
    repair: "Throttle body replacement",
    parts: [492, 573],
    published: [623, 766],
    source: repairPal("throttle-body-replacement-cost"),
    note: REPAIRPAL_NOTE,
  },
  "Driver Assistance": {
    repair: "Front radar sensor replacement and calibration",
    parts: null,
    published: [500, 1300],
    source: AAA_ADAS,
    note: "AAA ADAS repair study.",
  },
  "Seats": {
    repair: "Power seat motor replacement",
    parts: [510, 510],
    published: [649, 714],
    source: repairPal("power-seat-motor-replacement-cost"),
    note: REPAIRPAL_NOTE,
  },
  "Tires": {
    repair: "Single tire replacement",
    parts: [212, 212],
    published: null,
    source: {
      name: "Consumer Reports",
      url: "https://www.consumerreports.org/cars/tire-buying-maintenance/how-to-save-money-when-buying-replacement-tires-a6799675738/",
      year: "2026",
    },
    note: "Average price paid per tire. Median installation was $31 per tire, and over half of buyers got it free.",
  },
  "Wheels / Hubs": {
    repair: "Wheel bearing replacement",
    parts: [121, 172],
    published: [346, 504],
    source: repairPal("wheel-bearing-replacement-cost"),
    note: REPAIRPAL_NOTE,
  },
  "Windows / Windshield": {
    repair: "Windshield wiper motor replacement",
    parts: [372, 377],
    published: [488, 547],
    source: repairPal("windshield-wiper-motor-replacement-cost"),
    note: REPAIRPAL_NOTE,
  },
  "Lights": {
    repair: "Headlight assembly replacement",
    parts: [30, 4000],
    published: null,
    source: {
      name: "AutoZone",
      url: "https://www.autozone.com/diy/headlight/how-much-does-it-cost-to-replace-a-headlight",
      year: null,
    },
    note: "Parts vary hugely by vehicle; sealed modern units often exceed $1,000. AutoZone puts shop labor at $100–$400.",
  },
  "Doors / Locks": {
    repair: "Door lock actuator replacement",
    parts: [236, 271],
    published: [381, 484],
    source: repairPal("door-lock-actuator-replacement-cost", null),
    note: REPAIRPAL_NOTE,
  },
};

/** Look up the estimate for a problem category (see lib/categories.ts). Null = no credible published figure. */
export function estimateFor(category: string): RepairEstimate | null {
  return TABLE[category] ?? null;
}

export type CostView = {
  parts: Range | null;
  hours: Range | null;
  labor: Range | null;
  total: Range | null;
  /** "computed" = published parts + standard hours × rate; "published" = the source's own total. */
  totalBasis: "computed" | "published" | null;
};

export function costView(e: RepairEstimate, rate: number): CostView {
  if (e.parts) {
    const hours = STANDARD_LABOR_HOURS;
    const labor: Range = [hours[0] * rate, hours[1] * rate];
    return { parts: e.parts, hours, labor, total: [e.parts[0] + labor[0], e.parts[1] + labor[1]], totalBasis: "computed" };
  }
  // Source gives only a combined parts-and-labor total: show it as-is rather than mixing in our labor figure.
  return { parts: null, hours: null, labor: null, total: e.published, totalBasis: e.published ? "published" : null };
}
