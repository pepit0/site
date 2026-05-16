export type SellPublishComplianceInput = {
  hasRegistration: boolean;
  hasInsurance: boolean;
  noRegInsurance: boolean;
};

export function validateSellPublishCompliance(input: SellPublishComplianceInput): string | null {
  const { hasRegistration, hasInsurance, noRegInsurance } = input;
  const anyChecked = hasRegistration || hasInsurance || noRegInsurance;
  if (!anyChecked) {
    return "Check registration, insurance, or no reg/insurance on file.";
  }
  if (noRegInsurance && (hasRegistration || hasInsurance)) {
    return 'Uncheck "No reg/insurance" or uncheck registration and insurance.';
  }
  if (!noRegInsurance && !hasRegistration && !hasInsurance) {
    return "Check registration received, insurance received, or no reg/insurance on file.";
  }
  return null;
}

export type SellPublishRequirement = {
  id: string;
  label: string;
  ok: boolean;
};

export type SellPublishRequirementInput = SellPublishComplianceInput & {
  stock: string;
  vin: string;
  photoCount: number;
  year: string;
  odometerKm: string;
  cost: string;
  stockIsDuplicate: boolean;
};

export function getSellPublishRequirements(input: SellPublishRequirementInput): SellPublishRequirement[] {
  const stock = input.stock.trim();
  const vin = input.vin.trim();
  const year = Number.parseInt(input.year, 10);
  const km = Number.parseInt(input.odometerKm, 10);
  const cost = Number.parseFloat(input.cost);
  const complianceError = validateSellPublishCompliance(input);

  return [
    { id: "stock", label: "Stock number entered", ok: stock.length > 0 },
    {
      id: "stock-dup",
      label: "Stock number not already in inventory",
      ok: stock.length === 0 || !input.stockIsDuplicate
    },
    { id: "vin", label: "VIN entered (type none if unavailable)", ok: vin.length > 0 },
    {
      id: "compliance",
      label: "Registration / insurance option selected",
      ok: complianceError === null
    },
    { id: "photos", label: "At least one photo on submission", ok: input.photoCount >= 1 },
    { id: "year", label: "Valid year on submission", ok: Number.isFinite(year) },
    { id: "km", label: "Valid odometer (km) on submission", ok: Number.isFinite(km) && km >= 0 },
    { id: "cost", label: "Valid cost (0 or more)", ok: Number.isFinite(cost) && cost >= 0 }
  ];
}

export function sellPublishBlockerMessages(requirements: SellPublishRequirement[]): string[] {
  return requirements.filter((r) => !r.ok).map((r) => r.label);
}
