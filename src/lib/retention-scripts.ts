// Conversational retention talk tracks for vehicle service contract specialists.
//
// Every script is filled from real data only: the NHTSA complaint count for the selected component
// and the estimated repair cost shown on screen. Guardrails, on purpose:
// - Never claims the customer's car WILL fail; complaints are owner reports, not proof of a defect.
// - Never promises coverage; it always defers to the customer's actual contract.
// - Costs are always spoken as rough estimates.

export type ScriptContext = {
  vehicle: string; // e.g. "2019 Toyota Camry"
  component: string; // e.g. "Engine"
  repair: string | null; // e.g. "Engine replacement (remanufactured)"
  complaints: number; // complaints naming this component
  totalComplaints: number; // all complaints for the vehicle
  rank: number; // 1 = most-reported component for this vehicle
  cost: [number, number] | null; // estimated total repair cost
  laborRate: number;
  laborHours: [number, number] | null;
  parts: [number, number] | null;
};

const SPOKEN: Record<string, string> = {
  Electrical: "electrical system",
  "Driver Assistance": "driver-assistance features",
  "Powertrain (General)": "powertrain",
  "Body / Structure": "body",
  "Infotainment / Electronics": "infotainment system",
  "Windows / Windshield": "windows and windshield",
  "EV Battery / Motor": "EV battery and motor",
  Other: "other parts of the car",
};

export type RetentionScript ={ id: string; title: string; when: string; text: string };

/** "$3,620" -> spoken "about $3,600"; keeps figures human and avoids false precision. */
function money(n: number) {
  const rounded = n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10;
  return "$" + rounded.toLocaleString("en-US");
}

function spokenRange([lo, hi]: [number, number]) {
  return money(lo) === money(hi) ? money(lo) : `${money(lo)} to ${money(hi)}`;
}

function costPhrase(cost: [number, number]) {
  return `somewhere around ${spokenRange(cost)}`;
}

function times(n: number) {
  return n === 1 ? "one complaint" : `${n.toLocaleString("en-US")} complaints`;
}

export function retentionScripts(c: ScriptContext): RetentionScript[] {
  // Category name as it sounds in a sentence: "owners filed complaints about the ___".
  const part =
    SPOKEN[c.component] ??
    c.component
      .replace(/ \/ /g, " and ")
      .toLowerCase()
      .replace(/\b(ac|ev)\b/g, (m) => m.toUpperCase());
  const share = c.totalComplaints > 0 ? Math.round((c.complaints / c.totalComplaints) * 100) : 0;
  // Parentheticals like "(remanufactured)" read awkwardly out loud.
  const repair = c.repair ? c.repair.replace(/\s*\([^)]*\)/g, "").toLowerCase() : `a ${part} repair`;
  const topIssue = c.rank <= 3;
  const hasCost = c.cost !== null;

  const scripts: RetentionScript[] = [
    {
      id: "empathy",
      title: "Empathetic check-in",
      when: "Opening the conversation; the customer sounds unsure or busy.",
      text: [
        `Hi [Customer name], thanks for taking a minute with me. I totally get wanting to trim monthly costs, honestly, I'd be looking at the same thing.`,
        `Before you decide, can I share one thing I noticed about your ${c.vehicle}? Owners have filed ${times(c.complaints)} with the federal safety agency, NHTSA, about the ${part}. That doesn't mean yours is going to have a problem, a lot of these cars run just fine.`,
        hasCost
          ? `But if it ever does, ${repair} tends to run ${costPhrase(c.cost!)}. And that kind of bill never seems to show up at a convenient time, does it?`
          : `But when something does go wrong there, it's rarely a quick, cheap fix, and it never seems to happen at a convenient time, does it?`,
        `So I just want to make sure, whatever you decide, you're deciding with that in mind. How are you feeling about it?`,
      ].join("\n\n"),
    },
    {
      id: "owners",
      title: "What other owners are saying",
      when: "The customer feels their car is reliable and doesn't need the plan.",
      text: [
        `I hear you, and it's great that the car's been treating you well. Honestly, that's how most owners feel, right up until something changes.`,
        `I actually pulled up the public complaint records for the ${c.vehicle} while we were talking. The ${part} comes up in ${times(c.complaints)}, that's about ${share}% of everything owners have reported for this model.`,
        `These are real people, a lot of them saying the same thing: "everything was fine, and then one day it wasn't."`,
        hasCost
          ? `When that happens, you're usually looking at ${costPhrase(c.cost!)} for ${repair}.`
          : `And when it happens, it's usually not a small bill.`,
        `I'm not saying that'll be you. I'd just hate for you to give up the protection right before you need it. Does that make sense?`,
      ].join("\n\n"),
    },
    hasCost
      ? {
          id: "math",
          title: "Walk through the numbers",
          when: "Price-focused customers; the plan feels expensive.",
          text: [
            `Totally fair to look at the cost, so let's actually put the numbers side by side real quick.`,
            topIssue
              ? `On your ${c.vehicle}, one of the most reported problem areas is the ${part}. The typical fix there is ${repair}.`
              : `On your ${c.vehicle}, owners have filed ${times(c.complaints)} about the ${part}. The typical fix there is ${repair}.`,
            c.parts && c.laborHours
              ? `Parts alone usually land around ${spokenRange(c.parts)}. Then labor: shops are charging roughly $${c.laborRate.toLocaleString("en-US")} an hour these days, and a job like that can take ${c.laborHours[0]} to ${c.laborHours[1]} hours. All in, you're looking at ${costPhrase(c.cost!)}.`
              : `All in, parts and labor, that's typically ${costPhrase(c.cost!)}.`,
            `Now put that next to what the plan costs you over a year, which is [plan cost]. If it's a covered repair, that's money that stays in your pocket instead of going to the shop. How does that stack up for you?`,
            `Would it help if I checked exactly what your contract covers for the ${part}?`,
          ].join("\n\n"),
        }
      : null,
    {
      id: "peace",
      title: "Peace of mind",
      when: "Customers who worry about surprises or have a tight budget.",
      text: [
        `Can I ask you something? If your car went into the shop tomorrow, what would that do to your month?`,
        hasCost
          ? `I ask because on the ${c.vehicle}, the ${part} is ${topIssue ? "one of the things owners report most" : "something owners report"}, ${times(c.complaints)} so far, and ${repair} usually runs ${costPhrase(c.cost!)}.`
          : `I ask because on the ${c.vehicle}, the ${part} is something owners report a lot, ${times(c.complaints)} so far.`,
        `That's really what this plan is about. It's less about the car and more about you not having to pull from savings or put a big repair on a credit card when you least expect it.`,
        `A lot of my customers tell me the best part is just not having to think about it. Would keeping that peace of mind be worth it to you?`,
      ].join("\n\n"),
    },
    {
      id: "objection",
      title: '"I\'ll just take my chances"',
      when: "The customer has decided to self-insure or put money aside instead.",
      text: [
        `Honestly, that's a fair plan, and some people do it really well. Can I just share one thing to think about?`,
        hasCost
          ? `With the ${c.vehicle}, owners have reported ${times(c.complaints)} about the ${part}. If that's the one that goes, ${repair} usually comes to ${costPhrase(c.cost!)}. That's a lot to have sitting ready in a repair fund on day one.`
          : `With the ${c.vehicle}, owners have reported ${times(c.complaints)} about the ${part}, and repairs in that area can get expensive fast.`,
        `The tricky part with taking your chances is timing. The repair doesn't wait until the savings account is ready.`,
        `If you'd like, we can look at a lower-cost option that still covers the big stuff, so you're not all-or-nothing. Want me to walk you through that?`,
      ].join("\n\n"),
    },
  ].filter((s): s is RetentionScript => s !== null);

  return scripts;
}

/** "2019 TOYOTA CAMRY" -> "2019 Toyota Camry", keeping short/alphanumeric names like BMW, CR-V, RAV4 uppercase. */
export function speakableVehicle(year: string, make: string, model: string) {
  const word = (w: string) => (w.length <= 3 || /[\d-]/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase());
  return [year, ...`${make} ${model}`.split(/\s+/).map(word)].join(" ");
}
