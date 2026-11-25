 "use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import GlobalErrorBanner, {
  type ConfirmationPrompt,
  type GlobalAlert,
} from "@/components/GlobalErrorBanner";
import { formatDateAU } from "@/lib/format";

interface ActiveContract {
  id: string;
  startDate: string;
  vehicle: {
    id: string;
    registration: string;
    model: string;
    year: number | null;
    colour: string | null;
  };
}

interface DriverRow {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  dateOfBirth: string | null;
  address: string | null;
  licenceNumber: string | null;
  licenceState: string | null;
  abn: string | null;
  emergencyContact: string | null;
  rideshareAccreditation: string | null;
  licenceExpiry: string | null;
  rideshareAccreditationExpiry: string | null;
  status: string;
  notes: string | null;
  contracts: ActiveContract[];
  _count: { documents: number };
}

interface DriverForm {
  name: string;
  mobile: string;
  email: string;
  dateOfBirth: string;
  address: string;
  licenceNumber: string;
  licenceState: string;
  abn: string;
  emergencyContact: string;
  rideshareAccreditation: string;
  licenceExpiry: string;
  rideshareAccreditationExpiry: string;
  status: string;
  notes: string;
}

const emptyForm: DriverForm = {
  name: "",
  mobile: "",
  email: "",
  dateOfBirth: "",
  address: "",
  licenceNumber: "",
  licenceState: "",
  abn: "",
  emergencyContact: "",
  rideshareAccreditation: "",
  licenceExpiry: "",
  rideshareAccreditationExpiry: "",
  status: "Ended",
  notes: "",
};

function dateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function driverToForm(driver: DriverRow): DriverForm {
  return {
    name: driver.name,
    mobile: driver.mobile,
    email: driver.email ?? "",
    dateOfBirth: dateInput(driver.dateOfBirth),
    address: driver.address ?? "",
    licenceNumber: driver.licenceNumber ?? "",
    licenceState: driver.licenceState ?? "",
    abn: driver.abn ?? "",
    emergencyContact: driver.emergencyContact ?? "",
    rideshareAccreditation: driver.rideshareAccreditation ?? "",
    licenceExpiry: dateInput(driver.licenceExpiry),
    rideshareAccreditationExpiry: dateInput(driver.rideshareAccreditationExpiry),
    status: driver.status,
    notes: driver.notes ?? "",
  };
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<GlobalAlert | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationPrompt | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DriverRow | null>(null);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/drivers", { cache: "no-store" });
      const body = (await response.json()) as { drivers?: DriverRow[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not load drivers.");
      setDrivers(body.drivers ?? []);
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Driver register unavailable",
        message: error instanceof Error ? error.message : "Could not load drivers.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDrivers();
  }, [loadDrivers]);

  function updateField(field: keyof DriverForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function beginEdit(driver: DriverRow) {
    setEditingId(driver.id);
    setForm(driverToForm(driver));
    setAlert(null);
  }

  async function saveDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setAlert(null);
    const isEditing = editingId !== null;
    try {
      const response = await fetch(editingId ? `/api/drivers/${editingId}` : "/api/drivers", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json()) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error([body.error, body.details].filter(Boolean).join(" ") || "Could not save driver.");
      }
      cancelEdit();
      setAlert({
        tone: "success",
        title: isEditing ? "Driver updated" : "Driver added",
        message: isEditing
          ? "The driver profile was saved."
          : "The driver was added to the register.",
      });
      await loadDrivers();
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Driver could not be saved",
        message: error instanceof Error ? error.message : "Could not save driver.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(driver: DriverRow) {
    setPendingDelete(driver);
    setConfirmation({
      title: `Delete ${driver.name}?`,
      message: "This driver will be permanently deleted if they are not linked to any contract.",
      confirmLabel: "Delete driver",
      destructive: true,
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const response = await fetch(`/api/drivers/${pendingDelete.id}`, { method: "DELETE" });
    const body = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
    if (!response.ok) {
      throw new Error([body.error, body.details].filter(Boolean).join(" ") || "Could not delete driver.");
    }
    setConfirmation(null);
    setPendingDelete(null);
    setAlert({
      tone: "success",
      title: "Driver deleted",
      message: "The driver was removed from the register.",
    });
    await loadDrivers();
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredDrivers = drivers.filter((driver) =>
    [driver.name, driver.mobile, driver.email, driver.licenceNumber]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedSearch)),
  );

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Driver Register</h1>
          <p>Manage drivers, licences, and rental assignments.</p>
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

      <form className="register-form" onSubmit={saveDriver}>
        <h2>{editingId ? "Edit driver" : "Add driver"}</h2>
        <div className="vehicle-grid">
          <label>Name *<input required value={form.name} onChange={(event) => updateField("name", event.target.value)} /></label>
          <label>Mobile *<input required value={form.mobile} onChange={(event) => updateField("mobile", event.target.value)} /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} /></label>
          <label>Date of birth<input type="date" value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} /></label>
          <label>Licence number<input value={form.licenceNumber} onChange={(event) => updateField("licenceNumber", event.target.value)} /></label>
          <label>Licence state<input value={form.licenceState} onChange={(event) => updateField("licenceState", event.target.value)} /></label>
          <label>Licence expiry<input type="date" value={form.licenceExpiry} onChange={(event) => updateField("licenceExpiry", event.target.value)} /></label>
          <label>Rideshare accreditation<input value={form.rideshareAccreditation} onChange={(event) => updateField("rideshareAccreditation", event.target.value)} /></label>
          <label>Rideshare expiry<input type="date" value={form.rideshareAccreditationExpiry} onChange={(event) => updateField("rideshareAccreditationExpiry", event.target.value)} /></label>
          <label>ABN<input value={form.abn} onChange={(event) => updateField("abn", event.target.value)} /></label>
          <label>Emergency contact<input value={form.emergencyContact} onChange={(event) => updateField("emergencyContact", event.target.value)} /></label>
          <label>Status<select value={form.status} onChange={(event) => updateField("status", event.target.value)}><option>Ended</option><option>Current</option></select></label>
          <label className="register-form__notes">Address<textarea value={form.address} onChange={(event) => updateField("address", event.target.value)} /></label>
          <label className="register-form__notes">Notes<textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} /></label>
        </div>
        <div className="register-form__actions">
          <button className="button button--primary" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : editingId ? "Save driver" : "Add driver"}
          </button>
          {editingId ? (
            <button className="button button--secondary" type="button" onClick={cancelEdit} disabled={submitting}>
              Cancel Edit
            </button>
          ) : null}
        </div>
      </form>

      <section className="register-list" aria-labelledby="driver-list-title">
        <div className="register-list__heading">
          <h2 id="driver-list-title">Drivers</h2>
          <label>
            Search
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, mobile, email or licence number"
            />
          </label>
        </div>

        {loading ? (
          <p role="status">Loading drivers…</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Current car</th>
                  <th>Car taken date</th>
                  <th>Licence expiry</th>
                  <th>Status</th>
                  <th>Documents</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver) => {
                  const activeContract = driver.contracts[0];
                  const vehicle = activeContract?.vehicle;
                  const carLabel = vehicle
                    ? `${vehicle.year ? `${vehicle.year} ` : ""}${vehicle.registration} · ${vehicle.model}${vehicle.colour ? ` · ${vehicle.colour}` : ""}`
                    : "—";
                  return (
                    <tr key={driver.id}>
                      <td><strong>{driver.name}</strong></td>
                      <td>{driver.mobile}</td>
                      <td>{carLabel}</td>
                      <td>{formatDateAU(activeContract?.startDate)}</td>
                      <td>{formatDateAU(driver.licenceExpiry)}</td>
                      <td>{driver.status}</td>
                      <td>{driver._count.documents}</td>
                      <td>
                        <div className="table-actions">
                          <Link className="button button--secondary" href={`/drivers/${driver.id}`}>Profile</Link>
                          <button className="button button--secondary" type="button" onClick={() => beginEdit(driver)}>Edit</button>
                          <button className="button button--danger" type="button" onClick={() => requestDelete(driver)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredDrivers.length === 0 ? (
                  <tr><td colSpan={8}>{normalizedSearch ? "No matching drivers." : "No drivers found."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
