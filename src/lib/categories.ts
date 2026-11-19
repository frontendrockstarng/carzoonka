// Plain-language problem categories (Transmission, Engine, AC / Heater, ...) derived from NHTSA data.
//
// NHTSA tags each complaint with broad component codes. Most map directly to a category. Two codes are
// too vague to be useful on their own, so for those we read the owner's description:
// - "POWER TRAIN" covers transmission, drivetrain and some engine issues; transmission words ("shift",
//   "gear", "CVT", ...) -> Transmission, then drivetrain / cooling / engine words, else Powertrain (General).
// - "UNKNOWN OR OTHER" is sorted by keywords (sunroof, A/C, radio, ...), falling back to Other.

const DIRECT: Record<string, string> = {
  ENGINE: "Engine",
  "FUEL/PROPULSION SYSTEM": "Fuel System",
  "FUEL SYSTEM": "Fuel System",
  "HYBRID PROPULSION SYSTEM": "Hybrid System",
  "ELECTRIC POWER PROPULSION SYSTEM": "EV Battery / Motor",
  "SERVICE BRAKES": "Brakes",
  "PARKING BRAKE": "Brakes",
  "ELECTRONIC STABILITY CONTROL (ESC)": "Brakes",
  "ELECTRICAL SYSTEM": "Electrical",
  "AIR BAGS": "Airbags",
  "SEAT BELTS": "Seat Belts",
  SEATS: "Seats",
  STEERING: "Steering",
  SUSPENSION: "Suspension",
  "VEHICLE SPEED CONTROL": "Acceleration / Cruise Control",
  "FORWARD COLLISION AVOIDANCE": "Driver Assistance",
  "LANE DEPARTURE": "Driver Assistance",
  "BACK OVER PREVENTION": "Driver Assistance",
  TIRES: "Tires",
  WHEELS: "Wheels / Hubs",
  VISIBILITY: "Windows / Windshield",
  "VISIBILITY/WIPER": "Windows / Windshield",
  "EXTERIOR LIGHTING": "Lights",
  "LATCHES/LOCKS/LINKAGES": "Doors / Locks",
  STRUCTURE: "Body / Structure",
  EQUIPMENT: "Accessories",
  "EQUIPMENT ADAPTIVE/MOBILITY": "Accessories",
  COMMUNICATION: "Accessories",
  "TRAILER HITCHES": "Accessories",
};

const TRANSMISSION_RE =
  /\b(transmissions?|trans\b|shift(s|ed|ing)?|downshift\w*|upshift\w*|gears?|gearbox|cvt|slip(s|ped|ping)?|clutch|torque converter|valve body|solenoid)/i;
const COOLING_RE = /\b(coolant|radiator|water pump|overheat\w*|thermostat|antifreeze)/i;
const DRIVETRAIN_RE =
  /\b(axles?|cv joint|cv axle|differential|transfer case|drive\s?shaft|drive\s?train|awd|4wd|all[- ]wheel drive|four[- ]wheel drive|u[- ]joint|wheel hub)/i;
const ENGINE_RE = /\b(engine|turbo\w*|oil consumption|burning oil|oil burning|misfire\w*|stall\w*|piston|cylinder|timing chain|spark plug)/i;

// Order matters: first match wins for "UNKNOWN OR OTHER" complaints.
const OTHER_RULES: [string, RegExp][] = [
  ["Transmission", TRANSMISSION_RE],
  ["AC / Heater", /\b(a\/c|ac\b|air condition\w*|heater|heating|hvac|defrost\w*|blower|compressor|climate control)/i],
  ["Body / Structure", /\b(sun\s?roof|moon\s?roof|panoramic|roof|paint|rust|corrosion|trim|bumper|hood)/i],
  ["Infotainment / Electronics", /\b(radio|infotainment|screen|display|bluetooth|navigation|carplay|android auto|speaker|backup camera|touch\s?screen)/i],
  ["Windows / Windshield", /\b(windshield|window|wiper|mirror)/i],
  ["Doors / Locks", /\b(door|lock|latch|trunk|lift\s?gate|tailgate)/i],
  ["Cooling System", COOLING_RE],
  ["Engine", ENGINE_RE],
  ["Electrical", /\b(battery|alternator|electrical|wiring|fuse)/i],
  ["Brakes", /\b(brakes?|braking|abs)\b/i],
];

/** Categories for one complaint, from its NHTSA component codes and (for vague codes) its description. */
export function categorize(components: string[], summary: string): string[] {
  const out = new Set<string>();
  for (const raw of components) {
    const code = raw.trim().toUpperCase();
    if (code === "POWER TRAIN") {
      if (TRANSMISSION_RE.test(summary)) out.add("Transmission");
      else if (DRIVETRAIN_RE.test(summary)) out.add("Drivetrain");
      else if (COOLING_RE.test(summary)) out.add("Cooling System");
      else if (ENGINE_RE.test(summary)) out.add("Engine");
      else out.add("Powertrain (General)");
    } else if (code === "ENGINE AND ENGINE COOLING") {
      out.add(COOLING_RE.test(summary) ? "Cooling System" : "Engine");
    } else if (code === "UNKNOWN OR OTHER") {
      out.add(OTHER_RULES.find(([, re]) => re.test(summary))?.[0] ?? "Other");
    } else {
      out.add(DIRECT[code] ?? DIRECT[code.split(", ")[0]] ?? "Other");
    }
  }
  return out.size ? [...out] : ["Other"];
}

export const CATEGORY_METHOD_NOTE =
  "Categories come from NHTSA's component codes. Complaints NHTSA files under the broad \"Power Train\" or \"Unknown or Other\" codes are sorted by keywords in the owner's description (e.g. \"shifting\" or \"CVT\" → Transmission).";
