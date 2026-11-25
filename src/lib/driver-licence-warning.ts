import { daysUntil, type DateInput } from "@/lib/format";
import { isoDateSchema } from "@/lib/validation";

export type LicenceExpiryWarning =
  | { kind: "missing"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "expired"; message: string }
  | { kind: "soon"; message: string };

export function getLicenceExpiryWarning(
  expiry: string | null | undefined,
  today: DateInput = new Date(),
): LicenceExpiryWarning | null {
  if (!expiry) {
    return { kind: "missing", message: "Driver licence expiry date is missing." };
  }
  if (!isoDateSchema.safeParse(expiry).success) {
    return { kind: "invalid", message: "Driver licence expiry date is invalid." };
  }

  const remainingDays = daysUntil(expiry, today);
  if (remainingDays === null) {
    return { kind: "invalid", message: "Driver licence expiry date is invalid." };
  }
  if (remainingDays < 0) {
    return { kind: "expired", message: "Driver licence has expired." };
  }
  if (remainingDays <= 90) {
    return {
      kind: "soon",
      message:
        remainingDays === 0
          ? "Driver licence expires today."
          : `Driver licence expires in ${remainingDays} days.`,
    };
  }

  return null;
}
