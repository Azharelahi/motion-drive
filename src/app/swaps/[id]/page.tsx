import { notFound } from "next/navigation";
import SwapAgreementView from "@/components/SwapAgreementView";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SwapAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const swap = await prisma.vehicleSwap.findUnique({
    where: { id },
    select: {
      id: true,
      swapNumber: true,
      swapDate: true,
      notes: true,
      newRentOne: true,
      newRentTwo: true,
      driverOne: { select: { name: true } },
      driverTwo: { select: { name: true } },
      vehicleOne: { select: { registration: true, make: true, model: true } },
      vehicleTwo: { select: { registration: true, make: true, model: true } },
    },
  });
  if (!swap) notFound();

  return (
    <SwapAgreementView
      swap={{
        ...swap,
        newRentOne: swap.newRentOne.toString(),
        newRentTwo: swap.newRentTwo.toString(),
      }}
    />
  );
}
