export type VehicleQuery = { year: string; make: string; model: string };

// Makes whose names span more than one word, so "Land Rover Defender" isn't read as make "Land".
const MULTI_WORD_MAKES = [
  "ALFA ROMEO",
  "ASTON MARTIN",
  "LAND ROVER",
  "MERCEDES BENZ",
  "ROLLS ROYCE",
];

// Common shorthand -> the make name NHTSA uses.
const MAKE_ALIASES: Record<string, string> = {
  CHEVY: "CHEVROLET",
  VW: "VOLKSWAGEN",
  MERCEDES: "MERCEDES-BENZ",
  "MERCEDES BENZ": "MERCEDES-BENZ",
  BENZ: "MERCEDES-BENZ",
  MB: "MERCEDES-BENZ",
  "ROLLS ROYCE": "ROLLS-ROYCE",
  LANDROVER: "LAND ROVER",
};

const YEAR_RE = /\b(19[5-9]\d|20\d{2})\b/;

/** Best-effort split of free text like "2019 Toyota Camry" into year / make / model. */
export function parseVehicle(input: string): VehicleQuery {
  let text = input.replace(/[,|/]+/g, " ").replace(/\s+/g, " ").trim();

  let year = "";
  const yearMatch = text.match(YEAR_RE);
  if (yearMatch) {
    year = yearMatch[1];
    text = text.replace(yearMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  const upper = text.toUpperCase();
  const normalized = upper.replace(/-/g, " ");
  let make = "";
  let rest = "";

  const multi = MULTI_WORD_MAKES.find((m) => normalized === m || normalized.startsWith(m + " "));
  if (multi) {
    const wordCount = multi.split(" ").length;
    make = multi;
    // Skip the tokens that make up the make (which may be hyphenated), keep the model as typed.
    const tokens = upper.split(" ");
    let consumed = 0;
    let i = 0;
    while (i < tokens.length && consumed < wordCount) {
      consumed += tokens[i].split("-").length;
      i++;
    }
    rest = tokens.slice(i).join(" ");
  } else {
    const [first = "", ...others] = upper.split(" ");
    make = first;
    rest = others.join(" ");
  }

  make = MAKE_ALIASES[make] ?? make;
  return { year, make, model: rest.trim() };
}
