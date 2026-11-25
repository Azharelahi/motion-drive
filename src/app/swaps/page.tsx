"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import GlobalErrorBanner, {
  type ConfirmationPrompt,
  type GlobalAlert,
} from "@/components/GlobalErrorBanner";
import { formatAUD, formatDateAU } from "@/lib/format";

interface ActiveRental {
  id: string;
  startDate: string;
  weeklyRent: number | string;
  driver: { id: string; name: string; mobile: string };
  vehicle: {
    id: string;
    registration: string;
    make: string | null;
    model: string;
    weeklyRent: number | string;
  };
}

interface SavedSwap {
  id: string;
  swapNumber: string;
  swapDate: string;
  notes: string | null;
  newRentOne: number | string;
  newRentTwo: number | string;
  driverOne: { id: string; name: string };
  driverTwo: { id: string; name: string };
  vehicleOne: { id: string; registration: string; model: string };
  vehicleTwo: { id: string; registration: string; model: string };
}

function melbourneToday(): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function laterDate(...dates: string[]): string {
  return dates.reduce((latest, date) => (date > latest ? date : latest), "");
}

function vehicleLabel(rental: ActiveRental): string {
  return [rental.vehicle.registration, rental.vehicle.make, rental.vehicle.model]
    .filter(Boolean)
    .join(" · ");
}

export default function SwapsPage() {
  const [today] = useState(melbourneToday);
  const [activeRentals, setActiveRentals] = useState<ActiveRental[]>([]);
  const [swaps, setSwaps] = useState<SavedSwap[]>([]);
  const [driverOneId, setDriverOneId] = useState("");
  const [driverTwoId, setDriverTwoId] = useState("");
  const [swapDate, setSwapDate] = useState(today);
  const [newRentOne, setNewRentOne] = useState("");
  const [newRentTwo, setNewRentTwo] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationPrompt | null>(null);
  const [alert, setAlert] = useState<GlobalAlert | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/swaps", { cache: "no-store" });
      const body = (await response.json()) as {
        activeRentals?: ActiveRental[];
        swaps?: SavedSwap[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Could not load active rentals.");
      setActiveRentals(body.activeRentals ?? []);
      setSwaps(body.swaps ?? []);
    } catch (error) {
      setAlert({
        tone: "error",
        title: "Swap register unavailable",
        message: error instanceof Error ? error.message : "Could not load active rentals and saved swaps.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const driverOneRental = activeRentals.find((rental) => rental.driver.id === driverOneId) ?? null;
  const driverTwoRental = activeRentals.find((rental) => rental.driver.id === driverTwoId) ?? null;
  const minimumSwapDate = useMemo(
    () => laterDate(today, driverOneRental?.startDate.slice(0, 10) ?? "", driverTwoRental?.startDate.slice(0, 10) ?? ""),
    [driverOneRental, driverTwoRental, today],
  );

  function setDriverOne(id: string) {
    const rental = activeRentals.find((item) => item.driver.id === id);
    setDriverOneId(id);
    setNewRentTwo(rental?.weeklyRent.toString() ?? "");
    setNewRentOne(driverTwoRental?.weeklyRent.toString() ?? "");
    const floor = laterDate(today, rental?.startDate.slice(0, 10) ?? "", driverTwoRental?.startDate.slice(0, 10) ?? "");
    setSwapDate((current) => (current < floor ? floor : current));
  }

  function setDriverTwo(id: string) {
    const rental = activeRentals.find((item) => item.driver.id === id);
    setDriverTwoId(id);
    setNewRentOne(rental?.weeklyRent.toString() ?? "");
    setNewRentTwo(driverOneRental?.weeklyRent.toString() ?? "");
    const floor = laterDate(today, driverOneRental?.startDate.slice(0, 10) ?? "", rental?.startDate.slice(0, 10) ?? "");
    setSwapDate((current) => (current < floor ? floor : current));
  }

  function requestSwap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!driverOneRental || !driverTwoRental) {
      setAlert({
        tone: "error",
        title: "Choose two active drivers",
        message: "Both selected drivers must have an active vehicle rental.",
      });
      return;
    }

    setConfirmation({
      title: "Confirm vehicle swap?",
      message: `This will end both current rentals and start the exchange on ${formatDateAU(swapDate)}.`,
      confirmLabel: "Confirm Swap",
      destructive: true,
    });
  }

  async function completeSwap() {
    if (!driverOneRental || !driverTwoRental) return;

    setSubmitting(true);
    setAlert(null);
    try {
      const response = await fetch("/api/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swapDate,
          driverOneId,
          driverTwoId,
          vehicleOneId: driverOneRental.vehicle.id,
          vehicleTwoId: driverTwoRental.vehicle.id,
          newRentOne,
          newRentTwo,
          notes,
        }),
      });
      const body = (await response.json()) as {
        swap?: { id: string };
        error?: string;
        details?: string;
      };
      if (!response.ok) {
        throw new Error([body.error, body.details].filter(Boolean).join(" ") || "Could not complete the swap.");
      }
      if (!body.swap?.id) throw new Error("The swap was saved but no agreement ID was returned.");
      window.location.assign(`/swaps/${body.swap.id}`);
    } catch (error) {
      setConfirmation(null);
      setAlert({
        tone: "error",
        title: "Swap could not be completed",
        message: error instanceof Error ? error.message : "Could not complete the vehicle swap.",
      });
      setSubmitting(false);
    }
  }

  const confirmationPrompt = confirmation
    ? { ...confirmation, confirmLabel: submitting ? "Saving swap…" : confirmation.confirmLabel }
    : null;

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Swap Cars</h1>
          <p>Exchange vehicles between two drivers with active rentals.</p>
        </div>
      </div>

      <GlobalErrorBanner
        alert={alert}
        onDismissAlert={() => setAlert(null)}
        confirmation={confirmationPrompt}
        onConfirm={completeSwap}
        onCancel={() => {
          if (!submitting) setConfirmation(null);
        }}
      />

      {loading ? (
        <p role="status">Loading active rentals and saved swaps…</p>
      ) : (
        <>
          <form className="register-form swap-form" onSubmit={requestSwap}>
            <h2>Arrange a vehicle swap</h2>
            {activeRentals.length < 2 ? (
              <p className="form-hint">At least two active rentals are required to make a swap.</p>
            ) : null}

            <div className="swap-grid">
              <label>
                Driver one *
                <select required value={driverOneId} onChange={(event) => setDriverOne(event.target.value)}>
                  <option value="">Select an active driver</option>
                  {activeRentals.map((rental) => (
                    <option
                      key={rental.id}
                      value={rental.driver.id}
                      disabled={rental.driver.id === driverTwoId}
                    >
                      {rental.driver.name} · {rental.vehicle.registration}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Driver two *
                <select required value={driverTwoId} onChange={(event) => setDriverTwo(event.target.value)}>
                  <option value="">Select another active driver</option>
                  {activeRentals.map((rental) => (
                    <option
                      key={rental.id}
                      value={rental.driver.id}
                      disabled={rental.driver.id === driverOneId}
                    >
                      {rental.driver.name} · {rental.vehicle.registration}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="swap-preview-grid" aria-live="polite">
              {[driverOneRental, driverTwoRental].map((rental, index) => {
                const other = index === 0 ? driverTwoRental : driverOneRental;
                return (
                  <article className="swap-preview-card" key={index}>
                    <h3>{index === 0 ? "Driver one" : "Driver two"}</h3>
                    {rental ? (
                      <>
                        <strong>{rental.driver.name}</strong>
                        <span>Currently in: {vehicleLabel(rental)}</span>
                        <span>Weekly rent now: {formatAUD(rental.weeklyRent)}</span>
                        <span>
                          Will receive: {other ? vehicleLabel(other) : "Select the other driver"}
                        </span>
                      </>
                    ) : (
                      <p>Select an active driver to preview the exchange.</p>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="swap-grid swap-form__terms">
              <label>
                Swap date *
                <input
                  type="date"
                  required
                  min={minimumSwapDate}
                  value={swapDate}
                  onChange={(event) => setSwapDate(event.target.value)}
                />
              </label>
              <label>
                Driver one new weekly rent (AUD) *
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={newRentOne}
                  onChange={(event) => setNewRentOne(event.target.value)}
                />
              </label>
              <label>
                Driver two new weekly rent (AUD) *
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={newRentTwo}
                  onChange={(event) => setNewRentTwo(event.target.value)}
                />
              </label>
              <label className="swap-form__notes">
                Notes
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional notes for the swap agreement"
                />
              </label>
            </div>

            <div className="register-form__actions">
              <button
                className="button button--primary"
                type="submit"
                disabled={submitting || activeRentals.length < 2}
              >
                Review and confirm swap
              </button>
            </div>
          </form>

          <section className="saved-swaps" aria-labelledby="saved-swaps-title">
            <h2 id="saved-swaps-title">Saved Vehicle Swaps</h2>
            {swaps.length === 0 ? (
              <p>No saved vehicle swaps yet.</p>
            ) : (
              <div className="contracts-table-wrap">
                <table className="saved-swaps-table">
                  <thead>
                    <tr>
                      <th scope="col">Swap</th>
                      <th scope="col">Date</th>
                      <th scope="col">Drivers</th>
                      <th scope="col">Vehicle exchange</th>
                      <th scope="col">New weekly rents</th>
                      <th scope="col">Agreement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {swaps.map((swap) => (
                      <tr key={swap.id}>
                        <td data-label="Swap">{swap.swapNumber}</td>
                        <td data-label="Date">{formatDateAU(swap.swapDate)}</td>
                        <td data-label="Drivers">
                          {swap.driverOne.name}<br />{swap.driverTwo.name}
                        </td>
                        <td data-label="Vehicle exchange">
                          {swap.vehicleOne.registration} ↔ {swap.vehicleTwo.registration}
                        </td>
                        <td data-label="New weekly rents">
                          {formatAUD(swap.newRentOne)} / {formatAUD(swap.newRentTwo)}
                        </td>
                        <td data-label="Agreement">
                          <Link className="button button--secondary" href={`/swaps/${swap.id}`}>
                            Open Agreement
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
      )}
    </section>
  );
}
