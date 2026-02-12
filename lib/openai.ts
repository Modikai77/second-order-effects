import type { AnalysisModelOutput, AnalyzeInput } from "@/lib/schemas";
import { analysisModelOutputSchema, sanitizeModelOutput } from "@/lib/schemas";

const PROMPT_VERSION = "v1";

function buildPrompt(input: AnalyzeInput): string {
  const holdingsText = input.holdings
    .map((h) => `- ${h.name} (${h.ticker ?? "N/A"}), sensitivity=${h.sensitivity}, tags=${h.exposureTags.join(", ") || "none"}`)
    .join("\n");

  return [
    "You are a macro systems thinker focused on portfolio stress testing.",
    "Given a structural change, generate a concrete causal map and portfolio impacts.",
    "Rules:",
    "- Be specific and mechanism-driven.",
    "- Keep exposureType concise (<= 220 chars) and mechanism concise (<= 900 chars).",
    "- Avoid repeating the same idea across layers.",
    "- Keep a coherent first->second->third->fourth order chain.",
    "- Provide exactly one mapping per unique holding name (even if the same name appears multiple times).",
    "- Use confidence levels LOW/MED/HIGH.",
    "",
    `Structural shift: ${input.statement}`,
    `Probability: ${input.probability}`,
    `Horizon months: ${input.horizonMonths}`,
    "Holdings:",
    holdingsText,
    "",
    "Return JSON that exactly matches the required schema."
  ].join("\n");
}

function responseSchema() {
  return {
    name: "second_order_analysis",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        effectsByLayer: {
          type: "object",
          additionalProperties: false,
          properties: {
            first: { $ref: "#/$defs/effects" },
            second: { $ref: "#/$defs/effects" },
            third: { $ref: "#/$defs/effects" },
            fourth: { $ref: "#/$defs/effects" }
          },
          required: ["first", "second", "third", "fourth"]
        },
        assumptions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              assumption: { type: "string" },
              breakpointSignal: { type: "string" }
            },
            required: ["assumption", "breakpointSignal"]
          }
        },
        leadingIndicators: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              rationale: { type: "string" }
            },
            required: ["name", "rationale"]
          }
        },
        holdingMappings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              holdingName: { type: "string" },
              exposureType: { type: "string" },
              netImpact: { type: "string", enum: ["POS", "NEG", "MIXED", "UNCERTAIN"] },
              mechanism: { type: "string" },
              confidence: { type: "string", enum: ["LOW", "MED", "HIGH"] }
            },
            required: ["holdingName", "exposureType", "netImpact", "mechanism", "confidence"]
          }
        }
      },
      required: ["effectsByLayer", "assumptions", "leadingIndicators", "holdingMappings"],
      $defs: {
        effects: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              description: { type: "string" },
              impactDirection: {
                type: "string",
                enum: ["POS", "NEG", "MIXED", "UNCERTAIN"]
              },
              confidence: {
                type: "string",
                enum: ["LOW", "MED", "HIGH"]
              }
            },
            required: ["description", "impactDirection", "confidence"]
          }
        }
      }
    }
  };
}

export async function runStructuredAnalysis(input: AnalyzeInput): Promise<{
  modelName: string;
  promptVersion: string;
  output: AnalysisModelOutput;
  raw: unknown;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const modelName = process.env.OPENAI_MODEL ?? "gpt-4.1";
  const payload = {
    model: modelName,
    input: buildPrompt(input),
    text: {
      format: {
        type: "json_schema",
        strict: true,
        ...responseSchema()
      }
    }
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`OpenAI request failed (${res.status})`);
  }

  const raw = (await res.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const outputText =
    raw.output_text ??
    raw.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text" && content.text)?.text;

  if (!outputText) {
    throw new Error("OpenAI response did not include output_text.");
  }

  const sanitized = sanitizeModelOutput(JSON.parse(outputText));
  const parsed = analysisModelOutputSchema.parse(sanitized);
  return {
    modelName,
    promptVersion: PROMPT_VERSION,
    output: parsed,
    raw
  };
}
