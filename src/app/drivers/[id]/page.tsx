"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import GlobalErrorBanner, { type GlobalAlert } from "@/components/GlobalErrorBanner";
import { getLicenceExpiryWarning } from "@/lib/driver-licence-warning";
import { formatAUD, formatDateAU } from "@/lib/format";

interface DriverContract {
  id: string;
  contractNumber: string;
  status: string;
  startDate: string;
  endDate: string | null;
  initialEndDate: string | null;
  weeklyRent: number | string;
  bond: number | string;
  excess: number | string;
  term: string;
  noticePeriod: string;
  vehicle: {
    id: string;
    registration: string;
    model: string;
    year: number | null;
    colour: string | null;
  };
}

interface DriverDocument {
  id: string;
  documentType: string;
  originalName: string;
  expiryDate: string | null;
  createdAt: string;
  sizeBytes: string;
}

interface DriverProfile {
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
  contracts: DriverContract[];
  documents: DriverDocument[];
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

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function toForm(driver: DriverProfile): DriverForm {
  return {
    name: driver.name,
    mobile: driver.mobile,
    email: driver.email ?? "",
    dateOfBirth: toDateInput(driver.dateOfBirth),
    address: driver.address ?? "",
    licenceNumber: driver.licenceNumber ?? "",
    licenceState: driver.licenceState ?? "",
    abn: driver.abn ?? "",
    emergencyContact: driver.emergencyContact ?? "",
    rideshareAccreditation: driver.rideshareAccreditation ?? "",
    licenceExpiry: toDateInput(driver.licenceExpiry),
    rideshareAccreditationExpiry: toDateInput(driver.rideshareAccreditationExpiry),
    status: driver.status,
    notes: driver.notes ?? "",
  };
}

export default function DriverProfilePage() {
  const params = useParams<{ id: string }>();
  const driverId = params.id;
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [form, setForm] = useState<DriverForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<GlobalAlert | null>(null);

  const loadDriver = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/drivers/${driverId}`, { cache: "no-store" });
      const body = (await response.json()) as { driver?: DriverProfile; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not load the driver.");
      if (!body.driver) throw new Error("Driver not found.");
      setDriver(body.driver);
      setForm(toForm(body.driver));
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Driver profile unavailable",
        message: error instanceof Error ? error.message : "Could not load the driver.",
      });
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    void loadDriver();
  }, [loadDriver]);

  function updateField(field: keyof DriverForm, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  async function saveDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setAlert(null);
    try {
      const response = await fetch(`/api/drivers/${driverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json()) as { error?: string; details?: string };
      if (!response.ok) {
        throw new Error([body.error, body.details].filter(Boolean).join(" ") || "Could not update the driver.");
      }
      setEditing(false);
      setAlert({ tone: "success", title: "Driver updated", message: "The driver profile was saved." });
      await loadDriver();
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : "Could not update the driver.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <section><p role="status">Loading driver profile…</p></section>;
  }

  if (!driver || !form) {
    return (
      <section>
        <GlobalErrorBanner alert={alert} onDismissAlert={() => setAlert(null)} />
        <Link className="button button--secondary" href="/drivers">Back to Driver Register</Link>
      </section>
    );
  }

  const licenceWarning = getLicenceExpiryWarning(driver.licenceExpiry);
  const activeContract = driver.contracts.find((contract) => contract.status === "Active") ?? null;
  const relatedContract = activeContract ?? driver.contracts[0] ?? null;
  const relatedVehicle = relatedContract?.vehicle ?? null;

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>{driver.name}</h1>
          <p>{driver.mobile}{driver.email ? ` · ${driver.email}` : ""}</p>
        </div>
        <button className="button button--primary" type="button" onClick={() => setEditing((current) => !current)}>
          {editing ? "Close edit" : "Edit Driver"}
        </button>
      </div>

      <GlobalErrorBanner alert={alert} onDismissAlert={() => setAlert(null)} />

      {licenceWarning ? (
        <aside className="licence-warning" role="alert" aria-live="assertive">
          <strong>Licence expiry warning</strong>
          <p>{licenceWarning.message}</p>
          {driver.licenceExpiry ? <p>Expiry date: {formatDateAU(driver.licenceExpiry)}</p> : null}
        </aside>
      ) : null}

      {editing ? (
        <form className="register-form" onSubmit={saveDriver}>
          <h2>Edit driver</h2>
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
            <label>Status<select value={form.status} onChange={(event) => updateField("status", event.target.value)}><option>Current</option><option>Ended</option></select></label>
            <label className="register-form__notes">Address<textarea value={form.address} onChange={(event) => updateField("address", event.target.value)} /></label>
            <label className="register-form__notes">Notes<textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} /></label>
          </div>
          <div className="register-form__actions">
            <button className="button button--primary" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save driver"}
            </button>
            <button className="button button--secondary" type="button" onClick={() => setEditing(false)} disabled={submitting}>
              Cancel Edit
            </button>
          </div>
        </form>
      ) : null}

      <div className="profile-grid">
        <section className="profile-card">
          <h2>Personal information</h2>
          <dl className="detail-grid">
            <div><dt>Name</dt><dd>{driver.name}</dd></div>
            <div><dt>Mobile</dt><dd>{driver.mobile}</dd></div>
            <div><dt>Email</dt><dd>{driver.email ?? "—"}</dd></div>
            <div><dt>Date of birth</dt><dd>{formatDateAU(driver.dateOfBirth)}</dd></div>
            <div><dt>Address</dt><dd>{driver.address ?? "—"}</dd></div>
            <div><dt>Status</dt><dd>{driver.status}</dd></div>
            <div><dt>Emergency contact</dt><dd>{driver.emergencyContact ?? "—"}</dd></div>
            <div><dt>ABN</dt><dd>{driver.abn ?? "—"}</dd></div>
          </dl>
        </section>

        <section className="profile-card">
          <h2>Licence and accreditation</h2>
          <dl className="detail-grid">
            <div><dt>Licence number</dt><dd>{driver.licenceNumber ?? "—"}</dd></div>
            <div><dt>Licence state</dt><dd>{driver.licenceState ?? "—"}</dd></div>
            <div><dt>Licence expiry</dt><dd>{formatDateAU(driver.licenceExpiry)}</dd></div>
            <div><dt>Rideshare accreditation</dt><dd>{driver.rideshareAccreditation ?? "—"}</dd></div>
            <div><dt>Rideshare expiry</dt><dd>{formatDateAU(driver.rideshareAccreditationExpiry)}</dd></div>
          </dl>
        </section>

        <section className="profile-card">
          <h2>Rental details</h2>
          <dl className="detail-grid">
            <div><dt>Current vehicle</dt><dd>{activeContract && relatedVehicle ? `${relatedVehicle.registration} · ${relatedVehicle.model}` : "—"}</dd></div>
            <div><dt>Car taken date</dt><dd>{formatDateAU(activeContract?.startDate)}</dd></div>
            <div><dt>Weekly rent</dt><dd>{formatAUD(relatedContract?.weeklyRent)}</dd></div>
            <div><dt>Bond</dt><dd>{formatAUD(relatedContract?.bond)}</dd></div>
            <div><dt>Excess</dt><dd>{formatAUD(relatedContract?.excess)}</dd></div>
            <div><dt>Initial end date</dt><dd>{formatDateAU(relatedContract?.initialEndDate)}</dd></div>
            <div><dt>Ongoing term</dt><dd>{relatedContract?.term ?? "—"}</dd></div>
            <div><dt>Notice period</dt><dd>{relatedContract?.noticePeriod ?? "—"}</dd></div>
          </dl>
        </section>

        {driver.notes ? (
          <section className="profile-card">
            <h2>Notes</h2>
            <p>{driver.notes}</p>
          </section>
        ) : null}
      </div>

      <div className="profile-actions">
        {relatedVehicle ? (
          <Link className="button button--secondary" href={`/vehicles/${relatedVehicle.id}`}>Open Car</Link>
        ) : null}
        {relatedContract ? (
          <Link className="button button--secondary" href={`/contracts/${relatedContract.id}`}>Open Contract</Link>
        ) : null}
        <Link className="button button--secondary" href="/drivers">Back to Register</Link>
      </div>

      <section className="profile-card document-panel" aria-labelledby="driver-documents-title">
        <h2 id="driver-documents-title">Driver Documents</h2>
        {driver.documents.length === 0 ? (
          <p>No driver documents uploaded.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Document</th><th>Expiry</th><th>Uploaded</th></tr></thead>
              <tbody>
                {driver.documents.map((document) => (
                  <tr key={document.id}>
                    <td>{document.documentType} · {document.originalName}</td>
                    <td>{formatDateAU(document.expiryDate)}</td>
                    <td>{formatDateAU(document.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
