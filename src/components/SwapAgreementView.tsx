import Link from "next/link";
import PrintContractButton from "@/components/PrintContractButton";
import { companyDetails } from "@/lib/contract-terms";
import { formatAUD, formatDateAU } from "@/lib/format";

interface SwapAgreement {
  swapNumber: string;
  swapDate: Date;
  notes: string | null;
  newRentOne: number | string;
  newRentTwo: number | string;
  driverOne: { name: string };
  driverTwo: { name: string };
  vehicleOne: { registration: string; make: string | null; model: string };
  vehicleTwo: { registration: string; make: string | null; model: string };
}

function vehicleName(vehicle: SwapAgreement["vehicleOne"]): string {
  return [vehicle.registration, vehicle.make, vehicle.model].filter(Boolean).join(" · ");
}

export default function SwapAgreementView({ swap }: { swap: SwapAgreement }) {
  const date = formatDateAU(swap.swapDate);
  const terms = [
    {
      title: "Effective date",
      text: `The exchange takes effect on ${date}. The outgoing rental agreements end on that date and replacement agreements begin.`,
    },
    {
      title: "Vehicle exchange",
      text: `${swap.driverOne.name} takes the vehicle currently assigned to ${swap.driverTwo.name}; ${swap.driverTwo.name} takes the vehicle currently assigned to ${swap.driverOne.name}.`,
    },
    {
      title: "Weekly rent",
      text: `${swap.driverOne.name}'s new weekly rent is ${formatAUD(swap.newRentOne)}. ${swap.driverTwo.name}'s new weekly rent is ${formatAUD(swap.newRentTwo)}, effective from the swap date.`,
    },
    {
      title: "Continuing rental terms",
      text: "Each driver's existing rental terms continue except for the exchanged vehicle, the weekly rent recorded here, and vehicle-specific bond, excess, and kilometre allowance details.",
    },
    {
      title: "Handover and vehicle care",
      text: "Each driver should check the received vehicle at handover, promptly raise any existing damage or safety concern, and continue to comply with the applicable rental agreement.",
    },
  ];

  return (
    <>
      <div className="contract-view-toolbar">
        <div>
          <p>Vehicle exchange agreement · {swap.swapNumber}</p>
          <Link className="button button--secondary" href="/swaps">Back to Swaps</Link>
        </div>
        <PrintContractButton label="Print Agreement" />
      </div>

      <article className="rental-contract-view swap-agreement-view" aria-labelledby="swap-agreement-title">
        <header className="rental-contract-view__header">
          <div className="rental-contract-view__brand">
            <span className="rental-contract-view__logo" aria-hidden="true">MD</span>
            <div>
              <p className="rental-contract-view__eyebrow">Vehicle swap agreement</p>
              <h1 id="swap-agreement-title">{companyDetails.name}</h1>
              <p>Swap {swap.swapNumber}</p>
            </div>
          </div>
          <dl className="rental-contract-view__terms swap-agreement-view__meta">
            <div><dt>Swap date</dt><dd>{date}</dd></div>
            <div><dt>Agreement number</dt><dd>{swap.swapNumber}</dd></div>
          </dl>
        </header>

        <p className="rental-contract-view__draft-note">
          Draft for review. Confirm the vehicle exchange, new rents, and terms before signing.
        </p>

        <section className="rental-contract-view__section">
          <h2>Vehicle exchange</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">Driver</th>
                <th scope="col">Vehicle exchanged</th>
                <th scope="col">Vehicle received</th>
                <th scope="col">New weekly rent</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{swap.driverOne.name}</th>
                <td>{vehicleName(swap.vehicleOne)}</td>
                <td>{vehicleName(swap.vehicleTwo)}</td>
                <td>{formatAUD(swap.newRentOne)}</td>
              </tr>
              <tr>
                <th scope="row">{swap.driverTwo.name}</th>
                <td>{vehicleName(swap.vehicleTwo)}</td>
                <td>{vehicleName(swap.vehicleOne)}</td>
                <td>{formatAUD(swap.newRentTwo)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="rental-contract-view__section swap-agreement-view__terms">
          <h2>Agreed terms</h2>
          <ol>
            {terms.map((term) => (
              <li className="swap-agreement-view__term" key={term.title}>
                <h3>{term.title}</h3>
                <p>{term.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="rental-contract-view__section">
          <h2>Notes</h2>
          <p className="swap-agreement-view__notes">{swap.notes?.trim() || "No additional notes recorded."}</p>
        </section>

        <section className="rental-contract-view__section rental-contract-view__signatures">
          <h2>Signatures</h2>
          <p>By signing below, each party acknowledges the vehicle exchange and the agreed terms above.</p>
          <div className="rental-contract-view__signature-grid swap-agreement-view__signatures">
            <div><span>Driver one — {swap.driverOne.name}</span><i aria-hidden="true" /></div>
            <div><span>Driver two — {swap.driverTwo.name}</span><i aria-hidden="true" /></div>
            <div><span>Company representative</span><i aria-hidden="true" /></div>
          </div>
        </section>

        <footer className="rental-contract-view__footer">
          {swap.swapNumber} · {companyDetails.name}
        </footer>
      </article>
    </>
  );
}
