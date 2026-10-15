/** Plain unit-economics arithmetic. Every input comes from the caller; nothing here is a market figure or a quote. */

export type UnitInputs = {
  /** What the customer pays per unit, before shipping charged separately. */
  price: number;
  /** Landed cost of one unit: manufacturing, decoration, duties, freight in. */
  unitCost: number;
  /** Outbound packaging per order (mailer, tissue, cards). */
  packagingPerUnit?: number;
  /** What you pay to ship one order, minus any shipping the customer pays. */
  netShippingPerUnit?: number;
  /** Card fee as a percent of the charge (e.g. 2.9). Check your processor's current rate. */
  feePercent?: number;
  /** Card fee flat part per charge (e.g. 0.30). */
  feeFlat?: number;
  /** Share of units returned or lost, percent. Treated as lost margin on those units. */
  returnRatePercent?: number;
};

export type UnitResult = {
  revenue: number;
  paymentFee: number;
  returnsAllowance: number;
  totalCostPerUnit: number;
  profitPerUnit: number;
  marginPercent: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const nonNeg = (n: number | undefined, name: string) => {
  const v = n ?? 0;
  if (!Number.isFinite(v) || v < 0) throw new Error(`${name} must be a number of 0 or more`);
  return v;
};

export function unitEconomics(i: UnitInputs): UnitResult {
  const price = nonNeg(i.price, "price");
  const unitCost = nonNeg(i.unitCost, "unitCost");
  const paymentFee = price * (nonNeg(i.feePercent, "feePercent") / 100) + nonNeg(i.feeFlat, "feeFlat");
  // A returned unit refunds the sale and is assumed unresaleable: its cost is lost.
  const returnsAllowance = (nonNeg(i.returnRatePercent, "returnRatePercent") / 100) * (price + unitCost);
  const totalCostPerUnit = unitCost + nonNeg(i.packagingPerUnit, "packagingPerUnit") + nonNeg(i.netShippingPerUnit, "netShippingPerUnit") + paymentFee + returnsAllowance;
  const profitPerUnit = price - totalCostPerUnit;
  return {
    revenue: r2(price),
    paymentFee: r2(paymentFee),
    returnsAllowance: r2(returnsAllowance),
    totalCostPerUnit: r2(totalCostPerUnit),
    profitPerUnit: r2(profitPerUnit),
    marginPercent: price > 0 ? r2((profitPerUnit / price) * 100) : 0,
  };
}

export type PlanInputs = UnitInputs & {
  /** Units you plan to make and sell. */
  units: number;
  /** One-off costs: samples, tooling, photography, setup, legal. */
  fixedCosts?: number;
  /** Share of made units you expect to sell, percent (default 100). */
  sellThroughPercent?: number;
};

export type PlanResult = UnitResult & {
  unitsSold: number;
  cashOutlay: number;
  totalProfit: number;
  /** Units that must sell to cover fixed costs plus the production of all units made. null if each sale loses money. */
  breakEvenUnitsSold: number | null;
  breakEvenSellThroughPercent: number | null;
};

export function plan(i: PlanInputs): PlanResult {
  if (!Number.isInteger(i.units) || i.units < 1) throw new Error("units must be a whole number of 1 or more");
  const sell = i.sellThroughPercent ?? 100;
  if (!Number.isFinite(sell) || sell < 0 || sell > 100) throw new Error("sellThroughPercent must be between 0 and 100");
  const fixed = nonNeg(i.fixedCosts, "fixedCosts");
  const u = unitEconomics(i);
  const unitsSold = Math.floor((i.units * sell) / 100);
  // Per-sale costs (packaging, shipping, fees, returns) only occur on units sold; production cost occurs on every unit made.
  const perSaleCost = u.totalCostPerUnit - nonNeg(i.unitCost, "unitCost");
  const contribution = u.revenue - perSaleCost; // what one sale brings in after per-sale costs
  const production = i.units * i.unitCost;
  const cashOutlay = production + fixed;
  const totalProfit = unitsSold * contribution - cashOutlay;
  const breakEven = contribution > 0 ? Math.ceil(cashOutlay / contribution) : null;
  return {
    ...u,
    unitsSold,
    cashOutlay: r2(cashOutlay),
    totalProfit: r2(totalProfit),
    breakEvenUnitsSold: breakEven,
    breakEvenSellThroughPercent: breakEven === null ? null : r2((breakEven / i.units) * 100),
  };
}
