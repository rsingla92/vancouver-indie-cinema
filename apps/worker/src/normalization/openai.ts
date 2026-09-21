import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { normalizedTitleSchema, type NormalizedTitle } from "./contracts.js";

export const NORMALIZATION_PROMPT_VERSION = "title-v1";

export interface TitleNormalizer {
  normalize(rawTitle: string): Promise<NormalizedTitle>;
}

export class OpenAITitleNormalizer implements TitleNormalizer {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    this.client = new OpenAI({ apiKey: options.apiKey ?? process.env.OPENAI_API_KEY });
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5-mini";
  }

  async normalize(rawTitle: string): Promise<NormalizedTitle> {
    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        {
          role: "system",
          content: "Extract the canonical film title from a cinema listing. Remove venue marketing, format labels, presenter names, series names, and event prefixes. Preserve sequel numerals and meaningful subtitles. Never invent a release year: return null unless the listing states it. Classify concerts, talks, parties, and stage events as non_film. Keep note factual and under 160 characters.",
        },
        { role: "user", content: rawTitle },
      ],
      text: { format: zodTextFormat(normalizedTitleSchema, "normalized_cinema_title") },
    });

    if (!response.output_parsed) throw new Error("The model did not return a normalization result");
    return response.output_parsed;
  }
}
