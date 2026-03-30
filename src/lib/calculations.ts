import Decimal from 'decimal.js';

/**
 * Calculate weighted average price when adding new stock.
 * Formula: ((oldStock * oldAvg) + (newQty * newPrice)) / (oldStock + newQty)
 */
export function calculateWeightedAverage(
  oldStock: string | number,
  oldAvg: string | number,
  newQty: string | number,
  newPrice: string | number
): Decimal {
  const oldStockDec = new Decimal(oldStock);
  const oldAvgDec = new Decimal(oldAvg);
  const newQtyDec = new Decimal(newQty);
  const newPriceDec = new Decimal(newPrice);

  const totalValue = oldStockDec.mul(oldAvgDec).plus(newQtyDec.mul(newPriceDec));
  const totalQty = oldStockDec.plus(newQtyDec);

  if (totalQty.isZero()) return new Decimal(0);

  return totalValue.div(totalQty);
}

/**
 * Calculate loss ratio during smelting.
 * Formula: (inputQty - outputQty) / inputQty
 */
export function calculateLossRatio(
  inputQty: string | number,
  outputQty: string | number
): Decimal {
  const inputDec = new Decimal(inputQty);
  const outputDec = new Decimal(outputQty);

  if (inputDec.isZero()) return new Decimal(0);

  return inputDec.minus(outputDec).div(inputDec);
}

/**
 * Calculate total batch cost.
 * Formula: materialCost + operatingCost + maintenanceAlloc
 */
export function calculateBatchCost(
  materialCost: string | number,
  operatingCost: string | number,
  maintenanceAlloc: string | number
): Decimal {
  return new Decimal(materialCost)
    .plus(new Decimal(operatingCost))
    .plus(new Decimal(maintenanceAlloc));
}

/**
 * Calculate cost per kilogram of output.
 * Formula: totalCost / outputQty
 */
export function calculateCostPerKg(
  totalCost: string | number,
  outputQty: string | number
): Decimal {
  const outputDec = new Decimal(outputQty);

  if (outputDec.isZero()) return new Decimal(0);

  return new Decimal(totalCost).div(outputDec);
}

/**
 * Calculate total operating cost for a batch.
 * Formula: (electricityHrs * electricityRate) + (laborHrs * laborRate) + otherExpenses
 */
export function calculateOperatingCost(
  electricityHrs: string | number,
  electricityRate: string | number,
  laborHrs: string | number,
  laborRate: string | number,
  otherExpenses: string | number
): Decimal {
  const electricityCost = new Decimal(electricityHrs).mul(new Decimal(electricityRate));
  const laborCost = new Decimal(laborHrs).mul(new Decimal(laborRate));

  return electricityCost.plus(laborCost).plus(new Decimal(otherExpenses));
}

/**
 * Calculate gross profit from a sale.
 * Formula: revenue - (quantity * costPerKg)
 */
export function calculateGrossProfit(
  revenue: string | number,
  quantity: string | number,
  costPerKg: string | number
): Decimal {
  const cost = new Decimal(quantity).mul(new Decimal(costPerKg));
  return new Decimal(revenue).minus(cost);
}
