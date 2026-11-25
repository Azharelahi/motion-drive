export interface ContractSearchFields {
  contractNumber: string;
  driver: { name: string; mobile: string };
  vehicle: { registration: string; make: string | null; model: string };
}

export function filterContracts<T extends ContractSearchFields>(
  contracts: T[],
  search: string,
): T[] {
  const query = search.trim().toLocaleLowerCase("en-AU");
  if (!query) return contracts;

  return contracts.filter((contract) =>
    [
      contract.contractNumber,
      contract.driver.name,
      contract.driver.mobile,
      contract.vehicle.registration,
      contract.vehicle.make,
      contract.vehicle.model,
    ].some((value) => value?.toLocaleLowerCase("en-AU").includes(query)),
  );
}
