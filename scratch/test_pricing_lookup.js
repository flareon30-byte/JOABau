// Mock data representing the client company's price items
const mockPriceItems = [
  { name: "Activación Estándar", priceToClient: 158 },
  { name: "Instalación SP", priceToClient: 75 },
  { name: "Instalación TA", priceToClient: 50 },
  { name: "Instalación MDU", priceToClient: 48 },
  { name: "Activación Multi-familia", priceToClient: 370 },
  { name: "Avería / Reparación", priceToClient: 45 }
];

// Mock system settings financials
const mockFin = {
  pricePerUnit: 250,
  pricePerSP: 100,
  pricePerTA: 50,
  pricePerMDU: 50
};

// Simulation function representing updated lookup logic
function simulateCalculation(activationType, customActivationName, spCount, taInstalledBool, taCountInt, isMduBool) {
  let basePrice = parseFloat(mockFin.pricePerUnit || 60);

  // A. Base Price Resolution
  let matchingItem = mockPriceItems.find(item => item.name === activationType || (customActivationName && item.name === customActivationName));
  if (!matchingItem) {
    matchingItem = mockPriceItems.find(item => {
      const searchName = (item.name || '').toLowerCase();
      if (activationType === 'BP' || activationType === 'BP_2_FAM') {
        return searchName.includes('caja') || searchName.includes('bp') || searchName.includes('unifamiliar');
      }
      if (activationType === 'SDU') return searchName.includes('sdu') || searchName.includes('ta');
      if (activationType === 'MDU') return searchName.includes('mdu');
      if (activationType === 'BR_MULTI') return searchName.includes('br') || searchName.includes('multi');
      return false;
    });
  }

  if (matchingItem) {
    basePrice = matchingItem.priceToClient;
  }

  // B. SP Price Resolution
  let spDynamicPrice = parseFloat(mockFin.pricePerSP || 75);
  const spItem = mockPriceItems.find(item => {
    const name = (item.name || '').toLowerCase();
    return name === 'sp' || name.includes('sp');
  });
  if (spItem && spItem.priceToClient !== undefined) {
    spDynamicPrice = spItem.priceToClient;
  }
  const totalSpPrice = spCount * spDynamicPrice;

  // C. TA Price Resolution
  let taPriceTotal = 0;
  let sduDynamicPrice = parseFloat(mockFin.pricePerTA || 25);
  const sduItem = mockPriceItems.find(item => {
    const name = (item.name || '').toLowerCase();
    return name === 'sdu' || name === 'ta' || name.includes('ta') || name.includes('sdu');
  });
  if (sduItem && sduItem.priceToClient !== undefined) {
    sduDynamicPrice = sduItem.priceToClient;
  }
  const finalTaCountCalculated = taInstalledBool ? (taCountInt > 0 ? taCountInt : 1) : 0;
  if (finalTaCountCalculated > 0) {
    taPriceTotal = finalTaCountCalculated * sduDynamicPrice;
  }

  // D. MDU Price Resolution
  let mduPriceTotal = 0;
  let mduDynamicPrice = parseFloat(mockFin.pricePerMDU || 50);
  const mduItem = mockPriceItems.find(item => {
    const name = (item.name || '').toLowerCase();
    return name === 'mdu' || name.includes('mdu');
  });
  if (mduItem && mduItem.priceToClient !== undefined) {
    mduDynamicPrice = mduItem.priceToClient;
  }
  if (isMduBool) {
    mduPriceTotal = mduDynamicPrice;
  }

  const total = basePrice + totalSpPrice + taPriceTotal + mduPriceTotal;

  console.log(`Simulation for Type: ${activationType} (Custom: ${customActivationName || 'None'})`);
  console.log(`  - Base Price resolved: ${basePrice}€`);
  console.log(`  - SP Price resolved: ${totalSpPrice}€ (spCount: ${spCount}, unit price: ${spDynamicPrice}€)`);
  console.log(`  - TA Price resolved: ${taPriceTotal}€ (finalTaCount: ${finalTaCountCalculated}, unit price: ${sduDynamicPrice}€)`);
  console.log(`  - MDU Price resolved: ${mduPriceTotal}€ (unit price: ${mduDynamicPrice}€)`);
  console.log(`  - TOTAL: ${total}€`);
  return total;
}

console.log("=== RUNNING SIMULATION ===");
// Case 1: The Multi activation with SP: 1 and MDU: true
simulateCalculation('BR_MULTI', 'Multi', 1, false, 0, true);

console.log("\n-------------------------\n");

// Case 2: The Unifamiliar activation with no extras
simulateCalculation('BP', 'Unifamiliar', 0, false, 0, false);
