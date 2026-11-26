 "use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import GlobalErrorBanner, { type GlobalAlert, type ConfirmationPrompt } from "@/components/GlobalErrorBanner";
import { formatAUD, formatDateAU } from "@/lib/format";

interface ActiveContract {
  id: string;
  startDate: string;
  driver: { id: string; name: string; mobile: string };
}

interface VehicleRow {
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
  contracts: ActiveContract[];
  _count: { documents: number };
}

interface VehicleForm {
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

const emptyForm: VehicleForm = {
  registration: "",
  make: "",
  model: "",
  fuelType: "",
  year: "",
  colour: "",
  vin: "",
  status: "Available",
  weeklyRent: "",
  bond: "500",
  excess: "0",
  kmAllowance: "Unlimited",
  pickupLocation: "Tarneit, VIC",
  odometer: "",
  nextServiceKm: "",
  registrationExpiry: "",
  insuranceExpiry: "",
  inspectionExpiry: "",
  notes: "",
};

function dateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function vehicleToForm(vehicle: VehicleRow): VehicleForm {
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
    registrationExpiry: dateInputValue(vehicle.registrationExpiry),
    insuranceExpiry: dateInputValue(vehicle.insuranceExpiry),
    inspectionExpiry: dateInputValue(vehicle.inspectionExpiry),
    notes: vehicle.notes ?? "",
  };
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<GlobalAlert | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationPrompt | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VehicleRow | null>(null);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/vehicles", { cache: "no-store" });
      const body = (await response.json()) as { vehicles?: VehicleRow[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not load vehicles.");
      setVehicles(body.vehicles ?? []);
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Vehicle register unavailable",
        message: error instanceof Error ? error.message : "Could not load vehicles.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  function updateField(field: keyof VehicleForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function beginEdit(vehicle: VehicleRow) {
    setEditingId(vehicle.id);
    setForm(vehicleToForm(vehicle));
    setAlert(null);
  }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setAlert(null);
    const isEditing = editingId !== null;
    try {
      const response = await fetch(
        editingId ? `/api/vehicles/${editingId}` : "/api/vehicles",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const body = (await response.json()) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error([body.error, body.details].filter(Boolean).join(" ") || "Could not save vehicle.");
      }
      cancelEdit();
      setAlert({
        tone: "success",
        title: isEditing ? "Vehicle updated" : "Vehicle added",
        message: isEditing
          ? "The vehicle profile was saved."
          : "The vehicle was added to the register.",
      });
      await loadVehicles();
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Vehicle could not be saved",
        message: error instanceof Error ? error.message : "Could not save vehicle.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(vehicle: VehicleRow) {
    setPendingDelete(vehicle);
    setConfirmation({
      title: `Delete ${vehicle.registration}?`,
      message:
        "This vehicle will be permanently deleted if it is not linked to any contract.",
      confirmLabel: "Delete vehicle",
      destructive: true,
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const response = await fetch(`/api/vehicles/${pendingDelete.id}`, { method: "DELETE" });
    const body = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
    if (!response.ok) {
      throw new Error([body.error, body.details].filter(Boolean).join(" ") || "Could not delete vehicle.");
    }
    setConfirmation(null);
    setPendingDelete(null);
    setAlert({
      tone: "success",
      title: "Vehicle deleted",
      message: "The vehicle was removed from the register.",
    });
    await loadVehicles();
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredVehicles = vehicles.filter((vehicle) =>
    [vehicle.registration, vehicle.model, vehicle.year?.toString(), vehicle.colour]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedSearch)),
  );

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Vehicle Register</h1>
          <p>Manage vehicles, rentals, and vehicle documents.</p>
        </div>
      </div>

      <GlobalErrorBanner
        alert={alert}
        onDismissAlert={() => setAlert(null)}
        confirmation={confirmation}
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirmation(null);
          setPendingDelete(null);
        }}
      />

      <form className="register-form" onSubmit={saveVehicle}>
        <h2>{editingId ? "Edit vehicle" : "Add vehicle"}</h2>
        <div className="vehicle-grid">
          <label>
            Registration *
            <input required value={form.registration} onChange={(event) => updateField("registration", event.target.value)} />
            <span className="form-hint">VicRoads plate number (e.g. ABC123)</span>
          </label>
          <label>
            Model *
            <input required value={form.model} onChange={(event) => updateField("model", event.target.value)} />
            <span className="form-hint">Vehicle model name (e.g. Corolla, Camry, Hilux)</span>
          </label>
          <label>
            Make
            <input value={form.make} onChange={(event) => updateField("make", event.target.value)} />
            <span className="form-hint">Manufacturer brand (e.g. Toyota, Ford, Mazda)</span>
          </label>
          <label>
            Fuel type
            <input value={form.fuelType} onChange={(event) => updateField("fuelType", event.target.value)} />
            <span className="form-hint">Petrol, Diesel, Hybrid, Electric, LPG</span>
          </label>
          <label>
            Year
            <input type="number" min="1886" max="9999" value={form.year} onChange={(event) => updateField("year", event.target.value)} />
            <span className="form-hint">Manufacture year (e.g. 2022)</span>
          </label>
          <label>
            Colour
            <input value={form.colour} onChange={(event) => updateField("colour", event.target.value)} />
            <span className="form-hint">Exterior colour (e.g. White, Silver, Blue)</span>
          </label>
          <label>
            VIN
            <input value={form.vin} onChange={(event) => updateField("vin", event.target.value)} />
            <span className="form-hint">17-character Vehicle Identification Number</span>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
              <option>Available</option>
              <option>Rented</option>
              <option>Inactive</option>
            </select>
            <span className="form-hint">Available = ready to rent; Rented = currently on contract; Inactive = not in service</span>
          </label>
          <label>
            Weekly rent *
            <input type="number" min="0" step="0.01" required value={form.weeklyRent} onChange={(event) => updateField("weeklyRent", event.target.value)} />
            <span className="form-hint">Rent amount per week in AUD (e.g. 350.00)</span>
          </label>
          <label>
            Bond
            <input type="number" min="0" step="0.01" value={form.bond} onChange={(event) => updateField("bond", event.target.value)} />
            <span className="form-hint">Security deposit amount (default $500)</span>
          </label>
          <label>
            Excess
            <input type="number" min="0" step="0.01" value={form.excess} onChange={(event) => updateField("excess", event.target.value)} />
            <span className="form-hint">Driver liability excess for damage (default $0)</span>
          </label>
          <label>
            KM allowance
            <input value={form.kmAllowance} onChange={(event) => updateField("kmAllowance", event.target.value)} />
            <span className="form-hint">e.g. Unlimited, 1000km/week, 5000km/month</span>
          </label>
          <label>
            Pickup location
            <input value={form.pickupLocation} onChange={(event) => updateField("pickupLocation", event.target.value)} />
            <span className="form-hint">Where driver collects the vehicle (default: Tarneit, VIC)</span>
          </label>
          <label>
            Odometer
            <input type="number" min="0" value={form.odometer} onChange={(event) => updateField("odometer", event.target.value)} />
            <span className="form-hint">Current odometer reading in km</span>
          </label>
          <label>
            Next service KM
            <input type="number" min="0" value={form.nextServiceKm} onChange={(event) => updateField("nextServiceKm", event.target.value)} />
            <span className="form-hint">Odometer reading when next service is due</span>
          </label>
          <label>
            Registration expiry
            <input type="date" value={form.registrationExpiry} onChange={(event) => updateField("registrationExpiry", event.target.value)} />
            <span className="form-hint">VicRoads registration expiry date</span>
          </label>
          <label>
            Insurance expiry
            <input type="date" value={form.insuranceExpiry} onChange={(event) => updateField("insuranceExpiry", event.target.value)} />
            <span className="form-hint">Comprehensive insurance policy expiry</span>
          </label>
          <label>
            Inspection expiry
            <input type="date" value={form.inspectionExpiry} onChange={(event) => updateField("inspectionExpiry", event.target.value)} />
            <span className="form-hint">RWC / roadworthy certificate expiry (if applicable)</span>
          </label>
          <label className="register-form__notes">
            Notes
            <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
            <span className="form-hint">Internal notes, damage records, special conditions</span>
          </label>
        </div>
        <div className="register-form__actions">
          <button className="button button--primary" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : editingId ? "Save vehicle" : "Add vehicle"}
          </button>
          {editingId ? (
            <button className="button button--secondary" type="button" onClick={cancelEdit} disabled={submitting}>
              Cancel Edit
            </button>
          ) : null}
        </div>
      </form>

      <section className="register-list" aria-labelledby="vehicle-list-title">
        <div className="register-list__heading">
          <h2 id="vehicle-list-title">Vehicles</h2>
          <label>
            Search
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Registration, model, year or colour"
            />
          </label>
        </div>

        {loading ? (
          <p role="status">Loading vehicles…</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Vehicle</th>
                  <th>Current driver</th>
                  <th>Taken since</th>
                  <th>Rent</th>
                  <th>Status</th>
                  <th>Documents</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => {
                  const activeContract = vehicle.contracts[0];
                  return (
                    <tr key={vehicle.id}>
                      <td><strong>{vehicle.registration}</strong></td>
                      <td>{vehicle.year ? `${vehicle.year} ` : ""}{vehicle.make ? `${vehicle.make} ` : ""}{vehicle.model}{vehicle.colour ? ` · ${vehicle.colour}` : ""}</td>
                      <td>{activeContract?.driver.name ?? "—"}</td>
                      <td>{formatDateAU(activeContract?.startDate)}</td>
                      <td>{formatAUD(vehicle.weeklyRent)}</td>
                      <td>{vehicle.status}</td>
                      <td>{vehicle._count.documents}</td>
                      <td>
                        <div className="table-actions">
                          <Link className="button button--secondary" href={`/vehicles/${vehicle.id}`}>Profile</Link>
                          <button className="button button--secondary" type="button" onClick={() => beginEdit(vehicle)}>Edit</button>
                          <button className="button button--danger" type="button" onClick={() => requestDelete(vehicle)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredVehicles.length === 0 ? (
                  <tr><td colSpan={8}>{normalizedSearch ? "No matching vehicles." : "No vehicles found."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
