import { notFound } from "next/navigation";
import RentalContractView from "@/components/RentalContractView";
import { prisma } from "@/lib/db";

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
    <RentalContractView
      contract={{
        contractNumber: contract.contractNumber,
        status: contract.status,
        agreementDate: contract.agreementDate,
        startDate: contract.startDate,
        endDate: contract.endDate,
        weeklyRent: contract.weeklyRent.toString(),
        bond: contract.bond.toString(),
        excess: contract.excess.toString(),
        kmAllowance: contract.kmAllowance,
        term: contract.term,
        noticePeriod: contract.noticePeriod,
        paymentFrequency: contract.paymentFrequency,
        paymentMethod: contract.paymentMethod,
        rideshareUse: contract.rideshareUse,
        privateUse: contract.privateUse,
        driver: {
          name: contract.driver.name,
          mobile: contract.driver.mobile,
          email: contract.driver.email,
          dateOfBirth: contract.driver.dateOfBirth,
          address: contract.driver.address,
          licenceNumber: contract.driver.licenceNumber,
          licenceState: contract.driver.licenceState,
          licenceExpiry: contract.driver.licenceExpiry,
          rideshareAccreditation: contract.driver.rideshareAccreditation,
        },
        vehicle: {
          registration: contract.vehicle.registration,
          make: contract.vehicle.make,
          model: contract.vehicle.model,
          year: contract.vehicle.year,
          colour: contract.vehicle.colour,
          vin: contract.vehicle.vin,
          pickupLocation: contract.vehicle.pickupLocation,
        },
      }}
    />
  );
}
