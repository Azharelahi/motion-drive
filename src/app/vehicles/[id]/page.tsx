"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import GlobalErrorBanner, { type GlobalAlert } from "@/components/GlobalErrorBanner";
import DocumentPanel from "@/components/DocumentPanel";
import { formatAUD, formatDateAU } from "@/lib/format";

interface ContractSummary {
  id: string;
  contractNumber: string;
  status: string;
  startDate: string;
  endDate: string | null;
  weeklyRent: number | string;
  bond: number | string;
  excess: number | string;
  initialEndDate: string | null;
  term: string;
  noticePeriod: string;
  driver: {
    id: string;
    name: string;
    mobile: string;
  };
}

interface DocumentSummary {
  id: string;
  documentType: string;
  originalName: string;
  expiryDate: string | null;
  createdAt: string;
}

interface VehicleProfile {
  id: string;
  registration: string;
  make: string | null;
  model: string;
  fuelType: string | null;
  year: number | null;
  colour: string | null;
  vin: string | null;
  status: string;
  weeklyRent: number | string;
  bond: number | string;
  excess: number | string;
  kmAllowance: string;
  pickupLocation: string;
  odometer: number | null;
  nextServiceKm: number | null;
  registrationExpiry: string | null;
  insuranceExpiry: string | null;
  inspectionExpiry: string | null;
  notes: string | null;
  contracts: ContractSummary[];
  documents: DocumentSummary[];
}

interface EditForm {
  registration: string;
  make: string;
  model: string;
  fuelType: string;
  year: string;
  colour: string;
  vin: string;
  status: string;
  weeklyRent: string;
  bond: string;
  excess: string;
  kmAllowance: string;
  pickupLocation: string;
  odometer: string;
  nextServiceKm: string;
  registrationExpiry: string;
  insuranceExpiry: string;
  inspectionExpiry: string;
  notes: string;
}

function dateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function profileToEditForm(vehicle: VehicleProfile): EditForm {
  return {
    registration: vehicle.registration,
    make: vehicle.make ?? "",
    model: vehicle.model,
    fuelType: vehicle.fuelType ?? "",
    year: vehicle.year?.toString() ?? "",
    colour: vehicle.colour ?? "",
    vin: vehicle.vin ?? "",
    status: vehicle.status,
    weeklyRent: vehicle.weeklyRent.toString(),
    bond: vehicle.bond.toString(),
    excess: vehicle.excess.toString(),
    kmAllowance: vehicle.kmAllowance,
    pickupLocation: vehicle.pickupLocation,
    odometer: vehicle.odometer?.toString() ?? "",
    nextServiceKm: vehicle.nextServiceKm?.toString() ?? "",
    registrationExpiry: dateInput(vehicle.registrationExpiry),
    insuranceExpiry: dateInput(vehicle.insuranceExpiry),
    inspectionExpiry: dateInput(vehicle.inspectionExpiry),
    notes: vehicle.notes ?? "",
  };
}

export default function VehicleProfilePage() {
  const params = useParams<{ id: string }>();
  const vehicleId = params.id;
  const [vehicle, setVehicle] = useState<VehicleProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<GlobalAlert | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const loadVehicle = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`, { cache: "no-store" });
      const body = (await response.json()) as { vehicle?: VehicleProfile; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not load the vehicle.");
      if (!body.vehicle) throw new Error("Vehicle not found.");
      setVehicle(body.vehicle);
      setEditForm(profileToEditForm(body.vehicle));
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Vehicle profile unavailable",
        message: error instanceof Error ? error.message : "Could not load the vehicle.",
      });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void loadVehicle();
  }, [loadVehicle]);

  function updateEditField(field: keyof EditForm, value: string) {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm) return;
    setSubmitting(true);
    setAlert(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const body = (await response.json()) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error([body.error, body.details].filter(Boolean).join(" ") || "Could not update the vehicle.");
      }
      setEditing(false);
      setAlert({ tone: "success", title: "Vehicle updated", message: "The vehicle profile was saved." });
      await loadVehicle();
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : "Could not update the vehicle.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function quickUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm) return;
    setSubmitting(true);
    setAlert(null);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editForm.status,
          registrationExpiry: editForm.registrationExpiry,
          insuranceExpiry: editForm.insuranceExpiry,
          inspectionExpiry: editForm.inspectionExpiry,
          odometer: editForm.odometer,
          nextServiceKm: editForm.nextServiceKm,
        }),
      });
      const body = (await response.json()) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error([body.error, body.details].filter(Boolean).join(" ") || "Could not save quick update.");
      }
      setAlert({ tone: "success", title: "Quick update saved", message: "Vehicle status and maintenance fields were updated." });
      await loadVehicle();
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Quick update failed",
        message: error instanceof Error ? error.message : "Could not save quick update.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section>
        <p role="status">Loading vehicle profile…</p>
      </section>
    );
  }

  if (!vehicle || !editForm) {
    return (
      <section>
        <GlobalErrorBanner alert={alert} onDismissAlert={() => setAlert(null)} />
        <Link className="button button--secondary" href="/vehicles">Back to Vehicle Register</Link>
      </section>
    );
  }

  const activeContract = vehicle.contracts.find((contract) => contract.status === "Active");
  const currentContract = activeContract ?? vehicle.contracts[0] ?? null;

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>{vehicle.registration}</h1>
          <p>{vehicle.year ? `${vehicle.year} ` : ""}{vehicle.make ? `${vehicle.make} ` : ""}{vehicle.model}</p>
        </div>
        <button className="button button--primary" type="button" onClick={() => setEditing((value) => !value)}>
          {editing ? "Close edit" : "Edit Vehicle"}
        </button>
      </div>

      <GlobalErrorBanner alert={alert} onDismissAlert={() => setAlert(null)} />

      {editing ? (
        <form className="register-form" onSubmit={saveVehicle}>
          <h2>Edit vehicle</h2>

          <fieldset className="form-section">
            <legend className="form-section__title">Vehicle Identity</legend>
            <div className="form-section__grid">
              <label>
                Registration *
                <input required value={editForm.registration} onChange={(event) => updateEditField("registration", event.target.value)} />
                <span className="form-hint">VicRoads plate number (e.g. ABC123)</span>
              </label>
              <label>
                VIN
                <input value={editForm.vin} onChange={(event) => updateEditField("vin", event.target.value)} />
                <span className="form-hint">17-character Vehicle Identification Number</span>
              </label>
              <label>
                Make
                <input value={editForm.make} onChange={(event) => updateEditField("make", event.target.value)} />
                <span className="form-hint">Manufacturer brand (e.g. Toyota, Ford, Mazda)</span>
              </label>
              <label>
                Model *
                <input required value={editForm.model} onChange={(event) => updateEditField("model", event.target.value)} />
                <span className="form-hint">Vehicle model name (e.g. Corolla, Camry, Hilux)</span>
              </label>
              <label>
                Year
                <input type="number" min="1886" max="9999" value={editForm.year} onChange={(event) => updateEditField("year", event.target.value)} />
                <span className="form-hint">Manufacture year (e.g. 2022)</span>
              </label>
              <label>
                Colour
                <input value={editForm.colour} onChange={(event) => updateEditField("colour", event.target.value)} />
                <span className="form-hint">Exterior colour (e.g. White, Silver, Blue)</span>
              </label>
              <label>
                Fuel type
                <input value={editForm.fuelType} onChange={(event) => updateEditField("fuelType", event.target.value)} />
                <span className="form-hint">Petrol, Diesel, Hybrid, Electric, LPG</span>
              </label>
              <label>
                Status
                <select value={editForm.status} onChange={(event) => updateEditField("status", event.target.value)}>
                  <option>Available</option>
                  <option>Rented</option>
                  <option>Inactive</option>
                </select>
                <span className="form-hint">Available = ready to rent; Rented = currently on contract; Inactive = not in service</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend className="form-section__title">Rental Terms</legend>
            <div className="form-section__grid">
              <label>
                Weekly rent
                <input type="number" min="0" step="0.01" required value={editForm.weeklyRent} onChange={(event) => updateEditField("weeklyRent", event.target.value)} />
                <span className="form-hint">Rent amount per week in AUD (e.g. 350.00)</span>
              </label>
              <label>
                Bond
                <input type="number" min="0" step="0.01" value={editForm.bond} onChange={(event) => updateEditField("bond", event.target.value)} />
                <span className="form-hint">Security deposit amount (default $500)</span>
              </label>
              <label>
                Excess
                <input type="number" min="0" step="0.01" value={editForm.excess} onChange={(event) => updateEditField("excess", event.target.value)} />
                <span className="form-hint">Driver liability excess for damage (default $0)</span>
              </label>
              <label>
                KM allowance
                <input value={editForm.kmAllowance} onChange={(event) => updateEditField("kmAllowance", event.target.value)} />
                <span className="form-hint">e.g. Unlimited, 1000km/week, 5000km/month</span>
              </label>
              <label>
                Pickup location
                <input value={editForm.pickupLocation} onChange={(event) => updateEditField("pickupLocation", event.target.value)} />
                <span className="form-hint">Where driver collects the vehicle (default: Tarneit, VIC)</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend className="form-section__title">Maintenance & Compliance</legend>
            <div className="form-section__grid">
              <label>
                Odometer
                <input type="number" min="0" value={editForm.odometer} onChange={(event) => updateEditField("odometer", event.target.value)} />
                <span className="form-hint">Current odometer reading in km</span>
              </label>
              <label>
                Next service KM
                <input type="number" min="0" value={editForm.nextServiceKm} onChange={(event) => updateEditField("nextServiceKm", event.target.value)} />
                <span className="form-hint">Odometer reading when next service is due</span>
              </label>
              <label>
                Registration expiry
                <input type="date" value={editForm.registrationExpiry} onChange={(event) => updateEditField("registrationExpiry", event.target.value)} />
                <span className="form-hint">VicRoads registration expiry date</span>
              </label>
              <label>
                Insurance expiry
                <input type="date" value={editForm.insuranceExpiry} onChange={(event) => updateEditField("insuranceExpiry", event.target.value)} />
                <span className="form-hint">Comprehensive insurance policy expiry</span>
              </label>
              <label>
                Inspection expiry
                <input type="date" value={editForm.inspectionExpiry} onChange={(event) => updateEditField("inspectionExpiry", event.target.value)} />
                <span className="form-hint">RWC / roadworthy certificate expiry (if applicable)</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend className="form-section__title">Notes</legend>
            <label className="register-form__notes">
              Notes
              <textarea value={editForm.notes} onChange={(event) => updateEditField("notes", event.target.value)} />
              <span className="form-hint">Internal notes, damage records, special conditions</span>
            </label>
          </fieldset>

          <div className="register-form__actions">
            <button className="button button--primary" type="submit" disabled={submitting}>Save changes</button>
            <button className="button button--secondary" type="button" onClick={() => setEditing(false)} disabled={submitting}>Cancel editing</button>
          </div>
        </form>
      ) : null}

      <div className="profile-grid">
        <section className="profile-card">
          <h2>Vehicle information</h2>
          <dl className="detail-grid">
            <div><dt>Registration</dt><dd>{vehicle.registration}</dd></div>
            <div><dt>Make / Model</dt><dd>{vehicle.make ? `${vehicle.make} ` : ""}{vehicle.model}</dd></div>
            <div><dt>Fuel type</dt><dd>{vehicle.fuelType ?? "—"}</dd></div>
            <div><dt>Year</dt><dd>{vehicle.year ?? "—"}</dd></div>
            <div><dt>Colour</dt><dd>{vehicle.colour ?? "—"}</dd></div>
            <div><dt>VIN</dt><dd>{vehicle.vin ?? "—"}</dd></div>
            <div><dt>Status</dt><dd>{vehicle.status}</dd></div>
            <div><dt>Pickup</dt><dd>{vehicle.pickupLocation}</dd></div>
          </dl>
        </section>

        <section className="profile-card">
          <h2>Rental details</h2>
          <dl className="detail-grid">
            <div><dt>Current driver</dt><dd>{currentContract?.driver.name ?? "—"}</dd></div>
            <div><dt>Mobile</dt><dd>{currentContract?.driver.mobile ?? "—"}</dd></div>
            <div><dt>Taken since</dt><dd>{formatDateAU(currentContract?.startDate)}</dd></div>
            <div><dt>Weekly rent</dt><dd>{formatAUD(vehicle.weeklyRent)}</dd></div>
            <div><dt>Bond</dt><dd>{formatAUD(vehicle.bond)}</dd></div>
            <div><dt>Excess</dt><dd>{formatAUD(vehicle.excess)}</dd></div>
            <div><dt>Initial end date</dt><dd>{formatDateAU(currentContract?.initialEndDate)}</dd></div>
            <div><dt>Ongoing term</dt><dd>{currentContract?.term ?? "—"}</dd></div>
            <div><dt>Notice period</dt><dd>{currentContract?.noticePeriod ?? "—"}</dd></div>
          </dl>
        </section>
      </div>

      <form className="register-form" onSubmit={quickUpdate}>
        <h2>Quick Update</h2>

        <fieldset className="form-section">
          <legend className="form-section__title">Status & Compliance</legend>
          <div className="form-section__grid">
            <label>
              Status
              <select value={editForm.status} onChange={(event) => updateEditField("status", event.target.value)}>
                <option>Available</option>
                <option>Rented</option>
                <option>Inactive</option>
              </select>
              <span className="form-hint">Available = ready to rent; Rented = currently on contract; Inactive = not in service</span>
            </label>
            <label>
              Registration expiry
              <input type="date" value={editForm.registrationExpiry} onChange={(event) => updateEditField("registrationExpiry", event.target.value)} />
              <span className="form-hint">VicRoads registration expiry date</span>
            </label>
            <label>
              Insurance expiry
              <input type="date" value={editForm.insuranceExpiry} onChange={(event) => updateEditField("insuranceExpiry", event.target.value)} />
              <span className="form-hint">Comprehensive insurance policy expiry</span>
            </label>
            <label>
              Inspection expiry
              <input type="date" value={editForm.inspectionExpiry} onChange={(event) => updateEditField("inspectionExpiry", event.target.value)} />
              <span className="form-hint">RWC / roadworthy certificate expiry (if applicable)</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend className="form-section__title">Maintenance</legend>
          <div className="form-section__grid">
            <label>
              Odometer
              <input type="number" min="0" value={editForm.odometer} onChange={(event) => updateEditField("odometer", event.target.value)} />
              <span className="form-hint">Current odometer reading in km</span>
            </label>
            <label>
              Next service KM
              <input type="number" min="0" value={editForm.nextServiceKm} onChange={(event) => updateEditField("nextServiceKm", event.target.value)} />
              <span className="form-hint">Odometer reading when next service is due</span>
            </label>
          </div>
        </fieldset>

        <div className="register-form__actions">
          <button className="button button--primary" type="submit" disabled={submitting}>Save quick update</button>
        </div>
      </form>

      <div className="profile-actions">
        {currentContract?.driver.id ? (
          <Link className="button button--secondary" href={`/drivers/${currentContract.driver.id}`}>View driver profile</Link>
        ) : null}
        {currentContract ? (
          <Link className="button button--secondary" href={`/contracts/${currentContract.id}`}>View rental agreement</Link>
        ) : null}
        <Link className="button button--secondary" href="/vehicles">Back to vehicle register</Link>
      </div>

      <DocumentPanel
        entityType="Vehicle"
        entityId={vehicle.id}
        documents={vehicle.documents}
        onProfileUpdated={() => loadVehicle(false)}
      />
    </section>
  );
}
