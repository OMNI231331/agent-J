import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { defineAgent } from "eve";

const MODEL_ID = "anthropic/claude-3-haiku";

// With OPENROUTER_API_KEY set, calls go straight to OpenRouter; otherwise the
// same model id routes through the Vercel AI Gateway as before.
const apiKey = process.env.OPENROUTER_API_KEY;

export default defineAgent({
  model: apiKey ? createOpenRouter({ apiKey }).chat(MODEL_ID) : MODEL_ID,
  modelContextWindowTokens: 200_000,
});
