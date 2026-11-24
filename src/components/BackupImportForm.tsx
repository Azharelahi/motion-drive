"use client";

import { useState, type FormEvent } from "react";

interface ApiError {
  error?: string;
  details?: string;
}

export default function BackupImportForm() {
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!backupFile) {
      setError("Choose a Motion Drive backup JSON file.");
      return;
    }
    if (
      !window.confirm(
        "Restore this backup? It will replace all current records and uploaded files. This cannot be undone.",
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: backupFile,
      });

      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }

      const body = (await response.json().catch(() => null)) as ApiError | null;
      if (!response.ok) {
        throw new Error(
          [body?.error, body?.details].filter(Boolean).join(" ") ||
            `Import failed with HTTP ${response.status}.`,
        );
      }

      throw new Error("Import completed but the Dashboard redirect was not received.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Backup import failed.");
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="backup-import-title">
      <h2 id="backup-import-title">Restore a backup</h2>
      <p>
        Choose a Motion Drive backup JSON file. Restoring replaces the current records
        and uploaded files.
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="backup-file">Backup file</label>
        <input
          id="backup-file"
          type="file"
          accept=".json,application/json"
          onChange={(event) => {
            setBackupFile(event.currentTarget.files?.[0] ?? null);
            setError("");
          }}
          disabled={isSubmitting}
        />
        <button className="button button--danger" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Restoring…" : "Import backup"}
        </button>
      </form>
      {isSubmitting && <p role="status">Validating and restoring backup…</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
