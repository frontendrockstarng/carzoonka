"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseVehicle, type VehicleQuery } from "@/lib/parse-vehicle";

type Props = {
  value: VehicleQuery;
  onChange: (v: VehicleQuery) => void;
  onSearch: (v: VehicleQuery) => void;
  loading: boolean;
};

export function VehicleSearch({ value, onChange, onSearch, loading }: Props) {
  const [raw, setRaw] = useState("");
  const ready = /^\d{4}$/.test(value.year) && value.make.trim() !== "" && value.model.trim() !== "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ready && !loading) onSearch(value);
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-card p-4 sm:p-5">
      <label htmlFor="vehicle" className="text-sm font-medium">
        Vehicle
      </label>
      <Input
        id="vehicle"
        autoFocus
        autoComplete="off"
        placeholder='Paste a vehicle, e.g. "2019 Toyota Camry"'
        className="mt-1.5 h-10"
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          onChange(parseVehicle(e.target.value));
        }}
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[110px_1fr_1fr_auto] sm:items-end">
        <Field label="Year" id="year">
          <Input
            id="year"
            inputMode="numeric"
            maxLength={4}
            placeholder="2019"
            value={value.year}
            onChange={(e) => onChange({ ...value, year: e.target.value.replace(/\D/g, "") })}
          />
        </Field>
        <Field label="Make" id="make">
          <Input
            id="make"
            placeholder="TOYOTA"
            value={value.make}
            onChange={(e) => onChange({ ...value, make: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="Model" id="model">
          <Input
            id="model"
            placeholder="CAMRY"
            value={value.model}
            onChange={(e) => onChange({ ...value, model: e.target.value.toUpperCase() })}
          />
        </Field>
        <Button type="submit" disabled={!ready || loading} className="h-9 px-4">
          {loading ? <Loader2 className="animate-spin" /> : <Search />}
          Search NHTSA
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Check the extracted details. Use the model name NHTSA uses, without trim levels (e.g. &ldquo;CAMRY&rdquo;, not
        &ldquo;CAMRY SE&rdquo;).
      </p>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
