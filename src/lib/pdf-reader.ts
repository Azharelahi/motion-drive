import { isoDateSchema } from "@/lib/validation";

export interface ExtractedPdfFields {
  registration?: string;
  vin?: string;
  licenceNumber?: string;
  expiryDate?: string;
}

export interface PdfReadResult {
  text: string;
  fields: ExtractedPdfFields;
  hasTextLayer: boolean;
}

function firstCapture(text: string, expressions: RegExp[]): string | undefined {
  for (const expression of expressions) {
    const value = expression.exec(text)?.[1]?.trim();
    if (value) return value;
  }
  return undefined;
}

function normalizeDate(value: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isoDateSchema.safeParse(value).success ? value : undefined;
  }

  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return isoDateSchema.safeParse(isoDate).success ? isoDate : undefined;
}

export function extractPdfFields(text: string): ExtractedPdfFields {
  const registration = firstCapture(text, [
    /\b(?:vehicle\s+)?(?:registration(?:\s+(?:no\.?|number))?|rego|number\s+plate)\s*[:#-]?\s*([A-Z0-9]{2,8}(?:[\s-][A-Z0-9]{1,6})?)/i,
  ]);
  const vin = firstCapture(text, [
    /\b(?:VIN|vehicle\s+identification\s+number)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-HJ-NPR-Z0-9]{11,17})\b/i,
  ]);
  const licenceNumber = firstCapture(text, [
    /\b(?:driver'?s?\s*)?licen[cs]e\s*(?:no\.?|number|#)\s*[:#-]?\s*([A-Z0-9-]{4,24})/i,
  ]);
  const rawExpiry = firstCapture(text, [
    /\b(?:date\s+of\s+)?(?:expiry|expiration|expires|valid\s+(?:to|until))(?:\s+date)?\s*[:#-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
  ]);
  const expiryDate = rawExpiry ? normalizeDate(rawExpiry) : undefined;

  return {
    ...(registration ? { registration: registration.toUpperCase().replace(/[\s-]/g, "") } : {}),
    ...(vin ? { vin: vin.toUpperCase() } : {}),
    ...(licenceNumber ? { licenceNumber: licenceNumber.toUpperCase() } : {}),
    ...(expiryDate ? { expiryDate } : {}),
  };
}

export async function readPdfDocument(data: ArrayBuffer): Promise<PdfReadResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
  try {
    const pdf = await loadingTask.promise;
    const textParts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ("str" in item) textParts.push(`${item.str}${item.hasEOL ? "\n" : " "}`);
      }
    }

    const text = textParts.join("").trim();
    return {
      text,
      fields: extractPdfFields(text),
      hasTextLayer: text.length > 0,
    };
  } finally {
    await loadingTask.destroy();
  }
}
