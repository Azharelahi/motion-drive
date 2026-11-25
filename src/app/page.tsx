"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackupImportForm from "@/components/BackupImportForm";
import GlobalErrorBanner, { type GlobalAlert } from "@/components/GlobalErrorBanner";
import { formatAUD, formatDateAU } from "@/lib/format";
import type { DashboardAlert, ExpiryKind } from "@/lib/dashboard";

interface ExpiryDisplay {
  date: string | null;
  kind: ExpiryKind;
  daysRemaining: number | null;
}

interface DashboardPayload {
  counters: {
    vehicles: number;
    drivers: number;
    savedContracts: number;
    activeRentals: number;
  };
  alerts: DashboardAlert[];
  vehicleExpiryRegister: Array<{
    id: string;
    registration: string;
    make: string | null;
    model: string;
    status: string;
    registrationExpiry: ExpiryDisplay;
    insuranceExpiry: ExpiryDisplay;
    inspectionExpiry: ExpiryDisplay;
    odometer: number | null;
    nextServiceKm: number | null;
    serviceDueInKm: number | null;
  }>;
  driverDocumentExpiryRegister: Array<{
    id: string;
    name: string;
    mobile: string;
    licenceExpiry: ExpiryDisplay;
    rideshareAccreditationExpiry: ExpiryDisplay;
    documents: Array<{
      id: string;
      documentType: string;
      originalName: string;
      expiryDate: ExpiryDisplay;
    }>;
  }>;
  recentContracts: Array<{
    id: string;
    contractNumber: string;
    status: string;
    startDate: string;
    weeklyRent: number | string;
    driver: { id: string; name: string; mobile: string };
    vehicle: { id: string; registration: string; model: string };
  }>;
}

const counterLinks = [
  { key: "vehicles", label: "Vehicles", href: "/vehicles" },
  { key: "drivers", label: "Drivers", href: "/drivers" },
  { key: "savedContracts", label: "Saved Contracts", href: "/contracts" },
  { key: "activeRentals", label: "Active Rentals", href: "/contracts" },
] as const;

const quickActions = [
  { label: "Create New Contract", href: "/rentals/new", style: "primary" },
  { label: "Swap Cars", href: "/swaps", style: "secondary" },
  { label: "Add or View Vehicles", href: "/vehicles", style: "secondary" },
  { label: "Add or View Drivers", href: "/drivers", style: "secondary" },
] as const;

function expiryLabel(expiry: ExpiryDisplay): string {
  if (expiry.kind === "missing") return "Not recorded";
  if (expiry.kind === "invalid") return "Invalid date";
  if (expiry.kind === "expired") {
    const days = Math.abs(expiry.daysRemaining ?? 0);
    return days === 0 ? "Expired today" : `Expired ${days}d`;
  }
  if (expiry.kind === "due") {
    return expiry.daysRemaining === 0 ? "Due today" : `Due in ${expiry.daysRemaining}d`;
  }
  return "In date";
}

function ExpiryBadge({ expiry }: { expiry: ExpiryDisplay }) {
  return (
    <span className={`expiry-badge expiry-badge--${expiry.kind}`}>
      {expiryLabel(expiry)}
      {expiry.daysRemaining !== null && expiry.kind !== "expired"
        ? <small>{expiry.daysRemaining} days left</small>
        : null}
      {expiry.kind === "expired" ? (
        <small>{Math.abs(expiry.daysRemaining ?? 0)} days overdue</small>
      ) : null}
    </span>
  );
}

function AlertItem({ alert }: { alert: DashboardAlert }) {
  return (
    <li className={`dashboard-alert dashboard-alert--${alert.severity}`}>
      <div>
        <strong>{alert.title}</strong>
        <p>{alert.message}</p>
      </div>
      <Link href={alert.href}>View</Link>
    </li>
  );
}

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<GlobalAlert | null>(null);

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const body = (await response.json()) as DashboardPayload & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Could not load dashboard data.");
        if (active) setDashboard(body);
      } catch (error) {
        if (active) {
          setAlert({
            tone: "error",
            title: "Dashboard unavailable",
            message: error instanceof Error ? error.message : "Could not load dashboard data.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1>Motion Drive Rental Manager</h1>
          <p>Dashboard for Motion Drive Pty Ltd.</p>
        </div>
      </div>

      <GlobalErrorBanner alert={alert} onDismissAlert={() => setAlert(null)} />

      {loading ? <p role="status">Loading dashboard…</p> : null}

      {!loading && dashboard ? (
        <>
          <section aria-labelledby="dashboard-counts-title">
            <h2 id="dashboard-counts-title">Overview</h2>
            <div className="dashboard-counters">
              {counterLinks.map(({ key, label, href }) => (
                <Link className="dashboard-counter" href={href} key={key}>
                  <span>{label}</span>
                  <strong>{dashboard.counters[key].toLocaleString("en-AU")}</strong>
                </Link>
              ))}
            </div>
          </section>

          <section className="dashboard-section" aria-labelledby="attention-title">
            <h2 id="attention-title">Attention Needed</h2>
            {dashboard.alerts.length === 0 ? (
              <p className="dashboard-empty">No urgent alerts</p>
            ) : (
              <ul className="dashboard-alerts">
                {dashboard.alerts.map((item) => <AlertItem alert={item} key={item.id} />)}
              </ul>
            )}
          </section>

          <section className="dashboard-section" aria-labelledby="vehicle-expiry-title">
            <h2 id="vehicle-expiry-title">Vehicle Expiry Register</h2>
            {dashboard.vehicleExpiryRegister.length === 0 ? (
              <p>No vehicles have been added.</p>
            ) : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th scope="col">Vehicle</th>
                      <th scope="col">Registration expiry</th>
                      <th scope="col">Insurance expiry</th>
                      <th scope="col">Inspection expiry</th>
                      <th scope="col">Service</th>
                      <th scope="col">Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.vehicleExpiryRegister.map((vehicle) => (
                      <tr key={vehicle.id}>
                        <td data-label="Vehicle">
                          <strong>{vehicle.registration}</strong>
                          <span>{[vehicle.make, vehicle.model].filter(Boolean).join(" ")}</span>
                        </td>
                        <td data-label="Registration expiry">
                          {formatDateAU(vehicle.registrationExpiry.date)} <ExpiryBadge expiry={vehicle.registrationExpiry} />
                        </td>
                        <td data-label="Insurance expiry">
                          {formatDateAU(vehicle.insuranceExpiry.date)} <ExpiryBadge expiry={vehicle.insuranceExpiry} />
                        </td>
                        <td data-label="Inspection expiry">
                          {formatDateAU(vehicle.inspectionExpiry.date)} <ExpiryBadge expiry={vehicle.inspectionExpiry} />
                        </td>
                        <td data-label="Service">
                          {vehicle.serviceDueInKm === null
                            ? "Not recorded"
                            : vehicle.serviceDueInKm < 0
                              ? `${Math.abs(vehicle.serviceDueInKm).toLocaleString("en-AU")} km overdue`
                              : `${vehicle.serviceDueInKm.toLocaleString("en-AU")} km remaining`}
                        </td>
                        <td data-label="Profile">
                          <Link className="button button--secondary" href={`/vehicles/${vehicle.id}`}>
                            Registration
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dashboard-section" aria-labelledby="driver-expiry-title">
            <h2 id="driver-expiry-title">Driver Document Expiry Register</h2>
            {dashboard.driverDocumentExpiryRegister.length === 0 ? (
              <p>No current drivers.</p>
            ) : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table dashboard-table--drivers">
                  <thead>
                    <tr>
                      <th scope="col">Driver</th>
                      <th scope="col">Licence expiry</th>
                      <th scope="col">Rideshare accreditation</th>
                      <th scope="col">Uploaded documents</th>
                      <th scope="col">Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.driverDocumentExpiryRegister.map((driver) => (
                      <tr key={driver.id}>
                        <td data-label="Driver">
                          <strong>{driver.name}</strong>
                          <span>{driver.mobile}</span>
                        </td>
                        <td data-label="Licence expiry">
                          {formatDateAU(driver.licenceExpiry.date)} <ExpiryBadge expiry={driver.licenceExpiry} />
                        </td>
                        <td data-label="Rideshare accreditation">
                          {formatDateAU(driver.rideshareAccreditationExpiry.date)}{" "}
                          <ExpiryBadge expiry={driver.rideshareAccreditationExpiry} />
                        </td>
                        <td data-label="Uploaded documents">
                          {driver.documents.length === 0 ? (
                            "No uploaded documents"
                          ) : (
                            <ul className="dashboard-document-list">
                              {driver.documents.map((document) => (
                                <li key={document.id}>
                                  <span>{document.documentType}: {document.originalName}</span>
                                  {formatDateAU(document.expiryDate.date)}{" "}
                                  <ExpiryBadge expiry={document.expiryDate} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td data-label="Profile">
                          <Link className="button button--secondary" href={`/drivers/${driver.id}`}>
                            Open Driver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dashboard-section" aria-labelledby="quick-actions-title">
            <h2 id="quick-actions-title">Quick Actions</h2>
            <div className="dashboard-quick-actions">
              {quickActions.map((action) => (
                <Link
                  className={`button button--${action.style}`}
                  href={action.href}
                  key={action.href}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="dashboard-section" aria-labelledby="recent-contracts-title">
            <h2 id="recent-contracts-title">Recent Contracts</h2>
            {dashboard.recentContracts.length === 0 ? (
              <p>No contracts have been saved.</p>
            ) : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table dashboard-table--recent">
                  <thead>
                    <tr>
                      <th scope="col">Contract</th>
                      <th scope="col">Driver</th>
                      <th scope="col">Mobile</th>
                      <th scope="col">Vehicle</th>
                      <th scope="col">Start</th>
                      <th scope="col">Rent / week</th>
                      <th scope="col">Status</th>
                      <th scope="col">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentContracts.map((contract) => (
                      <tr key={contract.id}>
                        <td data-label="Contract">{contract.contractNumber}</td>
                        <td data-label="Driver">{contract.driver.name}</td>
                        <td data-label="Mobile">{contract.driver.mobile}</td>
                        <td data-label="Vehicle">
                          {contract.vehicle.registration} · {contract.vehicle.model}
                        </td>
                        <td data-label="Start">{formatDateAU(contract.startDate)}</td>
                        <td data-label="Rent / week">{formatAUD(contract.weeklyRent)}</td>
                        <td data-label="Status">{contract.status}</td>
                        <td data-label="Open">
                          <Link className="button button--secondary" href={`/contracts/${contract.id}`}>
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className="dashboard-section" aria-labelledby="backup-title">
        <h2 id="backup-title">Backup and Restore</h2>
        <BackupImportForm />
      </section>
    </section>
  );
}
