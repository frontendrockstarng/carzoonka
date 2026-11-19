# Vehicle Insight

Research NHTSA owner complaints and recalls for a vehicle, for service contract retention specialists.

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

## How it works

- `src/lib/parse-vehicle.ts` splits pasted text ("2019 Toyota Camry") into year / make / model; users can edit before searching.
- `GET /api/vehicle?year=&make=&model=` (`src/app/api/vehicle/route.ts`) calls NHTSA live, with no caching and no mock data:
  - `api.nhtsa.gov/complaints/complaintsByVehicle`: owner-reported complaints (unverified)
  - `api.nhtsa.gov/recalls/recallsByVehicle`: recalls (confirmed defects); a failure here doesn't block complaints
  - `api.nhtsa.gov/products/vehicle/models`: only when nothing is found, to suggest NHTSA's model names
- Investigations aren't summarized: NHTSA's `/investigations` endpoint ignores vehicle filters, so the UI links to the vehicle's NHTSA.gov page instead.

## NHTSA data quirks handled

- Complaint `components` are joined with bare commas, but names can contain ", " (e.g. "FUEL SYSTEM, GASOLINE"), so the code splits only on `,` not followed by a space.
- Complaint dates are `MM/DD/YYYY`; recall `ReportReceivedDate` is `DD/MM/YYYY`.
