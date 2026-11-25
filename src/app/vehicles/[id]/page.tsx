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

  const loadVehicle = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
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
          <div className="vehicle-grid">
            <label>Registration *<input required value={editForm.registration} onChange={(event) => updateEditField("registration", event.target.value)} /></label>
            <label>Model *<input required value={editForm.model} onChange={(event) => updateEditField("model", event.target.value)} /></label>
            <label>Make<input value={editForm.make} onChange={(event) => updateEditField("make", event.target.value)} /></label>
            <label>Fuel type<input value={editForm.fuelType} onChange={(event) => updateEditField("fuelType", event.target.value)} /></label>
            <label>Year<input type="number" min="1886" max="9999" value={editForm.year} onChange={(event) => updateEditField("year", event.target.value)} /></label>
            <label>Colour<input value={editForm.colour} onChange={(event) => updateEditField("colour", event.target.value)} /></label>
            <label>VIN<input value={editForm.vin} onChange={(event) => updateEditField("vin", event.target.value)} /></label>
            <label>Status<select value={editForm.status} onChange={(event) => updateEditField("status", event.target.value)}><option>Available</option><option>Rented</option><option>Inactive</option></select></label>
            <label>Weekly rent<input type="number" min="0" step="0.01" required value={editForm.weeklyRent} onChange={(event) => updateEditField("weeklyRent", event.target.value)} /></label>
            <label>Bond<input type="number" min="0" step="0.01" value={editForm.bond} onChange={(event) => updateEditField("bond", event.target.value)} /></label>
            <label>Excess<input type="number" min="0" step="0.01" value={editForm.excess} onChange={(event) => updateEditField("excess", event.target.value)} /></label>
            <label>KM allowance<input value={editForm.kmAllowance} onChange={(event) => updateEditField("kmAllowance", event.target.value)} /></label>
            <label>Pickup location<input value={editForm.pickupLocation} onChange={(event) => updateEditField("pickupLocation", event.target.value)} /></label>
            <label>Odometer<input type="number" min="0" value={editForm.odometer} onChange={(event) => updateEditField("odometer", event.target.value)} /></label>
            <label>Next service KM<input type="number" min="0" value={editForm.nextServiceKm} onChange={(event) => updateEditField("nextServiceKm", event.target.value)} /></label>
            <label>Registration expiry<input type="date" value={editForm.registrationExpiry} onChange={(event) => updateEditField("registrationExpiry", event.target.value)} /></label>
            <label>Insurance expiry<input type="date" value={editForm.insuranceExpiry} onChange={(event) => updateEditField("insuranceExpiry", event.target.value)} /></label>
            <label>Inspection expiry<input type="date" value={editForm.inspectionExpiry} onChange={(event) => updateEditField("inspectionExpiry", event.target.value)} /></label>
            <label className="register-form__notes">Notes<textarea value={editForm.notes} onChange={(event) => updateEditField("notes", event.target.value)} /></label>
          </div>
          <div className="register-form__actions">
            <button className="button button--primary" type="submit" disabled={submitting}>Save vehicle</button>
            <button className="button button--secondary" type="button" onClick={() => setEditing(false)} disabled={submitting}>Cancel Edit</button>
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
        <div className="vehicle-grid">
          <label>Status<select value={editForm.status} onChange={(event) => updateEditField("status", event.target.value)}><option>Available</option><option>Rented</option><option>Inactive</option></select></label>
          <label>Registration expiry<input type="date" value={editForm.registrationExpiry} onChange={(event) => updateEditField("registrationExpiry", event.target.value)} /></label>
          <label>Insurance expiry<input type="date" value={editForm.insuranceExpiry} onChange={(event) => updateEditField("insuranceExpiry", event.target.value)} /></label>
          <label>Inspection expiry<input type="date" value={editForm.inspectionExpiry} onChange={(event) => updateEditField("inspectionExpiry", event.target.value)} /></label>
          <label>Odometer<input type="number" min="0" value={editForm.odometer} onChange={(event) => updateEditField("odometer", event.target.value)} /></label>
          <label>Next service KM<input type="number" min="0" value={editForm.nextServiceKm} onChange={(event) => updateEditField("nextServiceKm", event.target.value)} /></label>
        </div>
        <div className="register-form__actions">
          <button className="button button--primary" type="submit" disabled={submitting}>Save quick update</button>
        </div>
      </form>

      <div className="profile-actions">
        {currentContract?.driver.id ? (
          <Link className="button button--secondary" href={`/drivers/${currentContract.driver.id}`}>Open Driver</Link>
        ) : null}
        {currentContract ? (
          <Link className="button button--secondary" href={`/contracts/${currentContract.id}`}>Open Contract</Link>
        ) : null}
        <Link className="button button--secondary" href="/vehicles">Back to Register</Link>
      </div>

      <DocumentPanel entityType="Vehicle" entityId={vehicle.id} documents={vehicle.documents} />
    </section>
  );
}
