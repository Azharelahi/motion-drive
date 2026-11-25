"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { formatDateAU } from "@/lib/format";

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
}

interface DocumentResponse extends DocumentPanelRecord {
  sizeBytes: string;
}

const documentTypes: Record<DocumentEntityType, string[]> = {
  Driver: ["Licence", "Rideshare Accreditation", "Identity", "Other"],
  Vehicle: ["Registration", "Insurance", "Inspection", "Service", "Other"],
};

function expiryInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

export default function DocumentPanel({
  entityType,
  entityId,
  documents: initialDocuments,
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
    </section>
  );
}
