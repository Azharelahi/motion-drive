import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildDashboardAlerts, getExpiryStatus } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      vehicleCount,
      driverCount,
      savedContractCount,
      activeRentalCount,
      vehicles,
      currentDrivers,
      documents,
      recentContracts,
    ] = await prisma.$transaction([
      prisma.vehicle.count(),
      prisma.driver.count(),
      prisma.contract.count(),
      prisma.contract.count({ where: { status: "Active" } }),
      prisma.vehicle.findMany({
        select: {
          id: true,
          registration: true,
          make: true,
          model: true,
          status: true,
          odometer: true,
          nextServiceKm: true,
          registrationExpiry: true,
          insuranceExpiry: true,
          inspectionExpiry: true,
        },
        orderBy: { registration: "asc" },
      }),
      prisma.driver.findMany({
        where: { status: "Current" },
        select: {
          id: true,
          name: true,
          mobile: true,
          licenceExpiry: true,
          rideshareAccreditationExpiry: true,
          documents: {
            select: {
              id: true,
              documentType: true,
              originalName: true,
              expiryDate: true,
            },
            orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.document.findMany({
        select: {
          id: true,
          originalName: true,
          documentType: true,
          expiryDate: true,
          driverId: true,
          vehicleId: true,
        },
      }),
      prisma.contract.findMany({
        take: 8,
        orderBy: [{ createdAt: "desc" }, { startDate: "desc" }],
        select: {
          id: true,
          contractNumber: true,
          status: true,
          startDate: true,
          weeklyRent: true,
          createdAt: true,
          driver: { select: { id: true, name: true, mobile: true } },
          vehicle: { select: { id: true, registration: true, model: true } },
        },
      }),
    ]);

    const today = new Date();
    const alerts = buildDashboardAlerts(
      { currentDrivers, vehicles, documents },
      today,
    );

    return NextResponse.json(
      {
        counters: {
          vehicles: vehicleCount,
          drivers: driverCount,
          savedContracts: savedContractCount,
          activeRentals: activeRentalCount,
        },
        alerts,
        vehicleExpiryRegister: vehicles.map((vehicle) => ({
          id: vehicle.id,
          registration: vehicle.registration,
          make: vehicle.make,
          model: vehicle.model,
          status: vehicle.status,
          registrationExpiry: {
            date: vehicle.registrationExpiry?.toISOString() ?? null,
            ...getExpiryStatus(vehicle.registrationExpiry, 45, today),
          },
          insuranceExpiry: {
            date: vehicle.insuranceExpiry?.toISOString() ?? null,
            ...getExpiryStatus(vehicle.insuranceExpiry, 45, today),
          },
          inspectionExpiry: {
            date: vehicle.inspectionExpiry?.toISOString() ?? null,
            ...getExpiryStatus(vehicle.inspectionExpiry, 45, today),
          },
          odometer: vehicle.odometer,
          nextServiceKm: vehicle.nextServiceKm,
          serviceDueInKm:
            vehicle.odometer !== null && vehicle.nextServiceKm !== null
              ? vehicle.nextServiceKm - vehicle.odometer
              : null,
        })),
        driverDocumentExpiryRegister: currentDrivers.map((driver) => ({
          id: driver.id,
          name: driver.name,
          mobile: driver.mobile,
          licenceExpiry: {
            date: driver.licenceExpiry?.toISOString() ?? null,
            ...getExpiryStatus(driver.licenceExpiry, 90, today),
          },
          rideshareAccreditationExpiry: {
            date: driver.rideshareAccreditationExpiry?.toISOString() ?? null,
            ...getExpiryStatus(driver.rideshareAccreditationExpiry, 90, today),
          },
          documents: driver.documents.map((document) => ({
            id: document.id,
            documentType: document.documentType,
            originalName: document.originalName,
            expiryDate: {
              date: document.expiryDate?.toISOString() ?? null,
              ...getExpiryStatus(document.expiryDate, 60, today),
            },
          })),
        })),
        recentContracts: recentContracts.map((contract) => ({
          ...contract,
          startDate: contract.startDate.toISOString(),
          createdAt: contract.createdAt.toISOString(),
          weeklyRent: contract.weeklyRent.toString(),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Dashboard load failed", error);
    return NextResponse.json(
      { error: "Could not load the dashboard." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
