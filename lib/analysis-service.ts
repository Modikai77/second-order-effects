import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  analyzeInputSchema,
  dedupeEffects,
  dedupeHoldingMappings,
  dedupeAssetRecommendations,
  enforceOutputChecks,
  normalizeTextKey,
  type AnalyzeInput,
  type AnalysisModelOutput
} from "@/lib/schemas";
import { computePortfolioBias } from "@/lib/scoring";
import { runStructuredAnalysis } from "@/lib/openai";
import {
  buildDecisionSummary,
  buildExpressionRecommendations,
  buildNodeShocks,
  deriveIndicatorDefinitions,
  normalizeHoldingWeights,
  normalizeBranchProbabilities,
  validatePortfolioReality
} from "@/lib/decision-engine";

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
      const retryHint =
        attempt === 0
          ? undefined
          : `Your previous response failed validation with this error: ${String(
              lastError instanceof Error ? lastError.message : "validation error"
            )}. Return corrected JSON with at least 2 first-order and 2 second-order effects, each with valid confidence and distinct entries. If SECOND/THIRD/FOURTH effects are present, include at least one asset recommendation tied to those layers.`;

      const result = await runStructuredAnalysis(input, retryHint);
      const deduped = dedupeAssetRecommendations(dedupeHoldingMappings(dedupeEffects(result.output)));
      enforceOutputChecks(deduped, input.holdings);
      return { ...result, output: deduped };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Analysis generation failed.");
}

export async function analyzeAndPersist(rawInput: unknown, userId: string | undefined) {
  const parsedInput = analyzeInputSchema.parse(rawInput);
  let input: AnalyzeInput = {
    ...parsedInput,
    holdings: normalizeHoldingWeights(parsedInput.holdings)
  };

  try {
    if (input.portfolioScenarioId) {
      const loadedScenario = await prisma.portfolioScenario.findUnique({
        where: { id: input.portfolioScenarioId },
        include: { holdings: { orderBy: { orderIndex: "asc" } } }
      });
      if (!loadedScenario || loadedScenario.userId !== userId) {
        throw new Error("Portfolio scenario not found.");
      }
      input.holdings = normalizeHoldingWeights(
        loadedScenario.holdings.map((holding) => ({
        name: holding.name,
        ticker: holding.ticker ?? undefined,
        weight: holding.weight ?? undefined,
        sensitivity: holding.sensitivity,
        constraint: holding.constraint,
        purpose: holding.purpose,
        exposureTags: Array.isArray(holding.exposureTags) ? (holding.exposureTags as string[]) : []
        }))
      );
    }

    const portfolioValidation = validatePortfolioReality(input.holdings, input.allowWeightOverride);
    if (portfolioValidation.errors.length > 0) {
      throw new Error(portfolioValidation.errors.join(" | "));
    }

    const analysis = await getValidatedOutput(input);
    const bias = computePortfolioBias(input, analysis.output);
    const branches = normalizeBranchProbabilities(input.branchOverrides);
    const nodeShocks = analysis.output.nodeShocks?.length
      ? analysis.output.nodeShocks
      : buildNodeShocks(analysis.output, branches);
    const indicatorDefinitions = analysis.output.indicatorDefinitions?.length
      ? analysis.output.indicatorDefinitions
      : deriveIndicatorDefinitions(analysis.output);

    let universeRows: Array<{
      symbol: string;
      companyName: string;
      assetType: "EQUITY" | "ETF";
      region?: string;
      currency?: string;
      liquidityClass: string;
      maxPositionDefaultPct: number;
      tags: string[];
      exposureVector: Record<string, number>;
    }> = [];

    if (input.universeVersionId) {
      const universeVersion = await prisma.companyUniverseVersion.findUnique({
        where: { id: input.universeVersionId },
        include: { companies: true }
      });
      if (!universeVersion || universeVersion.userId !== userId) {
        throw new Error("Selected universe version not found.");
      }
      universeRows = universeVersion.companies.map((company) => ({
        symbol: company.symbol,
        companyName: company.companyName,
        assetType: company.assetType,
        region: company.region ?? undefined,
        currency: company.currency ?? undefined,
        liquidityClass: company.liquidityClass,
        maxPositionDefaultPct: company.maxPositionDefaultPct,
        tags: Array.isArray(company.tags) ? (company.tags as string[]) : [],
        exposureVector:
          company.exposureVector && typeof company.exposureVector === "object"
            ? (company.exposureVector as Record<string, number>)
            : {}
      }));
    }

    const recommendations = analysis.output.expressionRecommendations?.length
      ? analysis.output.expressionRecommendations
      : universeRows.length > 0
        ? buildExpressionRecommendations(branches, nodeShocks, universeRows, input.holdings, input.horizonMonths)
        : [];

    const branchImpacts = branches.map((branch) => ({
      branchName: branch.name,
      score:
        bias.portfolioBias *
        (branch.name === "BULL" ? 0.8 : branch.name === "BEAR" ? 1.2 : 1)
    }));

    const decisionSummary = analysis.output.decisionSummary
      ? analysis.output.decisionSummary
      : buildDecisionSummary(branchImpacts, recommendations, indicatorDefinitions);

    const exposureContributions = [...bias.contributions]
      .sort((a, b) => a.score - b.score)
      .map((contribution) => ({
        ...contribution,
        direction: contribution.score >= 0 ? "UPSIDE" : "DOWNSIDE"
      }));

    const created = await prisma.$transaction(async (tx) => {
      const theme = await tx.theme.create({
        data: {
          statement: input.statement,
          probability: input.probability,
          horizonMonths: input.horizonMonths,
          portfolioScenarioId: input.portfolioScenarioId,
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
              constraint: holding.constraint,
              purpose: holding.purpose,
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

      await tx.indicatorDefinition.createMany({
        data: indicatorDefinitions.map((indicator) => ({
          themeId: theme.id,
          indicatorName: indicator.indicatorName,
          supportsDirection: indicator.supportsDirection,
          greenThreshold: indicator.greenThreshold,
          yellowThreshold: indicator.yellowThreshold,
          redThreshold: indicator.redThreshold,
          expectedWindow: indicator.expectedWindow
        }))
      });

      const createdBranches = await Promise.all(
        branches.map((branch) =>
          tx.themeBranch.create({
            data: {
              themeId: theme.id,
              name: branch.name,
              probability: branch.probability,
              rationale: branch.rationale
            }
          })
        )
      );

      const branchIdByName = new Map(createdBranches.map((branch) => [branch.name, branch.id]));
      await tx.themeNodeShock.createMany({
        data: nodeShocks.map((nodeShock) => ({
          branchId: branchIdByName.get(nodeShock.branchName) as string,
          nodeKey: nodeShock.nodeKey,
          nodeLabel: nodeShock.nodeLabel,
          direction: nodeShock.direction,
          magnitudePct: nodeShock.magnitudePct,
          strength: nodeShock.strength,
          lag: nodeShock.lag,
          confidence: nodeShock.confidence,
          evidenceNote: nodeShock.evidenceNote
        }))
      });

      if (recommendations.length > 0) {
        await tx.expressionRecommendation.createMany({
          data: recommendations.map((recommendation) => ({
            themeId: theme.id,
            symbol: recommendation.symbol,
            name: recommendation.name,
            assetType: recommendation.assetType,
            direction: recommendation.direction,
            action: recommendation.action,
            sizingBand: recommendation.sizingBand,
            maxPositionPct: recommendation.maxPositionPct,
            score: recommendation.score,
            mechanism: recommendation.mechanism,
            catalystWindow: recommendation.catalystWindow,
            pricedInNote: recommendation.pricedInNote,
            riskNote: recommendation.riskNote,
            invalidationTrigger: recommendation.invalidationTrigger,
            portfolioRole: recommendation.portfolioRole,
            actionable: recommendation.actionable,
            alreadyExpressed: recommendation.alreadyExpressed
          }))
        });
      }

      await tx.runSnapshot.create({
        data: {
          themeId: theme.id,
          modelName: analysis.modelName,
          promptVersion: analysis.promptVersion,
          rawOutputJson: {
            output: analysis.output,
            raw: analysis.raw,
            decisionSummary,
            branches,
            nodeShocks,
            recommendations,
            exposureContributions,
            portfolioValidation
          } as Prisma.InputJsonValue,
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
      analysis: analysis.output,
      portfolioValidation,
      branches,
      nodeShocks,
      recommendations,
      indicatorDefinitions,
      exposureContributions,
      decisionSummary
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
        modelName: input.modelName ?? process.env.OPENAI_MODEL ?? "gpt-4.1",
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
