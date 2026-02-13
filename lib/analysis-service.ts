import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  analyzeInputSchema,
  dedupeEffects,
  dedupeHoldingMappings,
  enforceOutputChecks,
  normalizeTextKey,
  type AnalyzeInput,
  type AnalysisModelOutput
} from "@/lib/schemas";
import { computePortfolioBias } from "@/lib/scoring";
import { runStructuredAnalysis } from "@/lib/openai";

function layerEntries(output: AnalysisModelOutput) {
  return [
    ["FIRST", output.effectsByLayer.first],
    ["SECOND", output.effectsByLayer.second],
    ["THIRD", output.effectsByLayer.third],
    ["FOURTH", output.effectsByLayer.fourth]
  ] as const;
}

async function getValidatedOutput(input: AnalyzeInput) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await runStructuredAnalysis(input);
      const deduped = dedupeHoldingMappings(dedupeEffects(result.output));
      enforceOutputChecks(deduped, input.holdings);
      return { ...result, output: deduped };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Analysis generation failed.");
}

export async function analyzeAndPersist(rawInput: unknown, userId: string | undefined) {
  const input = analyzeInputSchema.parse(rawInput);

  try {
    const analysis = await getValidatedOutput(input);
    const bias = computePortfolioBias(input, analysis.output);

    const created = await prisma.$transaction(async (tx) => {
      const theme = await tx.theme.create({
        data: {
          statement: input.statement,
          probability: input.probability,
          horizonMonths: input.horizonMonths,
          userId
        }
      });

      await tx.themeEffect.createMany({
        data: layerEntries(analysis.output).flatMap(([layer, effects]) =>
          effects.map((effect, orderIndex) => ({
            themeId: theme.id,
            layer,
            description: effect.description,
            impactDirection: effect.impactDirection,
            confidence: effect.confidence,
            orderIndex
          }))
        )
      });

      const holdings = await Promise.all(
        input.holdings.map((holding) =>
          tx.holding.create({
            data: {
              themeId: theme.id,
              name: holding.name,
              ticker: holding.ticker,
              weight: holding.weight,
              sensitivity: holding.sensitivity,
              exposureTags: holding.exposureTags
            }
          })
        )
      );

      const mappingByHoldingKey = new Map(
        analysis.output.holdingMappings.map((mapping) => [normalizeTextKey(mapping.holdingName), mapping])
      );

      await tx.portfolioMapping.createMany({
        data: holdings.map((holding) => {
          const mapping = mappingByHoldingKey.get(normalizeTextKey(holding.name));
          if (!mapping) {
            throw new Error(`No holding match for mapping: ${holding.name}`);
          }
          return {
            themeId: theme.id,
            holdingId: holding.id,
            exposureType: mapping.exposureType,
            netImpact: mapping.netImpact,
            mechanism: mapping.mechanism,
            confidence: mapping.confidence
          };
        })
      });

      const indicators = analysis.output.leadingIndicators;
      const assumptions = analysis.output.assumptions;
      const maxLen = Math.max(indicators.length, assumptions.length);

      for (let idx = 0; idx < maxLen; idx += 1) {
        const assumption = assumptions[idx] ?? assumptions[assumptions.length - 1];
        const indicator = indicators[idx] ?? indicators[indicators.length - 1];
        if (!assumption || !indicator) {
          continue;
        }

        await tx.invalidationItem.create({
          data: {
            themeId: theme.id,
            assumption: assumption.assumption,
            breakpointSignal: assumption.breakpointSignal,
            indicatorName: indicator.name,
            latestNote: indicator.rationale
          }
        });
      }

      await tx.runSnapshot.create({
        data: {
          themeId: theme.id,
          modelName: analysis.modelName,
          promptVersion: analysis.promptVersion,
          rawOutputJson: analysis.raw as Prisma.InputJsonValue,
          computedBiasScore: bias.portfolioBias,
          biasLabel: bias.biasLabel
        }
      });

      return theme;
    });

    return {
      ok: true,
      themeId: created.id,
      bias,
      analysis: analysis.output
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Analysis failed";
    const theme = await prisma.theme.create({
      data: {
        statement: input.statement,
        probability: input.probability,
        horizonMonths: input.horizonMonths,
        userId
      }
    });

    await prisma.runSnapshot.create({
      data: {
        themeId: theme.id,
        modelName: process.env.OPENAI_MODEL ?? "gpt-4.1",
        promptVersion: "v1",
        rawOutputJson: { error: errMessage } as Prisma.InputJsonValue,
        computedBiasScore: 0,
        biasLabel: "NEUTRAL"
      }
    });

    return {
      ok: false,
      themeId: theme.id,
      error: errMessage
    };
  }
}
