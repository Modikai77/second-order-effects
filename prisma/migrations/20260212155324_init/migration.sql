/*
  Warnings:

  - You are about to alter the column `exposure_tags` on the `holdings` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.
  - You are about to alter the column `raw_output_json` on the `run_snapshots` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_holdings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "theme_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "weight" REAL,
    "sensitivity" TEXT NOT NULL,
    "exposure_tags" JSON NOT NULL,
    CONSTRAINT "holdings_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_holdings" ("exposure_tags", "id", "name", "sensitivity", "theme_id", "ticker", "weight") SELECT "exposure_tags", "id", "name", "sensitivity", "theme_id", "ticker", "weight" FROM "holdings";
DROP TABLE "holdings";
ALTER TABLE "new_holdings" RENAME TO "holdings";
CREATE TABLE "new_run_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "theme_id" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "raw_output_json" JSON NOT NULL,
    "computed_bias_score" REAL NOT NULL,
    "bias_label" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "run_snapshots_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_run_snapshots" ("bias_label", "computed_bias_score", "created_at", "id", "model_name", "prompt_version", "raw_output_json", "theme_id") SELECT "bias_label", "computed_bias_score", "created_at", "id", "model_name", "prompt_version", "raw_output_json", "theme_id" FROM "run_snapshots";
DROP TABLE "run_snapshots";
ALTER TABLE "new_run_snapshots" RENAME TO "run_snapshots";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
