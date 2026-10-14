import { defineTool } from "eve/tools";
import { z } from "zod";
import { plan } from "../../lib/finance.ts";

const money = z.number().min(0);

export default defineTool({
  description:
    "Do the arithmetic for LST unit economics and a production run: profit and margin per unit, total cash needed, profit at a sell-through rate, and break-even units. Every number must come from the founder (a quote, a decision, or a clearly labeled estimate). Never pass a made-up price or cost. Fee defaults are not applied: pass feePercent/feeFlat from the payment processor's current published rate.",
  inputSchema: z.object({
    price: money.describe("Selling price per unit"),
    unitCost: money.describe("Landed cost per unit (manufacturing, decoration, duties, freight in)"),
    units: z.number().int().min(1).describe("Units made in the run"),
    packagingPerUnit: money.optional(),
    netShippingPerUnit: money.optional().describe("Shipping paid by LST per order, minus what the customer pays"),
    feePercent: money.optional().describe("Card fee percent of the charge"),
    feeFlat: money.optional().describe("Card fee flat amount per charge"),
    returnRatePercent: money.max(100).optional(),
    fixedCosts: money.optional().describe("One-off costs: samples, photography, setup, legal"),
    sellThroughPercent: money.max(100).optional().describe("Share of units expected to sell; default 100"),
  }),
  label: { start: ({ units, price }) => `Run the numbers: ${units} units at ${price}` },
  async execute(input) {
    return plan(input);
  },
});
