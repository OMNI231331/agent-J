import assert from "node:assert/strict";
import { test } from "node:test";
import { plan, unitEconomics } from "../lib/finance.ts";

test("unit economics: simple case with fees", () => {
  const r = unitEconomics({ price: 100, unitCost: 40, packagingPerUnit: 3, netShippingPerUnit: 5, feePercent: 3, feeFlat: 0.5 });
  assert.equal(r.paymentFee, 3.5);
  assert.equal(r.totalCostPerUnit, 51.5);
  assert.equal(r.profitPerUnit, 48.5);
  assert.equal(r.marginPercent, 48.5);
});

test("returns lose the sale and the unit cost", () => {
  const r = unitEconomics({ price: 100, unitCost: 40, returnRatePercent: 10 });
  assert.equal(r.returnsAllowance, 14);
  assert.equal(r.profitPerUnit, 46);
});

test("plan: break-even counts production of all units made", () => {
  // 100 made at cost 40 = 4000 + 1000 fixed = 5000 out. Each sale nets 100 - 3 packaging = 97.
  const r = plan({ price: 100, unitCost: 40, packagingPerUnit: 3, units: 100, fixedCosts: 1000 });
  assert.equal(r.cashOutlay, 5000);
  assert.equal(r.breakEvenUnitsSold, 52); // ceil(5000/97)
  assert.equal(r.totalProfit, 4700); // 100*97 - 5000
  assert.equal(plan({ price: 100, unitCost: 40, packagingPerUnit: 3, units: 100, fixedCosts: 1000, sellThroughPercent: 50 }).totalProfit, -150);
});

test("plan: a sale that loses money has no break-even", () => {
  const r = plan({ price: 10, unitCost: 5, netShippingPerUnit: 12, units: 10 });
  assert.equal(r.breakEvenUnitsSold, null);
});

test("rejects bad input", () => {
  assert.throws(() => unitEconomics({ price: -1, unitCost: 1 }));
  assert.throws(() => plan({ price: 1, unitCost: 1, units: 0 }));
  assert.throws(() => plan({ price: 1, unitCost: 1, units: 5, sellThroughPercent: 120 }));
});
