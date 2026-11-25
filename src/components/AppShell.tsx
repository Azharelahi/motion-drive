"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CarFront,
  Download,
  LayoutDashboard,
  Upload,
  UserRound,
  FileText,
  Plus,
} from "lucide-react";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";

const navigation = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
  { label: "Vehicle Register", href: "/vehicles", icon: CarFront, exact: false },
  { label: "Driver Register", href: "/drivers", icon: UserRound, exact: false },
  { label: "New Rental", href: "/rentals/new", icon: Plus, exact: false },
  { label: "Swap Cars", href: "/swaps", icon: ArrowLeftRight, exact: false },
  { label: "Saved Contracts", href: "/contracts", icon: FileText, exact: false },
] as const;

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  async function exportBackup() {
    setMessage("");
    try {
      const response = await fetch("/api/backup/export");
      if (!response.ok) throw new Error("Backup export failed.");

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/i);
      const filename =
        filenameMatch?.[1] ?? `MotionDrive_Backup_${new Date().toISOString().slice(0, 10)}.json`;

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup export failed.");
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (
      !window.confirm(
        "Restore this backup? It will replace all current records and uploaded files. This cannot be undone.",
      )
    ) {
      return;
    }

    setImporting(true);
    setMessage("");
    try {
      const response = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: file,
      });
      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }
      const body = (await response.json().catch(() => null)) as
        | { error?: string; details?: string }
        | null;
      throw new Error(
        [body?.error, body?.details].filter(Boolean).join(" ") ||
          `Import failed with HTTP ${response.status}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="brand" href="/" aria-label="Motion Drive Dashboard">
          <span className="brand__mark" aria-hidden="true">
            MD
          </span>
          <span className="brand__text">
            <strong>Motion Drive</strong>
            <small>Pty Ltd</small>
          </span>
        </Link>

        <nav className="app-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                className={`app-nav__link${active ? " app-nav__link--active" : ""}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" size={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <div className="app-topbar__title">
            <strong>Motion Drive Rental Manager</strong>
            <span>Motion Drive Pty Ltd</span>
          </div>
          <div className="app-topbar__actions" aria-label="Backup actions">
            <button className="button button--secondary" type="button" onClick={exportBackup}>
              <Download aria-hidden="true" size={17} />
              Export backup
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
            >
              <Upload aria-hidden="true" size={17} />
              {importing ? "Importing…" : "Import backup"}
            </button>
            <input
              ref={importInputRef}
              className="visually-hidden"
              type="file"
              accept=".json,application/json"
              onChange={importBackup}
              disabled={importing}
              aria-label="Choose backup file"
            />
          </div>
        </header>

        {message ? (
          <div className="app-shell__message" role="alert">
            {message}
          </div>
        ) : null}

        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
