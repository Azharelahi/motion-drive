"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { formatDateAU } from "@/lib/format";
import { readPdfDocument, type ExtractedPdfFields } from "@/lib/pdf-reader";

export type DocumentEntityType = "Driver" | "Vehicle";

export interface DocumentPanelRecord {
  id: string;
  documentType: string;
  originalName: string;
  expiryDate: string | null;
  createdAt: string;
}

interface DocumentPanelProps {
  entityType: DocumentEntityType;
  entityId: string;
  documents: DocumentPanelRecord[];
  onProfileUpdated?: () => Promise<void>;
}

interface DocumentResponse extends DocumentPanelRecord {
  sizeBytes: string;
}

interface ReadProposal {
  key: string;
  label: string;
  value: string;
}

interface ReadUpdateModal {
  document: DocumentPanelRecord;
  proposals: ReadProposal[];
  expiryTarget: string | null;
  scanned: boolean;
}

const documentTypes: Record<DocumentEntityType, string[]> = {
  Driver: ["Licence", "Rideshare Accreditation", "Identity", "Other"],
  Vehicle: ["Registration", "Insurance", "Inspection", "Service", "Other"],
};

function expiryInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function expiryProfileField(
  entityType: DocumentEntityType,
  documentType: string,
): string | null {
  if (entityType === "Driver") {
    return documentType === "Rideshare Accreditation"
      ? "rideshareAccreditationExpiry"
      : "licenceExpiry";
  }
  if (documentType === "Insurance") return "insuranceExpiry";
  if (documentType === "Inspection") return "inspectionExpiry";
  if (documentType === "Registration") return "registrationExpiry";
  return null;
}

function createReadProposals(
  fields: ExtractedPdfFields,
  entityType: DocumentEntityType,
  documentType: string,
): ReadProposal[] {
  const proposals: ReadProposal[] = [];
  if (entityType === "Vehicle") {
    if (fields.registration) {
      proposals.push({ key: "registration", label: "Registration", value: fields.registration });
    }
    if (fields.vin) proposals.push({ key: "vin", label: "VIN", value: fields.vin });
  } else if (fields.licenceNumber) {
    proposals.push({
      key: "licenceNumber",
      label: "Licence number",
      value: fields.licenceNumber,
    });
  }

  if (fields.expiryDate) {
    const target = expiryProfileField(entityType, documentType);
    proposals.push({
      key: target ?? "documentExpiry",
      label: target ? "Profile expiry date" : "Document expiry date",
      value: fields.expiryDate,
    });
  }
  return proposals;
}

export default function DocumentPanel({
  entityType,
  entityId,
  documents: initialDocuments,
  onProfileUpdated,
}: DocumentPanelProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [expiryValues, setExpiryValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialDocuments.map((document) => [document.id, expiryInputValue(document.expiryDate)]),
    ),
  );
  const [documentType, setDocumentType] = useState(documentTypes[entityType][0]);
  const [expiryDate, setExpiryDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [readModal, setReadModal] = useState<ReadUpdateModal | null>(null);
  const [proposalValues, setProposalValues] = useState<Record<string, string>>({});
  const [selectedProposals, setSelectedProposals] = useState<Record<string, boolean>>({});
  const [manualExpiry, setManualExpiry] = useState("");
  const [applyingUpdates, setApplyingUpdates] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setDocuments(initialDocuments);
    setExpiryValues(
      Object.fromEntries(
        initialDocuments.map((document) => [document.id, expiryInputValue(document.expiryDate)]),
      ),
    );
  }, [entityId, initialDocuments]);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.currentTarget.files ?? []));
    setError("");
    setSuccess("");
  }

  async function uploadDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (files.length === 0) {
      setError("Choose at least one file to upload.");
      return;
    }

    const formData = new FormData();
    formData.set("entityType", entityType);
    formData.set("entityId", entityId);
    formData.set("documentType", documentType);
    formData.set("expiryDate", expiryDate);
    for (const file of files) formData.append("files", file);

    try {
      const response = await fetch("/api/documents", { method: "POST", body: formData });
      const body = (await response.json().catch(() => null)) as
        | { documents?: DocumentResponse[]; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? `Upload failed with HTTP ${response.status}.`);
      }
      if (!body?.documents) throw new Error("Upload succeeded but the document list was not returned.");

      setDocuments((current) => [...body.documents!, ...current]);
      setExpiryValues((current) => ({
        ...current,
        ...Object.fromEntries(
          body.documents!.map((document) => [document.id, expiryInputValue(document.expiryDate)]),
        ),
      }));
      setFiles([]);
      setExpiryDate("");
      setSuccess(`${body.documents.length} document${body.documents.length === 1 ? "" : "s"} uploaded.`);
      const fileInput = document.getElementById(`document-files-${entityId}`);
      if (fileInput instanceof HTMLInputElement) fileInput.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document upload failed.");
    }
  }

  async function updateExpiry(documentId: string, value: string) {
    setUpdatingId(documentId);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiryDate: value || null }),
      });
      const body = (await response.json().catch(() => null)) as
        | { document?: DocumentResponse; error?: string }
        | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not update document expiry.");
      if (!body?.document) throw new Error("Expiry update succeeded but no document was returned.");
      setDocuments((current) =>
        current.map((document) => (document.id === documentId ? body.document! : document)),
      );
      setExpiryValues((current) => ({
        ...current,
        [documentId]: expiryInputValue(body.document!.expiryDate),
      }));
      setSuccess("Document expiry updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update document expiry.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteDocument(document: DocumentPanelRecord) {
    if (!window.confirm(`Delete "${document.originalName}"? This cannot be undone.`)) return;
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Delete failed with HTTP ${response.status}.`);
      }
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setSuccess("Document deleted.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete document.");
    }
  }

  async function readAndUpdate(document: DocumentPanelRecord) {
    setReadingId(document.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/documents/${document.id}/file`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Could not read the PDF (HTTP ${response.status}).`);
      }

      const result = await readPdfDocument(await response.arrayBuffer());
      const proposals = createReadProposals(result.fields, entityType, document.documentType);
      setReadModal({
        document,
        proposals,
        expiryTarget: expiryProfileField(entityType, document.documentType),
        scanned: !result.hasTextLayer,
      });
      setProposalValues(Object.fromEntries(proposals.map((proposal) => [proposal.key, proposal.value])));
      setSelectedProposals(Object.fromEntries(proposals.map((proposal) => [proposal.key, true])));
      setManualExpiry("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the PDF.");
    } finally {
      setReadingId(null);
    }
  }

  async function applyReadUpdates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!readModal) return;

    const selected = readModal.proposals.filter((proposal) => selectedProposals[proposal.key]);
    const changes: Record<string, string> = {};
    for (const proposal of selected) {
      const value = proposalValues[proposal.key]?.trim();
      if (value) changes[proposal.key] = value;
    }

    const expiryProposal = selected.find(
      (proposal) =>
        proposal.key === readModal.expiryTarget || proposal.key === "documentExpiry",
    );
    const expiryValue = manualExpiry || (expiryProposal ? proposalValues[expiryProposal.key] : "");
    if (manualExpiry && readModal.expiryTarget) {
      changes[readModal.expiryTarget] = manualExpiry;
    }
    delete changes.documentExpiry;

    if (Object.keys(changes).length === 0 && !expiryValue) {
      setError("Select a proposed update or enter an expiry date.");
      return;
    }

    setApplyingUpdates(true);
    setError("");
    setSuccess("");
    let profileUpdated = false;
    try {
      if (Object.keys(changes).length > 0) {
        const response = await fetch(`/api/${entityType.toLowerCase()}s/${entityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
        const body = (await response.json().catch(() => null)) as { error?: string; details?: string } | null;
        if (!response.ok) {
          throw new Error([body?.error, body?.details].filter(Boolean).join(" ") || "Could not apply profile updates.");
        }
        profileUpdated = true;
      }

      if (expiryValue) {
        const response = await fetch(`/api/documents/${readModal.document.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiryDate: expiryValue }),
        });
        const body = (await response.json().catch(() => null)) as
          | { document?: DocumentResponse; error?: string }
          | null;
        if (!response.ok) {
          const reason = body?.error ?? "Could not update the document expiry.";
          throw new Error(
            profileUpdated
              ? `Profile updates were saved, but the document expiry was not updated. ${reason}`
              : reason,
          );
        }
        setDocuments((current) =>
          current.map((document) =>
            document.id === readModal.document.id
              ? { ...document, expiryDate: body?.document?.expiryDate ?? expiryValue }
              : document,
          ),
        );
        setExpiryValues((current) => ({ ...current, [readModal.document.id]: expiryValue }));
      }

      if (profileUpdated) await onProfileUpdated?.();
      setReadModal(null);
      setSuccess("Confirmed updates were applied.");
    } catch (cause) {
      if (profileUpdated) await onProfileUpdated?.();
      setError(cause instanceof Error ? cause.message : "Could not apply the proposed updates.");
    } finally {
      setApplyingUpdates(false);
    }
  }

  return (
    <section className="profile-card document-panel" aria-labelledby={`documents-title-${entityId}`}>
      <h2 id={`documents-title-${entityId}`}>{entityType} Documents</h2>
      <form className="document-upload" onSubmit={uploadDocuments}>
        <label>
          Document type
          <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
            {documentTypes[entityType].map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label>
          Expiry date (optional)
          <input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
        </label>
        <label className="document-upload__files">
          Files (up to 25 MB each)
          <input
            id={`document-files-${entityId}`}
            type="file"
            multiple
            accept=".pdf,.html,.htm,.txt,.json,.doc,.docx,image/*"
            onChange={chooseFiles}
          />
        </label>
        <button className="button button--primary" type="submit">Upload documents</button>
      </form>

      {error ? <p className="document-panel__error" role="alert">{error}</p> : null}
      {success ? <p className="document-panel__success" role="status">{success}</p> : null}

      {documents.length === 0 ? (
        <p>No documents uploaded.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Document</th><th>Expiry</th><th>Uploaded</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>{document.documentType} · {document.originalName}</td>
                  <td>
                    <label className="visually-hidden" htmlFor={`expiry-${document.id}`}>Expiry date for {document.originalName}</label>
                    <input
                      id={`expiry-${document.id}`}
                      type="date"
                      value={expiryValues[document.id] ?? expiryInputValue(document.expiryDate)}
                      onChange={(event) =>
                        setExpiryValues((current) => ({
                          ...current,
                          [document.id]: event.target.value,
                        }))
                      }
                    />
                    <button
                      className="button button--secondary document-panel__expiry-save"
                      type="button"
                      disabled={updatingId === document.id}
                      onClick={() =>
                        void updateExpiry(
                          document.id,
                          expiryValues[document.id] ?? expiryInputValue(document.expiryDate),
                        )
                      }
                    >
                      {updatingId === document.id ? "Saving…" : "Save expiry"}
                    </button>
                  </td>
                  <td>{formatDateAU(document.createdAt)}</td>
                  <td>
                    <div className="table-actions">
                      <a
                        className="button button--secondary"
                        href={`/api/documents/${document.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </a>
                      <a
                        className="button button--secondary"
                        href={`/api/documents/${document.id}/file?download=1`}
                      >
                        Download
                      </a>
                      {document.originalName.toLowerCase().endsWith(".pdf") ? (
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={readingId === document.id}
                          onClick={() => void readAndUpdate(document)}
                        >
                          {readingId === document.id ? "Reading…" : "Read & Update"}
                        </button>
                      ) : null}
                      <button
                        className="button button--danger"
                        type="button"
                        onClick={() => void deleteDocument(document)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {readModal ? (
        <div className="document-modal-backdrop">
          <section
            className="document-read-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-read-title"
          >
            <h2 id="document-read-title">Read &amp; Update</h2>
            <p className="document-read-modal__filename">{readModal.document.originalName}</p>
            {readModal.scanned || readModal.proposals.length === 0 ? (
              <p className="document-read-modal__manual-note" role="status">
                {readModal.scanned
                  ? "This PDF has no selectable text, as with a scanned image. Enter the expiry date manually."
                  : "No supported profile fields were detected. You can enter the expiry date manually."}
              </p>
            ) : (
              <p>Review the proposed values. Only checked updates will be applied.</p>
            )}

            <form onSubmit={applyReadUpdates}>
              {readModal.proposals.map((proposal) => (
                <label className="document-read-proposal" key={proposal.key}>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedProposals[proposal.key])}
                    onChange={(event) =>
                      setSelectedProposals((current) => ({
                        ...current,
                        [proposal.key]: event.target.checked,
                      }))
                    }
                  />
                  <span>{proposal.label}</span>
                  <input
                    aria-label={`Proposed ${proposal.label}`}
                    type={proposal.key.toLowerCase().includes("expiry") ? "date" : "text"}
                    value={proposalValues[proposal.key] ?? ""}
                    onChange={(event) =>
                      setProposalValues((current) => ({
                        ...current,
                        [proposal.key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}

              <label className="document-read-modal__expiry">
                {readModal.expiryTarget ? "Manual profile expiry date" : "Manual document expiry date"}
                <input
                  type="date"
                  value={manualExpiry}
                  onChange={(event) => setManualExpiry(event.target.value)}
                />
              </label>
              <div className="document-read-modal__actions">
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={applyingUpdates}
                  onClick={() => setReadModal(null)}
                >
                  Cancel
                </button>
                <button className="button button--primary" type="submit" disabled={applyingUpdates}>
                  {applyingUpdates ? "Applying…" : "Apply selected updates"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
