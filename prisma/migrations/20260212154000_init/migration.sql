-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statement" TEXT NOT NULL,
    "probability" REAL NOT NULL,
    "horizon_months" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "theme_effects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "theme_id" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact_direction" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    CONSTRAINT "theme_effects_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "theme_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "weight" REAL,
    "sensitivity" TEXT NOT NULL,
    "exposure_tags" JSON NOT NULL,
    CONSTRAINT "holdings_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "portfolio_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "theme_id" TEXT NOT NULL,
    "holding_id" TEXT NOT NULL,
    "exposure_type" TEXT NOT NULL,
    "net_impact" TEXT NOT NULL,
    "mechanism" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    CONSTRAINT "portfolio_mappings_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "portfolio_mappings_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invalidation_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "theme_id" TEXT NOT NULL,
    "assumption" TEXT NOT NULL,
    "breakpoint_signal" TEXT NOT NULL,
    "indicator_name" TEXT NOT NULL,
    "indicator_tracking_mode" TEXT NOT NULL DEFAULT 'MANUAL',
    "latest_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "latest_note" TEXT,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "invalidation_items_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "themes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "run_snapshots" (
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
