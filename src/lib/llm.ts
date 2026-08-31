import { ChatOpenAI } from "@langchain/openai";
import { apiKey, DEFAULT_MODEL } from "./env";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Chat model via OpenRouter (OpenAI-compatible endpoint). */
export function makeModel(model = DEFAULT_MODEL, temperature = 0.2) {
  const key = apiKey();
  if (!key) {
    throw new Error(
      "No OpenRouter key. Paste one in Developer settings, or set OPENROUTER_API_KEY locally.",
    );
  }
  return new ChatOpenAI({
    model,
    temperature,
    apiKey: key,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/gauravthorath/PromptCanary",
        "X-Title": "PromptCanary",
      },
    },
  });
}
