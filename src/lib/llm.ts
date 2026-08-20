import { ChatOpenAI } from "@langchain/openai";
import { apiKey, DEFAULT_MODEL } from "./env";

/** Chat model via OpenRouter (OpenAI-compatible endpoint). */
export function makeModel(model = DEFAULT_MODEL, temperature = 0.2) {
  const key = apiKey();
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Copy .env.example to .env.local and paste your key.",
    );
  }
  return new ChatOpenAI({
    model,
    temperature,
    apiKey: key,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/TuringCollegeSubmissions/gaurat-AE.AFA.4.6",
        "X-Title": "PromptCanary",
      },
    },
  });
}
