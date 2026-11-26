"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import GlobalErrorBanner, { type GlobalAlert } from "@/components/GlobalErrorBanner";
import { formatAUD } from "@/lib/format";

interface VehicleOption {
  id: string;
  registration: string;
  make: string | null;
  model: string;
  year: number | null;
  colour: string | null;
  status: string;
  weeklyRent: number | string;
  bond: number | string;
  excess: number | string;
  kmAllowance: string;
  contracts: Array<{ driver: { name: string } }>;
}

interface DriverOption {
  id: string;
  name: string;
  mobile: string;
  status: string;
  contracts: Array<{
    vehicle: { registration: string; model: string };
  }>;
}

interface RentalForm {
  agreementDate: string;
  startDate: string;
  endDate: string;
  weeklyRent: string;
  bond: string;
  excess: string;
  kmAllowance: string;
  term: string;
  noticePeriod: string;
  paymentFrequency: string;
  paymentMethod: "Bank Transfer" | "PayID";
  rideshareUse: boolean;
  privateUse: boolean;
}

function melbourneToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default function NewRentalPage() {
  const today = useMemo(melbourneToday, []);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [form, setForm] = useState<RentalForm>({
    agreementDate: today,
    startDate: today,
    endDate: "",
    weeklyRent: "",
    bond: "500",
    excess: "0",
    kmAllowance: "Unlimited",
    term: "Month to month",
    noticePeriod: "7 days",
    paymentFrequency: "Weekly in advance",
    paymentMethod: "Bank Transfer",
    rideshareUse: true,
    privateUse: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<GlobalAlert | null>(null);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setAlert(null);
    try {
      const [vehicleResponse, driverResponse] = await Promise.all([
        fetch("/api/vehicles", { cache: "no-store" }),
        fetch("/api/drivers", { cache: "no-store" }),
      ]);
      const [vehicleBody, driverBody] = await Promise.all([
        vehicleResponse.json(),
        driverResponse.json(),
      ]) as [
        { vehicles?: VehicleOption[]; error?: string },
        { drivers?: DriverOption[]; error?: string },
      ];
      if (!vehicleResponse.ok) throw new Error(vehicleBody.error ?? "Could not load vehicles.");
      if (!driverResponse.ok) throw new Error(driverBody.error ?? "Could not load drivers.");
      setVehicles(vehicleBody.vehicles ?? []);
      setDrivers(driverBody.drivers ?? []);
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Rental options unavailable",
        message: error instanceof Error ? error.message : "Could not load vehicle and driver options.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;
  const selectedDriver = drivers.find((driver) => driver.id === driverId) ?? null;

  function updateForm(field: keyof RentalForm, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseVehicle(id: string) {
    const vehicle = vehicles.find((item) => item.id === id);
    setVehicleId(id);
    if (!vehicle) return;
    setForm((current) => ({
      ...current,
      weeklyRent: vehicle.weeklyRent.toString(),
      bond: vehicle.bond.toString(),
      excess: vehicle.excess.toString(),
      kmAllowance: vehicle.kmAllowance,
    }));
  }

  async function createRental(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vehicleId || !driverId) {
      setAlert({
        tone: "error",
        title: "Choose a vehicle and driver",
        message: "Complete the first two steps before creating a rental.",
      });
      return;
    }

    setSubmitting(true);
    setAlert(null);
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          driverId,
          ...form,
          initialEndDate: form.endDate || null,
        }),
      });
      const body = (await response.json()) as {
        contract?: { id: string };
        error?: string;
        details?: string;
      };
      if (!response.ok) {
        throw new Error([body.error, body.details].filter(Boolean).join(" ") || "Could not create rental.");
      }
      if (!body.contract?.id) throw new Error("Rental was created but the contract view was not returned.");
      window.location.assign(`/contracts/${body.contract.id}`);
    } catch (error) {
      await loadOptions();
      setAlert({
        tone: "error",
        title: "Rental could not be created",
        message: error instanceof Error ? error.message : "Could not create rental.",
      });
      setSubmitting(false);
    }
  }

  const availableVehicles = vehicles.filter((vehicle) => vehicle.contracts.length === 0);
  const availableDrivers = drivers.filter((driver) => driver.contracts.length === 0);

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>New Rental</h1>
          <p>Create a rental agreement in three steps.</p>
        </div>
      </div>

      <GlobalErrorBanner alert={alert} onDismissAlert={() => setAlert(null)} />

      <ol className="rental-steps" aria-label="Rental steps">
        {["Choose vehicle", "Choose driver", "Agreement details"].map((label, index) => (
          <li key={label} className={step === index + 1 ? "rental-steps__active" : ""}>
            <span>Step {index + 1}</span>{label}
          </li>
        ))}
      </ol>

      {loading ? (
        <p role="status">Loading available vehicles and drivers…</p>
      ) : (
        <>
          {step === 1 ? (
            <section className="register-form" aria-labelledby="rental-vehicle-title">
              <h2 id="rental-vehicle-title">Step 1: Choose a vehicle</h2>
              <label className="rental-field">
                Vehicle *
                <select value={vehicleId} onChange={(event) => chooseVehicle(event.target.value)} required>
                  <option value="">Select a vehicle</option>
                  {vehicles.map((vehicle) => {
                    const activeContract = vehicle.contracts[0];
                    return (
                      <option key={vehicle.id} value={vehicle.id} disabled={Boolean(activeContract)}>
                        {vehicle.registration} · {vehicle.year ? `${vehicle.year} ` : ""}{vehicle.make ? `${vehicle.make} ` : ""}{vehicle.model}{vehicle.colour ? ` · ${vehicle.colour}` : ""}
                        {activeContract ? ` — Currently rented by ${activeContract.driver.name}` : ""}
                      </option>
                    );
                  })}
                </select>
                <span className="form-hint">Only vehicles with no active rental are selectable</span>
              </label>
              {selectedVehicle ? (
                <div className="rental-summary">
                  <span>Weekly rent: {formatAUD(selectedVehicle.weeklyRent)}</span>
                  <span>Bond: {formatAUD(selectedVehicle.bond)}</span>
                  <span>Excess: {formatAUD(selectedVehicle.excess)}</span>
                  <span>KM allowance: {selectedVehicle.kmAllowance}</span>
                </div>
              ) : null}
              {availableVehicles.length === 0 ? (
                <p className="form-hint">All vehicles currently have active rentals.</p>
              ) : null}
              <div className="register-form__actions">
                <button className="button button--primary" type="button" disabled={!vehicleId} onClick={() => setStep(2)}>
                  Continue to choose driver
                </button>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="register-form" aria-labelledby="rental-driver-title">
              <h2 id="rental-driver-title">Step 2: Choose a driver</h2>
              <p>Vehicle: <strong>{selectedVehicle?.registration} · {selectedVehicle?.model}</strong></p>
              <label className="rental-field">
                Driver *
                <select value={driverId} onChange={(event) => setDriverId(event.target.value)} required>
                  <option value="">Select a driver</option>
                  {drivers.map((driver) => {
                    const activeContract = driver.contracts[0];
                    return (
                      <option key={driver.id} value={driver.id} disabled={Boolean(activeContract)}>
                        {driver.name} · {driver.mobile}
                        {activeContract
                          ? ` — Currently with ${activeContract.vehicle.registration}`
                          : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              {availableDrivers.length === 0 ? (
                <p className="form-hint">All drivers currently have active rentals.</p>
              ) : null}
              <div className="register-form__actions">
                <button className="button button--secondary" type="button" onClick={() => setStep(1)}>Back to vehicle selection</button>
                <button className="button button--primary" type="button" disabled={!driverId} onClick={() => setStep(3)}>
                  Continue to agreement details
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <form className="register-form" onSubmit={createRental}>
              <h2>Step 3: Agreement details</h2>
              <p>
                Vehicle: <strong>{selectedVehicle?.registration}</strong> · Driver:{" "}
                <strong>{selectedDriver?.name}</strong>
              </p>

              <fieldset className="form-section">
                <legend className="form-section__title">Dates</legend>
                <div className="form-section__grid">
                  <label>
                    Agreement date *
                    <input type="date" required value={form.agreementDate} onChange={(event) => updateForm("agreementDate", event.target.value)} />
                    <span className="form-hint">Date the agreement is signed (defaults to today)</span>
                  </label>
                  <label>
                    Start date *
                    <input type="date" required value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} />
                    <span className="form-hint">Date driver takes possession of vehicle</span>
                  </label>
                  <label>
                    End date
                    <input type="date" value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} />
                    <span className="form-hint">Optional fixed end date (leave blank for ongoing month-to-month)</span>
                  </label>
                </div>
              </fieldset>

              <fieldset className="form-section">
                <legend className="form-section__title">Financial Terms</legend>
                <div className="form-section__grid">
                  <label>
                    Weekly rent (AUD) *
                    <input type="number" min="0" step="0.01" required value={form.weeklyRent} onChange={(event) => updateForm("weeklyRent", event.target.value)} />
                    <span className="form-hint">Pre-filled from vehicle; adjust if negotiated</span>
                  </label>
                  <label>
                    Bond (AUD)
                    <input type="number" min="0" step="0.01" value={form.bond} onChange={(event) => updateForm("bond", event.target.value)} />
                    <span className="form-hint">Security deposit (pre-filled from vehicle, default $500)</span>
                  </label>
                  <label>
                    Excess (AUD)
                    <input type="number" min="0" step="0.01" value={form.excess} onChange={(event) => updateForm("excess", event.target.value)} />
                    <span className="form-hint">Driver liability for damage (pre-filled from vehicle, default $0)</span>
                  </label>
                  <label>
                    KM allowance
                    <input value={form.kmAllowance} onChange={(event) => updateForm("kmAllowance", event.target.value)} />
                    <span className="form-hint">e.g. Unlimited, 1000km/week (pre-filled from vehicle)</span>
                  </label>
                </div>
              </fieldset>

              <fieldset className="form-section">
                <legend className="form-section__title">Agreement Terms</legend>
                <div className="form-section__grid">
                  <label>
                    Ongoing term
                    <input value={form.term} onChange={(event) => updateForm("term", event.target.value)} />
                    <span className="form-hint">e.g. Month to month, 6 months, 12 months</span>
                  </label>
                  <label>
                    Notice period
                    <input value={form.noticePeriod} onChange={(event) => updateForm("noticePeriod", event.target.value)} />
                    <span className="form-hint">Notice required to end agreement (e.g. 7 days, 14 days)</span>
                  </label>
                  <label>
                    Payment frequency
                    <input value={form.paymentFrequency} onChange={(event) => updateForm("paymentFrequency", event.target.value)} />
                    <span className="form-hint">e.g. Weekly in advance, Fortnightly in advance</span>
                  </label>
                </div>
              </fieldset>

              <fieldset className="form-section">
                <legend className="form-section__title">Payment & Usage</legend>
                <div className="form-section__grid">
                  <label>
                    Payment method
                    <select value={form.paymentMethod} onChange={(event) => updateForm("paymentMethod", event.target.value === "PayID" ? "PayID" : "Bank Transfer")}>
                      <option>Bank Transfer</option>
                      <option>PayID</option>
                    </select>
                    <span className="form-hint">How rent payments are made</span>
                  </label>
                  <label>
                    Rideshare use
                    <select value={form.rideshareUse ? "Yes" : "No"} onChange={(event) => updateForm("rideshareUse", event.target.value === "Yes")}>
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                    <span className="form-hint">Driver may use vehicle for Uber/Ola/Didi etc.</span>
                  </label>
                  <label>
                    Private use
                    <select value={form.privateUse ? "Yes" : "No"} onChange={(event) => updateForm("privateUse", event.target.value === "Yes")}>
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                    <span className="form-hint">Driver may use vehicle for personal trips</span>
                  </label>
                </div>
              </fieldset>

              <div className="register-form__actions">
                <button className="button button--secondary" type="button" onClick={() => setStep(2)} disabled={submitting}>Back to driver selection</button>
                <button className="button button--primary" type="submit" disabled={submitting}>
                  {submitting ? "Creating rental…" : "Create rental agreement"}
                </button>
                <Link className="button button--secondary" href="/contracts">Cancel</Link>
              </div>
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
