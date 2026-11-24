const AUD_FORMATTER = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

const AU_DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type NumericInput = number | string | bigint | { toString(): string } | null | undefined;
export type DateInput = Date | string | null | undefined;

const EMPTY_VALUE = "—";

/** Formats an amount as Australian dollars. Missing or invalid amounts display as an em dash. */
export function formatAUD(value: NumericInput): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  if (typeof value === "string" && value.trim() === "") return EMPTY_VALUE;

  const amount = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(amount) ? AUD_FORMATTER.format(amount) : EMPTY_VALUE;
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function australianDateParts(value: DateInput): [year: number, month: number, day: number] | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/.exec(value);
    if (!isoDate) return null;

    const [, yearText, monthText, dayText, timestamp] = isoDate;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!validCalendarDate(year, month, day)) return null;

    if (!timestamp) return [year, month, day];

    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = AU_DATE_FORMATTER.formatToParts(date);
    const partValue = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const localYear = partValue("year");
    const localMonth = partValue("month");
    const localDay = partValue("day");
    return validCalendarDate(localYear, localMonth, localDay)
      ? [localYear, localMonth, localDay]
      : null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = AU_DATE_FORMATTER.formatToParts(date);
  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = partValue("year");
  const month = partValue("month");
  const day = partValue("day");

  return validCalendarDate(year, month, day) ? [year, month, day] : null;
}

/** Formats a stored ISO date or Date as DD/MM/YYYY in the Australia/Melbourne timezone. */
export function formatDateAU(value: DateInput): string {
  const parts = australianDateParts(value);
  if (!parts) return EMPTY_VALUE;

  const [year, month, day] = parts;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String(year).padStart(4, "0")}`;
}

function calendarDayNumber([year, month, day]: [number, number, number]): number {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.floor(date.getTime() / 86_400_000);
}

/** Returns whole calendar days until the date, or null when either date is missing or invalid. */
export function daysUntil(value: DateInput, from: DateInput = new Date()): number | null {
  const targetParts = australianDateParts(value);
  const fromParts = australianDateParts(from);
  if (!targetParts || !fromParts) return null;

  return calendarDayNumber(targetParts) - calendarDayNumber(fromParts);
}
