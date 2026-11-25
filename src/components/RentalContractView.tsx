import { formatAUD, formatDateAU } from "@/lib/format";
import { annexureAClauses, companyDetails } from "@/lib/contract-terms";
import PrintContractButton from "@/components/PrintContractButton";

interface ContractDocument {
  contractNumber: string;
  status: string;
  agreementDate: Date | null;
  startDate: Date;
  endDate: Date | null;
  weeklyRent: number | string;
  bond: number | string;
  excess: number | string;
  kmAllowance: string;
  term: string;
  noticePeriod: string;
  paymentFrequency: string;
  paymentMethod: string;
  rideshareUse: boolean;
  privateUse: boolean;
  driver: {
    name: string;
    mobile: string;
    email: string | null;
    dateOfBirth: Date | null;
    address: string | null;
    licenceNumber: string | null;
    licenceState: string | null;
    licenceExpiry: Date | null;
    rideshareAccreditation: string | null;
  };
  vehicle: {
    registration: string;
    make: string | null;
    model: string;
    year: number | null;
    colour: string | null;
    vin: string | null;
    pickupLocation: string;
  };
}

function valueOrDash(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function permitted(value: boolean): string {
  return value ? "Permitted" : "Not permitted";
}

export default function RentalContractView({ contract }: { contract: ContractDocument }) {
  return (
    <>
      <div className="contract-view-toolbar">
        <p>Draft template: confirm company details and have terms reviewed before signing.</p>
        <PrintContractButton />
      </div>

      <article className="rental-contract-view" aria-labelledby="contract-title">
        <header className="rental-contract-view__header">
          <div className="rental-contract-view__brand">
            <span className="rental-contract-view__logo" aria-hidden="true">MD</span>
            <div>
              <p className="rental-contract-view__eyebrow">Vehicle rental agreement</p>
              <h1 id="contract-title">{companyDetails.name}</h1>
              <p>Contract {contract.contractNumber}</p>
            </div>
          </div>
          <div className="rental-contract-view__company" aria-label="Company details">
            <strong>Company details</strong>
            <span>ABN: {companyDetails.abn}</span>
            <span>Address: {companyDetails.address}</span>
            <span>Email: {companyDetails.email}</span>
            <span>Phone: {companyDetails.phone}</span>
          </div>
        </header>

        <p className="rental-contract-view__draft-note">
          Draft for review. Complete the company details and have this agreement checked before use.
        </p>

        <section className="rental-contract-view__section">
          <h2>Agreement summary</h2>
          <dl className="rental-contract-view__terms">
            <div><dt>Status</dt><dd>{contract.status}</dd></div>
            <div><dt>Agreement date</dt><dd>{formatDateAU(contract.agreementDate)}</dd></div>
            <div><dt>Rental period</dt><dd>{formatDateAU(contract.startDate)} – {formatDateAU(contract.endDate) === "—" ? "Ongoing" : formatDateAU(contract.endDate)}</dd></div>
            <div><dt>Weekly rent</dt><dd>{formatAUD(contract.weeklyRent)}</dd></div>
            <div><dt>Bond</dt><dd>{formatAUD(contract.bond)}</dd></div>
            <div><dt>Insurance excess</dt><dd>{formatAUD(contract.excess)}</dd></div>
            <div><dt>Payment</dt><dd>{contract.paymentFrequency} · {contract.paymentMethod}</dd></div>
            <div><dt>Rental term</dt><dd>{contract.term}</dd></div>
            <div><dt>Notice period</dt><dd>{contract.noticePeriod}</dd></div>
            <div><dt>Kilometre allowance</dt><dd>{contract.kmAllowance}</dd></div>
          </dl>
        </section>

        <section className="rental-contract-view__section">
          <h2>Driver details</h2>
          <table>
            <tbody>
              <tr><th scope="row">Full name</th><td>{contract.driver.name}</td><th scope="row">Date of birth</th><td>{formatDateAU(contract.driver.dateOfBirth)}</td></tr>
              <tr><th scope="row">Mobile</th><td>{contract.driver.mobile}</td><th scope="row">Email</th><td>{valueOrDash(contract.driver.email)}</td></tr>
              <tr><th scope="row">Address</th><td colSpan={3}>{valueOrDash(contract.driver.address)}</td></tr>
              <tr><th scope="row">Licence number</th><td>{valueOrDash(contract.driver.licenceNumber)}</td><th scope="row">Licence state</th><td>{valueOrDash(contract.driver.licenceState)}</td></tr>
              <tr><th scope="row">Licence expiry</th><td>{formatDateAU(contract.driver.licenceExpiry)}</td><th scope="row">Rideshare accreditation</th><td>{valueOrDash(contract.driver.rideshareAccreditation)}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="rental-contract-view__section">
          <h2>Vehicle details</h2>
          <table>
            <tbody>
              <tr><th scope="row">Registration</th><td>{contract.vehicle.registration}</td><th scope="row">Make / model</th><td>{[contract.vehicle.make, contract.vehicle.model].filter(Boolean).join(" ")}</td></tr>
              <tr><th scope="row">Year</th><td>{valueOrDash(contract.vehicle.year)}</td><th scope="row">Colour</th><td>{valueOrDash(contract.vehicle.colour)}</td></tr>
              <tr><th scope="row">VIN</th><td>{valueOrDash(contract.vehicle.vin)}</td><th scope="row">Pickup location</th><td>{contract.vehicle.pickupLocation}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="rental-contract-view__section rental-contract-view__key-terms">
          <h2>Key terms</h2>
          <ul>
            <li>Weekly rent of <strong>{formatAUD(contract.weeklyRent)}</strong>, payable {contract.paymentFrequency.toLowerCase()} by {contract.paymentMethod}.</li>
            <li>Bond of <strong>{formatAUD(contract.bond)}</strong> and stated insurance excess of <strong>{formatAUD(contract.excess)}</strong>.</li>
            <li>Rideshare use: <strong>{permitted(contract.rideshareUse)}</strong>. Private use: <strong>{permitted(contract.privateUse)}</strong>.</li>
            <li>Only the named driver may use the vehicle unless the company gives prior written approval.</li>
          </ul>
        </section>

        <section className="rental-contract-view__section rental-contract-view__annexure" aria-labelledby="annexure-title">
          <p className="rental-contract-view__eyebrow">Annexure A</p>
          <h2 id="annexure-title">Terms and conditions</h2>
          <ol>
            {annexureAClauses.map((clause) => (
              <li className="rental-contract-view__clause" key={clause.title}>
                <h3>{clause.title}</h3>
                <p>{clause.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="rental-contract-view__section rental-contract-view__signatures">
          <h2>Driver acknowledgement</h2>
          <p>
            By signing, the driver acknowledges receipt of the vehicle and confirms they have
            read and agree to the rental terms and Annexure A, subject to applicable law.
          </p>
          <div className="rental-contract-view__signature-grid">
            <div><span>Driver signature</span><i aria-hidden="true" /></div>
            <div><span>Date</span><i aria-hidden="true" /></div>
            <div><span>Driver name</span><i>{contract.driver.name}</i></div>
            <div><span>Company representative</span><i aria-hidden="true" /></div>
          </div>
        </section>

        <footer className="rental-contract-view__footer">
          Contract {contract.contractNumber} · {companyDetails.name}
        </footer>
      </article>
    </>
  );
}
