-- CreateEnum
CREATE TYPE "ImpactDirection" AS ENUM ('POS', 'NEG', 'MIXED', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MED', 'HIGH');

-- CreateEnum
CREATE TYPE "EffectLayer" AS ENUM ('FIRST', 'SECOND', 'THIRD', 'FOURTH');

-- CreateEnum
CREATE TYPE "SensitivityLevel" AS ENUM ('LOW', 'MED', 'HIGH');

-- CreateEnum
CREATE TYPE "TrackingMode" AS ENUM ('MANUAL');

-- CreateEnum
CREATE TYPE "IndicatorStatus" AS ENUM ('GREEN', 'YELLOW', 'RED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BiasLabel" AS ENUM ('STRONG_NEG', 'NEG', 'NEUTRAL', 'POS', 'STRONG_POS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "horizon_months" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme_effects" (
    "id" TEXT NOT NULL,
    "theme_id" TEXT NOT NULL,
    "layer" "EffectLayer" NOT NULL,
    "description" TEXT NOT NULL,
    "impact_direction" "ImpactDirection" NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "theme_effects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" TEXT NOT NULL,
    "theme_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "weight" DOUBLE PRECISION,
    "sensitivity" "SensitivityLevel" NOT NULL,
    "exposure_tags" JSONB NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_mappings" (
    "id" TEXT NOT NULL,
    "theme_id" TEXT NOT NULL,
    "holding_id" TEXT NOT NULL,
    "exposure_type" TEXT NOT NULL,
    "net_impact" "ImpactDirection" NOT NULL,
    "mechanism" TEXT NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,

    CONSTRAINT "portfolio_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invalidation_items" (
    "id" TEXT NOT NULL,
    "theme_id" TEXT NOT NULL,
    "assumption" TEXT NOT NULL,
    "breakpoint_signal" TEXT NOT NULL,
    "indicator_name" TEXT NOT NULL,
    "indicator_tracking_mode" "TrackingMode" NOT NULL DEFAULT 'MANUAL',
    "latest_status" "IndicatorStatus" NOT NULL DEFAULT 'UNKNOWN',
    "latest_note" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invalidation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_snapshots" (
    "id" TEXT NOT NULL,
    "theme_id" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "raw_output_json" JSONB NOT NULL,
    "computed_bias_score" DOUBLE PRECISION NOT NULL,
    "bias_label" "BiasLabel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_scenarios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "portfolio_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_holdings" (
    "id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "weight" DOUBLE PRECISION,
    "sensitivity" "SensitivityLevel" NOT NULL,
    "exposure_tags" JSONB NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "scenario_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "themes_user_id_idx" ON "themes"("user_id");

-- CreateIndex
CREATE INDEX "portfolio_scenarios_user_id_idx" ON "portfolio_scenarios"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme_effects" ADD CONSTRAINT "theme_effects_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_mappings" ADD CONSTRAINT "portfolio_mappings_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_mappings" ADD CONSTRAINT "portfolio_mappings_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invalidation_items" ADD CONSTRAINT "invalidation_items_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_snapshots" ADD CONSTRAINT "run_snapshots_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_scenarios" ADD CONSTRAINT "portfolio_scenarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_holdings" ADD CONSTRAINT "scenario_holdings_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "portfolio_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
