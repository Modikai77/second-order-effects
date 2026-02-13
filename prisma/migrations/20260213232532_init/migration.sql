/*
  Warnings:

  - You are about to drop the column `user_id` on the `accounts` table. All the data in the column will be lost.
  - You are about to alter the column `exposure_tags` on the `holdings` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.
  - You are about to alter the column `raw_output_json` on the `run_snapshots` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.
  - You are about to alter the column `exposure_tags` on the `scenario_holdings` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.
  - Added the required column `userId` to the `accounts` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_accounts" ("access_token", "expires_at", "id", "id_token", "provider", "provider_account_id", "refresh_token", "scope", "session_state", "token_type", "type") SELECT "access_token", "expires_at", "id", "id_token", "provider", "provider_account_id", "refresh_token", "scope", "session_state", "token_type", "type" FROM "accounts";
DROP TABLE "accounts";
ALTER TABLE "new_accounts" RENAME TO "accounts";
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");
CREATE TABLE "new_holdings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "theme_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "weight" REAL,
    "sensitivity" TEXT NOT NULL,
    "exposure_tags" JSONB NOT NULL,
    CONSTRAINT "holdings_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_holdings" ("exposure_tags", "id", "name", "sensitivity", "theme_id", "ticker", "weight") SELECT "exposure_tags", "id", "name", "sensitivity", "theme_id", "ticker", "weight" FROM "holdings";
DROP TABLE "holdings";
ALTER TABLE "new_holdings" RENAME TO "holdings";
CREATE TABLE "new_portfolio_scenarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "user_id" TEXT,
    CONSTRAINT "portfolio_scenarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_portfolio_scenarios" ("created_at", "id", "name", "updated_at", "user_id") SELECT "created_at", "id", "name", "updated_at", "user_id" FROM "portfolio_scenarios";
DROP TABLE "portfolio_scenarios";
ALTER TABLE "new_portfolio_scenarios" RENAME TO "portfolio_scenarios";
CREATE INDEX "portfolio_scenarios_user_id_idx" ON "portfolio_scenarios"("user_id");
CREATE TABLE "new_run_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "theme_id" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "raw_output_json" JSONB NOT NULL,
    "computed_bias_score" REAL NOT NULL,
    "bias_label" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "run_snapshots_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_run_snapshots" ("bias_label", "computed_bias_score", "created_at", "id", "model_name", "prompt_version", "raw_output_json", "theme_id") SELECT "bias_label", "computed_bias_score", "created_at", "id", "model_name", "prompt_version", "raw_output_json", "theme_id" FROM "run_snapshots";
DROP TABLE "run_snapshots";
ALTER TABLE "new_run_snapshots" RENAME TO "run_snapshots";
CREATE TABLE "new_scenario_holdings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenario_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "weight" REAL,
    "sensitivity" TEXT NOT NULL,
    "exposure_tags" JSONB NOT NULL,
    "order_index" INTEGER NOT NULL,
    CONSTRAINT "scenario_holdings_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "portfolio_scenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_scenario_holdings" ("exposure_tags", "id", "name", "order_index", "scenario_id", "sensitivity", "ticker", "weight") SELECT "exposure_tags", "id", "name", "order_index", "scenario_id", "sensitivity", "ticker", "weight" FROM "scenario_holdings";
DROP TABLE "scenario_holdings";
ALTER TABLE "new_scenario_holdings" RENAME TO "scenario_holdings";
CREATE TABLE "new_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sessions" ("expires", "id", "session_token", "user_id") SELECT "expires", "id", "session_token", "user_id" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");
CREATE TABLE "new_themes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statement" TEXT NOT NULL,
    "probability" REAL NOT NULL,
    "horizon_months" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "user_id" TEXT,
    CONSTRAINT "themes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_themes" ("created_at", "horizon_months", "id", "probability", "statement", "updated_at", "user_id") SELECT "created_at", "horizon_months", "id", "probability", "statement", "updated_at", "user_id" FROM "themes";
DROP TABLE "themes";
ALTER TABLE "new_themes" RENAME TO "themes";
CREATE INDEX "themes_user_id_idx" ON "themes"("user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
