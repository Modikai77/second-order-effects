-- Enums
CREATE TYPE "HoldingConstraint" AS ENUM ('LOCKED', 'SEMI_LOCKED', 'FREE');
CREATE TYPE "HoldingPurpose" AS ENUM ('TAX', 'SPEND_0_12M', 'SPEND_12_36M', 'LIFESTYLE_DRAWDOWN', 'LONG_TERM_GROWTH');
CREATE TYPE "RunStatus" AS ENUM ('PLAYING_OUT', 'MIXED', 'INVALIDATED', 'UNASSESSED');
CREATE TYPE "ShockDirection" AS ENUM ('UP', 'DOWN', 'FLAT');
CREATE TYPE "StrengthBand" AS ENUM ('WEAK', 'MED', 'STRONG');
CREATE TYPE "LagBand" AS ENUM ('IMMEDIATE', 'M3_6', 'M6_18', 'M18_PLUS');
CREATE TYPE "SizingBand" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');
CREATE TYPE "BranchName" AS ENUM ('BASE', 'BULL', 'BEAR');
CREATE TYPE "UniverseAssetType" AS ENUM ('EQUITY', 'ETF');
CREATE TYPE "IndicatorSupportDirection" AS ENUM ('HIGHER_SUPPORTS', 'LOWER_SUPPORTS');

-- Theme / holding extensions
ALTER TABLE "themes" ADD COLUMN "run_status" "RunStatus" NOT NULL DEFAULT 'UNASSESSED';
ALTER TABLE "themes" ADD COLUMN "portfolio_scenario_id" TEXT;
ALTER TABLE "holdings" ADD COLUMN "constraint" "HoldingConstraint" NOT NULL DEFAULT 'FREE';
ALTER TABLE "holdings" ADD COLUMN "purpose" "HoldingPurpose" NOT NULL DEFAULT 'LONG_TERM_GROWTH';
ALTER TABLE "scenario_holdings" ADD COLUMN "constraint" "HoldingConstraint" NOT NULL DEFAULT 'FREE';
ALTER TABLE "scenario_holdings" ADD COLUMN "purpose" "HoldingPurpose" NOT NULL DEFAULT 'LONG_TERM_GROWTH';

-- New decision tables
CREATE TABLE "theme_branches" (
  "id" TEXT NOT NULL,
  "theme_id" TEXT NOT NULL,
  "name" "BranchName" NOT NULL,
  "probability" DOUBLE PRECISION NOT NULL,
  "rationale" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "theme_branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "theme_node_shocks" (
  "id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "node_key" TEXT NOT NULL,
  "node_label" TEXT NOT NULL,
  "direction" "ShockDirection" NOT NULL,
  "magnitude_pct" DOUBLE PRECISION NOT NULL,
  "strength" "StrengthBand" NOT NULL,
  "lag" "LagBand" NOT NULL,
  "confidence" "ConfidenceLevel" NOT NULL,
  "evidence_note" TEXT NOT NULL,
  CONSTRAINT "theme_node_shocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expression_recommendations" (
  "id" TEXT NOT NULL,
  "theme_id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "asset_type" "UniverseAssetType" NOT NULL,
  "direction" "ImpactDirection" NOT NULL,
  "action" TEXT NOT NULL,
  "sizing_band" "SizingBand" NOT NULL,
  "max_position_pct" DOUBLE PRECISION NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "mechanism" TEXT NOT NULL,
  "catalyst_window" TEXT NOT NULL,
  "priced_in_note" TEXT NOT NULL,
  "risk_note" TEXT NOT NULL,
  "invalidation_trigger" TEXT NOT NULL,
  "portfolio_role" TEXT NOT NULL,
  "actionable" BOOLEAN NOT NULL DEFAULT true,
  "already_expressed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "expression_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_universe_versions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_universe_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_exposures" (
  "id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "company_name" TEXT NOT NULL,
  "asset_type" "UniverseAssetType" NOT NULL,
  "region" TEXT,
  "currency" TEXT,
  "liquidity_class" TEXT NOT NULL,
  "max_position_default_pct" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
  "tags" JSONB NOT NULL,
  "exposure_vector" JSONB NOT NULL,
  CONSTRAINT "company_exposures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "indicator_definitions" (
  "id" TEXT NOT NULL,
  "theme_id" TEXT NOT NULL,
  "indicator_name" TEXT NOT NULL,
  "source_type" "TrackingMode" NOT NULL DEFAULT 'MANUAL',
  "supports_direction" "IndicatorSupportDirection" NOT NULL,
  "green_threshold" DOUBLE PRECISION NOT NULL,
  "yellow_threshold" DOUBLE PRECISION NOT NULL,
  "red_threshold" DOUBLE PRECISION NOT NULL,
  "expected_window" TEXT NOT NULL,
  CONSTRAINT "indicator_definitions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "company_universe_versions_user_id_idx" ON "company_universe_versions"("user_id");
CREATE INDEX "company_exposures_version_id_idx" ON "company_exposures"("version_id");

-- Foreign keys
ALTER TABLE "themes"
  ADD CONSTRAINT "themes_portfolio_scenario_id_fkey"
  FOREIGN KEY ("portfolio_scenario_id") REFERENCES "portfolio_scenarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "theme_branches"
  ADD CONSTRAINT "theme_branches_theme_id_fkey"
  FOREIGN KEY ("theme_id") REFERENCES "themes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "theme_node_shocks"
  ADD CONSTRAINT "theme_node_shocks_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "theme_branches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expression_recommendations"
  ADD CONSTRAINT "expression_recommendations_theme_id_fkey"
  FOREIGN KEY ("theme_id") REFERENCES "themes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_universe_versions"
  ADD CONSTRAINT "company_universe_versions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_exposures"
  ADD CONSTRAINT "company_exposures_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "company_universe_versions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "indicator_definitions"
  ADD CONSTRAINT "indicator_definitions_theme_id_fkey"
  FOREIGN KEY ("theme_id") REFERENCES "themes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
