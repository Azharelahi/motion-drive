"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import GlobalErrorBanner, {
  type ConfirmationPrompt,
  type GlobalAlert,
} from "@/components/GlobalErrorBanner";
import { filterContracts, type ContractSearchFields } from "@/lib/contracts";
import { formatAUD, formatDateAU } from "@/lib/format";

interface ContractRow extends ContractSearchFields {
  id: string;
  status: string;
  startDate: string;
  weeklyRent: number | string;
}

type ContractAction = {
  contract: ContractRow;
  action: "end" | "reopen";
};

function actionPrompt(pending: ContractAction | null): ConfirmationPrompt | null {
  if (!pending) return null;
  const isEnd = pending.action === "end";

  return {
    title: isEnd ? "Mark contract ended?" : "Reopen contract?",
    message: isEnd
      ? `End ${pending.contract.contractNumber}? Its vehicle will become available and its driver will be marked ended, unless another active contract still uses either one.`
      : `Reopen ${pending.contract.contractNumber}? This will make its vehicle and driver active again.`,
    confirmLabel: isEnd ? "Mark Ended" : "Reopen",
    destructive: isEnd,
  };
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<GlobalAlert | null>(null);
  const [pendingAction, setPendingAction] = useState<ContractAction | null>(null);

  const loadContracts = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch("/api/contracts", { cache: "no-store" });
      const body = (await response.json()) as {
        contracts?: ContractRow[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Could not load saved contracts.");
      setContracts(body.contracts ?? []);
      return true;
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Contract register unavailable",
        message: error instanceof Error ? error.message : "Could not load saved contracts.",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  const visibleContracts = useMemo(
    () => filterContracts(contracts, search),
    [contracts, search],
  );

  async function completeAction() {
    if (!pendingAction) return;

    const { contract, action } = pendingAction;
    try {
      const response = await fetch(`/api/contracts/${contract.id}/${action}`, {
        method: "POST",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Could not ${action} contract.`);

      setPendingAction(null);
      if (await loadContracts()) {
        setAlert({
          tone: "success",
          title: action === "end" ? "Contract ended" : "Contract reopened",
          message: `${contract.contractNumber} was ${action === "end" ? "marked ended" : "reopened"}.`,
        });
      }
    } catch (error) {
      setPendingAction(null);
      const message = error instanceof Error ? error.message : "The contract action failed.";
      const refreshed = await loadContracts();
      setAlert({
        tone: "error",
        title: action === "end" ? "Could not end contract" : "Could not reopen contract",
        message: refreshed ? message : `${message} The contract list could not be refreshed.`,
      });
    }
  }

  const confirmation = actionPrompt(pendingAction);

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Saved Contracts</h1>
          <p>Search rental agreements, open the document, or manage their status.</p>
        </div>
        <Link className="button button--primary" href="/rentals/new">Create New Contract</Link>
      </div>

      <GlobalErrorBanner
        alert={alert}
        onDismissAlert={() => setAlert(null)}
        confirmation={confirmation}
        onConfirm={completeAction}
        onCancel={() => setPendingAction(null)}
      />

      <label className="contract-search">
        Search contracts
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Contract, driver, mobile, registration, or model"
        />
      </label>

      {loading ? (
        <p role="status">Loading saved contracts…</p>
      ) : contracts.length === 0 ? (
        <p>No saved contracts yet.</p>
      ) : visibleContracts.length === 0 ? (
        <p>No contracts match “{search}”.</p>
      ) : (
        <div className="contracts-table-wrap">
          <table className="contracts-table">
            <thead>
              <tr>
                <th scope="col">Contract</th>
                <th scope="col">Driver</th>
                <th scope="col">Mobile</th>
                <th scope="col">Vehicle</th>
                <th scope="col">Start</th>
                <th scope="col">Rent / week</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleContracts.map((contract) => (
                <tr key={contract.id}>
                  <td data-label="Contract">{contract.contractNumber}</td>
                  <td data-label="Driver">{contract.driver.name}</td>
                  <td data-label="Mobile">{contract.driver.mobile}</td>
                  <td data-label="Vehicle">
                    <strong>{contract.vehicle.registration}</strong>
                    <span className="contracts-table__model">
                      {[contract.vehicle.make, contract.vehicle.model].filter(Boolean).join(" ")}
                    </span>
                  </td>
                  <td data-label="Start">{formatDateAU(contract.startDate)}</td>
                  <td data-label="Rent / week">{formatAUD(contract.weeklyRent)}</td>
                  <td data-label="Status">
                    <span
                      className={`contract-status ${contract.status === "Active" ? "contract-status--active" : "contract-status--ended"}`}
                    >
                      {contract.status}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="contracts-table__actions">
                      <Link
                        className="button button--secondary"
                        href={`/contracts/${contract.id}`}
                      >
                        Open
                      </Link>
                      {contract.status === "Active" ? (
                        <button
                          className="button button--danger"
                          type="button"
                          onClick={() => setPendingAction({ contract, action: "end" })}
                        >
                          Mark Ended
                        </button>
                      ) : contract.status === "Ended" ? (
                        <button
                          className="button button--primary"
                          type="button"
                          onClick={() => setPendingAction({ contract, action: "reopen" })}
                        >
                          Reopen
                        </button>
                      ) : null}
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
