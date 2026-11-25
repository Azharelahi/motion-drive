import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatAUD, formatDateAU } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContractCreatedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { driver: true, vehicle: true },
  });
  if (!contract) notFound();

  return (
    <section>
      <p className="contract-created__status">Rental created successfully</p>
      <h1>Contract {contract.contractNumber}</h1>
      <p>{contract.driver.name} · {contract.vehicle.registration} · {contract.vehicle.model}</p>
      <dl className="detail-grid contract-created__details">
        <div><dt>Status</dt><dd>{contract.status}</dd></div>
        <div><dt>Agreement date</dt><dd>{formatDateAU(contract.agreementDate)}</dd></div>
        <div><dt>Start date</dt><dd>{formatDateAU(contract.startDate)}</dd></div>
        <div><dt>End date</dt><dd>{formatDateAU(contract.endDate)}</dd></div>
        <div><dt>Weekly rent</dt><dd>{formatAUD(contract.weeklyRent)}</dd></div>
        <div><dt>Bond</dt><dd>{formatAUD(contract.bond)}</dd></div>
        <div><dt>Excess</dt><dd>{formatAUD(contract.excess)}</dd></div>
        <div><dt>Term</dt><dd>{contract.term}</dd></div>
        <div><dt>Notice period</dt><dd>{contract.noticePeriod}</dd></div>
        <div><dt>Payment</dt><dd>{contract.paymentFrequency} · {contract.paymentMethod}</dd></div>
      </dl>
      <div className="profile-actions">
        <Link className="button button--primary" href="/contracts">Saved Contracts</Link>
        <Link className="button button--secondary" href={`/vehicles/${contract.vehicleId}`}>Open Vehicle</Link>
        <Link className="button button--secondary" href={`/drivers/${contract.driverId}`}>Open Driver</Link>
      </div>
    </section>
  );
}
