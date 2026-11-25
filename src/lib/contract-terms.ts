export const companyDetails = {
  name: "Motion Drive Pty Ltd",
  abn: process.env.MOTION_DRIVE_ABN?.trim() || "To be completed",
  address: process.env.MOTION_DRIVE_ADDRESS?.trim() || "To be completed",
  email: process.env.MOTION_DRIVE_EMAIL?.trim() || "To be completed",
  phone: process.env.MOTION_DRIVE_PHONE?.trim() || "To be completed",
};

export const annexureAClauses = [
  {
    title: "Parties and vehicle",
    text: "This agreement records the vehicle supplied by the company to the named driver, together with the rental terms and vehicle details shown above.",
  },
  {
    title: "Rental period",
    text: "The rental starts on the stated start date and continues for the stated term. Any end date shown is the current agreed end date; an ongoing rental remains subject to the agreed notice period and applicable law.",
  },
  {
    title: "Rental payments",
    text: "The driver must pay the weekly rent at the stated frequency and by the selected payment method. The driver should contact the company promptly if a payment is disputed or cannot be made when due.",
  },
  {
    title: "Bond",
    text: "The bond amount is recorded in the key terms. Any handling, deductions, or refund of the bond must be explained to the driver and carried out in accordance with this agreement and applicable law.",
  },
  {
    title: "Permitted use",
    text: "The vehicle may be used only for the purposes marked as permitted in this agreement and in accordance with applicable laws, licence conditions, and any reasonable written vehicle-use instructions provided by the company.",
  },
  {
    title: "Driver and licence",
    text: "The vehicle may be driven only by the named driver unless the company gives prior written approval. The driver must hold and maintain a valid licence for the vehicle and promptly tell the company about any suspension, restriction, or change that affects their ability to drive.",
  },
  {
    title: "Care, maintenance, and faults",
    text: "The driver must take reasonable care of the vehicle, keep it secure, follow the manufacturer's operating guidance, and promptly report damage, warning lights, faults, or maintenance needs. Repairs or alterations require the company's approval except where immediate action is reasonably necessary for safety.",
  },
  {
    title: "Accidents, damage, and theft",
    text: "The driver must promptly notify the company of an accident, damage, theft, or other incident involving the vehicle; take reasonable steps to protect people and property; and cooperate with lawful reporting, insurer, and investigation requirements.",
  },
  {
    title: "Insurance and excess",
    text: "The applicable insurance arrangements and the excess recorded in the key terms apply subject to the relevant policy and law. The driver must provide accurate information and cooperate with claims. This clause does not expand or replace the terms of an insurance policy.",
  },
  {
    title: "Tolls, fines, and usage charges",
    text: "The driver is responsible for tolls, parking charges, fines, and other vehicle-use charges incurred during the rental to the extent permitted by law. The company will provide available supporting details for a charge it seeks to recover.",
  },
  {
    title: "Prohibited use",
    text: "The driver must not use the vehicle unlawfully, for racing or competition, to carry more people or goods than permitted, while impaired, or in a way that deliberately or recklessly risks damage. The driver must not sell, lend, sub-rent, or give possession of the vehicle to another person without the company's prior written consent.",
  },
  {
    title: "Ending the rental and return",
    text: "Either party may end an ongoing rental by giving the agreed notice, subject to applicable law. When the rental ends, the driver must return the vehicle, keys, and supplied items to the agreed location and in substantially the same condition as supplied, allowing for fair wear and tear.",
  },
  {
    title: "Governing law and disputes",
    text: "This agreement is governed by the laws of Victoria, Australia. The parties should first try to resolve a dispute by discussing it in good faith. Nothing in this agreement limits a right or remedy that cannot lawfully be excluded.",
  },
] as const;
