import { daysUntil, type DateInput } from "@/lib/format";
import { getLicenceExpiryWarning } from "@/lib/driver-licence-warning";

export type ExpiryKind = "missing" | "invalid" | "expired" | "due" | "valid";

export interface ExpiryStatus {
  kind: ExpiryKind;
  daysRemaining: number | null;
}

export interface DashboardAlert {
  id: string;
  severity: "critical" | "warning";
  title: string;
  message: string;
  href: string;
}

export interface DashboardDriverSource {
  id: string;
  name: string;
  licenceExpiry: DateInput;
  rideshareAccreditationExpiry: DateInput;
}

export interface DashboardVehicleSource {
  id: string;
  registration: string;
  odometer: number | null;
  nextServiceKm: number | null;
  registrationExpiry: DateInput;
  insuranceExpiry: DateInput;
  inspectionExpiry: DateInput;
}

export interface DashboardDocumentSource {
  id: string;
  originalName: string;
  documentType: string;
  expiryDate: DateInput;
  driverId: string | null;
  vehicleId: string | null;
}

export function getExpiryStatus(
  value: DateInput,
  warningWindow: number,
  today: DateInput = new Date(),
): ExpiryStatus {
  if (value === null || value === undefined || value === "") {
    return { kind: "missing", daysRemaining: null };
  }

  const daysRemaining = daysUntil(value, today);
  if (daysRemaining === null) return { kind: "invalid", daysRemaining: null };
  if (daysRemaining < 0) return { kind: "expired", daysRemaining };
  if (daysRemaining <= warningWindow) return { kind: "due", daysRemaining };
  return { kind: "valid", daysRemaining };
}

function expiryMessage(label: string, expiry: ExpiryStatus): string {
  if (expiry.kind === "invalid") return `${label} expiry date is invalid.`;
  if (expiry.kind === "expired") {
    return expiry.daysRemaining === -1
      ? `${label} expired yesterday.`
      : `${label} expired ${Math.abs(expiry.daysRemaining ?? 0)} days ago.`;
  }
  if (expiry.daysRemaining === 0) return `${label} expires today.`;
  return `${label} expires in ${expiry.daysRemaining} days.`;
}

function expirySeverity(expiry: ExpiryStatus): DashboardAlert["severity"] {
  return expiry.kind === "expired" || expiry.kind === "invalid" ? "critical" : "warning";
}

function dateForWarning(value: DateInput): string | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : "invalid";
  return value ?? null;
}

export function buildDashboardAlerts(
  source: {
    currentDrivers: DashboardDriverSource[];
    vehicles: DashboardVehicleSource[];
    documents: DashboardDocumentSource[];
  },
  today: DateInput = new Date(),
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  for (const driver of source.currentDrivers) {
    const licenceWarning = getLicenceExpiryWarning(dateForWarning(driver.licenceExpiry), today);
    if (licenceWarning) {
      alerts.push({
        id: `driver-licence-${driver.id}`,
        severity: licenceWarning.kind === "soon" ? "warning" : "critical",
        title: `${driver.name} — driver licence`,
        message: licenceWarning.message,
        href: `/drivers/${driver.id}`,
      });
    }

    if (driver.rideshareAccreditationExpiry !== null && driver.rideshareAccreditationExpiry !== undefined) {
      const expiry = getExpiryStatus(driver.rideshareAccreditationExpiry, 90, today);
      if (expiry.kind === "expired" || expiry.kind === "due" || expiry.kind === "invalid") {
        alerts.push({
          id: `driver-rideshare-${driver.id}`,
          severity: expirySeverity(expiry),
          title: `${driver.name} — rideshare accreditation`,
          message: expiryMessage("Rideshare accreditation", expiry),
          href: `/drivers/${driver.id}`,
        });
      }
    }
  }

  for (const vehicle of source.vehicles) {
    for (const field of [
      ["registrationExpiry", "Registration"],
      ["insuranceExpiry", "Insurance"],
      ["inspectionExpiry", "Inspection"],
    ] as const) {
      const [key, label] = field;
      const expiry = getExpiryStatus(vehicle[key], 45, today);
      if (expiry.kind === "expired" || expiry.kind === "due" || expiry.kind === "invalid") {
        alerts.push({
          id: `vehicle-${key}-${vehicle.id}`,
          severity: expirySeverity(expiry),
          title: `${vehicle.registration} — ${label.toLowerCase()}`,
          message: expiryMessage(label, expiry),
          href: `/vehicles/${vehicle.id}`,
        });
      }
    }

    if (vehicle.odometer !== null && vehicle.nextServiceKm !== null) {
      const kilometresRemaining = vehicle.nextServiceKm - vehicle.odometer;
      if (kilometresRemaining <= 1000) {
        alerts.push({
          id: `vehicle-service-${vehicle.id}`,
          severity: kilometresRemaining <= 0 ? "critical" : "warning",
          title: `${vehicle.registration} — service`,
          message:
            kilometresRemaining < 0
              ? `Service is overdue by ${Math.abs(kilometresRemaining).toLocaleString("en-AU")} km.`
              : kilometresRemaining === 0
                ? "Service is due now."
                : `Service is due in ${kilometresRemaining.toLocaleString("en-AU")} km.`,
          href: `/vehicles/${vehicle.id}`,
        });
      }
    }
  }

  for (const document of source.documents) {
    if (document.expiryDate === null || document.expiryDate === undefined) continue;
    const expiry = getExpiryStatus(document.expiryDate, 60, today);
    if (expiry.kind === "expired" || expiry.kind === "due" || expiry.kind === "invalid") {
      alerts.push({
        id: `document-${document.id}`,
        severity: expirySeverity(expiry),
        title: `${document.documentType} — ${document.originalName}`,
        message: expiryMessage(document.documentType, expiry),
        href: document.driverId
          ? `/drivers/${document.driverId}`
          : document.vehicleId
            ? `/vehicles/${document.vehicleId}`
            : "/",
      });
    }
  }

  return alerts;
}
